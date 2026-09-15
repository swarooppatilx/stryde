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
import {EventRegistry} from "../src/EventRegistry.sol";
import {RelayerRoles} from "./RelayerRoles.sol";

contract DeployAll is Script {
    // State, not locals: eleven contracts plus the role grant overflow the compiler's stack.
    ProfileRegistry internal profileRegistry;
    ActivityRegistry internal activityRegistry;
    TerritoryRegistry internal territoryRegistry;
    SeasonManager internal seasonManager;
    AchievementRegistry internal achievementRegistry;
    ChallengeRegistry internal challengeRegistry;
    TerritoryNFT internal territoryNFT;
    MoveToEarnToken internal moveToEarnToken;
    GroupRegistry internal groupRegistry;
    SocialRegistry internal socialRegistry;
    EventRegistry internal eventRegistry;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        profileRegistry = new ProfileRegistry();
        console.log("ProfileRegistry:", address(profileRegistry));

        activityRegistry = new ActivityRegistry();
        console.log("ActivityRegistry:", address(activityRegistry));

        territoryRegistry = new TerritoryRegistry();
        console.log("TerritoryRegistry:", address(territoryRegistry));

        seasonManager = new SeasonManager();
        console.log("SeasonManager:", address(seasonManager));

        achievementRegistry = new AchievementRegistry();
        console.log("AchievementRegistry:", address(achievementRegistry));

        challengeRegistry = new ChallengeRegistry();
        console.log("ChallengeRegistry:", address(challengeRegistry));

        territoryNFT = new TerritoryNFT();
        console.log("TerritoryNFT:", address(territoryNFT));

        moveToEarnToken = new MoveToEarnToken();
        console.log("MoveToEarnToken:", address(moveToEarnToken));

        groupRegistry = new GroupRegistry();
        console.log("GroupRegistry:", address(groupRegistry));

        socialRegistry = new SocialRegistry();
        console.log("SocialRegistry:", address(socialRegistry));
        eventRegistry = new EventRegistry();
        console.log("EventRegistry:", address(eventRegistry));

        // The deployer starts with every role. When the relayer is a different key, hand it its roles in the same
        // run; otherwise verification, settlement, season contributions and minting stop working. Set
        // RELAYER_ADDRESS to the relayer's address (leave it unset when the relayer key is the deployer's).
        address relayer = vm.envOr("RELAYER_ADDRESS", vm.addr(deployerPrivateKey));
        if (relayer != vm.addr(deployerPrivateKey)) {
            RelayerRoles.grant(
                relayer,
                profileRegistry,
                seasonManager,
                achievementRegistry,
                challengeRegistry,
                territoryNFT,
                moveToEarnToken
            );
            console.log("Relayer roles granted to:", relayer);
        } else {
            console.log("Relayer is the deployer: no extra role transactions needed");
        }

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
        console.log("eventRegistry=", address(eventRegistry));
    }
}
