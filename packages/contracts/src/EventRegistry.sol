// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IEventRegistry} from "./interfaces/IEventRegistry.sol";

contract EventRegistry is IEventRegistry, Ownable, Pausable {
    uint256 private _nextEventId = 1;

    mapping(uint256 => StrydeEvent) private _events;
    mapping(uint256 => mapping(address => bool)) private _isParticipant;
    // Per-user list of event ids the user currently participates in, with an
    // index for O(1) swap-and-pop removal on leaveEvent (same pattern as
    // GroupRegistry's _userGroups/_userGroupIndex).
    mapping(address => uint256[]) private _userEvents;
    mapping(address => mapping(uint256 => uint256)) private _userEventIndex;

    constructor() Ownable(msg.sender) {}

    function createEvent(
        string calldata title,
        string calldata description,
        uint8 sportType,
        uint256 startTime,
        uint256 endTime,
        uint256 distanceGoal,
        int32 startLat,
        int32 startLng
    ) external override whenNotPaused returns (uint256 eventId) {
        if (bytes(title).length == 0) revert EmptyTitle();
        if (endTime <= startTime) revert InvalidTimeRange();

        unchecked {
            eventId = _nextEventId++;
        }

        _events[eventId] = StrydeEvent({
            host: msg.sender,
            title: title,
            description: description,
            sportType: sportType,
            startTime: startTime,
            endTime: endTime,
            distanceGoal: distanceGoal,
            startLat: startLat,
            startLng: startLng,
            participantCount: 1,
            createdAt: block.timestamp,
            active: true
        });

        _addParticipant(eventId, msg.sender);

        emit EventCreated(
            eventId,
            msg.sender,
            title,
            description,
            sportType,
            startTime,
            endTime,
            distanceGoal,
            startLat,
            startLng,
            block.timestamp
        );
    }

    function joinEvent(uint256 eventId) external override whenNotPaused {
        StrydeEvent storage e = _events[eventId];
        if (!e.active) revert EventNotFound();
        if (_isParticipant[eventId][msg.sender]) revert AlreadyJoined();
        if (block.timestamp > e.endTime) revert EventEnded();

        _addParticipant(eventId, msg.sender);
        e.participantCount++;

        emit EventJoined(eventId, msg.sender, e.participantCount);
    }

    function leaveEvent(uint256 eventId) external override whenNotPaused {
        StrydeEvent storage e = _events[eventId];
        if (!e.active) revert EventNotFound();
        if (!_isParticipant[eventId][msg.sender]) revert NotParticipant();

        // The host can't "leave" while others remain — they should call
        // cancelEvent() to dissolve it for everyone. A host who is the *last*
        // participant leaving dissolves the event outright (nothing left to
        // keep alive).
        if (msg.sender == e.host) {
            if (e.participantCount > 1) revert HostMustCancelFirst();
            _removeParticipant(eventId, msg.sender);
            e.active = false;
            e.participantCount = 0;
            emit EventCancelled(eventId, msg.sender, block.timestamp);
            return;
        }

        _removeParticipant(eventId, msg.sender);
        e.participantCount--;

        emit EventLeft(eventId, msg.sender, e.participantCount);
    }

    function cancelEvent(uint256 eventId) external override whenNotPaused {
        StrydeEvent storage e = _events[eventId];
        if (!e.active) revert EventNotFound();
        if (msg.sender != e.host) revert NotHost();

        e.active = false;
        e.participantCount = 0;

        emit EventCancelled(eventId, msg.sender, block.timestamp);
    }

    function getEvent(uint256 eventId) external view override returns (StrydeEvent memory) {
        return _events[eventId];
    }

    function getEventCount() external view override returns (uint256) {
        return _nextEventId - 1;
    }

    function isJoined(uint256 eventId, address user) external view override returns (bool) {
        return _isParticipant[eventId][user];
    }

    function getUserEventIds(address user, uint256 offset, uint256 limit)
        external
        view
        override
        returns (uint256[] memory)
    {
        uint256[] storage arr = _userEvents[user];
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

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _addParticipant(uint256 eventId, address participant) internal {
        _isParticipant[eventId][participant] = true;
        _userEventIndex[participant][eventId] = _userEvents[participant].length;
        _userEvents[participant].push(eventId);
    }

    function _removeParticipant(uint256 eventId, address participant) internal {
        _isParticipant[eventId][participant] = false;

        uint256[] storage list = _userEvents[participant];
        uint256 index = _userEventIndex[participant][eventId];
        uint256 lastIndex = list.length - 1;

        if (index != lastIndex) {
            uint256 lastEventId = list[lastIndex];
            list[index] = lastEventId;
            _userEventIndex[participant][lastEventId] = index;
        }

        list.pop();
        delete _userEventIndex[participant][eventId];
    }
}
