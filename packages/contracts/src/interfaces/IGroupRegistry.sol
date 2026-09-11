// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IGroupRegistry {
    // Events
    event GroupCreated(
        uint256 indexed groupId,
        address indexed owner,
        string name,
        string location,
        string description,
        uint8 sportType,
        uint256 createdAt
    );
    event GroupJoined(uint256 indexed groupId, address indexed member, uint256 memberCount);
    event GroupLeft(uint256 indexed groupId, address indexed member, uint256 memberCount);
    event GroupDissolved(uint256 indexed groupId, address indexed lastOwner, uint256 dissolvedAt);
    event GroupOwnershipTransferred(uint256 indexed groupId, address indexed previousOwner, address indexed newOwner);
    event TreasuryDeposited(uint256 indexed groupId, address indexed from, uint256 amount, uint256 newBalance);
    event TreasuryWithdrawn(uint256 indexed groupId, address indexed to, uint256 amount, uint256 newBalance);

    // Errors
    error EmptyName();
    error GroupNotFound();
    error AlreadyMember();
    error NotMember();
    error NotGroupOwner();
    error NewOwnerNotMember();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientTreasuryBalance();
    error TreasuryTransferFailed();
    /// @dev The group owner tried to leave while other members remain. They must
    /// hand off ownership via transferGroupOwnership() first — the alternative
    /// (auto-promoting an arbitrary remaining member) would silently hand control
    /// of the group to someone the departing owner never chose. An owner who is
    /// the *last* member may still leave; that dissolves the group instead.
    error OwnerMustTransferOwnershipFirst();

    // Struct
    struct Group {
        address owner;
        string name;
        string location;
        string description;
        uint8 sportType; // index into shared ACTIVITY_TYPE_MAP, or 255 for "multi"
        uint256 memberCount;
        uint256 createdAt;
        bool active; // false once dissolved (owner left as last member) or never created
    }

    // Write functions
    function createGroup(string calldata name, string calldata location, string calldata description, uint8 sportType)
        external
        returns (uint256 groupId);
    function joinGroup(uint256 groupId) external;
    function leaveGroup(uint256 groupId) external;
    function transferGroupOwnership(uint256 groupId, address newOwner) external;
    /// @dev Shared organization wallet for the group: any account (member or
    /// not — e.g. a sponsor) can contribute ETH into a group's on-chain
    /// treasury for team challenges/prizes.
    function depositToTreasury(uint256 groupId) external payable;
    /// @dev Owner-gated for the hackathon (single-signer, not a real
    /// multisig/threshold approval — see FEEDBACK.md for the stated
    /// production follow-up) — the group owner spends from the shared
    /// treasury on the group's behalf.
    function withdrawFromTreasury(uint256 groupId, uint256 amount, address to) external;

    // View functions
    function getGroup(uint256 groupId) external view returns (Group memory);
    function getMemberCount(uint256 groupId) external view returns (uint256);
    function isMember(uint256 groupId, address user) external view returns (bool);
    function getUserGroupIds(address user, uint256 offset, uint256 limit) external view returns (uint256[] memory);
    function getGroupCount() external view returns (uint256);
    function getGroupTreasury(uint256 groupId) external view returns (uint256);
}
