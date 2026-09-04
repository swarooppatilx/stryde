// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IChallengeRegistry} from "./interfaces/IChallengeRegistry.sol";

contract ChallengeRegistry is IChallengeRegistry, Ownable, Pausable, ReentrancyGuard {
    uint256 private _nextChallengeId = 1;

    mapping(uint256 => Challenge) private _challenges;
    mapping(address => uint256[]) private _userChallenges;
    mapping(uint256 => mapping(address => bool)) private _hasDonePayout;

    constructor() Ownable(msg.sender) {}

    function createChallenge(address opponent, uint8 activityType, uint256 targetMetric, uint256 duration)
        external
        payable
        override
        whenNotPaused
        nonReentrant
    {
        if (opponent == address(0)) revert ZeroAddress();
        if (opponent == msg.sender) revert OwnChallenge();
        if (msg.value == 0) revert CannotRefund();

        uint256 challengeId = _nextChallengeId++;
        _challenges[challengeId] = Challenge({
            challenger: msg.sender,
            opponent: opponent,
            stake: msg.value,
            activityType: activityType,
            targetMetric: targetMetric,
            deadline: block.timestamp + duration,
            winner: address(0),
            status: ChallengeStatus.Open
        });

        _userChallenges[msg.sender].push(challengeId);
        _userChallenges[opponent].push(challengeId);

        emit ChallengeCreated(
            challengeId, msg.sender, opponent, activityType, targetMetric, block.timestamp + duration, msg.value
        );
    }

    function acceptChallenge(uint256 challengeId) external payable override whenNotPaused nonReentrant {
        Challenge storage c = _challenges[challengeId];
        if (c.challenger == address(0)) revert NotParticipant();
        if (c.status != ChallengeStatus.Open) revert AlreadyAccepted();
        if (msg.sender != c.opponent) revert InvitationOnly();
        if (block.timestamp > c.deadline) revert DeadlinePassed();
        if (msg.value != c.stake) revert CannotRefund();

        c.status = ChallengeStatus.Accepted;

        emit ChallengeAccepted(challengeId, msg.sender);
    }

    function settleChallenge(uint256 challengeId, address winner) external override whenNotPaused {
        Challenge storage c = _challenges[challengeId];
        if (c.challenger == address(0)) revert NotParticipant();
        if (c.status == ChallengeStatus.Settled) revert AlreadySettled();
        if (c.status != ChallengeStatus.Accepted) revert NotSettled();
        if (block.timestamp > c.deadline) revert DeadlinePassed();
        if (winner != c.challenger && winner != c.opponent) revert NotParticipant();

        c.status = ChallengeStatus.Settled;
        c.winner = winner;
        address loser = winner == c.challenger ? c.opponent : c.challenger;

        uint256 total = c.stake * 2;
        emit ChallengeSettled(challengeId, winner, loser, total);
    }

    function cancelChallenge(uint256 challengeId) external override whenNotPaused nonReentrant {
        Challenge storage c = _challenges[challengeId];
        if (c.challenger == address(0)) revert NotParticipant();
        if (msg.sender != c.challenger) revert NotParticipant();
        if (c.status == ChallengeStatus.Cancelled) revert AlreadyCancelled();
        if (c.status != ChallengeStatus.Open) revert AlreadyAccepted();

        c.status = ChallengeStatus.Cancelled;

        emit ChallengeCancelled(challengeId, msg.sender);
    }

    function withdrawStake(uint256 challengeId) external override nonReentrant {
        Challenge storage c = _challenges[challengeId];
        if (c.challenger == address(0)) revert NotParticipant();

        if (c.status == ChallengeStatus.Settled) {
            if (msg.sender != c.winner) revert NotParticipant();
            if (_hasDonePayout[challengeId][msg.sender]) revert AlreadySettled();
            _hasDonePayout[challengeId][msg.sender] = true;
            _payOut(msg.sender, c.stake * 2);
            emit ChallengeWithdrawn(challengeId, msg.sender, c.stake * 2);
        } else if (
            c.status == ChallengeStatus.Cancelled || (c.status == ChallengeStatus.Open && block.timestamp > c.deadline)
        ) {
            // Challenger reclaims stake after explicit cancel, or after the accept
            // deadline passes on an unaccepted challenge (prevents permanently
            // locking funds when the opponent never responds).
            if (msg.sender != c.challenger) revert NotParticipant();
            if (_hasDonePayout[challengeId][msg.sender]) revert AlreadySettled();
            _hasDonePayout[challengeId][msg.sender] = true;
            _payOut(msg.sender, c.stake);
            emit ChallengeWithdrawn(challengeId, msg.sender, c.stake);
        } else {
            revert NotSettled();
        }
    }

    function getChallenge(uint256 challengeId) external view override returns (Challenge memory) {
        return _challenges[challengeId];
    }

    function getChallengeCount() external view override returns (uint256) {
        return _nextChallengeId - 1;
    }

    function getUserChallenges(address user) external view override returns (uint256[] memory) {
        return _userChallenges[user];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _payOut(address recipient, uint256 amount) internal {
        Address.sendValue(payable(recipient), amount);
    }
}
