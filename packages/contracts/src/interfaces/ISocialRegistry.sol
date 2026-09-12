// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISocialRegistry {
    // Events
    event KudosGiven(uint256 indexed activityId, address indexed giver, uint256 timestamp);
    event KudosRevoked(uint256 indexed activityId, address indexed giver, uint256 timestamp);
    event CommentAdded(
        uint256 indexed activityId,
        address indexed author,
        bytes32 indexed commentId,
        string commentCid,
        uint256 timestamp
    );

    // Errors
    error DuplicateComment();

    // Write functions
    function toggleKudos(uint256 activityId) external;
    function addComment(uint256 activityId, bytes32 commentId, string calldata commentCid) external;

    // View functions
    function hasKudos(uint256 activityId, address user) external view returns (bool);
}
