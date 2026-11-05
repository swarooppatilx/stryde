// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ProfileRegistry} from "../src/ProfileRegistry.sol";
import {SeasonManager} from "../src/SeasonManager.sol";
import {AchievementRegistry} from "../src/AchievementRegistry.sol";
import {ChallengeRegistry} from "../src/ChallengeRegistry.sol";
import {TerritoryNFT} from "../src/TerritoryNFT.sol";
import {MoveToEarnToken} from "../src/MoveToEarnToken.sol";

/// The roles the relayer works with. Each contract gives them to the deployer at construction, so
/// when the relayer is another key they must be handed over, or verification, challenge settlement,
/// season contributions and minting quietly stop working after a redeploy. The caller must be the
/// owner (the deployer); ownership itself stays with the deployer.
library RelayerRoles {
    function grant(
        address relayer,
        ProfileRegistry profile,
        SeasonManager season,
        AchievementRegistry achievements,
        ChallengeRegistry challenges,
        TerritoryNFT territories,
        MoveToEarnToken token
    ) internal {
        profile.setVerifier(relayer);
        season.setRecorder(relayer, true);
        challenges.setSettler(relayer);
        achievements.grantRole(achievements.MINTER_ROLE(), relayer);
        territories.grantRole(territories.MINTER_ROLE(), relayer);
        token.grantRole(token.MINTER_ROLE(), relayer);
    }
}
