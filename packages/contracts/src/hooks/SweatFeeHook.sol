// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {IProfileRegistry} from "../interfaces/IProfileRegistry.sol";
import {IActivityRegistry} from "../interfaces/IActivityRegistry.sol";

/// @title SweatFeeHook — "Proof-of-Sweat" dynamic fees for the STRD pool
/// @notice Swap fees depend on who is swapping: World-verified athletes who recently
/// recorded an activity pay the lowest fee, verified athletes pay the standard fee, and
/// unverified wallets dumping STRD pay a steep fee that accrues to LPs. The athlete is
/// identified by a short-lived pass signed by the Stryde relayer and carried in hookData,
/// because the swap `sender` is the router, not the user.
contract SweatFeeHook is IHooks, Ownable {
    using LPFeeLibrary for uint24;

    struct SweatPass {
        address athlete;
        uint256 deadline;
        bytes32 nonce;
        bytes signature;
    }

    uint8 public constant TIER_ACTIVE_ATHLETE = 1;
    uint8 public constant TIER_ATHLETE = 2;
    uint8 public constant TIER_BUY = 3;
    uint8 public constant TIER_UNVERIFIED_SELL = 4;

    IPoolManager public immutable poolManager;
    IProfileRegistry public immutable profiles;
    IActivityRegistry public immutable activities;
    Currency public immutable strd;

    address public passSigner;
    uint24 public activeAthleteFee = 500;
    uint24 public athleteFee = 3000;
    uint24 public buyFee = 3000;
    uint24 public unverifiedSellFee = 30_000;
    uint256 public activeWindow = 7 days;

    mapping(bytes32 nonce => bool used) public usedPasses;

    event SweatSwap(address indexed athlete, address indexed router, bool isSell, uint8 tier, uint24 fee);
    event PassSignerUpdated(address signer);
    event FeesUpdated(uint24 activeAthleteFee, uint24 athleteFee, uint24 buyFee, uint24 unverifiedSellFee);
    event ActiveWindowUpdated(uint256 window);

    error NotPoolManager();
    error HookNotImplemented();
    error PoolMustUseDynamicFee();
    error PoolMustIncludeStrd();
    error SweatPassExpired();
    error SweatPassUsed();
    error InvalidSweatPass();
    error FeeTooHigh();

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    constructor(
        IPoolManager _poolManager,
        IProfileRegistry _profiles,
        IActivityRegistry _activities,
        Currency _strd,
        address _passSigner,
        address _owner
    ) Ownable(_owner) {
        poolManager = _poolManager;
        profiles = _profiles;
        activities = _activities;
        strd = _strd;
        passSigner = _passSigner;
        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());
    }

    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ---------------------------------------------------------------------
    // Fee logic
    // ---------------------------------------------------------------------

    /// @notice Fee the given athlete would pay right now. `athlete == address(0)` means no pass.
    function getFeeFor(address athlete, bool isSell) public view returns (uint8 tier, uint24 fee) {
        if (athlete != address(0) && profiles.isVerified(athlete)) {
            if (isActive(athlete)) return (TIER_ACTIVE_ATHLETE, activeAthleteFee);
            return (TIER_ATHLETE, athleteFee);
        }
        if (isSell) return (TIER_UNVERIFIED_SELL, unverifiedSellFee);
        return (TIER_BUY, buyFee);
    }

    /// @notice True when the athlete's most recent onchain activity is inside the active window.
    function isActive(address athlete) public view returns (bool) {
        uint256 count = activities.getActivityCount(athlete);
        if (count == 0) return false;
        uint256[] memory ids = activities.getUserActivityIds(athlete, count - 1, 1);
        uint256 lastAt = activities.getActivityTimestamp(ids[0]);
        return block.timestamp <= lastAt + activeWindow;
    }

    /// @notice Digest the relayer signs (EIP-191) to issue a pass bound to one router, chain and hook.
    function passDigest(address athlete, address router, uint256 deadline, bytes32 nonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(block.chainid, address(this), athlete, router, deadline, nonce));
    }

    function _resolveAthlete(address router, bytes calldata hookData) internal returns (address) {
        if (hookData.length == 0) return address(0);
        SweatPass memory pass = abi.decode(hookData, (SweatPass));
        if (block.timestamp > pass.deadline) revert SweatPassExpired();
        if (usedPasses[pass.nonce]) revert SweatPassUsed();

        bytes32 digest =
            MessageHashUtils.toEthSignedMessageHash(passDigest(pass.athlete, router, pass.deadline, pass.nonce));
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, pass.signature);
        if (err != ECDSA.RecoverError.NoError || recovered != passSigner) revert InvalidSweatPass();

        usedPasses[pass.nonce] = true;
        return pass.athlete;
    }

    // ---------------------------------------------------------------------
    // Hook callbacks
    // ---------------------------------------------------------------------

    function beforeInitialize(address, PoolKey calldata key, uint160) external view onlyPoolManager returns (bytes4) {
        if (!key.fee.isDynamicFee()) revert PoolMustUseDynamicFee();
        if (!(key.currency0 == strd) && !(key.currency1 == strd)) revert PoolMustIncludeStrd();
        return IHooks.beforeInitialize.selector;
    }

    function beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        bool isSell = key.currency0 == strd ? params.zeroForOne : !params.zeroForOne;
        address athlete = _resolveAthlete(sender, hookData);
        (uint8 tier, uint24 fee) = getFeeFor(athlete, isSell);
        emit SweatSwap(athlete, sender, isSell, tier, fee);
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function setPassSigner(address signer) external onlyOwner {
        passSigner = signer;
        emit PassSignerUpdated(signer);
    }

    function setFees(uint24 _activeAthleteFee, uint24 _athleteFee, uint24 _buyFee, uint24 _unverifiedSellFee)
        external
        onlyOwner
    {
        if (_unverifiedSellFee > 100_000 || _athleteFee > 100_000 || _buyFee > 100_000 || _activeAthleteFee > 100_000)
        {
            revert FeeTooHigh();
        }
        activeAthleteFee = _activeAthleteFee;
        athleteFee = _athleteFee;
        buyFee = _buyFee;
        unverifiedSellFee = _unverifiedSellFee;
        emit FeesUpdated(_activeAthleteFee, _athleteFee, _buyFee, _unverifiedSellFee);
    }

    function setActiveWindow(uint256 window) external onlyOwner {
        activeWindow = window;
        emit ActiveWindowUpdated(window);
    }

    // ---------------------------------------------------------------------
    // Unused callbacks
    // ---------------------------------------------------------------------

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        revert HookNotImplemented();
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        revert HookNotImplemented();
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function afterSwap(address, PoolKey calldata, SwapParams calldata, BalanceDelta, bytes calldata)
        external
        pure
        returns (bytes4, int128)
    {
        revert HookNotImplemented();
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        revert HookNotImplemented();
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        revert HookNotImplemented();
    }
}
