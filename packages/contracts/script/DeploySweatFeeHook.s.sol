// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {HookMiner} from "v4-periphery/test/shared/HookMiner.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {LiquidityAmounts} from "v4-core/test/utils/LiquidityAmounts.sol";
import {SweatFeeHook} from "../src/hooks/SweatFeeHook.sol";
import {IProfileRegistry} from "../src/interfaces/IProfileRegistry.sol";
import {IActivityRegistry} from "../src/interfaces/IActivityRegistry.sol";

interface IStrdMinter {
    function mintForActivity(address recipient, bytes32 activityHash, uint256 distance) external returns (uint256);
    function rewardPerMeter() external view returns (uint256);
}

/// @notice Mines a hook address, deploys SweatFeeHook, initializes the ETH/STRD dynamic-fee
/// pool at 1 ETH = 10,000 STRD and seeds full-range liquidity.
///
/// Env: PRIVATE_KEY (STRD admin/minter), PASS_SIGNER (relayer address, defaults to deployer),
/// SEED_ETH (wei, default 0.02 ether), optional overrides for every address below.
contract DeploySweatFeeHook is Script {
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    int24 constant TICK_SPACING = 60;
    uint256 constant STRD_PER_ETH = 10_000;
    uint160 constant SQRT_PRICE_10000 = uint160(100 * 2 ** 96);

    struct Config {
        uint256 pk;
        address deployer;
        IPoolManager manager;
        PoolModifyLiquidityTest lpRouter;
        address profiles;
        address activities;
        address strd;
        address passSigner;
        uint256 seedEth;
    }

    function _config() internal view returns (Config memory cfg) {
        cfg.pk = vm.envUint("PRIVATE_KEY");
        cfg.deployer = vm.addr(cfg.pk);
        cfg.manager = IPoolManager(vm.envOr("POOL_MANAGER", address(0xE03A1074c86CFeDd5C142C4F04F1a1536e203543)));
        cfg.lpRouter = PoolModifyLiquidityTest(
            vm.envOr("POOL_MODIFY_LIQUIDITY_TEST", address(0x0C478023803a644c94c4CE1C1e7b9A087e411B0A))
        );
        cfg.profiles = vm.envOr("PROFILE_REGISTRY", address(0x348CE6aF8eA0C50fb44F284dCCA73b7EE5112314));
        cfg.activities = vm.envOr("ACTIVITY_REGISTRY", address(0x30a910fc25F0977907Af86345c0B26C34e7d2439));
        cfg.strd = vm.envOr("STRD_TOKEN", address(0x6Cc5211470De17d69B3208e26B08fFAD0b6260F6));
        cfg.passSigner = vm.envOr("PASS_SIGNER", cfg.deployer);
        cfg.seedEth = vm.envOr("SEED_ETH", uint256(0.02 ether));
    }

    function run() external {
        Config memory cfg = _config();

        bytes memory args = abi.encode(
            cfg.manager, cfg.profiles, cfg.activities, Currency.wrap(cfg.strd), cfg.passSigner, cfg.deployer
        );
        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG),
            type(SweatFeeHook).creationCode,
            args
        );

        vm.startBroadcast(cfg.pk);
        SweatFeeHook hook = new SweatFeeHook{salt: salt}(
            cfg.manager,
            IProfileRegistry(cfg.profiles),
            IActivityRegistry(cfg.activities),
            Currency.wrap(cfg.strd),
            cfg.passSigner,
            cfg.deployer
        );
        require(address(hook) == hookAddress, "hook address mismatch");
        _ensureStrd(cfg);
        uint128 liquidity = _initAndSeed(cfg, hook);
        vm.stopBroadcast();

        console.log("SweatFeeHook deployed at:", address(hook));
        console.log("Pass signer:", cfg.passSigner);
        console.log("Seeded liquidity:", liquidity);
    }

    function _ensureStrd(Config memory cfg) internal {
        uint256 needed = cfg.seedEth * STRD_PER_ETH;
        uint256 balance = IERC20(cfg.strd).balanceOf(cfg.deployer);
        if (balance >= needed) return;
        uint256 meters = (needed - balance) / IStrdMinter(cfg.strd).rewardPerMeter() + 1;
        IStrdMinter(cfg.strd).mintForActivity(
            cfg.deployer, keccak256(abi.encode("stryde-lp-seed", block.timestamp)), meters
        );
    }

    function _initAndSeed(Config memory cfg, SweatFeeHook hook) internal returns (uint128 liquidity) {
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(cfg.strd),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(hook))
        });
        cfg.manager.initialize(key, SQRT_PRICE_10000);

        int24 tickLower = TickMath.minUsableTick(TICK_SPACING);
        int24 tickUpper = TickMath.maxUsableTick(TICK_SPACING);
        liquidity = LiquidityAmounts.getLiquidityForAmounts(
            SQRT_PRICE_10000,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            cfg.seedEth,
            cfg.seedEth * STRD_PER_ETH
        );
        IERC20(cfg.strd).approve(address(cfg.lpRouter), type(uint256).max);
        cfg.lpRouter.modifyLiquidity{value: cfg.seedEth + 1e12}(
            key,
            ModifyLiquidityParams({
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: int256(uint256(liquidity)),
                salt: bytes32(0)
            }),
            ""
        );
    }
}
