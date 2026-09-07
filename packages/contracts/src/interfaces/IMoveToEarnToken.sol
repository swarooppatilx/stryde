// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMoveToEarnToken {
    // Events
    event ActivityRewarded(address indexed recipient, bytes32 indexed activityHash, uint256 distance, uint256 amount);
    event RewardPerMeterUpdated(uint256 oldRate, uint256 newRate);

    // Errors
    error ZeroAddress();
    error EmptyActivityHash();
    error ZeroDistance();
    error DuplicateActivityHash();

    // View functions
    function isRewarded(bytes32 activityHash) external view returns (bool);
}
