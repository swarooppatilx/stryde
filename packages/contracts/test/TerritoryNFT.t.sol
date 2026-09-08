// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {TerritoryNFT} from "../src/TerritoryNFT.sol";
import {ITerritoryNFT} from "../src/interfaces/ITerritoryNFT.sol";

contract TerritoryNFTTest is Test {
    TerritoryNFT public nft;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    bytes32 constant POLYGON_A = keccak256("POLYGON_A");
    bytes32 constant POLYGON_B = keccak256("POLYGON_B");

    event TerritoryMinted(uint256 indexed tokenId, address indexed recipient, bytes32 indexed polygonHash);
    event TerritoryBurned(uint256 indexed tokenId, bytes32 indexed polygonHash);

    function setUp() public {
        nft = new TerritoryNFT();
    }

    // ─── Mint ───────────────────────────────────────────────────────

    function test_MintTerritory() public {
        uint256 tokenId = uint256(POLYGON_A);

        vm.expectEmit(true, true, true, true);
        emit TerritoryMinted(tokenId, alice, POLYGON_A);

        nft.mintTerritory(alice, POLYGON_A);

        assertEq(nft.balanceOf(alice), 1);
        assertEq(nft.ownerOf(tokenId), alice);
        assertEq(nft.getTokenCount(alice), 1);
        assertTrue(nft.isMinted(POLYGON_A));

        uint256[] memory tokens = nft.getTokenIds(alice);
        assertEq(tokens.length, 1);
        assertEq(tokens[0], tokenId);
    }

    function test_MintTerritory_TokenIdMatchesPolygonHash() public {
        nft.mintTerritory(alice, POLYGON_A);
        assertEq(nft.ownerOf(uint256(POLYGON_A)), alice);
    }

    function test_MintTerritory_Multiple() public {
        nft.mintTerritory(alice, POLYGON_A);
        nft.mintTerritory(bob, POLYGON_B);

        assertEq(nft.balanceOf(alice), 1);
        assertEq(nft.balanceOf(bob), 1);
        assertTrue(nft.isMinted(POLYGON_A));
        assertTrue(nft.isMinted(POLYGON_B));
    }

    function test_MintTerritory_RevertNotMinter() public {
        vm.prank(alice);
        vm.expectRevert();
        nft.mintTerritory(alice, POLYGON_A);
    }

    function test_MintTerritory_RevertZeroAddress() public {
        vm.expectRevert(ITerritoryNFT.ZeroAddress.selector);
        nft.mintTerritory(address(0), POLYGON_A);
    }

    function test_MintTerritory_RevertEmptyHash() public {
        vm.expectRevert(ITerritoryNFT.EmptyPolygonHash.selector);
        nft.mintTerritory(alice, bytes32(0));
    }

    function test_MintTerritory_RevertAlreadyMinted() public {
        nft.mintTerritory(alice, POLYGON_A);
        vm.expectRevert(ITerritoryNFT.TerritoryAlreadyMinted.selector);
        nft.mintTerritory(bob, POLYGON_A);
    }

    // ─── Burn ───────────────────────────────────────────────────────

    function test_BurnTerritory() public {
        nft.mintTerritory(alice, POLYGON_A);
        uint256 tokenId = uint256(POLYGON_A);

        vm.expectEmit(true, true, false, true);
        emit TerritoryBurned(tokenId, POLYGON_A);

        nft.burnTerritory(POLYGON_A);

        assertFalse(nft.isMinted(POLYGON_A));
        assertEq(nft.balanceOf(alice), 0);
        assertEq(nft.getTokenCount(alice), 0);

        uint256[] memory tokens = nft.getTokenIds(alice);
        assertEq(tokens.length, 0);

        vm.expectRevert();
        nft.ownerOf(tokenId);
    }

    function test_BurnTerritory_RemovesFromUserTokensArray() public {
        nft.mintTerritory(alice, POLYGON_A);
        nft.mintTerritory(alice, POLYGON_B);

        nft.burnTerritory(POLYGON_A);

        uint256[] memory tokens = nft.getTokenIds(alice);
        assertEq(tokens.length, 1);
        assertEq(tokens[0], uint256(POLYGON_B));
        assertEq(nft.getTokenCount(alice), 1);
    }

    function test_BurnTerritory_RevertNotMinted() public {
        vm.expectRevert(ITerritoryNFT.TerritoryNotMinted.selector);
        nft.burnTerritory(POLYGON_A);
    }

    function test_BurnTerritory_RevertNotMinter() public {
        nft.mintTerritory(alice, POLYGON_A);
        vm.prank(alice);
        vm.expectRevert();
        nft.burnTerritory(POLYGON_A);
    }

    function test_Remint_AfterBurn() public {
        uint256 tokenId = uint256(POLYGON_A);

        nft.mintTerritory(alice, POLYGON_A);
        nft.burnTerritory(POLYGON_A);
        nft.mintTerritory(bob, POLYGON_A);

        assertEq(nft.ownerOf(tokenId), bob);
        assertTrue(nft.isMinted(POLYGON_A));
        assertEq(nft.balanceOf(alice), 0);
        assertEq(nft.balanceOf(bob), 1);
    }

    // ─── Soulbound ──────────────────────────────────────────────────

    function test_Transfer_Revert() public {
        nft.mintTerritory(alice, POLYGON_A);

        vm.startPrank(alice);
        vm.expectRevert(ITerritoryNFT.SoulboundTransfer.selector);
        nft.transferFrom(alice, bob, uint256(POLYGON_A));
        vm.stopPrank();
    }

    function test_SafeTransfer_Revert() public {
        nft.mintTerritory(alice, POLYGON_A);

        vm.startPrank(alice);
        vm.expectRevert(ITerritoryNFT.SoulboundTransfer.selector);
        nft.safeTransferFrom(alice, bob, uint256(POLYGON_A));
        vm.stopPrank();
    }

    function test_Approval_ButNoTransfer() public {
        nft.mintTerritory(alice, POLYGON_A);
        uint256 tokenId = uint256(POLYGON_A);

        vm.prank(alice);
        nft.approve(bob, tokenId);

        vm.startPrank(bob);
        vm.expectRevert(ITerritoryNFT.SoulboundTransfer.selector);
        nft.transferFrom(alice, bob, tokenId);
        vm.stopPrank();

        assertEq(nft.ownerOf(tokenId), alice);
    }

    // ─── View functions ─────────────────────────────────────────────

    function test_IsMinted_DefaultFalse() public view {
        assertFalse(nft.isMinted(POLYGON_A));
    }

    function test_GetTokenCount_Zero() public view {
        assertEq(nft.getTokenCount(alice), 0);
    }

    function test_GetTokenIds_Empty() public view {
        uint256[] memory tokens = nft.getTokenIds(alice);
        assertEq(tokens.length, 0);
    }

    // ─── Pausable ───────────────────────────────────────────────────

    function test_Pause_PreventsMint() public {
        nft.pause();
        vm.expectRevert();
        nft.mintTerritory(alice, POLYGON_A);
    }

    function test_Pause_PreventsBurn() public {
        nft.mintTerritory(alice, POLYGON_A);
        nft.pause();
        vm.expectRevert();
        nft.burnTerritory(POLYGON_A);
    }

    function test_Unpause_AllowsMint() public {
        nft.pause();
        nft.unpause();

        nft.mintTerritory(alice, POLYGON_A);
        assertEq(nft.balanceOf(alice), 1);
    }

    // ─── Fuzz ───────────────────────────────────────────────────────

    function testFuzz_MintBurnRoundtrip(bytes32 polygonHash) public {
        vm.assume(polygonHash != bytes32(0));

        nft.mintTerritory(alice, polygonHash);
        assertTrue(nft.isMinted(polygonHash));

        nft.burnTerritory(polygonHash);
        assertFalse(nft.isMinted(polygonHash));

        nft.mintTerritory(bob, polygonHash);
        assertEq(nft.ownerOf(uint256(polygonHash)), bob);
    }

    function testFuzz_TokenIdMatchesPolygonHash(bytes32 polygonHash) public {
        vm.assume(polygonHash != bytes32(0));

        nft.mintTerritory(alice, polygonHash);
        assertEq(nft.ownerOf(uint256(polygonHash)), alice);
    }
}
