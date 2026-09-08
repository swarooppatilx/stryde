// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MoveToEarnToken} from "../src/MoveToEarnToken.sol";
import {IMoveToEarnToken} from "../src/interfaces/IMoveToEarnToken.sol";

contract MoveToEarnTokenTest is Test {
    MoveToEarnToken public token;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    bytes32 constant ACTIVITY_A = keccak256("ACTIVITY_A");
    bytes32 constant ACTIVITY_B = keccak256("ACTIVITY_B");

    event ActivityRewarded(address indexed recipient, bytes32 indexed activityHash, uint256 distance, uint256 amount);
    event RewardPerMeterUpdated(uint256 oldRate, uint256 newRate);

    function setUp() public {
        token = new MoveToEarnToken();
    }

    // ─── Mint ───────────────────────────────────────────────────────

    function test_MintForActivity() public {
        uint256 distance = 1000;
        uint256 expectedAmount = distance * token.rewardPerMeter();

        vm.expectEmit(true, true, false, true);
        emit ActivityRewarded(alice, ACTIVITY_A, distance, expectedAmount);

        token.mintForActivity(alice, ACTIVITY_A, distance);

        assertEq(token.balanceOf(alice), expectedAmount);
        assertEq(expectedAmount, 1e18); // 1000m at default rate = 1 STRD
        assertTrue(token.isRewarded(ACTIVITY_A));
    }

    function test_MintForActivity_MultipleUsers() public {
        token.mintForActivity(alice, ACTIVITY_A, 1000);
        token.mintForActivity(bob, ACTIVITY_B, 500);

        assertEq(token.balanceOf(alice), 1000 * token.rewardPerMeter());
        assertEq(token.balanceOf(bob), 500 * token.rewardPerMeter());
    }

    function test_MintForActivity_RevertNotMinter() public {
        vm.prank(alice);
        vm.expectRevert();
        token.mintForActivity(alice, ACTIVITY_A, 1000);
    }

    function test_MintForActivity_RevertZeroAddress() public {
        vm.expectRevert(IMoveToEarnToken.ZeroAddress.selector);
        token.mintForActivity(address(0), ACTIVITY_A, 1000);
    }

    function test_MintForActivity_RevertEmptyActivityHash() public {
        vm.expectRevert(IMoveToEarnToken.EmptyActivityHash.selector);
        token.mintForActivity(alice, bytes32(0), 1000);
    }

    function test_MintForActivity_RevertZeroDistance() public {
        vm.expectRevert(IMoveToEarnToken.ZeroDistance.selector);
        token.mintForActivity(alice, ACTIVITY_A, 0);
    }

    function test_MintForActivity_RevertDuplicateHash() public {
        token.mintForActivity(alice, ACTIVITY_A, 1000);
        vm.expectRevert(IMoveToEarnToken.DuplicateActivityHash.selector);
        token.mintForActivity(bob, ACTIVITY_A, 500);
    }

    // ─── Reward rate ────────────────────────────────────────────────

    function test_SetRewardPerMeter() public {
        vm.expectEmit(false, false, false, true);
        emit RewardPerMeterUpdated(1e15, 2e15);

        token.setRewardPerMeter(2e15);
        assertEq(token.rewardPerMeter(), 2e15);
    }

    function test_SetRewardPerMeter_RevertNotAdmin() public {
        vm.prank(alice);
        vm.expectRevert();
        token.setRewardPerMeter(2e15);
    }

    function test_MintForActivity_UsesUpdatedRate() public {
        token.setRewardPerMeter(2e15);
        token.mintForActivity(alice, ACTIVITY_A, 1000);
        assertEq(token.balanceOf(alice), 1000 * 2e15);
    }

    // ─── Transferable (contrast with soulbound TerritoryNFT) ─────────

    function test_Transfer_Succeeds() public {
        token.mintForActivity(alice, ACTIVITY_A, 1000);
        uint256 amount = token.balanceOf(alice);

        vm.prank(alice);
        token.transfer(bob, amount);

        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(bob), amount);
    }

    // ─── View functions ─────────────────────────────────────────────

    function test_IsRewarded_DefaultFalse() public view {
        assertFalse(token.isRewarded(ACTIVITY_A));
    }

    // ─── Pausable ───────────────────────────────────────────────────

    function test_Pause_PreventsMint() public {
        token.pause();
        vm.expectRevert();
        token.mintForActivity(alice, ACTIVITY_A, 1000);
    }

    function test_Unpause_AllowsMint() public {
        token.pause();
        token.unpause();

        token.mintForActivity(alice, ACTIVITY_A, 1000);
        assertGt(token.balanceOf(alice), 0);
    }

    // ─── Fuzz ───────────────────────────────────────────────────────

    function testFuzz_MintForActivity(uint96 distance, bytes32 activityHash) public {
        vm.assume(distance > 0);
        vm.assume(activityHash != bytes32(0));

        token.mintForActivity(alice, activityHash, distance);
        assertEq(token.balanceOf(alice), uint256(distance) * token.rewardPerMeter());
    }

    function testFuzz_SetRewardPerMeter(uint128 rate, uint96 distance) public {
        vm.assume(rate > 0);
        vm.assume(distance > 0);

        token.setRewardPerMeter(rate);
        token.mintForActivity(alice, ACTIVITY_A, distance);

        assertEq(token.balanceOf(alice), uint256(distance) * uint256(rate));
    }
}
