// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITerritoryNFT {
    // Events
    event TerritoryMinted(uint256 indexed tokenId, address indexed recipient, bytes32 indexed polygonHash);
    event TerritoryBurned(uint256 indexed tokenId, bytes32 indexed polygonHash);

    // Errors
    error ZeroAddress();
    error EmptyPolygonHash();
    error TerritoryAlreadyMinted();
    error TerritoryNotMinted();
    error SoulboundTransfer();

    // View functions
    function getTokenCount(address owner) external view returns (uint256);
    function getTokenIds(address owner) external view returns (uint256[] memory);
    function isMinted(bytes32 polygonHash) external view returns (bool);
}
