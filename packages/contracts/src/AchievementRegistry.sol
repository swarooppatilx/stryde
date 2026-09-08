// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IAchievementRegistry} from "./interfaces/IAchievementRegistry.sol";

contract AchievementRegistry is IAchievementRegistry, ERC721, Ownable, Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    event BaseURIUpdated(string oldURI, string newURI);

    string public baseURI;
    uint256 private _nextTokenId = 1;
    mapping(bytes32 => Achievement) private _achievements;
    mapping(uint256 => bytes32) private _tokenAchievement;
    mapping(address => uint256[]) private _userTokens;
    mapping(address => mapping(bytes32 => bool)) private _hasMinted;

    constructor() ERC721("StrydeAchievement", "SACH") Ownable(msg.sender) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        baseURI = "ipfs://stryde/";
    }

    function setBaseURI(string calldata uri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        string memory oldURI = baseURI;
        baseURI = uri;
        emit BaseURIUpdated(oldURI, uri);
    }

    function defineAchievement(bytes32 achievementId, string calldata name) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bytes(name).length == 0) revert EmptyAchievement();

        _achievements[achievementId] = Achievement({name: name, exists: true});
        emit AchievementDefined(achievementId, name);
    }

    function defineAchievement(uint256 achievementId, string calldata name, string calldata) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bytes(name).length == 0) revert EmptyAchievement();

        bytes32 id = bytes32(achievementId);
        _achievements[id] = Achievement({name: name, exists: true});
        emit AchievementDefined(id, name);
    }

    function mintAchievement(address recipient, bytes32 achievementId) external whenNotPaused onlyRole(MINTER_ROLE) {
        if (recipient == address(0)) revert ZeroAddress();
        Achievement storage achievement = _achievements[achievementId];
        if (!achievement.exists) revert EmptyAchievement();
        if (_hasMinted[recipient][achievementId]) revert AlreadyMinted();

        uint256 tokenId = _nextTokenId++;
        _hasMinted[recipient][achievementId] = true;
        _mint(recipient, tokenId);
        _tokenAchievement[tokenId] = achievementId;
        _userTokens[recipient].push(tokenId);

        emit AchievementMinted(tokenId, recipient, achievementId);
    }

    function mintAchievement(address to, uint256 achievementId, bytes32 activityHash) external whenNotPaused onlyRole(MINTER_ROLE) returns (uint256) {
        if (to == address(0)) revert ZeroAddress();
        bytes32 id = bytes32(achievementId);
        Achievement storage achievement = _achievements[id];
        if (!achievement.exists) revert EmptyAchievement();

        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        _tokenAchievement[tokenId] = id;
        _userTokens[to].push(tokenId);

        emit AchievementMinted(tokenId, to, id);
        return tokenId;
    }

    function getAchievement(bytes32 achievementId) external view override returns (Achievement memory) {
        return _achievements[achievementId];
    }

    function getTokenCount(address recipient) external view override returns (uint256) {
        return _userTokens[recipient].length;
    }

    function getTokenIds(address recipient) external view override returns (uint256[] memory) {
        return _userTokens[recipient];
    }

    function getTokenAchievement(uint256 tokenId) external view override returns (bytes32) {
        return _tokenAchievement[tokenId];
    }

    function hasMinted(address recipient, bytes32 achievementId) external view override returns (bool) {
        return _hasMinted[recipient][achievementId];
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, IAchievementRegistry) returns (string memory) {
        _requireOwned(tokenId);
        bytes32 achievementId = _tokenAchievement[tokenId];
        return string(abi.encodePacked(baseURI, Strings.toHexString(uint256(achievementId))));
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert SoulboundTransfer();
        }
        return super._update(to, tokenId, auth);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
