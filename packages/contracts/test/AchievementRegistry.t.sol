// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AchievementRegistry} from "../src/AchievementRegistry.sol";
import {IAchievementRegistry} from "../src/interfaces/IAchievementRegistry.sol";

contract AchievementRegistryTest is Test {
    AchievementRegistry public registry;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    bytes32 constant FIRST_ACTIVITY = keccak256("FIRST_ACTIVITY");
    bytes32 constant FIVE_K = keccak256("FIVE_K");
    bytes32 constant TERRITORY_PIONEER = keccak256("TERRITORY_PIONEER");

    event AchievementMinted(uint256 indexed tokenId, address indexed recipient, bytes32 indexed achievementId);
    event AchievementDefined(bytes32 indexed achievementId, string name);

    function setUp() public {
        registry = new AchievementRegistry();
    }

    function _defineAchievements() internal {
        registry.defineAchievement(FIRST_ACTIVITY, "First Activity");
        registry.defineAchievement(FIVE_K, "5K Runner");
        registry.defineAchievement(TERRITORY_PIONEER, "Territory Pioneer");
    }

    // ─── Define ─────────────────────────────────────────────────────

    function test_DefineAchievement() public {
        vm.expectEmit(true, false, false, true);
        emit AchievementDefined(FIRST_ACTIVITY, "First Activity");

        registry.defineAchievement(FIRST_ACTIVITY, "First Activity");

        IAchievementRegistry.Achievement memory achievement = registry.getAchievement(FIRST_ACTIVITY);
        assertEq(achievement.name, "First Activity");
        assertTrue(achievement.exists);
    }

    function test_DefineAchievement_RevertNotAdmin() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.defineAchievement(FIRST_ACTIVITY, "First Activity");
    }

    function test_DefineAchievement_RevertEmptyName() public {
        vm.expectRevert(IAchievementRegistry.EmptyAchievement.selector);
        registry.defineAchievement(FIRST_ACTIVITY, "");
    }

    // ─── Base URI ───────────────────────────────────────────────────

    function test_SetBaseURI() public {
        registry.setBaseURI("ipfs://custom/");

        _defineAchievements();
        registry.mintAchievement(alice, FIRST_ACTIVITY);

        // tokenURI should be prefixed with the updated base URI
        string memory uri = registry.tokenURI(1);
        bytes memory uriBytes = bytes(uri);
        assertGt(uriBytes.length, bytes("ipfs://custom/").length);

        // Check prefix is the new base URI
        for (uint256 i = 0; i < bytes("ipfs://custom/").length; i++) {
            assertEq(uriBytes[i], bytes("ipfs://custom/")[i]);
        }
    }

    function test_SetBaseURI_RevertNotAdmin() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.setBaseURI("ipfs://custom/");
    }

    // ─── Mint ───────────────────────────────────────────────────────

    function test_MintAchievement() public {
        _defineAchievements();

        vm.expectEmit(true, true, true, true);
        emit AchievementMinted(1, alice, FIRST_ACTIVITY);

        registry.mintAchievement(alice, FIRST_ACTIVITY);

        assertEq(registry.balanceOf(alice), 1);
        assertEq(registry.ownerOf(1), alice);
        assertEq(registry.getTokenCount(alice), 1);
        assertEq(registry.getTokenAchievement(1), FIRST_ACTIVITY);
        assertTrue(registry.hasMinted(alice, FIRST_ACTIVITY));

        uint256[] memory tokens = registry.getTokenIds(alice);
        assertEq(tokens.length, 1);
        assertEq(tokens[0], 1);
    }

    function test_MintAchievement_Multiple() public {
        _defineAchievements();

        registry.mintAchievement(alice, FIRST_ACTIVITY);
        registry.mintAchievement(alice, FIVE_K);
        registry.mintAchievement(alice, TERRITORY_PIONEER);

        assertEq(registry.balanceOf(alice), 3);
        assertEq(registry.getTokenCount(alice), 3);
        assertEq(registry.getTokenAchievement(1), FIRST_ACTIVITY);
        assertEq(registry.getTokenAchievement(2), FIVE_K);
        assertEq(registry.getTokenAchievement(3), TERRITORY_PIONEER);
    }

    function test_MintAchievement_MultipleUsers() public {
        _defineAchievements();

        registry.mintAchievement(alice, FIRST_ACTIVITY);
        registry.mintAchievement(bob, FIVE_K);

        assertEq(registry.balanceOf(alice), 1);
        assertEq(registry.balanceOf(bob), 1);
        assertEq(registry.getTokenCount(alice), 1);
        assertEq(registry.getTokenCount(bob), 1);
    }

    function test_MintAchievement_RevertNotMinter() public {
        _defineAchievements();

        vm.prank(alice);
        vm.expectRevert();
        registry.mintAchievement(bob, FIRST_ACTIVITY);
    }

    function test_MintAchievement_RevertUndefined() public {
        vm.expectRevert(IAchievementRegistry.EmptyAchievement.selector);
        registry.mintAchievement(alice, keccak256("UNDEFINED"));
    }

    function test_MintAchievement_RevertZeroAddress() public {
        _defineAchievements();

        vm.expectRevert(IAchievementRegistry.ZeroAddress.selector);
        registry.mintAchievement(address(0), FIRST_ACTIVITY);
    }

    function test_MintAchievement_RevertAlreadyMinted() public {
        _defineAchievements();

        registry.mintAchievement(alice, FIRST_ACTIVITY);
        assertTrue(registry.hasMinted(alice, FIRST_ACTIVITY));

        vm.expectRevert(IAchievementRegistry.AlreadyMinted.selector);
        registry.mintAchievement(alice, FIRST_ACTIVITY);

        // The failed re-mint didn't mint a second token.
        assertEq(registry.balanceOf(alice), 1);
        assertEq(registry.getTokenCount(alice), 1);
    }

    // ─── Soulbound ──────────────────────────────────────────────────

    function test_Transfer_Revert() public {
        _defineAchievements();

        registry.mintAchievement(alice, FIRST_ACTIVITY);
        vm.startPrank(alice);
        vm.expectRevert(IAchievementRegistry.SoulboundTransfer.selector);
        registry.transferFrom(alice, bob, 1);
        vm.stopPrank();
    }

    function test_SafeTransfer_Revert() public {
        _defineAchievements();

        registry.mintAchievement(alice, FIRST_ACTIVITY);
        vm.startPrank(alice);
        vm.expectRevert(IAchievementRegistry.SoulboundTransfer.selector);
        registry.safeTransferFrom(alice, bob, 1);
        vm.stopPrank();
    }

    function test_Approval_ButNoTransfer() public {
        _defineAchievements();

        registry.mintAchievement(alice, FIRST_ACTIVITY);

        // Approval alone doesn't transfer a soulbound token
        vm.prank(alice);
        registry.approve(bob, 1);

        // Attempted transfer still reverts
        vm.startPrank(bob);
        vm.expectRevert(IAchievementRegistry.SoulboundTransfer.selector);
        registry.transferFrom(alice, bob, 1);
        vm.stopPrank();

        // Token still belongs to alice
        assertEq(registry.ownerOf(1), alice);
    }

    // ─── View functions ─────────────────────────────────────────────

    function test_GetAchievement_Undefined() public {
        IAchievementRegistry.Achievement memory achievement = registry.getAchievement(FIRST_ACTIVITY);
        assertEq(achievement.name, "");
        assertFalse(achievement.exists);
    }

    function test_GetTokenCount_Zero() public {
        assertEq(registry.getTokenCount(alice), 0);
    }

    function test_GetTokenIds_Empty() public {
        uint256[] memory tokens = registry.getTokenIds(alice);
        assertEq(tokens.length, 0);
    }

    function test_GetTokenAchievement_Default() public {
        assertEq(registry.getTokenAchievement(1), bytes32(0));
    }

    function test_HasMinted_Default() public {
        assertFalse(registry.hasMinted(alice, FIRST_ACTIVITY));
    }

    // ─── Pausable ───────────────────────────────────────────────────

    function test_Pause_PreventsMint() public {
        _defineAchievements();

        registry.pause();
        vm.expectRevert();
        registry.mintAchievement(alice, FIRST_ACTIVITY);
    }

    function test_Unpause_AllowsMint() public {
        _defineAchievements();

        registry.pause();
        registry.unpause();

        registry.mintAchievement(alice, FIRST_ACTIVITY);
        assertEq(registry.balanceOf(alice), 1);
    }

    // ─── Fuzz ───────────────────────────────────────────────────────

    function testFuzz_MintAchievement(uint8 count) public {
        vm.assume(count > 0 && count < 100);
        _defineAchievements();

        // The same achievementId is minted to many distinct recipients, exercising that
        // _hasMinted is scoped per-(recipient, achievementId) rather than per achievementId.
        for (uint8 i = 0; i < count; i++) {
            address recipient = address(uint160(uint256(i) + 1));
            registry.mintAchievement(recipient, FIRST_ACTIVITY);

            assertEq(registry.balanceOf(recipient), 1);
            assertEq(registry.getTokenCount(recipient), 1);
            assertTrue(registry.hasMinted(recipient, FIRST_ACTIVITY));
            assertEq(registry.ownerOf(uint256(i) + 1), recipient);
        }
    }

    function testFuzz_GetTokenIdsLength(uint8 count) public {
        vm.assume(count > 0 && count < 100);

        // Each achievement id is unique per iteration so the per-(recipient, achievementId)
        // idempotency check doesn't reject any of these mints.
        for (uint8 i = 0; i < count; i++) {
            bytes32 id = keccak256(abi.encodePacked("ACHIEVEMENT", i));
            registry.defineAchievement(id, "Achievement");
            registry.mintAchievement(alice, id);
        }

        uint256[] memory tokens = registry.getTokenIds(alice);
        assertEq(tokens.length, count);
    }
}
