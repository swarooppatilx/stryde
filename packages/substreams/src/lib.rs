mod abi;
mod derive_activity_streaks;
mod derive_leaderboard;
mod derive_territory;
mod map_events;
mod pb;

use pb::stryde::v1;
use substreams::store::{StoreNew, StoreSet, StoreSetInt64};
use substreams_ethereum::pb::eth::v2::Block;

#[substreams::handlers::map]
fn map_events(block: Block) -> Result<v1::Events, substreams::errors::Error> {
    map_events::extract_events(block)
}

#[substreams::handlers::map]
fn derive_territory_snapshots(
    events: v1::Events,
) -> Result<v1::TerritorySnapshots, substreams::errors::Error> {
    Ok(v1::TerritorySnapshots { snapshots: derive_territory::derive_territory_snapshots(&events) })
}

#[substreams::handlers::map]
fn derive_season_standings(
    events: v1::Events,
) -> Result<v1::SeasonStandingUpdates, substreams::errors::Error> {
    Ok(v1::SeasonStandingUpdates { updates: derive_leaderboard::derive_season_standings(&events) })
}

/// Latest season total per participant, keyed `season:<id>:user:<hex>`.
#[substreams::handlers::store]
fn store_season_totals(updates: v1::SeasonStandingUpdates, store: StoreSetInt64) {
    for u in updates.updates {
        let key = format!("season:{}:user:{}", u.season_id, hex::encode(&u.user));
        store.set(0, key, &(u.total_distance as i64));
    }
}

#[substreams::handlers::map]
fn derive_activity_days(events: v1::Events) -> Result<v1::ActivityDays, substreams::errors::Error> {
    Ok(v1::ActivityDays { days: derive_activity_streaks::derive_activity_days(&events) })
}
