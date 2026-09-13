import {
  TerritoryClaimed,
  TerritoryDecayed,
  TerritoryLost,
  TerritoryReinforced,
} from '../../generated/TerritoryRegistry/TerritoryRegistry';
import { Territory } from '../../generated/schema';
import { getOrCreateProfile } from '../helpers';

export function handleTerritoryClaimed(event: TerritoryClaimed): void {
  const territory = new Territory(event.params.territoryId);
  territory.owner = getOrCreateProfile(event.params.controller).id;
  territory.area = event.params.areaSqm;
  territory.strength = event.params.strength;
  territory.capturedAt = event.params.capturedAt;
  territory.lastReinforced = event.params.capturedAt;
  territory.isActive = true;
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

export function handleTerritoryDecayed(event: TerritoryDecayed): void {
  const territory = Territory.load(event.params.territoryId);
  if (territory) {
    territory.strength = event.params.remainingStrength;
    territory.lastReinforced = event.params.decayedAt;
    territory.save();
  }
}

export function handleTerritoryLost(event: TerritoryLost): void {
  const territory = Territory.load(event.params.territoryId);
  if (territory) {
    territory.isActive = false;
    territory.save();
  }
}
