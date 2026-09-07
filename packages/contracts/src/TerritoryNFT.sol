// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ITerritoryNFT} from "./interfaces/ITerritoryNFT.sol";

/// @notice Soulbound ERC-721 mirroring TerritoryRegistry's captured-territory state.
/// Minted when a user claims a territory, burned when that territory is lost to decay.
/// tokenId is `uint256(polygonHash)` directly — TerritoryRegistry's own identifier —
/// so no separate id/hash mapping is needed.
contract TerritoryNFT is ITerritoryNFT, ERC721, Ownable, Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    string public baseURI;
    mapping(address => uint256[]) private _userTokens;
    mapping(uint256 => uint256) private _tokenIndex;

    constructor() ERC721("StrydeTerritory", "STER") Ownable(msg.sender) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        baseURI = "ipfs://stryde/territory/";
    }

    function setBaseURI(string calldata uri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        baseURI = uri;
    }

    function mintTerritory(address recipient, bytes32 polygonHash) external whenNotPaused onlyRole(MINTER_ROLE) {
        if (recipient == address(0)) revert ZeroAddress();
        if (polygonHash == bytes32(0)) revert EmptyPolygonHash();

        uint256 tokenId = uint256(polygonHash);
        if (_ownerOf(tokenId) != address(0)) revert TerritoryAlreadyMinted();

        _mint(recipient, tokenId);
        _tokenIndex[tokenId] = _userTokens[recipient].length;
        _userTokens[recipient].push(tokenId);

        emit TerritoryMinted(tokenId, recipient, polygonHash);
    }

    function burnTerritory(bytes32 polygonHash) external whenNotPaused onlyRole(MINTER_ROLE) {
        if (polygonHash == bytes32(0)) revert EmptyPolygonHash();

        uint256 tokenId = uint256(polygonHash);
        address owner = _ownerOf(tokenId);
        if (owner == address(0)) revert TerritoryNotMinted();

        _burn(tokenId);
        _removeToken(tokenId, owner);

        emit TerritoryBurned(tokenId, polygonHash);
    }

    function getTokenCount(address owner) external view override returns (uint256) {
        return _userTokens[owner].length;
    }

    function getTokenIds(address owner) external view override returns (uint256[] memory) {
        return _userTokens[owner];
    }

    function isMinted(bytes32 polygonHash) external view override returns (bool) {
        return _ownerOf(uint256(polygonHash)) != address(0);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string(abi.encodePacked(baseURI, Strings.toHexString(tokenId)));
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

    function _removeToken(uint256 tokenId, address owner) internal {
        uint256[] storage list = _userTokens[owner];
        uint256 index = _tokenIndex[tokenId];
        uint256 lastIndex = list.length - 1;

        if (index != lastIndex) {
            uint256 lastTokenId = list[lastIndex];
            list[index] = lastTokenId;
            _tokenIndex[lastTokenId] = index;
        }

        list.pop();
        delete _tokenIndex[tokenId];
    }
}
