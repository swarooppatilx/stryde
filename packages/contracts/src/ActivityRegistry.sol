// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IActivityRegistry} from "./interfaces/IActivityRegistry.sol";

contract ActivityRegistry is IActivityRegistry, Ownable, Pausable {
    uint256 private _nextActivityId = 1;

    struct Activity {
        bytes32 activityHash;
        address owner;
        uint256 timestamp;
    }

    mapping(uint256 => Activity) private _activities;
    mapping(address => uint256[]) private _activitiesByUser;
    mapping(bytes32 => bool) private _hashUsed;

    constructor() Ownable(msg.sender) {}

    function recordActivity(
        bytes32 activityHash,
        uint8 activityType,
        uint256 distance,
        uint256 duration,
        uint256 territoryArea
    ) external override whenNotPaused returns (uint256 activityId) {
        if (activityHash == bytes32(0)) revert ZeroHash();
        if (_hashUsed[activityHash]) revert DuplicateHash();
        if (activityType > 11) revert InvalidActivityType();

        unchecked { activityId = _nextActivityId++; }
        _activities[activityId] = Activity({activityHash: activityHash, owner: msg.sender, timestamp: block.timestamp});
        _activitiesByUser[msg.sender].push(activityId);
        _hashUsed[activityHash] = true;

        emit ActivityRecorded(
            activityId, msg.sender, activityHash, activityType, distance, duration, block.timestamp, territoryArea
        );
    }

    function getActivityHash(uint256 activityId) external view override returns (bytes32) {
        return _activities[activityId].activityHash;
    }

    function getActivityOwner(uint256 activityId) external view override returns (address) {
        return _activities[activityId].owner;
    }

    function getActivityTimestamp(uint256 activityId) external view override returns (uint256) {
        return _activities[activityId].timestamp;
    }

    function getActivity(uint256 activityId) external view override returns (bytes32 activityHash, address owner, uint256 timestamp) {
        Activity storage a = _activities[activityId];
        return (a.activityHash, a.owner, a.timestamp);
    }

    function getActivityCount(address user) external view override returns (uint256) {
        return _activitiesByUser[user].length;
    }

    function getUserActivityIds(address user, uint256 offset, uint256 limit) external view override returns (uint256[] memory) {
        uint256[] storage arr = _activitiesByUser[user];
        if (offset >= arr.length) {
            return new uint256[](0);
        }
        uint256 end = offset + limit;
        if (end > arr.length) {
            end = arr.length;
        }
        uint256 size = end - offset;
        uint256[] memory result = new uint256[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = arr[offset + i];
        }
        return result;
    }

    function totalActivities() external view override returns (uint256) {
        return _nextActivityId - 1;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
