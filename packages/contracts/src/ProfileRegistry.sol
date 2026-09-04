// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IProfileRegistry} from "./interfaces/IProfileRegistry.sol";

contract ProfileRegistry is IProfileRegistry, Ownable, Pausable {
    uint256 private _nextProfileId = 1;

    mapping(address => uint256) private _profileIdOf;
    mapping(uint256 => address) private _walletOf;
    mapping(string => bool) private _usernameTaken;

    constructor() Ownable(msg.sender) {}

    function register(string calldata username) external override whenNotPaused returns (uint256 profileId) {
        if (_profileIdOf[msg.sender] != 0) revert AlreadyRegistered();
        if (bytes(username).length == 0) revert EmptyUsername();
        if (_usernameTaken[username]) revert UsernameTaken();

        profileId = _nextProfileId++;
        _profileIdOf[msg.sender] = profileId;
        _walletOf[profileId] = msg.sender;
        _usernameTaken[username] = true;

        emit ProfileCreated(profileId, msg.sender, username, block.timestamp);
    }

    function isRegistered(address wallet) external view override returns (bool) {
        return _profileIdOf[wallet] != 0;
    }

    function getProfileId(address wallet) external view override returns (uint256) {
        if (_profileIdOf[wallet] == 0) revert NotRegistered();
        return _profileIdOf[wallet];
    }

    function getWallet(uint256 profileId) external view override returns (address) {
        address wallet = _walletOf[profileId];
        if (wallet == address(0)) revert NotRegistered();
        return wallet;
    }

    function totalProfiles() external view override returns (uint256) {
        return _nextProfileId - 1;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
