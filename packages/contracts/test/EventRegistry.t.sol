// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {EventRegistry} from "../src/EventRegistry.sol";
import {IEventRegistry} from "../src/interfaces/IEventRegistry.sol";

contract EventRegistryTest is Test {
    EventRegistry public registry;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    uint256 constant START_TIME = 1_700_000_000;
    uint256 constant END_TIME = 1_700_086_400;

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

    function setUp() public {
        registry = new EventRegistry();
    }

    function _createEvent() internal returns (uint256) {
        vm.prank(alice);
        return registry.createEvent("September 100K", "Run 100km this month", 0, START_TIME, END_TIME, 100_000, 0, 0);
    }

    // ─── Create ─────────────────────────────────────────────────────

    function test_CreateEvent() public {
        vm.expectEmit(true, true, false, false);
        emit EventCreated(
            1, alice, "September 100K", "Run 100km this month", 0, START_TIME, END_TIME, 100_000, 0, 0, block.timestamp
        );

        uint256 eventId = _createEvent();
        assertEq(eventId, 1);

        IEventRegistry.StrydeEvent memory e = registry.getEvent(eventId);
        assertEq(e.host, alice);
        assertEq(e.title, "September 100K");
        assertEq(e.description, "Run 100km this month");
        assertEq(e.sportType, 0);
        assertEq(e.startTime, START_TIME);
        assertEq(e.endTime, END_TIME);
        assertEq(e.distanceGoal, 100_000);
        assertEq(e.startLat, 0);
        assertEq(e.startLng, 0);
        assertEq(e.participantCount, 1);
        assertTrue(e.active);
        assertEq(registry.getEventCount(), 1);
        assertTrue(registry.isJoined(eventId, alice));
    }

    function test_CreateEvent_HostIsFirstParticipant() public {
        uint256 eventId = _createEvent();
        uint256[] memory aliceEvents = registry.getUserEventIds(alice, 0, type(uint256).max);
        assertEq(aliceEvents.length, 1);
        assertEq(aliceEvents[0], eventId);
    }

    function test_CreateEvent_EmptyTitleReverts() public {
        vm.startPrank(alice);
        vm.expectRevert(IEventRegistry.EmptyTitle.selector);
        registry.createEvent("", "desc", 0, START_TIME, END_TIME, 10_000, 0, 0);
        vm.stopPrank();
    }

    function test_CreateEvent_InvalidTimeRangeReverts() public {
        vm.startPrank(alice);
        vm.expectRevert(IEventRegistry.InvalidTimeRange.selector);
        registry.createEvent("Run", "desc", 0, END_TIME, START_TIME, 10_000, 0, 0);
        vm.stopPrank();
    }

    function test_CreateEvent_SupportsPinnedLocation() public {
        vm.prank(alice);
        uint256 eventId =
            registry.createEvent("Riverside Run", "desc", 0, START_TIME, END_TIME, 5_000, 1_850_000, 7_250_000);
        IEventRegistry.StrydeEvent memory e = registry.getEvent(eventId);
        assertEq(e.startLat, 1_850_000);
        assertEq(e.startLng, 7_250_000);
    }

    // ─── Join / Leave ───────────────────────────────────────────────

    function test_JoinEvent() public {
        uint256 eventId = _createEvent();

        vm.expectEmit(true, true, false, false);
        emit EventJoined(eventId, bob, 2);

        vm.prank(bob);
        registry.joinEvent(eventId);

        assertEq(registry.getEvent(eventId).participantCount, 2);
        assertTrue(registry.isJoined(eventId, bob));
        uint256[] memory bobEvents = registry.getUserEventIds(bob, 0, type(uint256).max);
        assertEq(bobEvents.length, 1);
        assertEq(bobEvents[0], eventId);
    }

    function test_JoinEvent_TwiceReverts() public {
        uint256 eventId = _createEvent();
        vm.startPrank(bob);
        registry.joinEvent(eventId);
        vm.expectRevert(IEventRegistry.AlreadyJoined.selector);
        registry.joinEvent(eventId);
        vm.stopPrank();
    }

    function test_JoinEvent_AfterEndReverts() public {
        uint256 eventId = _createEvent();
        vm.warp(END_TIME + 1);
        vm.prank(bob);
        vm.expectRevert(IEventRegistry.EventEnded.selector);
        registry.joinEvent(eventId);
    }

    function test_LeaveEvent() public {
        uint256 eventId = _createEvent();
        vm.prank(bob);
        registry.joinEvent(eventId);

        vm.expectEmit(true, true, false, false);
        emit EventLeft(eventId, bob, 1);

        vm.prank(bob);
        registry.leaveEvent(eventId);

        assertEq(registry.getEvent(eventId).participantCount, 1);
        assertFalse(registry.isJoined(eventId, bob));
        assertEq(registry.getUserEventIds(bob, 0, type(uint256).max).length, 0);
        assertTrue(registry.getEvent(eventId).active);
    }

    function test_LeaveEvent_NotParticipantReverts() public {
        uint256 eventId = _createEvent();
        vm.prank(bob);
        vm.expectRevert(IEventRegistry.NotParticipant.selector);
        registry.leaveEvent(eventId);
    }

    function test_LeaveEvent_SwapAndPop_KeepsOtherEntries() public {
        uint256 eventId = _createEvent();
        vm.startPrank(bob);
        uint256 secondId = registry.createEvent("Second", "desc", 1, START_TIME, END_TIME, 1_000, 0, 0);
        uint256 thirdId = registry.createEvent("Third", "desc", 1, START_TIME, END_TIME, 1_000, 0, 0);
        registry.joinEvent(eventId);
        vm.stopPrank();

        // bob now has: secondId, thirdId, eventId — leave secondId (the
        // middle) so swap-and-pop moves eventId in.
        vm.prank(bob);
        registry.leaveEvent(secondId);

        uint256[] memory bobEvents = registry.getUserEventIds(bob, 0, type(uint256).max);
        assertEq(bobEvents.length, 2);
        assertEq(bobEvents[0], eventId);
        assertEq(bobEvents[1], thirdId);
        assertTrue(registry.isJoined(bobEvents[0], bob));
        assertTrue(registry.isJoined(bobEvents[1], bob));
    }

    // ─── Host leave / cancel ────────────────────────────────────────

    function test_HostLeave_LastParticipant_Dissolves() public {
        uint256 eventId = _createEvent();
        vm.expectEmit(true, true, false, false);
        emit EventCancelled(eventId, alice, block.timestamp);

        vm.prank(alice);
        registry.leaveEvent(eventId);

        assertFalse(registry.getEvent(eventId).active);
        assertEq(registry.getEvent(eventId).participantCount, 0);
        assertEq(registry.getUserEventIds(alice, 0, type(uint256).max).length, 0);
    }

    function test_HostLeave_WithOtherParticipantsReverts() public {
        uint256 eventId = _createEvent();
        vm.prank(bob);
        registry.joinEvent(eventId);

        vm.prank(alice);
        vm.expectRevert(IEventRegistry.HostMustCancelFirst.selector);
        registry.leaveEvent(eventId);
    }

    function test_CancelEvent() public {
        uint256 eventId = _createEvent();
        vm.prank(bob);
        registry.joinEvent(eventId);

        vm.expectEmit(true, true, false, false);
        emit EventCancelled(eventId, alice, block.timestamp);

        vm.prank(alice);
        registry.cancelEvent(eventId);

        assertFalse(registry.getEvent(eventId).active);
        assertEq(registry.getEvent(eventId).participantCount, 0);
    }

    function test_CancelEvent_NotHostReverts() public {
        uint256 eventId = _createEvent();
        vm.prank(bob);
        vm.expectRevert(IEventRegistry.NotHost.selector);
        registry.cancelEvent(eventId);
    }

    function test_CancelEvent_AlreadyCancelledReverts() public {
        uint256 eventId = _createEvent();
        vm.prank(alice);
        registry.cancelEvent(eventId);

        vm.prank(alice);
        vm.expectRevert(IEventRegistry.EventNotFound.selector);
        registry.cancelEvent(eventId);
    }

    function test_JoinCancelledEvent_Reverts() public {
        uint256 eventId = _createEvent();
        vm.prank(alice);
        registry.cancelEvent(eventId);

        vm.prank(bob);
        vm.expectRevert(IEventRegistry.EventNotFound.selector);
        registry.joinEvent(eventId);
    }

    // ─── Pagination ─────────────────────────────────────────────────

    function test_GetUserEventIds_Pagination() public {
        vm.startPrank(bob);
        for (uint256 i = 0; i < 5; i++) {
            registry.createEvent(string.concat("Event ", vm.toString(i)), "desc", 1, START_TIME, END_TIME, 1_000, 0, 0);
        }
        vm.stopPrank();

        uint256[] memory page1 = registry.getUserEventIds(bob, 0, 2);
        assertEq(page1.length, 2);
        uint256[] memory page2 = registry.getUserEventIds(bob, 2, 2);
        assertEq(page2.length, 2);
        uint256[] memory page3 = registry.getUserEventIds(bob, 4, 2);
        assertEq(page3.length, 1);
        uint256[] memory pastEnd = registry.getUserEventIds(bob, 10, 2);
        assertEq(pastEnd.length, 0);
    }

    // ─── Pause ──────────────────────────────────────────────────────

    function test_Pause_BlocksWrites() public {
        registry.pause();
        vm.prank(alice);
        vm.expectRevert();
        registry.createEvent("Run", "desc", 0, START_TIME, END_TIME, 10_000, 0, 0);
    }
}
