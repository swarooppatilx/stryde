// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ChallengeRegistry} from "../src/ChallengeRegistry.sol";
import {IChallengeRegistry} from "../src/interfaces/IChallengeRegistry.sol";

contract ChallengeRegistryTest is Test {
    ChallengeRegistry public registry;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

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

    function setUp() public {
        registry = new ChallengeRegistry();
    }

    function _fund(address user, uint256 amount) internal {
        vm.deal(user, amount);
    }

    function _createChallenge() internal returns (uint256) {
        _fund(alice, 1 ether);
        vm.prank(alice);
        registry.createChallenge{value: 0.1 ether}(bob, 0, 5000, 7 days);
        return 1;
    }

    function _createAndAccept() internal returns (uint256) {
        uint256 id = _createChallenge();
        _fund(bob, 1 ether);
        vm.prank(bob);
        registry.acceptChallenge{value: 0.1 ether}(id);
        return id;
    }

    // ─── Create ─────────────────────────────────────────────────────

    function test_CreateChallenge() public {
        _fund(alice, 1 ether);

        vm.expectEmit(true, true, true, false);
        emit ChallengeCreated(1, alice, bob, 0, 5000, block.timestamp + 7 days, 0.1 ether);

        vm.prank(alice);
        registry.createChallenge{value: 0.1 ether}(bob, 0, 5000, 7 days);

        IChallengeRegistry.Challenge memory c = registry.getChallenge(1);
        assertEq(c.challenger, alice);
        assertEq(c.opponent, bob);
        assertEq(c.stake, 0.1 ether);
        assertEq(c.deadline, block.timestamp + 7 days);
        assertEq(registry.getChallengeCount(), 1);

        uint256[] memory aliceChallenges = registry.getUserChallenges(alice);
        uint256[] memory bobChallenges = registry.getUserChallenges(bob);
        assertEq(aliceChallenges.length, 1);
        assertEq(bobChallenges.length, 1);
    }

    function test_CreateChallenge_RevertZeroOpponent() public {
        _fund(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(IChallengeRegistry.ZeroAddress.selector);
        registry.createChallenge{value: 0.1 ether}(address(0), 0, 5000, 7 days);
    }

    function test_CreateChallenge_RevertSelfChallenge() public {
        _fund(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(IChallengeRegistry.OwnChallenge.selector);
        registry.createChallenge{value: 0.1 ether}(alice, 0, 5000, 7 days);
    }

    function test_CreateChallenge_RevertNoStake() public {
        _fund(alice, 0);
        vm.prank(alice);
        vm.expectRevert(IChallengeRegistry.CannotRefund.selector);
        registry.createChallenge{value: 0}(bob, 0, 5000, 7 days);
    }

    // ─── Accept ─────────────────────────────────────────────────────

    function test_AcceptChallenge() public {
        _createChallenge();
        _fund(bob, 1 ether);

        vm.expectEmit(true, true, false, false);
        emit ChallengeAccepted(1, bob);

        vm.prank(bob);
        registry.acceptChallenge{value: 0.1 ether}(1);

        IChallengeRegistry.Challenge memory c = registry.getChallenge(1);
        assertEq(uint8(c.status), uint8(IChallengeRegistry.ChallengeStatus.Accepted));
    }

    function test_AcceptChallenge_RevertNotInvited() public {
        _createChallenge();
        _fund(carol, 1 ether);

        vm.prank(carol);
        vm.expectRevert(IChallengeRegistry.InvitationOnly.selector);
        registry.acceptChallenge{value: 0.1 ether}(1);
    }

    function test_AcceptChallenge_RevertWrongStake() public {
        _createChallenge();
        _fund(bob, 1 ether);

        vm.prank(bob);
        vm.expectRevert(IChallengeRegistry.CannotRefund.selector);
        registry.acceptChallenge{value: 0.2 ether}(1);
    }

    function test_AcceptChallenge_RevertDeadlinePassed() public {
        _createChallenge();
        vm.warp(block.timestamp + 8 days);
        _fund(bob, 1 ether);

        vm.prank(bob);
        vm.expectRevert(IChallengeRegistry.DeadlinePassed.selector);
        registry.acceptChallenge{value: 0.1 ether}(1);
    }

    function test_AcceptChallenge_RevertAlreadyAccepted() public {
        _createAndAccept();
        _fund(carol, 1 ether);

        vm.prank(bob);
        vm.expectRevert(IChallengeRegistry.AlreadyAccepted.selector);
        registry.acceptChallenge{value: 0.1 ether}(1);
    }

    // ─── Settle ─────────────────────────────────────────────────────

    function test_SettleChallenge() public {
        uint256 id = _createAndAccept();

        vm.expectEmit(true, true, true, false);
        emit ChallengeSettled(id, alice, bob, 0.2 ether);

        vm.prank(alice);
        registry.settleChallenge(id, alice);

        IChallengeRegistry.Challenge memory c = registry.getChallenge(id);
        assertEq(uint8(c.status), uint8(IChallengeRegistry.ChallengeStatus.Settled));
        assertEq(c.winner, alice);
    }

    function test_SettleChallenge_RevertNotAccepted() public {
        uint256 id = _createChallenge();

        vm.prank(alice);
        vm.expectRevert(IChallengeRegistry.NotSettled.selector);
        registry.settleChallenge(id, alice);
    }

    function test_SettleChallenge_RevertNonParticipantWinner() public {
        uint256 id = _createAndAccept();

        vm.prank(alice);
        vm.expectRevert(IChallengeRegistry.NotParticipant.selector);
        registry.settleChallenge(id, carol);
    }

    function test_SettleChallenge_RevertNonParticipantCaller() public {
        uint256 id = _createAndAccept();

        vm.prank(carol);
        vm.expectRevert(IChallengeRegistry.NotParticipant.selector);
        registry.settleChallenge(id, alice);
    }

    function test_SettleChallenge_RevertDoubleSettle() public {
        uint256 id = _createAndAccept();

        vm.prank(alice);
        registry.settleChallenge(id, alice);

        vm.prank(alice);
        vm.expectRevert(IChallengeRegistry.AlreadySettled.selector);
        registry.settleChallenge(id, alice);
    }

    function test_SettleChallenge_RevertAfterDeadline() public {
        uint256 id = _createAndAccept();

        vm.warp(block.timestamp + 8 days);

        vm.prank(alice);
        vm.expectRevert(IChallengeRegistry.DeadlinePassed.selector);
        registry.settleChallenge(id, alice);
    }

    // ─── Withdraw ───────────────────────────────────────────────────

    function test_WithdrawWinnerGetsStake() public {
        uint256 id = _createAndAccept();

        vm.prank(alice);
        registry.settleChallenge(id, alice);

        uint256 aliceBalanceBefore = alice.balance;
        vm.prank(alice);
        registry.withdrawStake(id);

        assertEq(alice.balance, aliceBalanceBefore + 0.2 ether);
    }

    function test_WithdrawLoserGetsNothing() public {
        uint256 id = _createAndAccept();

        vm.prank(alice);
        registry.settleChallenge(id, alice);

        // Loser (bob) can't withdraw
        vm.prank(bob);
        vm.expectRevert(IChallengeRegistry.NotParticipant.selector);
        registry.withdrawStake(id);
    }

    function test_Withdraw_CancelledStakeRefund() public {
        uint256 id = _createChallenge();

        vm.prank(alice);
        registry.cancelChallenge(id);

        uint256 aliceBalanceBefore = alice.balance;
        vm.prank(alice);
        registry.withdrawStake(id);

        assertEq(alice.balance, aliceBalanceBefore + 0.1 ether);
    }

    function test_Withdraw_RevertDoubleWithdraw() public {
        uint256 id = _createAndAccept();
        vm.prank(alice);
        registry.settleChallenge(id, alice);

        vm.prank(alice);
        registry.withdrawStake(id);

        vm.prank(alice);
        vm.expectRevert(IChallengeRegistry.AlreadySettled.selector);
        registry.withdrawStake(id);
    }

    function test_Withdraw_RevertUnsettled() public {
        uint256 id = _createChallenge();

        vm.prank(alice);
        vm.expectRevert(IChallengeRegistry.NotSettled.selector);
        registry.withdrawStake(id);
    }

    function test_Withdraw_AfterDeadlineUnaccepted() public {
        uint256 id = _createChallenge();

        // Opponent never accepts; deadline passes
        vm.warp(block.timestamp + 8 days);

        uint256 aliceBalanceBefore = alice.balance;
        vm.prank(alice);
        registry.withdrawStake(id);

        assertEq(alice.balance, aliceBalanceBefore + 0.1 ether);
    }

    function test_Withdraw_AfterDeadline_RevertBeforeDeadline() public {
        uint256 id = _createChallenge();

        // Before deadline on an unaccepted challenge, cannot withdraw
        vm.prank(alice);
        vm.expectRevert(IChallengeRegistry.NotSettled.selector);
        registry.withdrawStake(id);
    }

    function test_Withdraw_AfterDeadline_RevertNotChallenger() public {
        uint256 id = _createChallenge();

        vm.warp(block.timestamp + 8 days);

        // Only the challenger can reclaim an unaccepted, expired challenge
        vm.prank(bob);
        vm.expectRevert(IChallengeRegistry.NotParticipant.selector);
        registry.withdrawStake(id);
    }

    function test_Withdraw_AfterDeadline_RevertDoubleWithdraw() public {
        uint256 id = _createChallenge();
        vm.warp(block.timestamp + 8 days);

        vm.prank(alice);
        registry.withdrawStake(id);

        vm.prank(alice);
        vm.expectRevert(IChallengeRegistry.AlreadySettled.selector);
        registry.withdrawStake(id);
    }

    // ─── Cancel ─────────────────────────────────────────────────────

    function test_CancelChallenge() public {
        uint256 id = _createChallenge();

        vm.expectEmit(true, true, false, false);
        emit ChallengeCancelled(id, alice);

        vm.prank(alice);
        registry.cancelChallenge(id);

        IChallengeRegistry.Challenge memory c = registry.getChallenge(id);
        assertEq(uint8(c.status), uint8(IChallengeRegistry.ChallengeStatus.Cancelled));
    }

    function test_CancelChallenge_RevertNotChallenger() public {
        uint256 id = _createChallenge();

        vm.prank(bob);
        vm.expectRevert(IChallengeRegistry.NotParticipant.selector);
        registry.cancelChallenge(id);
    }

    function test_CancelChallenge_RevertIfAccepted() public {
        uint256 id = _createAndAccept();

        vm.prank(alice);
        vm.expectRevert(IChallengeRegistry.AlreadyAccepted.selector);
        registry.cancelChallenge(id);
    }

    function test_CancelChallenge_RevertDoubleCancel() public {
        uint256 id = _createChallenge();

        vm.prank(alice);
        registry.cancelChallenge(id);

        vm.prank(alice);
        vm.expectRevert(IChallengeRegistry.AlreadyCancelled.selector);
        registry.cancelChallenge(id);
    }

    // ─── View functions ─────────────────────────────────────────────

    function test_GetChallengeCount_Zero() public {
        assertEq(registry.getChallengeCount(), 0);
    }

    function test_GetUserChallenges_Empty() public {
        uint256[] memory ids = registry.getUserChallenges(alice);
        assertEq(ids.length, 0);
    }

    function test_GetChallenge_Default() public view {
        IChallengeRegistry.Challenge memory c = registry.getChallenge(1);
        assertEq(c.challenger, address(0));
    }

    // ─── Pausable ───────────────────────────────────────────────────

    function test_Pause_PreventsCreate() public {
        _fund(alice, 1 ether);
        registry.pause();

        vm.prank(alice);
        vm.expectRevert();
        registry.createChallenge{value: 0.1 ether}(bob, 0, 5000, 7 days);
    }

    function test_Unpause_AllowsCreate() public {
        _fund(alice, 1 ether);
        registry.pause();
        registry.unpause();

        vm.prank(alice);
        registry.createChallenge{value: 0.1 ether}(bob, 0, 5000, 7 days);
        assertEq(registry.getChallengeCount(), 1);
    }

    // ─── Fuzz ───────────────────────────────────────────────────────

    function testFuzz_CreateChallenge(uint256 stake, uint8 activityType) public {
        vm.assume(stake > 0 && stake < 10 ether);
        vm.assume(activityType <= 3);

        _fund(alice, 20 ether);
        vm.prank(alice);
        registry.createChallenge{value: stake}(bob, activityType, 5000, 7 days);

        IChallengeRegistry.Challenge memory c = registry.getChallenge(1);
        assertEq(c.stake, stake);
        assertEq(c.activityType, activityType);
    }
}
