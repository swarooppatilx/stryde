// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ISocialRegistry} from "./interfaces/ISocialRegistry.sol";

contract SocialRegistry is ISocialRegistry, Ownable, Pausable {
    mapping(uint256 => mapping(address => bool)) private _kudosGiven;
    mapping(bytes32 => bool) private _commentUsed;

    constructor() Ownable(msg.sender) {}

    function toggleKudos(uint256 activityId) external override whenNotPaused {
        bool given = _kudosGiven[activityId][msg.sender];
        _kudosGiven[activityId][msg.sender] = !given;

        if (given) {
            emit KudosRevoked(activityId, msg.sender, block.timestamp);
        } else {
            emit KudosGiven(activityId, msg.sender, block.timestamp);
        }
    }

    function addComment(
        uint256 activityId,
        bytes32 commentId,
        string calldata commentCid
    ) external override whenNotPaused {
        if (_commentUsed[commentId]) revert DuplicateComment();
        _commentUsed[commentId] = true;

        emit CommentAdded(activityId, msg.sender, commentId, commentCid, block.timestamp);
    }

    function hasKudos(uint256 activityId, address user) external view override returns (bool) {
        return _kudosGiven[activityId][user];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
