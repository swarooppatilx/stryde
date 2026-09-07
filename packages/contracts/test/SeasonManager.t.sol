// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SeasonManager} from "../src/SeasonManager.sol";
import {ISeasonManager} from "../src/interfaces/ISeasonManager.sol";

contract SeasonManagerTest is Test {
    SeasonManager public manager;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address oracle = makeAddr("oracle");

    event SeasonStarted(uint256 indexed seasonId, uint256 startTime, uint256 endTime);
    event SeasonEnded(uint256 indexed seasonId, uint256 endTime, uint256 participantCount);
    event ContributionRecorded(
        uint256 indexed seasonId, address indexed participant, uint256 contribution, uint256 total
    );

    function setUp() public {
        manager = new SeasonManager();
    }

    function _startSeason() internal {
        vm.prank(manager.owner());
        manager.startSeason(30 days);
    }

    // ─── Start Season ──────────────────────────────────────────────

    function test_StartSeason() public {
        vm.expectEmit(false, false, false, true);
        emit SeasonStarted(1, block.timestamp, block.timestamp + 30 days);

        vm.prank(manager.owner());
        manager.startSeason(30 days);

        ISeasonManager.Season memory season = manager.getCurrentSeason();
        assertEq(season.id, 1);
        assertEq(season.startTime, block.timestamp);
        assertEq(season.endTime, block.timestamp + 30 days);
        assertTrue(season.isActive);
        assertEq(manager.getSeasonCount(), 1);
    }

    function test_StartSeason_RevertIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        manager.startSeason(30 days);
    }

    function test_StartSeason_RevertZeroDuration() public {
        vm.prank(manager.owner());
        vm.expectRevert(ISeasonManager.InvalidDuration.selector);
        manager.startSeason(0);
    }

    function test_StartSeason_RevertAlreadyActive() public {
        _startSeason();

        vm.prank(manager.owner());
        vm.expectRevert(ISeasonManager.SeasonAlreadyActive.selector);
        manager.startSeason(30 days);
    }

    // ─── End Season ────────────────────────────────────────────────

    function test_EndSeason() public {
        _startSeason();
        vm.warp(block.timestamp + 30 days);

        manager.recordContribution(alice, 5000);
        manager.recordContribution(bob, 3000);

        vm.expectEmit(false, false, false, true);
        emit SeasonEnded(1, block.timestamp, 2);

        vm.prank(manager.owner());
        manager.endSeason();

        ISeasonManager.Season memory season = manager.getCurrentSeason();
        assertFalse(season.isActive);
    }

    function test_EndSeason_RevertIfNotOwner() public {
        _startSeason();

        vm.prank(alice);
        vm.expectRevert();
        manager.endSeason();
    }

    function test_EndSeason_RevertNotActive() public {
        vm.prank(manager.owner());
        vm.expectRevert(ISeasonManager.SeasonNotActive.selector);
        manager.endSeason();
    }

    function test_RestartAfterEnd() public {
        _startSeason();
        vm.prank(manager.owner());
        manager.endSeason();

        vm.prank(manager.owner());
        manager.startSeason(30 days);

        assertEq(manager.getSeasonCount(), 2);
        ISeasonManager.Season memory season = manager.getCurrentSeason();
        assertEq(season.id, 2);
        assertTrue(season.isActive);
    }

    // ─── Record Contribution ───────────────────────────────────────

    function test_RecordContribution() public {
        _startSeason();

        vm.expectEmit(true, true, false, true);
        emit ContributionRecorded(1, alice, 5000, 5000);
        manager.recordContribution(alice, 5000);

        assertEq(manager.getParticipantContribution(1, alice), 5000);
        assertEq(manager.getTotalContribution(1), 5000);
        assertEq(manager.getParticipantCount(1), 1);
    }

    function test_RecordContribution_MultipleEntries() public {
        _startSeason();

        manager.recordContribution(alice, 5000);
        manager.recordContribution(alice, 3000);

        assertEq(manager.getParticipantContribution(1, alice), 8000);
        assertEq(manager.getTotalContribution(1), 8000);
        assertEq(manager.getParticipantCount(1), 1);
    }

    function test_RecordContribution_MultipleUsers() public {
        _startSeason();

        manager.recordContribution(alice, 5000);
        manager.recordContribution(bob, 3000);

        assertEq(manager.getParticipantContribution(1, alice), 5000);
        assertEq(manager.getParticipantContribution(1, bob), 3000);
        assertEq(manager.getTotalContribution(1), 8000);
        assertEq(manager.getParticipantCount(1), 2);
    }

    function test_RecordContribution_RevertNotActive() public {
        vm.expectRevert(ISeasonManager.SeasonNotActive.selector);
        manager.recordContribution(alice, 5000);
    }

    function test_RecordContribution_RevertNotActiveAfterEnd() public {
        _startSeason();
        vm.prank(manager.owner());
        manager.endSeason();

        vm.expectRevert(ISeasonManager.SeasonNotActive.selector);
        manager.recordContribution(alice, 5000);
    }

    function test_RecordContribution_RevertZeroAddress() public {
        _startSeason();

        vm.expectRevert(ISeasonManager.ZeroAddress.selector);
        manager.recordContribution(address(0), 5000);
    }

    // ─── View functions ────────────────────────────────────────────

    function test_GetSeasonCount_Zero() public {
        assertEq(manager.getSeasonCount(), 0);
    }

    function test_GetParticipantContribution_Default() public {
        assertEq(manager.getParticipantContribution(1, alice), 0);
    }

    function test_GetTotalContribution_Default() public {
        assertEq(manager.getTotalContribution(1), 0);
    }

    function test_GetParticipantCount_Default() public {
        assertEq(manager.getParticipantCount(1), 0);
    }

    function test_GetSeason_Historical() public {
        _startSeason();
        vm.warp(block.timestamp + 30 days);
        manager.recordContribution(alice, 5000);
        vm.prank(manager.owner());
        manager.endSeason();

        // Season 1 remains queryable after it ends
        ISeasonManager.Season memory s1 = manager.getSeason(1);
        assertEq(s1.id, 1);
        assertFalse(s1.isActive);
        assertEq(manager.getTotalContribution(1), 5000);
        assertEq(manager.getParticipantCount(1), 1);

        // Start a second season; season 1 is still readable alongside it
        vm.prank(manager.owner());
        manager.startSeason(30 days);
        ISeasonManager.Season memory s2 = manager.getSeason(2);
        assertEq(s2.id, 2);
        assertTrue(s2.isActive);

        ISeasonManager.Season memory s1Again = manager.getSeason(1);
        assertFalse(s1Again.isActive);
    }

    function test_GetSeason_RevertZero() public {
        vm.expectRevert(ISeasonManager.InvalidSeason.selector);
        manager.getSeason(0);
    }

    function test_GetSeason_RevertOutOfRange() public {
        _startSeason();
        vm.expectRevert(ISeasonManager.InvalidSeason.selector);
        manager.getSeason(2);
    }

    // ─── Pausable ──────────────────────────────────────────────────

    function test_Pause_PreventsStartSeason() public {
        manager.pause();

        vm.prank(manager.owner());
        vm.expectRevert();
        manager.startSeason(30 days);
    }

    function test_Pause_PreventsRecordContribution() public {
        _startSeason();
        manager.pause();

        vm.expectRevert();
        manager.recordContribution(alice, 5000);
    }

    function test_Unpause_AllowsRecordContribution() public {
        _startSeason();
        manager.pause();
        manager.unpause();

        manager.recordContribution(alice, 5000);
        assertEq(manager.getParticipantContribution(1, alice), 5000);
    }

    // ─── Fuzz ──────────────────────────────────────────────────────

    function testFuzz_RecordContribution(uint256 amount) public {
        vm.assume(amount > 0 && amount < type(uint256).max / 100);

        _startSeason();

        uint256 totalBefore = manager.getTotalContribution(1);
        manager.recordContribution(alice, amount);

        assertEq(manager.getParticipantContribution(1, alice), amount);
        assertEq(manager.getTotalContribution(1), totalBefore + amount);
    }

    function testFuzz_RecordContribution_Multiple(uint8 count) public {
        vm.assume(count > 0 && count <= 50);

        _startSeason();

        for (uint8 i = 0; i < count; i++) {
            manager.recordContribution(alice, 1000);
        }

        assertEq(manager.getParticipantContribution(1, alice), uint256(count) * 1000);
        assertEq(manager.getParticipantCount(1), 1);
    }
}
