// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IProfileRegistry {
    // Events
    event ProfileCreated(uint256 indexed profileId, address indexed wallet, string username, uint256 joinedAt);
    event ProfileUpdated(uint256 indexed profileId, string username);
    event AvatarUpdated(address indexed wallet, string cid);

    // Errors
    error AlreadyRegistered();
    error NotRegistered();
    error EmptyUsername();
    error UsernameTooLong();
    error UsernameTaken();

    // Functions
    function register(string calldata username) external returns (uint256 profileId);
    function setAvatar(string calldata cid) external;
    function setUsername(string calldata newUsername) external;
    function isRegistered(address wallet) external view returns (bool);
    function getProfileId(address wallet) external view returns (uint256);
    function getWallet(uint256 profileId) external view returns (address);
    function totalProfiles() external view returns (uint256);
}
