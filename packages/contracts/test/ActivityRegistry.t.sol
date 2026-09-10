// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ActivityRegistry} from "../src/ActivityRegistry.sol";
import {IActivityRegistry} from "../src/interfaces/IActivityRegistry.sol";

contract ActivityRegistryTest is Test {
    ActivityRegistry public registry;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    bytes32 constant TEST_HASH = keccak256("test_activity_data");
    bytes32 constant TEST_HASH_2 = keccak256("test_activity_data_2");

    event ActivityRecorded(
        uint256 indexed activityId,
        address indexed owner,
        bytes32 indexed activityHash,
        uint8 activityType,
        uint256 distance,
        uint256 duration,
        uint256 timestamp,
        uint256 territoryArea
    );
    event ActivityMetadataUpdated(uint256 indexed activityId, address indexed owner, string metadataCid);

    function setUp() public {
        registry = new ActivityRegistry();
    }

    // ─── Record Activity ────────────────────────────────────────────

    function test_RecordActivity() public {
        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit ActivityRecorded(1, alice, TEST_HASH, 0, 5000, 1800, block.timestamp, 42);

        uint256 activityId = registry.recordActivity(TEST_HASH, 0, 5000, 1800, 42);

        assertEq(activityId, 1);
        assertEq(registry.getActivityHash(1), TEST_HASH);
        assertEq(registry.getActivityOwner(1), alice);
        assertEq(registry.getActivityTimestamp(1), block.timestamp);
        assertEq(registry.getActivityCount(alice), 1);
        assertEq(registry.totalActivities(), 1);

        uint256[] memory ids = registry.getUserActivityIds(alice, 0, type(uint256).max);
        assertEq(ids.length, 1);
        assertEq(ids[0], 1);
    }

    function test_RecordActivity_RevertZeroHash() public {
        vm.prank(alice);
        vm.expectRevert(IActivityRegistry.ZeroHash.selector);
        registry.recordActivity(bytes32(0), 0, 5000, 1800, 42);
    }

    function test_RecordActivity_RevertDuplicateHash() public {
        vm.startPrank(alice);
        registry.recordActivity(TEST_HASH, 0, 5000, 1800, 42);

        vm.expectRevert(IActivityRegistry.DuplicateHash.selector);
        registry.recordActivity(TEST_HASH, 1, 10000, 3600, 80);
        vm.stopPrank();
    }

    function test_MultipleActivities_SameUser() public {
        vm.startPrank(alice);
        registry.recordActivity(TEST_HASH, 0, 5000, 1800, 42);
        registry.recordActivity(TEST_HASH_2, 1, 10000, 3600, 80);
        vm.stopPrank();

        assertEq(registry.getActivityCount(alice), 2);
        assertEq(registry.totalActivities(), 2);

        uint256[] memory ids = registry.getUserActivityIds(alice, 0, type(uint256).max);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    function test_MultipleUsers() public {
        vm.prank(alice);
        registry.recordActivity(TEST_HASH, 0, 5000, 1800, 42);

        vm.prank(bob);
        registry.recordActivity(TEST_HASH_2, 2, 3000, 900, 15);

        assertEq(registry.getActivityCount(alice), 1);
        assertEq(registry.getActivityCount(bob), 1);
        assertEq(registry.totalActivities(), 2);

        assertEq(registry.getActivityOwner(1), alice);
        assertEq(registry.getActivityOwner(2), bob);
    }

    // ─── Activity Metadata ──────────────────────────────────────────

    function test_SetActivityMetadata() public {
        vm.startPrank(alice);
        uint256 activityId = registry.recordActivity(TEST_HASH, 0, 5000, 1800, 42);

        vm.expectEmit(true, true, false, true);
        emit ActivityMetadataUpdated(activityId, alice, "ipfs://cid123");
        registry.setActivityMetadata(activityId, "ipfs://cid123");
        vm.stopPrank();
    }

    function test_SetActivityMetadata_RevertNotOwner() public {
        vm.prank(alice);
        uint256 activityId = registry.recordActivity(TEST_HASH, 0, 5000, 1800, 42);

        vm.prank(bob);
        vm.expectRevert(IActivityRegistry.NotActivityOwner.selector);
        registry.setActivityMetadata(activityId, "ipfs://cid123");
    }

    function test_SetActivityMetadata_RevertNonexistentActivity() public {
        vm.prank(alice);
        vm.expectRevert(IActivityRegistry.ActivityNotFound.selector);
        registry.setActivityMetadata(999, "ipfs://cid123");
    }

    function test_SetActivityMetadata_RevertWhenPaused() public {
        vm.prank(alice);
        uint256 activityId = registry.recordActivity(TEST_HASH, 0, 5000, 1800, 42);

        registry.pause();

        vm.prank(alice);
        vm.expectRevert();
        registry.setActivityMetadata(activityId, "ipfs://cid123");
    }

    // ─── View functions ─────────────────────────────────────────────

    function test_GetActivityHash_Default() public {
        assertEq(registry.getActivityHash(1), bytes32(0));
    }

    function test_GetActivityOwner_Default() public {
        assertEq(registry.getActivityOwner(1), address(0));
    }

    function test_GetActivityTimestamp_Default() public {
        assertEq(registry.getActivityTimestamp(1), 0);
    }

    function test_GetActivityCount_Unregistered() public {
        assertEq(registry.getActivityCount(alice), 0);
    }

    function test_GetUserActivityIds_Empty() public {
        uint256[] memory ids = registry.getUserActivityIds(alice, 0, type(uint256).max);
        assertEq(ids.length, 0);
    }

    function test_TotalActivities_Zero() public {
        assertEq(registry.totalActivities(), 0);
    }

    // ─── Pausable ───────────────────────────────────────────────────

    function test_Pause_RevertIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.pause();
    }

    function test_Pause_PreventsRecording() public {
        registry.pause();

        vm.prank(alice);
        vm.expectRevert();
        registry.recordActivity(TEST_HASH, 0, 5000, 1800, 42);
    }

    function test_Unpause_AllowsRecording() public {
        registry.pause();
        registry.unpause();

        vm.prank(alice);
        registry.recordActivity(TEST_HASH, 0, 5000, 1800, 42);
        assertEq(registry.getActivityCount(alice), 1);
    }

    // ─── Fuzz ───────────────────────────────────────────────────────

    function testFuzz_RecordActivity(uint8 activityType, uint256 distance, uint256 duration, uint256 territoryArea)
        public
    {
        vm.assume(activityType <= 11);
        vm.assume(distance > 0 && distance < type(uint256).max);
        vm.assume(duration > 0 && duration < type(uint256).max);
        vm.assume(territoryArea < type(uint256).max);

        bytes32 hash = keccak256(abi.encodePacked(block.timestamp, msg.sender, distance));

        vm.prank(alice);
        uint256 activityId = registry.recordActivity(hash, activityType, distance, duration, territoryArea);

        assertEq(activityId, 1);
        assertEq(registry.getActivityHash(activityId), hash);
        assertEq(registry.getActivityOwner(activityId), alice);
    }
}
