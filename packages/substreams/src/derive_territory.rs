use crate::pb::stryde::v1::*;

pub fn derive_territory_snapshots(events: &Events) -> Vec<TerritorySnapshot> {
    let mut snapshots = Vec::new();

    for e in &events.territory_claimed {
        snapshots.push(TerritorySnapshot {
            territory_id: e.territory_id.clone(),
            controller: e.controller.clone(),
            strength: e.strength,
            area_sqm: e.area_sqm,
            min_lng: e.min_lng,
            min_lat: e.min_lat,
            max_lng: e.max_lng,
            max_lat: e.max_lat,
            block_number: e.block_number,
            block_timestamp: e.block_timestamp,
            is_active: true,
            change_type: "claimed".into(),
        });
    }

    for e in &events.territory_reinforced {
        snapshots.push(TerritorySnapshot {
            territory_id: e.territory_id.clone(),
            controller: e.controller.clone(),
            strength: e.strength,
            block_number: e.block_number,
            block_timestamp: e.block_timestamp,
            is_active: true,
            change_type: "reinforced".into(),
            ..Default::default()
        });
    }

    for e in &events.territory_decayed {
        snapshots.push(TerritorySnapshot {
            territory_id: e.territory_id.clone(),
            strength: e.remaining_strength,
            block_number: e.block_number,
            block_timestamp: e.block_timestamp,
            is_active: e.remaining_strength > 0,
            change_type: "decayed".into(),
            ..Default::default()
        });
    }

    for e in &events.territory_lost {
        snapshots.push(TerritorySnapshot {
            territory_id: e.territory_id.clone(),
            controller: e.old_controller.clone(),
            block_number: e.block_number,
            block_timestamp: e.block_timestamp,
            is_active: false,
            change_type: "lost".into(),
            ..Default::default()
        });
    }

    snapshots
}
