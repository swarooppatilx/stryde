// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ISeasonManager} from "./interfaces/ISeasonManager.sol";

contract SeasonManager is ISeasonManager, Ownable, Pausable {
    Season private _currentSeason;
    uint256 private _seasonCount;

    mapping(uint256 => Season) private _seasons;
    mapping(uint256 => mapping(address => uint256)) private _contributions;
    mapping(uint256 => uint256) private _totalContributions;
    mapping(uint256 => uint256) private _participantCount;
    mapping(uint256 => mapping(address => bool)) private _hasParticipated;

    constructor() Ownable(msg.sender) {}

    function startSeason(uint256 duration) external override onlyOwner whenNotPaused {
        if (duration == 0) revert InvalidDuration();
        if (_currentSeason.isActive) revert SeasonAlreadyActive();

        _seasonCount++;
        _currentSeason =
            Season({id: _seasonCount, startTime: block.timestamp, endTime: block.timestamp + duration, isActive: true});
        _seasons[_seasonCount] = _currentSeason;

        emit SeasonStarted(_seasonCount, block.timestamp, block.timestamp + duration);
    }

    function endSeason() external override onlyOwner {
        if (!_currentSeason.isActive) revert SeasonNotActive();

        uint256 seasonId = _currentSeason.id;
        _currentSeason.isActive = false;
        _seasons[seasonId] = _currentSeason;

        emit SeasonEnded(seasonId, block.timestamp, _participantCount[seasonId]);
    }

    function recordContribution(address participant, uint256 amount) external override whenNotPaused {
        if (participant == address(0)) revert ZeroAddress();
        if (!_currentSeason.isActive) revert SeasonNotActive();

        uint256 seasonId = _currentSeason.id;

        if (!_hasParticipated[seasonId][participant]) {
            _hasParticipated[seasonId][participant] = true;
            _participantCount[seasonId]++;
        }

        _contributions[seasonId][participant] += amount;
        _totalContributions[seasonId] += amount;

        emit ContributionRecorded(seasonId, participant, amount, _contributions[seasonId][participant]);
    }

    function getCurrentSeason() external view override returns (Season memory) {
        return _currentSeason;
    }

    function getSeason(uint256 seasonId) external view override returns (Season memory) {
        if (seasonId == 0 || seasonId > _seasonCount) revert InvalidSeason();
        return _seasons[seasonId];
    }

    function getSeasonCount() external view override returns (uint256) {
        return _seasonCount;
    }

    function getParticipantContribution(uint256 seasonId, address participant)
        external
        view
        override
        returns (uint256)
    {
        return _contributions[seasonId][participant];
    }

    function getTotalContribution(uint256 seasonId) external view override returns (uint256) {
        return _totalContributions[seasonId];
    }

    function getParticipantCount(uint256 seasonId) external view override returns (uint256) {
        return _participantCount[seasonId];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
