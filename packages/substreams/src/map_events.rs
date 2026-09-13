use hex_literal::hex;
use substreams_ethereum::pb::eth::v2::Block;
use substreams_ethereum::Event;

use crate::abi;
use crate::pb::stryde::v1;

// Sepolia deployment — must match packages/shared/src/constants.ts and
// packages/subgraph/subgraph.yaml.
const PROFILE_REGISTRY: [u8; 20] = hex!("7f7c12c204229a76815470707de2384cd369ba23");
const ACTIVITY_REGISTRY: [u8; 20] = hex!("569dffc017a0040e381ae859dcfd34ff7fb94b1c");
const TERRITORY_REGISTRY: [u8; 20] = hex!("47a345474256c297eb78e28f1eb5026269b8220a");
const SEASON_MANAGER: [u8; 20] = hex!("e4a98f8eee705a9114d8bed7a9064cc00be14ccd");
const ACHIEVEMENT_REGISTRY: [u8; 20] = hex!("545945d83ff0dee4dbe993884e6951ea994bbe8e");
const CHALLENGE_REGISTRY: [u8; 20] = hex!("0a149740740927270326c7014e7c04aa5a0a299d");
const GROUP_REGISTRY: [u8; 20] = hex!("314c216c504cec6a2ccc0621fc3e25ff3487ffdd");
const SOCIAL_REGISTRY: [u8; 20] = hex!("0e8b3ca753d64809a2fe3982952bd86f9ff301ac");

/// Decodes every Stryde contract event in the block. Topic hashes and field
/// layouts come from the ABI-generated bindings in `src/abi` (see build.rs),
/// so each event is only matched by its real signature and emitting contract.
pub fn extract_events(block: Block) -> Result<v1::Events, substreams::errors::Error> {
    let mut out = v1::Events::default();
    let block_number = block.number;
    let block_timestamp = block.timestamp_seconds();

    for view in block.logs() {
        let log = view.log;
        let address: [u8; 20] = match log.address.as_slice().try_into() {
            Ok(a) => a,
            Err(_) => continue,
        };
        let log_index = log.block_index as u64;
        let tx_hash = view.receipt.transaction.hash.clone();

        if address == PROFILE_REGISTRY {
            if let Some(ev) = abi::profile_registry::events::ProfileCreated::match_and_decode(log) {
                out.profile_created.push(v1::ProfileCreated {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    profile_id: ev.profile_id.to_u64(),
                    wallet: ev.wallet,
                    username: ev.username,
                    joined_at: ev.joined_at.to_u64(),
                });
                continue;
            }
            if let Some(ev) = abi::profile_registry::events::AvatarUpdated::match_and_decode(log) {
                out.avatar_updated.push(v1::AvatarUpdated {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    wallet: ev.wallet,
                    cid: ev.cid,
                });
                continue;
            }
            if let Some(ev) = abi::profile_registry::events::ProfileVerified::match_and_decode(log)
            {
                out.profile_verified.push(v1::ProfileVerified {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    wallet: ev.wallet,
                    nullifier_hash: ev.nullifier_hash.to_vec(),
                    verified_at: ev.verified_at.to_u64(),
                });
                continue;
            }
        }
        if address == ACTIVITY_REGISTRY {
            if let Some(ev) =
                abi::activity_registry::events::ActivityRecorded::match_and_decode(log)
            {
                out.activity_recorded.push(v1::ActivityRecorded {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    activity_id: ev.activity_id.to_u64(),
                    owner: ev.owner,
                    activity_hash: ev.activity_hash.to_vec(),
                    activity_type: ev.activity_type.to_u64() as u32,
                    distance: ev.distance.to_u64(),
                    duration: ev.duration.to_u64(),
                    timestamp: ev.timestamp.to_u64(),
                    territory_area: ev.territory_area.to_u64(),
                });
                continue;
            }
            if let Some(ev) =
                abi::activity_registry::events::ActivityMetadataUpdated::match_and_decode(log)
            {
                out.activity_metadata_updated
                    .push(v1::ActivityMetadataUpdated {
                        log_index,
                        block_number,
                        block_timestamp,
                        tx_hash: tx_hash.clone(),
                        activity_id: ev.activity_id.to_u64(),
                        owner: ev.owner,
                        metadata_cid: ev.metadata_cid,
                    });
                continue;
            }
        }
        if address == TERRITORY_REGISTRY {
            if let Some(ev) =
                abi::territory_registry::events::TerritoryClaimed::match_and_decode(log)
            {
                out.territory_claimed.push(v1::TerritoryClaimed {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    territory_id: ev.territory_id.to_vec(),
                    controller: ev.controller,
                    area_sqm: ev.area_sqm.to_u64(),
                    polygon_hash: ev.polygon_hash.to_vec(),
                    min_lng: ev.min_lng.to_i32(),
                    min_lat: ev.min_lat.to_i32(),
                    max_lng: ev.max_lng.to_i32(),
                    max_lat: ev.max_lat.to_i32(),
                    captured_at: ev.captured_at.to_u64(),
                    strength: ev.strength.to_u64(),
                });
                continue;
            }
            if let Some(ev) =
                abi::territory_registry::events::TerritoryReinforced::match_and_decode(log)
            {
                out.territory_reinforced.push(v1::TerritoryReinforced {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    territory_id: ev.territory_id.to_vec(),
                    controller: ev.controller,
                    reinforced_at: ev.reinforced_at.to_u64(),
                    strength: ev.strength.to_u64(),
                });
                continue;
            }
            if let Some(ev) =
                abi::territory_registry::events::TerritoryDecayed::match_and_decode(log)
            {
                out.territory_decayed.push(v1::TerritoryDecayed {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    territory_id: ev.territory_id.to_vec(),
                    decayed_at: ev.decayed_at.to_u64(),
                    remaining_strength: ev.remaining_strength.to_u64(),
                });
                continue;
            }
            if let Some(ev) = abi::territory_registry::events::TerritoryLost::match_and_decode(log)
            {
                out.territory_lost.push(v1::TerritoryLost {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    territory_id: ev.territory_id.to_vec(),
                    old_controller: ev.old_controller,
                    lost_at: ev.lost_at.to_u64(),
                });
                continue;
            }
        }
        if address == SEASON_MANAGER {
            if let Some(ev) = abi::season_manager::events::SeasonStarted::match_and_decode(log) {
                out.season_started.push(v1::SeasonStarted {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    season_id: ev.season_id.to_u64(),
                    start_time: ev.start_time.to_u64(),
                    end_time: ev.end_time.to_u64(),
                });
                continue;
            }
            if let Some(ev) = abi::season_manager::events::SeasonEnded::match_and_decode(log) {
                out.season_ended.push(v1::SeasonEnded {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    season_id: ev.season_id.to_u64(),
                    end_time: ev.end_time.to_u64(),
                    participant_count: ev.participant_count.to_u64(),
                });
                continue;
            }
            if let Some(ev) =
                abi::season_manager::events::ContributionRecorded::match_and_decode(log)
            {
                out.contribution_recorded.push(v1::ContributionRecorded {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    season_id: ev.season_id.to_u64(),
                    participant: ev.participant,
                    contribution: ev.contribution.to_u64(),
                    total: ev.total.to_u64(),
                });
                continue;
            }
        }
        if address == ACHIEVEMENT_REGISTRY {
            if let Some(ev) =
                abi::achievement_registry::events::AchievementMinted::match_and_decode(log)
            {
                out.achievement_minted.push(v1::AchievementMinted {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    token_id: ev.token_id.to_u64(),
                    recipient: ev.recipient,
                    achievement_id: ev.achievement_id.to_vec(),
                });
                continue;
            }
            if let Some(ev) =
                abi::achievement_registry::events::AchievementDefined::match_and_decode(log)
            {
                out.achievement_defined.push(v1::AchievementDefined {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    achievement_id: ev.achievement_id.to_vec(),
                    name: ev.name,
                });
                continue;
            }
        }
        if address == CHALLENGE_REGISTRY {
            if let Some(ev) =
                abi::challenge_registry::events::ChallengeCreated::match_and_decode(log)
            {
                out.challenge_created.push(v1::ChallengeCreated {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    challenge_id: ev.challenge_id.to_u64(),
                    challenger: ev.challenger,
                    opponent: ev.opponent,
                    activity_type: ev.activity_type.to_u64() as u32,
                    target_metric: ev.target_metric.to_u64(),
                    deadline: ev.deadline.to_u64(),
                    stake: ev.stake.to_string(),
                });
                continue;
            }
            if let Some(ev) =
                abi::challenge_registry::events::ChallengeAccepted::match_and_decode(log)
            {
                out.challenge_accepted.push(v1::ChallengeAccepted {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    challenge_id: ev.challenge_id.to_u64(),
                    opponent: ev.opponent,
                });
                continue;
            }
            if let Some(ev) =
                abi::challenge_registry::events::ChallengeSettled::match_and_decode(log)
            {
                out.challenge_settled.push(v1::ChallengeSettled {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    challenge_id: ev.challenge_id.to_u64(),
                    winner: ev.winner,
                    loser: ev.loser,
                    payout: ev.payout.to_string(),
                });
                continue;
            }
            if let Some(ev) =
                abi::challenge_registry::events::ChallengeCancelled::match_and_decode(log)
            {
                out.challenge_cancelled.push(v1::ChallengeCancelled {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    challenge_id: ev.challenge_id.to_u64(),
                    canceller: ev.canceller,
                });
                continue;
            }
            if let Some(ev) =
                abi::challenge_registry::events::ChallengeWithdrawn::match_and_decode(log)
            {
                out.challenge_withdrawn.push(v1::ChallengeWithdrawn {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    challenge_id: ev.challenge_id.to_u64(),
                    withdrawer: ev.withdrawer,
                    amount: ev.amount.to_string(),
                });
                continue;
            }
        }
        if address == GROUP_REGISTRY {
            if let Some(ev) = abi::group_registry::events::GroupCreated::match_and_decode(log) {
                out.group_created.push(v1::GroupCreated {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    group_id: ev.group_id.to_u64(),
                    owner: ev.owner,
                    name: ev.name,
                    location: ev.location,
                    description: ev.description,
                    sport_type: ev.sport_type.to_u64() as u32,
                    created_at: ev.created_at.to_u64(),
                });
                continue;
            }
            if let Some(ev) = abi::group_registry::events::GroupJoined::match_and_decode(log) {
                out.group_joined.push(v1::GroupJoined {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    group_id: ev.group_id.to_u64(),
                    member: ev.member,
                    member_count: ev.member_count.to_u64(),
                });
                continue;
            }
            if let Some(ev) = abi::group_registry::events::GroupLeft::match_and_decode(log) {
                out.group_left.push(v1::GroupLeft {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    group_id: ev.group_id.to_u64(),
                    member: ev.member,
                    member_count: ev.member_count.to_u64(),
                });
                continue;
            }
            if let Some(ev) = abi::group_registry::events::GroupDissolved::match_and_decode(log) {
                out.group_dissolved.push(v1::GroupDissolved {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    group_id: ev.group_id.to_u64(),
                    last_owner: ev.last_owner,
                    dissolved_at: ev.dissolved_at.to_u64(),
                });
                continue;
            }
        }
        if address == SOCIAL_REGISTRY {
            if let Some(ev) = abi::social_registry::events::KudosGiven::match_and_decode(log) {
                out.kudos_given.push(v1::KudosGiven {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    activity_id: ev.activity_id.to_u64(),
                    giver: ev.giver,
                    timestamp: ev.timestamp.to_u64(),
                });
                continue;
            }
            if let Some(ev) = abi::social_registry::events::KudosRevoked::match_and_decode(log) {
                out.kudos_revoked.push(v1::KudosRevoked {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    activity_id: ev.activity_id.to_u64(),
                    giver: ev.giver,
                    timestamp: ev.timestamp.to_u64(),
                });
                continue;
            }
            if let Some(ev) = abi::social_registry::events::CommentAdded::match_and_decode(log) {
                out.comment_added.push(v1::CommentAdded {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    activity_id: ev.activity_id.to_u64(),
                    author: ev.author,
                    comment_id: ev.comment_id.to_vec(),
                    comment_cid: ev.comment_cid,
                    timestamp: ev.timestamp.to_u64(),
                });
                continue;
            }
        }
    }

    Ok(out)
}
