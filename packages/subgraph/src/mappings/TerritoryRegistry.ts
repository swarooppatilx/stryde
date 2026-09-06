import {
  Territory,
  type TerritoryClaimed,
  type TerritoryReinforced,
} from '../../generated/TerritoryRegistry/TerritoryRegistry';

export function handleTerritoryClaimed(event: TerritoryClaimed): void {
  const territory = new Territory(event.params.territoryId);
  territory.owner = event.params.controller;
  territory.area = event.params.areaSqm;
  territory.strength = event.params.strength;
  territory.capturedAt = event.params.capturedAt;
  territory.lastReinforced = event.params.capturedAt;
  territory.save();
}

export function handleTerritoryReinforced(event: TerritoryReinforced): void {
  const territory = Territory.load(event.params.territoryId);
  if (territory) {
    territory.strength = event.params.strength;
    territory.lastReinforced = event.params.reinforcedAt;
    territory.save();
  }
}
