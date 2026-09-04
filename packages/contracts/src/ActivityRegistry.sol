// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IActivityRegistry} from "./interfaces/IActivityRegistry.sol";

contract ActivityRegistry is IActivityRegistry, Ownable, Pausable {
    uint256 private _nextActivityId = 1;

    mapping(uint256 => bytes32) private _activityHash;
    mapping(uint256 => address) private _activityOwner;
    mapping(uint256 => uint256) private _activityTimestamp;
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

        activityId = _nextActivityId++;
        _activityHash[activityId] = activityHash;
        _activityOwner[activityId] = msg.sender;
        _activityTimestamp[activityId] = block.timestamp;
        _activitiesByUser[msg.sender].push(activityId);
        _hashUsed[activityHash] = true;

        emit ActivityRecorded(
            activityId, msg.sender, activityHash, activityType, distance, duration, block.timestamp, territoryArea
        );
    }

    function getActivityHash(uint256 activityId) external view override returns (bytes32) {
        return _activityHash[activityId];
    }

    function getActivityOwner(uint256 activityId) external view override returns (address) {
        return _activityOwner[activityId];
    }

    function getActivityTimestamp(uint256 activityId) external view override returns (uint256) {
        return _activityTimestamp[activityId];
    }

    function getActivityCount(address user) external view override returns (uint256) {
        return _activitiesByUser[user].length;
    }

    function getUserActivityIds(address user) external view override returns (uint256[] memory) {
        return _activitiesByUser[user];
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
