// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ProfileRegistry} from "../src/ProfileRegistry.sol";
import {SeasonManager} from "../src/SeasonManager.sol";
import {AchievementRegistry} from "../src/AchievementRegistry.sol";
import {ChallengeRegistry} from "../src/ChallengeRegistry.sol";
import {TerritoryNFT} from "../src/TerritoryNFT.sol";
import {MoveToEarnToken} from "../src/MoveToEarnToken.sol";
import {RelayerRoles} from "../script/RelayerRoles.sol";

/// A redeploy must hand the relayer every role it works with, or verification, settlement,
/// season contributions and minting silently stop working (the deployer key keeps them all).
contract RelayerRolesTest is Test {
    address relayer = makeAddr("relayer");

    ProfileRegistry profile;
    SeasonManager season;
    AchievementRegistry achievements;
    ChallengeRegistry challenges;
    TerritoryNFT territories;
    MoveToEarnToken token;

    function setUp() public {
        profile = new ProfileRegistry();
        season = new SeasonManager();
        achievements = new AchievementRegistry();
        challenges = new ChallengeRegistry();
        territories = new TerritoryNFT();
        token = new MoveToEarnToken();
    }

    function _grant() internal {
        RelayerRoles.grant(relayer, profile, season, achievements, challenges, territories, token);
    }

    function test_BeforeGranting_TheRelayerHasNoRole() public view {
        assertTrue(profile.verifierAddress() != relayer);
        assertFalse(season.isRecorder(relayer));
        assertTrue(challenges.settler() != relayer);
        assertFalse(achievements.hasRole(achievements.MINTER_ROLE(), relayer));
        assertFalse(territories.hasRole(territories.MINTER_ROLE(), relayer));
        assertFalse(token.hasRole(token.MINTER_ROLE(), relayer));
    }

    function test_Granting_GivesTheRelayerEveryRole() public {
        _grant();

        assertEq(profile.verifierAddress(), relayer);
        assertTrue(season.isRecorder(relayer));
        assertEq(challenges.settler(), relayer);
        assertTrue(achievements.hasRole(achievements.MINTER_ROLE(), relayer));
        assertTrue(territories.hasRole(territories.MINTER_ROLE(), relayer));
        assertTrue(token.hasRole(token.MINTER_ROLE(), relayer));
    }

    function test_Granting_LetsTheRelayerDefineAchievements() public {
        _grant();

        vm.prank(relayer);
        achievements.defineAchievement(keccak256("first-run"), "First run");
    }

    function test_Granting_KeepsTheDeployerInControl() public {
        _grant();

        assertEq(profile.owner(), address(this));
        assertTrue(achievements.hasRole(achievements.DEFAULT_ADMIN_ROLE(), address(this)));
        assertTrue(season.owner() == address(this));
    }
}
