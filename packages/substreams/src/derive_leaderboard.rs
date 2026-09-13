use crate::pb::stryde::v1::*;

/// Season standings touched in this block, using SeasonManager's running
/// `total` (not the per-event contribution) so values are correct across blocks.
pub fn derive_season_standings(events: &Events) -> Vec<SeasonStandingUpdate> {
    events
        .contribution_recorded
        .iter()
        .map(|c| SeasonStandingUpdate {
            season_id: c.season_id,
            user: c.participant.clone(),
            total_distance: c.total,
            contribution: c.contribution,
            block_number: c.block_number,
            block_timestamp: c.block_timestamp,
        })
        .collect()
}
