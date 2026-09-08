// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAchievementRegistry {
    // Events
    event AchievementMinted(uint256 indexed tokenId, address indexed recipient, bytes32 indexed achievementId);
    event AchievementDefined(bytes32 indexed achievementId, string name);

    // Errors
    error ZeroAddress();
    error EmptyAchievement();
    error SoulboundTransfer();
    error AlreadyMinted();

    // Struct
    struct Achievement {
        string name;
        bool exists;
    }

    // View functions
    function getAchievement(bytes32 achievementId) external view returns (Achievement memory);
    function getTokenCount(address recipient) external view returns (uint256);
    function getTokenIds(address recipient) external view returns (uint256[] memory);
    function getTokenAchievement(uint256 tokenId) external view returns (bytes32);
    function hasMinted(address recipient, bytes32 achievementId) external view returns (bool);
}
