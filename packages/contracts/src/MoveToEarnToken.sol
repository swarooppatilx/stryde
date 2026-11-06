// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IMoveToEarnToken} from "./interfaces/IMoveToEarnToken.sol";

/// @notice Move-to-earn ERC-20 reward token. Minted per completed activity,
/// proportional to distance traveled, deduped by the same activityHash
/// ActivityRegistry.recordActivity uses.
contract MoveToEarnToken is IMoveToEarnToken, ERC20, Ownable2Step, Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @dev wei-per-meter. Default 1e15 => 1e18 (1 STRD) per 1000 meters.
    uint256 public rewardPerMeter = 1e15;

    /// @dev 100x the default. The rate takes effect on the next mint, so a stolen or mistaken admin key
    /// could otherwise set it high enough to mint an unbounded amount in one transaction.
    uint256 public constant MAX_REWARD_PER_METER = 1e17;

    mapping(bytes32 => bool) private _rewarded;

    constructor() ERC20("Stryde", "STRD") Ownable(msg.sender) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function setRewardPerMeter(uint256 newRate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newRate > MAX_REWARD_PER_METER) revert RewardRateTooHigh();
        uint256 oldRate = rewardPerMeter;
        rewardPerMeter = newRate;
        emit RewardPerMeterUpdated(oldRate, newRate);
    }

    /// @dev Pausing and the reward rate are one authority: when ownership moves to a new owner, so does the
    /// admin role, so the old owner cannot keep changing the rate or granting minters. Roles other than
    /// admin stay as they are, because the relayer's minting must not stop with a handover.
    function _transferOwnership(address newOwner) internal override {
        address previous = owner();
        super._transferOwnership(newOwner);
        if (previous != newOwner) {
            if (previous != address(0)) _revokeRole(DEFAULT_ADMIN_ROLE, previous);
            if (newOwner != address(0)) _grantRole(DEFAULT_ADMIN_ROLE, newOwner);
        }
    }

    function mintForActivity(address recipient, bytes32 activityHash, uint256 distance)
        external
        whenNotPaused
        onlyRole(MINTER_ROLE)
        returns (uint256)
    {
        if (recipient == address(0)) revert ZeroAddress();
        if (activityHash == bytes32(0)) revert EmptyActivityHash();
        if (distance == 0) revert ZeroDistance();
        if (_rewarded[activityHash]) revert DuplicateActivityHash();

        _rewarded[activityHash] = true;
        uint256 amount = distance * rewardPerMeter;
        _mint(recipient, amount);

        emit ActivityRewarded(recipient, activityHash, distance, amount);
        return amount;
    }

    function isRewarded(bytes32 activityHash) external view override returns (bool) {
        return _rewarded[activityHash];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
