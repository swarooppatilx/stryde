// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ProfileRegistry} from "../src/ProfileRegistry.sol";
import {IProfileRegistry} from "../src/interfaces/IProfileRegistry.sol";

contract ProfileRegistryTest is Test {
    ProfileRegistry public registry;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    event ProfileCreated(uint256 indexed profileId, address indexed wallet, string username, uint256 joinedAt);

    function setUp() public {
        registry = new ProfileRegistry();
    }

    // ─── Registration ───────────────────────────────────────────────

    function test_RegisterProfile() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit ProfileCreated(1, alice, "alice_run", block.timestamp);

        uint256 profileId = registry.register("alice_run");

        assertEq(profileId, 1);
        assertTrue(registry.isRegistered(alice));
        assertEq(registry.getProfileId(alice), 1);
        assertEq(registry.getWallet(1), alice);
        assertEq(registry.totalProfiles(), 1);
    }

    function test_RegisterProfile_RevertAlreadyRegistered() public {
        vm.startPrank(alice);
        registry.register("alice_run");

        vm.expectRevert(IProfileRegistry.AlreadyRegistered.selector);
        registry.register("alice_again");
        vm.stopPrank();
    }

    function test_RegisterProfile_RevertEmptyUsername() public {
        vm.prank(alice);

        vm.expectRevert(IProfileRegistry.EmptyUsername.selector);
        registry.register("");
    }

    function test_RegisterProfile_RevertUsernameTaken() public {
        vm.prank(alice);
        registry.register("alice_run");

        vm.prank(bob);
        vm.expectRevert(IProfileRegistry.UsernameTaken.selector);
        registry.register("alice_run");
    }

    function test_MultipleUsers() public {
        vm.prank(alice);
        registry.register("alice_run");

        vm.prank(bob);
        registry.register("bob_ride");

        assertEq(registry.totalProfiles(), 2);
        assertEq(registry.getProfileId(alice), 1);
        assertEq(registry.getProfileId(bob), 2);
        assertEq(registry.getWallet(1), alice);
        assertEq(registry.getWallet(2), bob);
    }

    // ─── View functions ─────────────────────────────────────────────

    function test_IsRegistered_ReturnsFalse() public {
        assertFalse(registry.isRegistered(alice));
    }

    function test_GetProfileId_RevertNotRegistered() public {
        vm.expectRevert(IProfileRegistry.NotRegistered.selector);
        registry.getProfileId(alice);
    }

    function test_GetWallet_RevertNotRegistered() public {
        vm.expectRevert(IProfileRegistry.NotRegistered.selector);
        registry.getWallet(999);
    }

    function test_TotalProfiles_Zero() public {
        assertEq(registry.totalProfiles(), 0);
    }

    // ─── Pausable ───────────────────────────────────────────────────

    function test_Pause_RevertIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.pause();
    }

    function test_Pause_PreventsRegistration() public {
        registry.pause();

        vm.prank(alice);
        vm.expectRevert();
        registry.register("alice");
    }

    function test_Unpause_AllowsRegistration() public {
        registry.pause();
        registry.unpause();

        vm.prank(alice);
        registry.register("alice");
        assertTrue(registry.isRegistered(alice));
    }

    // ─── Fuzz ───────────────────────────────────────────────────────

    function testFuzz_RegisterProfile(string calldata username) public {
        vm.assume(bytes(username).length > 0 && bytes(username).length <= 20);

        vm.prank(alice);
        uint256 profileId = registry.register(username);

        assertEq(profileId, 1);
        assertTrue(registry.isRegistered(alice));
    }
}
