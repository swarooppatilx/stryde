use crate::pb::stryde::v1::*;

const SECONDS_PER_DAY: u64 = 86_400;

/// Normalizes each recorded activity to the UTC day it counts toward.
pub fn derive_activity_days(events: &Events) -> Vec<ActivityDay> {
    events
        .activity_recorded
        .iter()
        .map(|a| ActivityDay {
            user: a.owner.clone(),
            day: a.timestamp / SECONDS_PER_DAY,
            activity_id: a.activity_id,
            block_number: a.block_number,
            block_timestamp: a.block_timestamp,
        })
        .collect()
}
