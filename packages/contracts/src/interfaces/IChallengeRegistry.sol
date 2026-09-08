// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IChallengeRegistry {
    // Events
    event ChallengeCreated(
        uint256 indexed challengeId,
        address indexed challenger,
        address indexed opponent,
        uint8 activityType,
        uint256 targetMetric,
        uint256 deadline,
        uint256 stake
    );
    event ChallengeAccepted(uint256 indexed challengeId, address indexed opponent);
    event ChallengeSettled(uint256 indexed challengeId, address indexed winner, address indexed loser, uint256 payout);
    event ChallengeCancelled(uint256 indexed challengeId, address indexed canceller);
    event ChallengeWithdrawn(uint256 indexed challengeId, address indexed withdrawer, uint256 amount);

    // Errors
    error ZeroAddress();
    error InvitationOnly();
    error OwnChallenge();
    error AlreadyAccepted();
    error DeadlinePassed();
    error NotParticipant();
    error NotSettled();
    error AlreadySettled();
    error AlreadyCancelled();
    error CannotRefund();

    // Struct
    enum ChallengeStatus {
        Open, // created, awaiting opponent acceptance
        Accepted, // both staked, in progress
        Settled, // winner declared, payout claimable
        Cancelled // challenger backed out before acceptance
    }

    struct Challenge {
        address challenger;
        address opponent;
        uint256 stake;
        uint8 activityType;
        uint256 targetMetric;
        uint256 deadline;
        address winner;
        ChallengeStatus status;
    }

    // View functions
    function getChallenge(uint256 challengeId) external view returns (Challenge memory);
    function getChallengeCount() external view returns (uint256);
    function getUserChallenges(address user, uint256 offset, uint256 limit) external view returns (uint256[] memory);

    // Write functions
    function createChallenge(address opponent, uint8 activityType, uint256 targetMetric, uint256 duration)
        external
        payable;
    function acceptChallenge(uint256 challengeId) external payable;
    function settleChallenge(uint256 challengeId, address winner) external;
    function cancelChallenge(uint256 challengeId) external;
    function withdrawStake(uint256 challengeId) external;
}
