// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {TerritoryRegistry} from "../src/TerritoryRegistry.sol";
import {ITerritoryRegistry} from "../src/interfaces/ITerritoryRegistry.sol";

contract TerritoryRegistryTest is Test {
    TerritoryRegistry public registry;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    bytes32 constant HASH_1 = keccak256("polygon_alpha");
    bytes32 constant HASH_2 = keccak256("polygon_beta");
    bytes32 constant HASH_3 = keccak256("polygon_gamma");

    event TerritoryClaimed(
        bytes32 indexed territoryId,
        address indexed controller,
        uint256 areaSqm,
        bytes32 polygonHash,
        int32 minLng,
        int32 minLat,
        int32 maxLng,
        int32 maxLat,
        uint256 capturedAt,
        uint256 strength
    );
    event TerritoryReinforced(
        bytes32 indexed territoryId, address indexed controller, uint256 reinforcedAt, uint256 strength
    );
    event TerritoryDecayed(bytes32 indexed territoryId, uint256 decayedAt, uint256 remainingStrength);
    event TerritoryLost(bytes32 indexed territoryId, address indexed oldController, uint256 lostAt);

    function setUp() public {
        registry = new TerritoryRegistry();
    }

    // ─── Claim ──────────────────────────────────────────────────────

    function test_ClaimTerritory() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit TerritoryClaimed(
            HASH_1, alice, 5000, HASH_1, -73985000, 40742000, -73980000, 40747000, block.timestamp, 500
        );

        registry.claimTerritory(HASH_1, 5000, 500, -73985000, 40742000, -73980000, 40747000);

        assertEq(registry.getController(HASH_1), alice);
        assertEq(registry.getUserTerritoryCount(alice), 1);
        assertEq(registry.totalTerritories(), 1);

        ITerritoryRegistry.Territory memory t = registry.getTerritory(HASH_1);
        assertEq(t.controller, alice);
        assertEq(t.capturedAt, block.timestamp);
        assertEq(t.lastReinforced, block.timestamp);
        assertEq(t.controlStrength, 500);
        assertEq(t.areaSqm, 5000);
        assertEq(t.polygonHash, HASH_1);
        assertEq(t.minLng, -73985000);
        assertEq(t.minLat, 40742000);
        assertEq(t.maxLng, -73980000);
        assertEq(t.maxLat, 40747000);
    }

    function test_ClaimTerritory_CapsStrength() public {
        vm.prank(alice);
        registry.claimTerritory(HASH_1, 5000, 5000, -73985000, 40742000, -73980000, 40747000);

        ITerritoryRegistry.Territory memory t = registry.getTerritory(HASH_1);
        assertEq(t.controlStrength, registry.MAX_STRENGTH());
    }

    function test_ClaimTerritory_RevertEmptyHash() public {
        vm.prank(alice);
        vm.expectRevert(ITerritoryRegistry.EmptyTerritoryId.selector);
        registry.claimTerritory(bytes32(0), 5000, 500, -73985000, 40742000, -73980000, 40747000);
    }

    function test_ClaimTerritory_RevertInvalidArea() public {
        vm.prank(alice);
        vm.expectRevert(ITerritoryRegistry.InvalidArea.selector);
        registry.claimTerritory(HASH_1, 0, 500, -73985000, 40742000, -73980000, 40747000);
    }

    function test_ClaimTerritory_RevertAlreadyClaimed() public {
        vm.prank(alice);
        registry.claimTerritory(HASH_1, 5000, 500, -73985000, 40742000, -73980000, 40747000);

        vm.prank(bob);
        vm.expectRevert(ITerritoryRegistry.AlreadyOwned.selector);
        registry.claimTerritory(HASH_1, 5000, 500, -73985000, 40742000, -73980000, 40747000);
    }

    function test_MultipleTerritories() public {
        vm.startPrank(alice);
        registry.claimTerritory(HASH_1, 5000, 500, -73985000, 40742000, -73980000, 40747000);
        registry.claimTerritory(HASH_2, 3000, 300, -73990000, 40740000, -73985000, 40745000);
        vm.stopPrank();

        assertEq(registry.getUserTerritoryCount(alice), 2);
        assertEq(registry.totalTerritories(), 2);

        bytes32[] memory territories = registry.getUserTerritories(alice);
        assertEq(territories.length, 2);
        assertEq(territories[0], HASH_1);
        assertEq(territories[1], HASH_2);
    }

    // ─── Reinforce ──────────────────────────────────────────────────

    function test_ReinforceTerritory() public {
        vm.startPrank(alice);
        registry.claimTerritory(HASH_1, 5000, 500, -73985000, 40742000, -73980000, 40747000);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit TerritoryReinforced(HASH_1, alice, block.timestamp, 800);

        registry.reinforceTerritory(HASH_1, 800);

        ITerritoryRegistry.Territory memory t = registry.getTerritory(HASH_1);
        assertEq(t.controlStrength, 800);
        assertEq(t.lastReinforced, block.timestamp);
    }

    function test_ReinforceTerritory_RevertNotController() public {
        vm.prank(alice);
        registry.claimTerritory(HASH_1, 5000, 500, -73985000, 40742000, -73980000, 40747000);

        vm.prank(bob);
        vm.expectRevert(ITerritoryRegistry.NotController.selector);
        registry.reinforceTerritory(HASH_1, 800);
    }

    function test_ReinforceTerritory_RevertUnowned() public {
        vm.prank(alice);
        vm.expectRevert(ITerritoryRegistry.Unowned.selector);
        registry.reinforceTerritory(HASH_1, 800);
    }

    function test_ReinforceTerritory_CapsStrength() public {
        vm.startPrank(alice);
        registry.claimTerritory(HASH_1, 5000, 500, -73985000, 40742000, -73980000, 40747000);
        registry.reinforceTerritory(HASH_1, 9999);
        vm.stopPrank();

        ITerritoryRegistry.Territory memory t = registry.getTerritory(HASH_1);
        assertEq(t.controlStrength, registry.MAX_STRENGTH());
    }

    // ─── Decay ──────────────────────────────────────────────────────

    function test_Decay_BeforeInterval_NoChange() public {
        vm.prank(alice);
        registry.claimTerritory(HASH_1, 5000, 500, -73985000, 40742000, -73980000, 40747000);

        vm.warp(block.timestamp + 3 days);

        registry.decayTerritory(HASH_1);

        ITerritoryRegistry.Territory memory t = registry.getTerritory(HASH_1);
        assertEq(t.controlStrength, 500);
    }

    function test_Decay_AfterInterval_ReducesStrength() public {
        vm.prank(alice);
        registry.claimTerritory(HASH_1, 5000, 500, -73985000, 40742000, -73980000, 40747000);

        vm.warp(block.timestamp + 7 days);

        vm.expectEmit(false, false, false, true);
        emit TerritoryDecayed(HASH_1, block.timestamp, 400);
        registry.decayTerritory(HASH_1);

        ITerritoryRegistry.Territory memory t = registry.getTerritory(HASH_1);
        assertEq(t.controlStrength, 400);
        assertEq(registry.getController(HASH_1), alice);
    }

    function test_Decay_ToZero_RemovesTerritory() public {
        vm.prank(alice);
        registry.claimTerritory(HASH_1, 5000, 100, -73985000, 40742000, -73980000, 40747000);

        vm.warp(block.timestamp + 7 days);

        vm.expectEmit(true, true, false, true);
        emit TerritoryLost(HASH_1, alice, block.timestamp);
        registry.decayTerritory(HASH_1);

        assertEq(registry.getController(HASH_1), address(0));
        assertEq(registry.getUserTerritoryCount(alice), 0);
        assertEq(registry.totalTerritories(), 0);
    }

    function test_Decay_ReinforcePreventsLoss() public {
        vm.prank(alice);
        registry.claimTerritory(HASH_1, 5000, 100, -73985000, 40742000, -73980000, 40747000);

        vm.warp(block.timestamp + 5 days);
        vm.prank(alice);
        registry.reinforceTerritory(HASH_1, 300);

        vm.warp(block.timestamp + 7 days);
        registry.decayTerritory(HASH_1);

        ITerritoryRegistry.Territory memory t = registry.getTerritory(HASH_1);
        assertEq(t.controlStrength, 200);
        assertEq(registry.getUserTerritoryCount(alice), 1);
    }

    // ─── View functions ─────────────────────────────────────────────

    function test_GetController_Unowned() public view {
        assertEq(registry.getController(HASH_1), address(0));
    }

    function test_GetUserTerritories_Empty() public view {
        bytes32[] memory territories = registry.getUserTerritories(alice);
        assertEq(territories.length, 0);
    }

    function test_GetUserTerritoryCount_Zero() public view {
        assertEq(registry.getUserTerritoryCount(alice), 0);
    }

    function test_TotalTerritories_Zero() public view {
        assertEq(registry.totalTerritories(), 0);
    }

    // ─── Pausable ───────────────────────────────────────────────────

    function test_Pause_RevertIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.pause();
    }

    function test_Pause_PreventsClaiming() public {
        registry.pause();

        vm.prank(alice);
        vm.expectRevert();
        registry.claimTerritory(HASH_1, 5000, 500, -73985000, 40742000, -73980000, 40747000);
    }

    function test_Pause_PreventsReinforce() public {
        vm.prank(alice);
        registry.claimTerritory(HASH_1, 5000, 500, -73985000, 40742000, -73980000, 40747000);
        registry.pause();

        vm.prank(alice);
        vm.expectRevert();
        registry.reinforceTerritory(HASH_1, 600);
    }

    function test_Unpause_AllowsClaiming() public {
        registry.pause();
        registry.unpause();

        vm.prank(alice);
        registry.claimTerritory(HASH_1, 5000, 500, -73985000, 40742000, -73980000, 40747000);
        assertEq(registry.getController(HASH_1), alice);
    }

    // ─── Fuzz ───────────────────────────────────────────────────────

    function testFuzz_ClaimTerritory(uint256 strength) public {
        vm.assume(strength > 0 && strength < type(uint256).max);

        vm.prank(alice);
        registry.claimTerritory(HASH_1, 5000, strength, -73985000, 40742000, -73980000, 40747000);

        ITerritoryRegistry.Territory memory t = registry.getTerritory(HASH_1);
        uint256 expected = strength > registry.MAX_STRENGTH() ? registry.MAX_STRENGTH() : strength;
        assertEq(t.controlStrength, expected);
    }

    function testFuzz_MultipleTerritories(uint8 count) public {
        vm.assume(count > 0 && count <= 50);

        vm.startPrank(alice);
        for (uint8 i = 0; i < count; i++) {
            bytes32 hash = _hashFromIndex(i);
            registry.claimTerritory(hash, 1000 + i, 100 + i, -73985000, 40742000, -73980000, 40747000);
        }
        vm.stopPrank();

        assertEq(registry.getUserTerritoryCount(alice), count);
        assertEq(registry.totalTerritories(), count);
    }

    function _hashFromIndex(uint8 i) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("polygon_", i));
    }
}
