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
    mapping(uint256 => string) private _usernameOf;
    mapping(address => bool) private _verified;

    /// @dev Address authorized to call verify() — the backend's relayer
    /// wallet, which calls this after a confirmed World ID Selfie Check.
    /// A single settable address (rather than AccessControl) to keep this
    /// consistent with this contract's existing plain-Ownable style.
    address public verifierAddress;

    modifier onlyVerifier() {
        if (msg.sender != verifierAddress) revert NotAuthorizedVerifier();
        _;
    }

    constructor() Ownable(msg.sender) {
        verifierAddress = msg.sender;
    }

    function register(string calldata username) external override whenNotPaused returns (uint256 profileId) {
        if (_profileIdOf[msg.sender] != 0) revert AlreadyRegistered();
        if (bytes(username).length == 0) revert EmptyUsername();
        if (bytes(username).length > 32) revert UsernameTooLong();
        if (_usernameTaken[username]) revert UsernameTaken();

        unchecked { profileId = _nextProfileId++; }
        _profileIdOf[msg.sender] = profileId;
        _walletOf[profileId] = msg.sender;
        _usernameTaken[username] = true;
        _usernameOf[profileId] = username;

        emit ProfileCreated(profileId, msg.sender, username, block.timestamp);
    }

    function setAvatar(string calldata cid) external override whenNotPaused {
        if (_profileIdOf[msg.sender] == 0) revert NotRegistered();
        emit AvatarUpdated(msg.sender, cid);
    }

    function setUsername(string calldata newUsername) external whenNotPaused override {
        uint256 profileId = _profileIdOf[msg.sender];
        if (profileId == 0) revert NotRegistered();
        if (bytes(newUsername).length == 0) revert EmptyUsername();
        if (bytes(newUsername).length > 32) revert UsernameTooLong();
        if (_usernameTaken[newUsername]) revert UsernameTaken();

        string memory oldUsername = _usernameOf[profileId];
        if (bytes(oldUsername).length > 0) {
            _usernameTaken[oldUsername] = false;
        }
        _usernameTaken[newUsername] = true;
        _usernameOf[profileId] = newUsername;

        emit ProfileUpdated(profileId, newUsername);
    }

    function isRegistered(address wallet) external view override returns (bool) {
        return _profileIdOf[wallet] != 0;
    }

    function getProfileId(address wallet) external view override returns (uint256) {
        uint256 profileId = _profileIdOf[wallet];
        if (profileId == 0) revert NotRegistered();
        return profileId;
    }

    function getWallet(uint256 profileId) external view override returns (address) {
        address wallet = _walletOf[profileId];
        if (wallet == address(0)) revert NotRegistered();
        return wallet;
    }

    function totalProfiles() external view override returns (uint256) {
        return _nextProfileId - 1;
    }

    function verify(address wallet, bytes32 nullifierHash) external override onlyVerifier {
        if (_verified[wallet]) revert AlreadyVerified();
        _verified[wallet] = true;
        emit ProfileVerified(wallet, nullifierHash, block.timestamp);
    }

    function isVerified(address wallet) external view override returns (bool) {
        return _verified[wallet];
    }

    function setVerifier(address newVerifier) external override onlyOwner {
        verifierAddress = newVerifier;
        emit VerifierUpdated(newVerifier);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
