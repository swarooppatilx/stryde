use hex_literal::hex;
use substreams::scalar::BigInt;
use substreams_ethereum::pb::eth::v2::Block;
use substreams_ethereum::Event;

use crate::abi;
use crate::pb::stryde::v1;

/// Contract fields are uint256 and users control them, so out-of-range values clamp instead of
/// aborting the whole block (BigInt::to_u64 panics).
fn saturating_u64(value: &BigInt) -> u64 {
    u64::try_from(value).unwrap_or(u64::MAX)
}

fn saturating_u32(value: &BigInt) -> u32 {
    u32::try_from(saturating_u64(value)).unwrap_or(u32::MAX)
}

// Sepolia deployment — must match packages/shared/src/constants.ts and
// packages/subgraph/subgraph.yaml.
const PROFILE_REGISTRY: [u8; 20] = hex!("348ce6af8ea0c50fb44f284dcca73b7ee5112314");
const ACTIVITY_REGISTRY: [u8; 20] = hex!("30a910fc25f0977907af86345c0b26c34e7d2439");
const TERRITORY_REGISTRY: [u8; 20] = hex!("22802b1c6fda5ca6fbc519830879a17214dba1e2");
const SEASON_MANAGER: [u8; 20] = hex!("fc42018ea93384fa6703d0eb72656c67261d1732");
const ACHIEVEMENT_REGISTRY: [u8; 20] = hex!("537f289b59b9944e14978a23f57133b738747f81");
const CHALLENGE_REGISTRY: [u8; 20] = hex!("6e196c21292e0ede7748a04a5a62be0b6ae6004c");
const GROUP_REGISTRY: [u8; 20] = hex!("eebbd3aaadcc95919e6f3a78e3a2cda57d0a3241");
const SOCIAL_REGISTRY: [u8; 20] = hex!("fc97445a56b61471720ef9e2bb0759d8d3c76561");

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
                    profile_id: saturating_u64(&ev.profile_id),
                    wallet: ev.wallet,
                    username: ev.username,
                    joined_at: saturating_u64(&ev.joined_at),
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
                    verified_at: saturating_u64(&ev.verified_at),
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
                    activity_id: saturating_u64(&ev.activity_id),
                    owner: ev.owner,
                    activity_hash: ev.activity_hash.to_vec(),
                    activity_type: saturating_u32(&ev.activity_type),
                    distance: saturating_u64(&ev.distance),
                    duration: saturating_u64(&ev.duration),
                    timestamp: saturating_u64(&ev.timestamp),
                    territory_area: saturating_u64(&ev.territory_area),
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
                        activity_id: saturating_u64(&ev.activity_id),
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
                    area_sqm: saturating_u64(&ev.area_sqm),
                    polygon_hash: ev.polygon_hash.to_vec(),
                    min_lng: ev.min_lng.to_i32(),
                    min_lat: ev.min_lat.to_i32(),
                    max_lng: ev.max_lng.to_i32(),
                    max_lat: ev.max_lat.to_i32(),
                    captured_at: saturating_u64(&ev.captured_at),
                    strength: saturating_u64(&ev.strength),
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
                    reinforced_at: saturating_u64(&ev.reinforced_at),
                    strength: saturating_u64(&ev.strength),
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
                    decayed_at: saturating_u64(&ev.decayed_at),
                    remaining_strength: saturating_u64(&ev.remaining_strength),
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
                    lost_at: saturating_u64(&ev.lost_at),
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
                    season_id: saturating_u64(&ev.season_id),
                    start_time: saturating_u64(&ev.start_time),
                    end_time: saturating_u64(&ev.end_time),
                });
                continue;
            }
            if let Some(ev) = abi::season_manager::events::SeasonEnded::match_and_decode(log) {
                out.season_ended.push(v1::SeasonEnded {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    season_id: saturating_u64(&ev.season_id),
                    end_time: saturating_u64(&ev.end_time),
                    participant_count: saturating_u64(&ev.participant_count),
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
                    season_id: saturating_u64(&ev.season_id),
                    participant: ev.participant,
                    contribution: saturating_u64(&ev.contribution),
                    total: saturating_u64(&ev.total),
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
                    token_id: saturating_u64(&ev.token_id),
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
                    challenge_id: saturating_u64(&ev.challenge_id),
                    challenger: ev.challenger,
                    opponent: ev.opponent,
                    activity_type: saturating_u32(&ev.activity_type),
                    target_metric: saturating_u64(&ev.target_metric),
                    deadline: saturating_u64(&ev.deadline),
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
                    challenge_id: saturating_u64(&ev.challenge_id),
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
                    challenge_id: saturating_u64(&ev.challenge_id),
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
                    challenge_id: saturating_u64(&ev.challenge_id),
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
                    challenge_id: saturating_u64(&ev.challenge_id),
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
                    group_id: saturating_u64(&ev.group_id),
                    owner: ev.owner,
                    name: ev.name,
                    location: ev.location,
                    description: ev.description,
                    sport_type: saturating_u32(&ev.sport_type),
                    created_at: saturating_u64(&ev.created_at),
                });
                continue;
            }
            if let Some(ev) = abi::group_registry::events::GroupJoined::match_and_decode(log) {
                out.group_joined.push(v1::GroupJoined {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    group_id: saturating_u64(&ev.group_id),
                    member: ev.member,
                    member_count: saturating_u64(&ev.member_count),
                });
                continue;
            }
            if let Some(ev) = abi::group_registry::events::GroupLeft::match_and_decode(log) {
                out.group_left.push(v1::GroupLeft {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    group_id: saturating_u64(&ev.group_id),
                    member: ev.member,
                    member_count: saturating_u64(&ev.member_count),
                });
                continue;
            }
            if let Some(ev) = abi::group_registry::events::GroupDissolved::match_and_decode(log) {
                out.group_dissolved.push(v1::GroupDissolved {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    group_id: saturating_u64(&ev.group_id),
                    last_owner: ev.last_owner,
                    dissolved_at: saturating_u64(&ev.dissolved_at),
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
                    activity_id: saturating_u64(&ev.activity_id),
                    giver: ev.giver,
                    timestamp: saturating_u64(&ev.timestamp),
                });
                continue;
            }
            if let Some(ev) = abi::social_registry::events::KudosRevoked::match_and_decode(log) {
                out.kudos_revoked.push(v1::KudosRevoked {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    activity_id: saturating_u64(&ev.activity_id),
                    giver: ev.giver,
                    timestamp: saturating_u64(&ev.timestamp),
                });
                continue;
            }
            if let Some(ev) = abi::social_registry::events::CommentAdded::match_and_decode(log) {
                out.comment_added.push(v1::CommentAdded {
                    log_index,
                    block_number,
                    block_timestamp,
                    tx_hash: tx_hash.clone(),
                    activity_id: saturating_u64(&ev.activity_id),
                    author: ev.author,
                    comment_id: ev.comment_id.to_vec(),
                    comment_cid: ev.comment_cid,
                    timestamp: saturating_u64(&ev.timestamp),
                });
                continue;
            }
        }
    }

    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_values_that_fit() {
        assert_eq!(saturating_u64(&BigInt::from(1234u64)), 1234);
        assert_eq!(saturating_u32(&BigInt::from(7u64)), 7);
    }

    #[test]
    fn clamps_instead_of_panicking_when_the_value_is_too_large() {
        let huge: BigInt = "115792089237316195423570985008687907853269984665640564039457584007913129639935"
            .parse()
            .unwrap();
        assert_eq!(saturating_u64(&huge), u64::MAX);
        assert_eq!(saturating_u32(&huge), u32::MAX);
    }
}
