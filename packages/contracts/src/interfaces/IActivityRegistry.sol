// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IActivityRegistry {
    // Events
    event ActivityRecorded(
        uint256 indexed activityId,
        address indexed owner,
        bytes32 indexed activityHash,
        uint8 activityType,
        uint256 distance,
        uint256 duration,
        uint256 timestamp,
        uint256 territoryArea
    );

    // Errors
    error ZeroHash();
    error DuplicateHash();

    // Functions
    function recordActivity(
        bytes32 activityHash,
        uint8 activityType,
        uint256 distance,
        uint256 duration,
        uint256 territoryArea
    ) external returns (uint256 activityId);

    function getActivityHash(uint256 activityId) external view returns (bytes32);
    function getActivityOwner(uint256 activityId) external view returns (address);
    function getActivityTimestamp(uint256 activityId) external view returns (uint256);
    function getActivityCount(address user) external view returns (uint256);
    function getUserActivityIds(address user) external view returns (uint256[] memory);
    function totalActivities() external view returns (uint256);
}
