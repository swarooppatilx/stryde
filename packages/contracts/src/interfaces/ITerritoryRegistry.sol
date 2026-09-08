// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITerritoryRegistry {
    // Events
    event TerritoryClaimed(
        bytes32 indexed territoryId,
        address indexed controller,
        uint256 areaSqm,
        bytes32 polygonHash,
        int32 minLng,
        int32 minLat,
        int32 maxLng,
        int32 maxLat,
        uint256 capturedAt,
        uint256 strength
    );
    event TerritoryReinforced(
        bytes32 indexed territoryId, address indexed controller, uint256 reinforcedAt, uint256 strength
    );
    event TerritoryDecayed(bytes32 indexed territoryId, uint256 decayedAt, uint256 remainingStrength);
    event TerritoryLost(bytes32 indexed territoryId, address indexed oldController, uint256 lostAt);

    // Errors
    error EmptyTerritoryId();
    error NotController();
    error Unowned();
    error AlreadyOwned();
    error InvalidArea();

    // Struct
    struct Territory {
        address controller;
        uint256 capturedAt;
        uint256 lastReinforced;
        uint256 controlStrength;
        uint256 areaSqm;
        bytes32 polygonHash;
        int32 minLng;
        int32 minLat;
        int32 maxLng;
        int32 maxLat;
    }

    // Constants
    function MAX_STRENGTH() external view returns (uint256);
    function DECAY_INTERVAL() external view returns (uint256);
    function DECAY_AMOUNT() external view returns (uint256);

    // Write functions
    function claimTerritory(
        bytes32 polygonHash,
        uint256 areaSqm,
        uint256 strength,
        int32 minLng,
        int32 minLat,
        int32 maxLng,
        int32 maxLat
    ) external;
    function reinforceTerritory(bytes32 territoryId, uint256 strength) external;
    function decayTerritory(bytes32 territoryId) external;

    // View functions
    function getController(bytes32 territoryId) external view returns (address);
    function getTerritory(bytes32 territoryId) external view returns (Territory memory);
    function getUserTerritories(address user) external view returns (bytes32[] memory);
    function getUserTerritoryCount(address user) external view returns (uint256);
    function totalTerritories() external view returns (uint256);
}
