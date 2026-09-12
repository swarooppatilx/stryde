// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProfileRegistry} from "../src/ProfileRegistry.sol";
import {ActivityRegistry} from "../src/ActivityRegistry.sol";
import {TerritoryRegistry} from "../src/TerritoryRegistry.sol";
import {SeasonManager} from "../src/SeasonManager.sol";
import {AchievementRegistry} from "../src/AchievementRegistry.sol";
import {ChallengeRegistry} from "../src/ChallengeRegistry.sol";
import {TerritoryNFT} from "../src/TerritoryNFT.sol";
import {MoveToEarnToken} from "../src/MoveToEarnToken.sol";
import {GroupRegistry} from "../src/GroupRegistry.sol";
import {SocialRegistry} from "../src/SocialRegistry.sol";

contract DeployAll is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        ProfileRegistry profileRegistry = new ProfileRegistry();
        console.log("ProfileRegistry:", address(profileRegistry));

        ActivityRegistry activityRegistry = new ActivityRegistry();
        console.log("ActivityRegistry:", address(activityRegistry));

        TerritoryRegistry territoryRegistry = new TerritoryRegistry();
        console.log("TerritoryRegistry:", address(territoryRegistry));

        SeasonManager seasonManager = new SeasonManager();
        console.log("SeasonManager:", address(seasonManager));

        AchievementRegistry achievementRegistry = new AchievementRegistry();
        console.log("AchievementRegistry:", address(achievementRegistry));

        ChallengeRegistry challengeRegistry = new ChallengeRegistry();
        console.log("ChallengeRegistry:", address(challengeRegistry));

        TerritoryNFT territoryNFT = new TerritoryNFT();
        console.log("TerritoryNFT:", address(territoryNFT));

        MoveToEarnToken moveToEarnToken = new MoveToEarnToken();
        console.log("MoveToEarnToken:", address(moveToEarnToken));

        GroupRegistry groupRegistry = new GroupRegistry();
        console.log("GroupRegistry:", address(groupRegistry));

        SocialRegistry socialRegistry = new SocialRegistry();
        console.log("SocialRegistry:", address(socialRegistry));

        vm.stopBroadcast();

        console.log("\n=== All contracts deployed ===");
        console.log("profileRegistry=", address(profileRegistry));
        console.log("activityRegistry=", address(activityRegistry));
        console.log("territoryRegistry=", address(territoryRegistry));
        console.log("seasonManager=", address(seasonManager));
        console.log("achievementRegistry=", address(achievementRegistry));
        console.log("challengeRegistry=", address(challengeRegistry));
        console.log("territoryNFT=", address(territoryNFT));
        console.log("moveToEarnToken=", address(moveToEarnToken));
        console.log("groupRegistry=", address(groupRegistry));
        console.log("socialRegistry=", address(socialRegistry));
    }
}
