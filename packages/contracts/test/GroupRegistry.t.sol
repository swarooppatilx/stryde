// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {GroupRegistry} from "../src/GroupRegistry.sol";
import {IGroupRegistry} from "../src/interfaces/IGroupRegistry.sol";

contract GroupRegistryTest is Test {
    GroupRegistry public registry;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

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

    function setUp() public {
        registry = new GroupRegistry();
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(carol, 10 ether);
    }

    function _createGroup() internal returns (uint256) {
        vm.prank(alice);
        return registry.createGroup("Pune Trail Runners", "Pune, India", "Weekly trail runs", 0);
    }

    // ─── Create ─────────────────────────────────────────────────────

    function test_CreateGroup() public {
        vm.expectEmit(true, true, false, false);
        emit GroupCreated(1, alice, "Pune Trail Runners", "Pune, India", "Weekly trail runs", 0, block.timestamp);

        uint256 groupId = _createGroup();
        assertEq(groupId, 1);

        IGroupRegistry.Group memory g = registry.getGroup(groupId);
        assertEq(g.owner, alice);
        assertEq(g.name, "Pune Trail Runners");
        assertEq(g.location, "Pune, India");
        assertEq(g.description, "Weekly trail runs");
        assertEq(g.sportType, 0);
        assertEq(g.memberCount, 1);
        assertTrue(g.active);
        assertEq(registry.getGroupCount(), 1);
        assertEq(registry.getMemberCount(groupId), 1);
        assertTrue(registry.isMember(groupId, alice));
    }

    function test_CreateGroup_CreatorIsFirstMember() public {
        uint256 groupId = _createGroup();
        uint256[] memory aliceGroups = registry.getUserGroupIds(alice, 0, type(uint256).max);
        assertEq(aliceGroups.length, 1);
        assertEq(aliceGroups[0], groupId);
    }

    function test_CreateGroup_RevertEmptyName() public {
        vm.prank(alice);
        vm.expectRevert(IGroupRegistry.EmptyName.selector);
        registry.createGroup("", "Pune, India", "desc", 0);
    }

    function test_CreateGroup_MultipleGroupsIncrementIds() public {
        uint256 id1 = _createGroup();
        vm.prank(bob);
        uint256 id2 = registry.createGroup("Mumbai Cyclists", "Mumbai, India", "Group rides", 1);

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(registry.getGroupCount(), 2);
    }

    // ─── Join ───────────────────────────────────────────────────────

    function test_JoinGroup() public {
        uint256 groupId = _createGroup();

        vm.expectEmit(true, true, false, true);
        emit GroupJoined(groupId, bob, 2);

        vm.prank(bob);
        registry.joinGroup(groupId);

        assertTrue(registry.isMember(groupId, bob));
        assertEq(registry.getMemberCount(groupId), 2);

        uint256[] memory bobGroups = registry.getUserGroupIds(bob, 0, type(uint256).max);
        assertEq(bobGroups.length, 1);
        assertEq(bobGroups[0], groupId);
    }

    function test_JoinGroup_RevertNonexistent() public {
        vm.prank(bob);
        vm.expectRevert(IGroupRegistry.GroupNotFound.selector);
        registry.joinGroup(999);
    }

    function test_JoinGroup_RevertDoubleJoin() public {
        uint256 groupId = _createGroup();

        vm.prank(bob);
        registry.joinGroup(groupId);

        vm.prank(bob);
        vm.expectRevert(IGroupRegistry.AlreadyMember.selector);
        registry.joinGroup(groupId);
    }

    function test_JoinGroup_RevertCreatorAlreadyMember() public {
        uint256 groupId = _createGroup();

        vm.prank(alice);
        vm.expectRevert(IGroupRegistry.AlreadyMember.selector);
        registry.joinGroup(groupId);
    }

    function test_JoinGroup_RevertAfterDissolved() public {
        uint256 groupId = _createGroup();

        vm.prank(alice);
        registry.leaveGroup(groupId);

        vm.prank(bob);
        vm.expectRevert(IGroupRegistry.GroupNotFound.selector);
        registry.joinGroup(groupId);
    }

    // ─── Leave ──────────────────────────────────────────────────────

    function test_LeaveGroup_NonOwnerMember() public {
        uint256 groupId = _createGroup();
        vm.prank(bob);
        registry.joinGroup(groupId);

        vm.expectEmit(true, true, false, true);
        emit GroupLeft(groupId, bob, 1);

        vm.prank(bob);
        registry.leaveGroup(groupId);

        assertFalse(registry.isMember(groupId, bob));
        assertEq(registry.getMemberCount(groupId), 1);
        assertTrue(registry.getGroup(groupId).active);

        uint256[] memory bobGroups = registry.getUserGroupIds(bob, 0, type(uint256).max);
        assertEq(bobGroups.length, 0);
    }

    function test_LeaveGroup_RevertNonexistent() public {
        vm.prank(bob);
        vm.expectRevert(IGroupRegistry.GroupNotFound.selector);
        registry.leaveGroup(999);
    }

    function test_LeaveGroup_RevertNotMember() public {
        uint256 groupId = _createGroup();

        vm.prank(bob);
        vm.expectRevert(IGroupRegistry.NotMember.selector);
        registry.leaveGroup(groupId);
    }

    function test_LeaveGroup_RevertDoubleLeave() public {
        uint256 groupId = _createGroup();
        vm.prank(bob);
        registry.joinGroup(groupId);

        vm.prank(bob);
        registry.leaveGroup(groupId);

        vm.prank(bob);
        vm.expectRevert(IGroupRegistry.NotMember.selector);
        registry.leaveGroup(groupId);
    }

    // ─── Owner-leaves edge case ─────────────────────────────────────
    // Decision: the owner may not leave while other members remain (they must
    // transferGroupOwnership() first). An owner who is the *last* remaining
    // member leaving dissolves the group entirely.

    function test_LeaveGroup_OwnerRevertsWhileOthersRemain() public {
        uint256 groupId = _createGroup();
        vm.prank(bob);
        registry.joinGroup(groupId);

        vm.prank(alice);
        vm.expectRevert(IGroupRegistry.OwnerMustTransferOwnershipFirst.selector);
        registry.leaveGroup(groupId);
    }

    function test_LeaveGroup_OwnerAsLastMemberDissolves() public {
        uint256 groupId = _createGroup();

        vm.expectEmit(true, true, false, true);
        emit GroupDissolved(groupId, alice, block.timestamp);

        vm.prank(alice);
        registry.leaveGroup(groupId);

        IGroupRegistry.Group memory g = registry.getGroup(groupId);
        assertFalse(g.active);
        assertEq(g.owner, address(0));
        assertEq(g.memberCount, 0);
        assertFalse(registry.isMember(groupId, alice));
    }

    function test_LeaveGroup_AfterOwnerTransfer_OldOwnerCanLeave() public {
        uint256 groupId = _createGroup();
        vm.prank(bob);
        registry.joinGroup(groupId);

        vm.prank(alice);
        registry.transferGroupOwnership(groupId, bob);

        vm.prank(alice);
        registry.leaveGroup(groupId);

        assertFalse(registry.isMember(groupId, alice));
        assertEq(registry.getGroup(groupId).owner, bob);
        assertEq(registry.getMemberCount(groupId), 1);
    }

    // ─── Ownership transfer ─────────────────────────────────────────

    function test_TransferGroupOwnership() public {
        uint256 groupId = _createGroup();
        vm.prank(bob);
        registry.joinGroup(groupId);

        vm.expectEmit(true, true, true, false);
        emit GroupOwnershipTransferred(groupId, alice, bob);

        vm.prank(alice);
        registry.transferGroupOwnership(groupId, bob);

        assertEq(registry.getGroup(groupId).owner, bob);
    }

    function test_TransferGroupOwnership_RevertNotOwner() public {
        uint256 groupId = _createGroup();
        vm.prank(bob);
        registry.joinGroup(groupId);

        vm.prank(bob);
        vm.expectRevert(IGroupRegistry.NotGroupOwner.selector);
        registry.transferGroupOwnership(groupId, bob);
    }

    function test_TransferGroupOwnership_RevertNewOwnerNotMember() public {
        uint256 groupId = _createGroup();

        vm.prank(alice);
        vm.expectRevert(IGroupRegistry.NewOwnerNotMember.selector);
        registry.transferGroupOwnership(groupId, carol);
    }

    function test_TransferGroupOwnership_RevertNonexistent() public {
        vm.prank(alice);
        vm.expectRevert(IGroupRegistry.GroupNotFound.selector);
        registry.transferGroupOwnership(999, bob);
    }

    function test_TransferGroupOwnership_RevertZeroAddress() public {
        uint256 groupId = _createGroup();

        vm.prank(alice);
        vm.expectRevert(IGroupRegistry.ZeroAddress.selector);
        registry.transferGroupOwnership(groupId, address(0));
    }

    // ─── Pagination ─────────────────────────────────────────────────

    function test_GetUserGroupIds_Pagination() public {
        vm.startPrank(alice);
        uint256 id1 = registry.createGroup("Group A", "Loc", "desc", 0);
        uint256 id2 = registry.createGroup("Group B", "Loc", "desc", 0);
        uint256 id3 = registry.createGroup("Group C", "Loc", "desc", 0);
        vm.stopPrank();

        uint256[] memory page1 = registry.getUserGroupIds(alice, 0, 2);
        assertEq(page1.length, 2);
        assertEq(page1[0], id1);
        assertEq(page1[1], id2);

        uint256[] memory page2 = registry.getUserGroupIds(alice, 2, 2);
        assertEq(page2.length, 1);
        assertEq(page2[0], id3);
    }

    function test_GetUserGroupIds_Empty() public {
        uint256[] memory ids = registry.getUserGroupIds(alice, 0, type(uint256).max);
        assertEq(ids.length, 0);
    }

    function test_GetUserGroupIds_OffsetBeyondLength() public {
        _createGroup();
        uint256[] memory ids = registry.getUserGroupIds(alice, 5, 10);
        assertEq(ids.length, 0);
    }

    // ─── View functions on nonexistent group ─────────────────────────

    function test_GetGroup_Default() public view {
        IGroupRegistry.Group memory g = registry.getGroup(1);
        assertEq(g.owner, address(0));
        assertFalse(g.active);
    }

    function test_GetGroupCount_Zero() public {
        assertEq(registry.getGroupCount(), 0);
    }

    function test_IsMember_FalseForNonexistentGroup() public {
        assertFalse(registry.isMember(999, alice));
    }

    // ─── Pausable ───────────────────────────────────────────────────

    function test_Pause_PreventsCreate() public {
        registry.pause();

        vm.prank(alice);
        vm.expectRevert();
        registry.createGroup("Name", "Loc", "desc", 0);
    }

    function test_Pause_PreventsJoin() public {
        uint256 groupId = _createGroup();
        registry.pause();

        vm.prank(bob);
        vm.expectRevert();
        registry.joinGroup(groupId);
    }

    function test_Unpause_AllowsCreate() public {
        registry.pause();
        registry.unpause();

        vm.prank(alice);
        registry.createGroup("Name", "Loc", "desc", 0);
        assertEq(registry.getGroupCount(), 1);
    }

    // ─── Treasury ───────────────────────────────────────────────────

    function test_DepositToTreasury() public {
        uint256 groupId = _createGroup();

        vm.expectEmit(true, true, false, true);
        emit TreasuryDeposited(groupId, bob, 1 ether, 1 ether);

        vm.prank(bob);
        registry.depositToTreasury{value: 1 ether}(groupId);

        assertEq(registry.getGroupTreasury(groupId), 1 ether);
    }

    function test_DepositToTreasury_AnyoneCanContribute() public {
        uint256 groupId = _createGroup();

        // carol is not a member — a sponsor/external donor should still be
        // able to fund a group's shared treasury.
        vm.prank(carol);
        registry.depositToTreasury{value: 0.5 ether}(groupId);

        assertEq(registry.getGroupTreasury(groupId), 0.5 ether);
    }

    function test_DepositToTreasury_Accumulates() public {
        uint256 groupId = _createGroup();

        vm.prank(alice);
        registry.depositToTreasury{value: 1 ether}(groupId);
        vm.prank(bob);
        registry.depositToTreasury{value: 2 ether}(groupId);

        assertEq(registry.getGroupTreasury(groupId), 3 ether);
    }

    function test_DepositToTreasury_RevertZeroAmount() public {
        uint256 groupId = _createGroup();

        vm.prank(alice);
        vm.expectRevert(IGroupRegistry.ZeroAmount.selector);
        registry.depositToTreasury{value: 0}(groupId);
    }

    function test_DepositToTreasury_RevertNonexistentGroup() public {
        vm.prank(alice);
        vm.expectRevert(IGroupRegistry.GroupNotFound.selector);
        registry.depositToTreasury{value: 1 ether}(999);
    }

    function test_WithdrawFromTreasury() public {
        uint256 groupId = _createGroup();
        vm.prank(bob);
        registry.depositToTreasury{value: 2 ether}(groupId);

        uint256 carolBalanceBefore = carol.balance;

        vm.expectEmit(true, true, false, true);
        emit TreasuryWithdrawn(groupId, carol, 1 ether, 1 ether);

        vm.prank(alice);
        registry.withdrawFromTreasury(groupId, 1 ether, carol);

        assertEq(registry.getGroupTreasury(groupId), 1 ether);
        assertEq(carol.balance, carolBalanceBefore + 1 ether);
    }

    function test_WithdrawFromTreasury_RevertNotOwner() public {
        uint256 groupId = _createGroup();
        vm.prank(bob);
        registry.depositToTreasury{value: 1 ether}(groupId);

        vm.prank(bob);
        vm.expectRevert(IGroupRegistry.NotGroupOwner.selector);
        registry.withdrawFromTreasury(groupId, 1 ether, bob);
    }

    function test_WithdrawFromTreasury_RevertInsufficientBalance() public {
        uint256 groupId = _createGroup();
        vm.prank(bob);
        registry.depositToTreasury{value: 1 ether}(groupId);

        vm.prank(alice);
        vm.expectRevert(IGroupRegistry.InsufficientTreasuryBalance.selector);
        registry.withdrawFromTreasury(groupId, 2 ether, alice);
    }

    function test_WithdrawFromTreasury_RevertZeroAmount() public {
        uint256 groupId = _createGroup();
        vm.prank(bob);
        registry.depositToTreasury{value: 1 ether}(groupId);

        vm.prank(alice);
        vm.expectRevert(IGroupRegistry.ZeroAmount.selector);
        registry.withdrawFromTreasury(groupId, 0, alice);
    }

    function test_WithdrawFromTreasury_RevertZeroAddress() public {
        uint256 groupId = _createGroup();
        vm.prank(bob);
        registry.depositToTreasury{value: 1 ether}(groupId);

        vm.prank(alice);
        vm.expectRevert(IGroupRegistry.ZeroAddress.selector);
        registry.withdrawFromTreasury(groupId, 1 ether, address(0));
    }

    function test_WithdrawFromTreasury_RevertNonexistentGroup() public {
        vm.prank(alice);
        vm.expectRevert(IGroupRegistry.GroupNotFound.selector);
        registry.withdrawFromTreasury(999, 1 ether, alice);
    }

    function test_GetGroupTreasury_ZeroByDefault() public {
        uint256 groupId = _createGroup();
        assertEq(registry.getGroupTreasury(groupId), 0);
    }

    function testFuzz_DepositToTreasury(uint96 amount) public {
        vm.assume(amount > 0);
        vm.deal(alice, uint256(amount));
        uint256 groupId = _createGroup();

        vm.prank(alice);
        registry.depositToTreasury{value: amount}(groupId);

        assertEq(registry.getGroupTreasury(groupId), amount);
    }

    // ─── Fuzz ───────────────────────────────────────────────────────

    function testFuzz_CreateGroup_SportType(uint8 sportType) public {
        vm.prank(alice);
        uint256 groupId = registry.createGroup("Fuzzy Group", "Loc", "desc", sportType);

        IGroupRegistry.Group memory g = registry.getGroup(groupId);
        assertEq(g.sportType, sportType);
    }

    function testFuzz_JoinAndLeave(uint8 memberSeed) public {
        uint256 groupId = _createGroup();
        address member = address(uint160(uint256(memberSeed)) + 1000);
        vm.assume(member != alice);

        vm.prank(member);
        registry.joinGroup(groupId);
        assertTrue(registry.isMember(groupId, member));

        vm.prank(member);
        registry.leaveGroup(groupId);
        assertFalse(registry.isMember(groupId, member));
    }
}
