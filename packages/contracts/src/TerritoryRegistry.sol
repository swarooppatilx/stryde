// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ITerritoryRegistry} from "./interfaces/ITerritoryRegistry.sol";

contract TerritoryRegistry is ITerritoryRegistry, Ownable, Pausable {
    uint256 public constant MAX_STRENGTH = 1000;
    uint256 public constant DECAY_INTERVAL = 7 days;
    uint256 public constant DECAY_AMOUNT = 100;

    mapping(bytes32 => Territory) private _territories;
    mapping(address => bytes32[]) private _userTerritories;
    mapping(bytes32 => uint256) private _territoryIndex;
    uint256 private _totalTerritories;

    constructor() Ownable(msg.sender) {}

    function claimTerritory(
        bytes32 polygonHash,
        uint256 areaSqm,
        uint256 strength,
        int32 minLng,
        int32 minLat,
        int32 maxLng,
        int32 maxLat
    ) external override whenNotPaused {
        if (polygonHash == bytes32(0)) revert EmptyTerritoryId();
        if (areaSqm == 0) revert InvalidArea();
        if (_territories[polygonHash].controller != address(0)) revert Unowned();

        uint256 cappedStrength = _capStrength(strength);

        _territories[polygonHash] = Territory({
            controller: msg.sender,
            capturedAt: block.timestamp,
            lastReinforced: block.timestamp,
            controlStrength: cappedStrength,
            areaSqm: areaSqm,
            polygonHash: polygonHash,
            minLng: minLng,
            minLat: minLat,
            maxLng: maxLng,
            maxLat: maxLat
        });

        _territoryIndex[polygonHash] = _userTerritories[msg.sender].length;
        _userTerritories[msg.sender].push(polygonHash);
        _totalTerritories++;

        emit TerritoryClaimed(
            polygonHash,
            msg.sender,
            areaSqm,
            polygonHash,
            minLng,
            minLat,
            maxLng,
            maxLat,
            block.timestamp,
            cappedStrength
        );
    }

    function reinforceTerritory(bytes32 territoryId, uint256 strength) external override whenNotPaused {
        if (territoryId == bytes32(0)) revert EmptyTerritoryId();

        Territory storage t = _territories[territoryId];
        if (t.controller == address(0)) revert Unowned();
        if (t.controller != msg.sender) revert NotController();

        uint256 cappedStrength = _capStrength(strength);
        t.controlStrength = cappedStrength;
        t.lastReinforced = block.timestamp;

        emit TerritoryReinforced(territoryId, msg.sender, block.timestamp, cappedStrength);
    }

    function decayTerritory(bytes32 territoryId) external override {
        if (territoryId == bytes32(0)) revert EmptyTerritoryId();

        Territory storage t = _territories[territoryId];
        if (t.controller == address(0)) revert Unowned();

        if (block.timestamp >= t.lastReinforced + DECAY_INTERVAL) {
            uint256 newStrength = t.controlStrength > DECAY_AMOUNT ? t.controlStrength - DECAY_AMOUNT : 0;
            t.controlStrength = newStrength;
            t.lastReinforced = block.timestamp;

            if (newStrength == 0) {
                address oldController = t.controller;
                _removeTerritory(territoryId, oldController);
                delete _territories[territoryId];
                _totalTerritories--;

                emit TerritoryDecayed(territoryId, block.timestamp, 0);
                emit TerritoryLost(territoryId, oldController, block.timestamp);
            } else {
                emit TerritoryDecayed(territoryId, block.timestamp, newStrength);
            }
        }
    }

    function getController(bytes32 territoryId) external view override returns (address) {
        return _territories[territoryId].controller;
    }

    function getTerritory(bytes32 territoryId) external view override returns (Territory memory) {
        return _territories[territoryId];
    }

    function getUserTerritories(address user) external view override returns (bytes32[] memory) {
        return _userTerritories[user];
    }

    function getUserTerritoryCount(address user) external view override returns (uint256) {
        return _userTerritories[user].length;
    }

    function totalTerritories() external view override returns (uint256) {
        return _totalTerritories;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _capStrength(uint256 strength) internal pure returns (uint256) {
        return strength > MAX_STRENGTH ? MAX_STRENGTH : strength;
    }

    function _removeTerritory(bytes32 territoryId, address owner) internal {
        bytes32[] storage list = _userTerritories[owner];
        uint256 index = _territoryIndex[territoryId];
        uint256 lastIndex = list.length - 1;

        if (index != lastIndex) {
            bytes32 lastTerritory = list[lastIndex];
            list[index] = lastTerritory;
            _territoryIndex[lastTerritory] = index;
        }

        list.pop();
        delete _territoryIndex[territoryId];
    }
}
