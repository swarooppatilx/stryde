// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Deployers} from "v4-core/test/utils/Deployers.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {SweatFeeHook} from "../src/hooks/SweatFeeHook.sol";
import {ProfileRegistry} from "../src/ProfileRegistry.sol";
import {ActivityRegistry} from "../src/ActivityRegistry.sol";
import {IProfileRegistry} from "../src/interfaces/IProfileRegistry.sol";
import {IActivityRegistry} from "../src/interfaces/IActivityRegistry.sol";

contract SweatFeeHookTest is Test, Deployers {
    SweatFeeHook hook;
    ProfileRegistry profiles;
    ActivityRegistry activities;

    uint256 signerPk = 0xA11CE;
    address signer;
    address athlete = makeAddr("athlete");

    function setUp() public {
        signer = vm.addr(signerPk);
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();

        profiles = new ProfileRegistry();
        activities = new ActivityRegistry();

        address hookAddress =
            address(uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG) | (uint160(0x5EA7) << 144));
        deployCodeTo(
            "SweatFeeHook.sol:SweatFeeHook",
            abi.encode(manager, profiles, activities, currency1, signer, address(this)),
            hookAddress
        );
        hook = SweatFeeHook(hookAddress);

        (key,) = initPool(currency0, currency1, IHooks(hookAddress), LPFeeLibrary.DYNAMIC_FEE_FLAG, SQRT_PRICE_1_1);
        modifyLiquidityRouter.modifyLiquidity(key, LIQUIDITY_PARAMS, ZERO_BYTES);
    }

    function _pass(address who, bytes32 nonce, uint256 deadline) internal view returns (bytes memory) {
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(
            hook.passDigest(who, address(swapRouter), deadline, nonce)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encode(SweatFeeHook.SweatPass(who, deadline, nonce, abi.encodePacked(r, s, v)));
    }

    function _verify(address who) internal {
        vm.prank(who);
        profiles.register(vm.toString(uint256(uint160(who)) % 1e12));
        profiles.verify(who, keccak256(abi.encode(who)));
    }

    function _recordActivity(address who) internal {
        vm.prank(who);
        activities.recordActivity(keccak256(abi.encode(who, block.timestamp)), 0, 5000, 1800, 0);
    }

    function _sellStrd(bytes memory hookData) internal returns (uint256 received) {
        BalanceDelta delta = swap(key, false, -1e15, hookData);
        received = uint256(uint128(delta.amount0()));
    }

    function test_feeTiers() public {
        (uint8 tier, uint24 fee) = hook.getFeeFor(athlete, true);
        assertEq(tier, hook.TIER_UNVERIFIED_SELL());
        assertEq(fee, 30_000);

        (tier, fee) = hook.getFeeFor(athlete, false);
        assertEq(tier, hook.TIER_BUY());
        assertEq(fee, 3000);

        _verify(athlete);
        (tier, fee) = hook.getFeeFor(athlete, true);
        assertEq(tier, hook.TIER_ATHLETE());
        assertEq(fee, 3000);

        _recordActivity(athlete);
        (tier, fee) = hook.getFeeFor(athlete, true);
        assertEq(tier, hook.TIER_ACTIVE_ATHLETE());
        assertEq(fee, 500);

        vm.warp(block.timestamp + 8 days);
        (tier,) = hook.getFeeFor(athlete, true);
        assertEq(tier, hook.TIER_ATHLETE());
    }

    function test_activeAthleteGetsMoreOutThanUnverifiedSeller() public {
        uint256 snapshot = vm.snapshotState();
        uint256 unverifiedOut = _sellStrd(ZERO_BYTES);
        vm.revertToState(snapshot);

        _verify(athlete);
        _recordActivity(athlete);
        vm.expectEmit(true, true, false, true, address(hook));
        emit SweatFeeHook.SweatSwap(athlete, address(swapRouter), true, 1, 500);
        uint256 athleteOut = _sellStrd(_pass(athlete, keccak256("n1"), block.timestamp + 300));

        assertGt(athleteOut, unverifiedOut);
    }

    function test_unverifiedSellerPaysHighFee() public {
        vm.expectEmit(true, true, false, true, address(hook));
        emit SweatFeeHook.SweatSwap(address(0), address(swapRouter), true, 4, 30_000);
        _sellStrd(ZERO_BYTES);
    }

    function test_passCannotBeReplayed() public {
        _verify(athlete);
        bytes memory pass = _pass(athlete, keccak256("n1"), block.timestamp + 300);
        _sellStrd(pass);
        vm.expectRevert();
        _sellStrd(pass);
        assertTrue(hook.usedPasses(keccak256("n1")));
    }

    function test_expiredPassReverts() public {
        _verify(athlete);
        bytes memory pass = _pass(athlete, keccak256("n2"), block.timestamp + 10);
        vm.warp(block.timestamp + 11);
        vm.expectRevert();
        _sellStrd(pass);
    }

    function test_forgedPassReverts() public {
        _verify(athlete);
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(
            hook.passDigest(athlete, address(swapRouter), block.timestamp + 300, keccak256("n3"))
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBAD, digest);
        bytes memory forged = abi.encode(
            SweatFeeHook.SweatPass(athlete, block.timestamp + 300, keccak256("n3"), abi.encodePacked(r, s, v))
        );
        vm.expectRevert();
        _sellStrd(forged);
    }

    function test_rejectsStaticFeePool() public {
        vm.expectRevert();
        initPool(currency0, currency1, IHooks(address(hook)), 3000, SQRT_PRICE_1_1);
    }

    function test_onlyOwnerCanChangeFees() public {
        vm.prank(athlete);
        vm.expectRevert();
        hook.setFees(1, 1, 1, 1);

        hook.setFees(100, 2000, 2500, 50_000);
        assertEq(hook.unverifiedSellFee(), 50_000);
        vm.expectRevert(SweatFeeHook.FeeTooHigh.selector);
        hook.setFees(100, 2000, 2500, 200_000);
    }
}
