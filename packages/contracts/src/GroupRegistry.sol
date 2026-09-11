// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IGroupRegistry} from "./interfaces/IGroupRegistry.sol";

contract GroupRegistry is IGroupRegistry, Ownable, Pausable {
    uint256 private _nextGroupId = 1;

    mapping(uint256 => Group) private _groups;
    mapping(uint256 => mapping(address => bool)) private _isMember;
    // Per-user list of group ids the user currently belongs to, with an index
    // for O(1) swap-and-pop removal on leaveGroup (same pattern as
    // TerritoryRegistry's _userTerritories/_territoryIndex).
    mapping(address => uint256[]) private _userGroups;
    mapping(address => mapping(uint256 => uint256)) private _userGroupIndex;

    constructor() Ownable(msg.sender) {}

    function createGroup(string calldata name, string calldata location, string calldata description, uint8 sportType)
        external
        override
        whenNotPaused
        returns (uint256 groupId)
    {
        if (bytes(name).length == 0) revert EmptyName();

        unchecked {
            groupId = _nextGroupId++;
        }

        _groups[groupId] = Group({
            owner: msg.sender,
            name: name,
            location: location,
            description: description,
            sportType: sportType,
            memberCount: 1,
            createdAt: block.timestamp,
            active: true
        });

        _addMember(groupId, msg.sender);

        emit GroupCreated(groupId, msg.sender, name, location, description, sportType, block.timestamp);
    }

    function joinGroup(uint256 groupId) external override whenNotPaused {
        Group storage g = _groups[groupId];
        if (!g.active) revert GroupNotFound();
        if (_isMember[groupId][msg.sender]) revert AlreadyMember();

        _addMember(groupId, msg.sender);
        g.memberCount++;

        emit GroupJoined(groupId, msg.sender, g.memberCount);
    }

    function leaveGroup(uint256 groupId) external override whenNotPaused {
        Group storage g = _groups[groupId];
        if (!g.active) revert GroupNotFound();
        if (!_isMember[groupId][msg.sender]) revert NotMember();

        if (msg.sender == g.owner) {
            if (g.memberCount > 1) revert OwnerMustTransferOwnershipFirst();

            // Last remaining member is the owner leaving: dissolve the group
            // rather than leave it ownerless-but-still-"active".
            _removeMember(groupId, msg.sender);
            g.active = false;
            g.owner = address(0);
            g.memberCount = 0;

            emit GroupDissolved(groupId, msg.sender, block.timestamp);
            return;
        }

        _removeMember(groupId, msg.sender);
        g.memberCount--;

        emit GroupLeft(groupId, msg.sender, g.memberCount);
    }

    function transferGroupOwnership(uint256 groupId, address newOwner) external override whenNotPaused {
        Group storage g = _groups[groupId];
        if (!g.active) revert GroupNotFound();
        if (msg.sender != g.owner) revert NotGroupOwner();
        if (newOwner == address(0)) revert ZeroAddress();
        if (!_isMember[groupId][newOwner]) revert NewOwnerNotMember();

        address previousOwner = g.owner;
        g.owner = newOwner;

        emit GroupOwnershipTransferred(groupId, previousOwner, newOwner);
    }

    function getGroup(uint256 groupId) external view override returns (Group memory) {
        return _groups[groupId];
    }

    function getMemberCount(uint256 groupId) external view override returns (uint256) {
        return _groups[groupId].memberCount;
    }

    function isMember(uint256 groupId, address user) external view override returns (bool) {
        return _isMember[groupId][user];
    }

    function getUserGroupIds(address user, uint256 offset, uint256 limit)
        external
        view
        override
        returns (uint256[] memory)
    {
        uint256[] storage arr = _userGroups[user];
        if (offset >= arr.length) {
            return new uint256[](0);
        }
        uint256 end = offset + limit;
        if (end > arr.length) {
            end = arr.length;
        }
        uint256 size = end - offset;
        uint256[] memory result = new uint256[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = arr[offset + i];
        }
        return result;
    }

    function getGroupCount() external view override returns (uint256) {
        return _nextGroupId - 1;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _addMember(uint256 groupId, address member) internal {
        _isMember[groupId][member] = true;
        _userGroupIndex[member][groupId] = _userGroups[member].length;
        _userGroups[member].push(groupId);
    }

    function _removeMember(uint256 groupId, address member) internal {
        _isMember[groupId][member] = false;

        uint256[] storage list = _userGroups[member];
        uint256 index = _userGroupIndex[member][groupId];
        uint256 lastIndex = list.length - 1;

        if (index != lastIndex) {
            uint256 lastGroupId = list[lastIndex];
            list[index] = lastGroupId;
            _userGroupIndex[member][lastGroupId] = index;
        }

        list.pop();
        delete _userGroupIndex[member][groupId];
    }
}
