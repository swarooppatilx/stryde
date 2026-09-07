// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISeasonManager {
    // Events
    event SeasonStarted(uint256 indexed seasonId, uint256 startTime, uint256 endTime);
    event SeasonEnded(uint256 indexed seasonId, uint256 endTime, uint256 participantCount);
    event ContributionRecorded(
        uint256 indexed seasonId, address indexed participant, uint256 contribution, uint256 total
    );

    // Errors
    error ZeroAddress();
    error SeasonNotActive();
    error SeasonAlreadyActive();
    error InvalidDuration();
    error InvalidSeason();

    // Structs
    struct Season {
        uint256 id;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
    }

    // View functions
    function getCurrentSeason() external view returns (Season memory);
    function getSeason(uint256 seasonId) external view returns (Season memory);
    function getSeasonCount() external view returns (uint256);
    function getParticipantContribution(uint256 seasonId, address participant) external view returns (uint256);
    function getTotalContribution(uint256 seasonId) external view returns (uint256);
    function getParticipantCount(uint256 seasonId) external view returns (uint256);

    // Write functions
    function startSeason(uint256 duration) external;
    function endSeason() external;
    function recordContribution(address participant, uint256 amount) external;
}
