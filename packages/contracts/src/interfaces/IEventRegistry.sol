// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IEventRegistry {
    // Events
    event EventCreated(
        uint256 indexed eventId,
        address indexed host,
        string title,
        string description,
        uint8 sportType,
        uint256 startTime,
        uint256 endTime,
        uint256 distanceGoal,
        int32 startLat,
        int32 startLng,
        uint256 createdAt
    );
    event EventJoined(uint256 indexed eventId, address indexed participant, uint256 participantCount);
    event EventLeft(uint256 indexed eventId, address indexed participant, uint256 participantCount);
    event EventCancelled(uint256 indexed eventId, address indexed host, uint256 cancelledAt);

    // Errors
    error EmptyTitle();
    error EventNotFound();
    error AlreadyJoined();
    error NotParticipant();
    error NotHost();
    error EventEnded();
    error InvalidTimeRange();
    /// @dev The host tried to leave while other participants remain. They
    /// should cancelEvent() instead, which dissolves the event for everyone.
    error HostMustCancelFirst();

    // Struct
    struct StrydeEvent {
        address host;
        string title;
        string description;
        uint8 sportType; // index into shared ACTIVITY_TYPE_MAP, or 255 for "multi"
        uint256 startTime;
        uint256 endTime;
        uint256 distanceGoal;
        /// @dev Event "pin" location in 1e6-fixed-point coordinates (same
        /// encoding as TerritoryRegistry bounds); zeros when the host chose
        /// not to pin the event to a place.
        int32 startLat;
        int32 startLng;
        uint256 participantCount;
        uint256 createdAt;
        bool active;
    }

    // Write functions
    function createEvent(
        string calldata title,
        string calldata description,
        uint8 sportType,
        uint256 startTime,
        uint256 endTime,
        uint256 distanceGoal,
        int32 startLat,
        int32 startLng
    ) external returns (uint256 eventId);
    function joinEvent(uint256 eventId) external;
    function leaveEvent(uint256 eventId) external;
    function cancelEvent(uint256 eventId) external;

    // View functions
    function getEvent(uint256 eventId) external view returns (StrydeEvent memory);
    function getEventCount() external view returns (uint256);
    function isJoined(uint256 eventId, address user) external view returns (bool);
    function getUserEventIds(address user, uint256 offset, uint256 limit) external view returns (uint256[] memory);
}
