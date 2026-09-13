import { BigInt } from '@graphprotocol/graph-ts';
import {
  TerritoryClaimed,
  TerritoryDecayed,
  TerritoryLost,
  TerritoryReinforced,
} from '../../generated/TerritoryRegistry/TerritoryRegistry';
import { Territory, TerritoryStrengthHistory } from '../../generated/schema';
import { getOrCreateProfile } from '../helpers';

export function handleTerritoryClaimed(event: TerritoryClaimed): void {
  const territory = new Territory(event.params.territoryId);
  territory.owner = getOrCreateProfile(event.params.controller).id;
  territory.area = event.params.areaSqm;
  territory.strength = event.params.strength;
  territory.capturedAt = event.params.capturedAt;
  territory.lastReinforced = event.params.capturedAt;
  territory.isActive = true;
  territory.minLng = event.params.minLng;
  territory.minLat = event.params.minLat;
  territory.maxLng = event.params.maxLng;
  territory.maxLat = event.params.maxLat;
  territory.save();

  // Substreams-derived: territory strength history
  const historyId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const history = new TerritoryStrengthHistory(historyId);
  history.territory = territory.id;
  history.strength = event.params.strength;
  history.changeType = 'claimed';
  history.blockNumber = event.block.number;
  history.timestamp = event.block.timestamp;
  history.save();
}

export function handleTerritoryReinforced(event: TerritoryReinforced): void {
  const territory = Territory.load(event.params.territoryId);
  if (territory) {
    territory.strength = event.params.strength;
    territory.lastReinforced = event.params.reinforcedAt;
    territory.save();

    // Substreams-derived: territory strength history
    const historyId = event.transaction.hash.concatI32(event.logIndex.toI32());
    const history = new TerritoryStrengthHistory(historyId);
    history.territory = territory.id;
    history.strength = event.params.strength;
    history.changeType = 'reinforced';
    history.blockNumber = event.block.number;
    history.timestamp = event.block.timestamp;
    history.save();
  }
}

export function handleTerritoryDecayed(event: TerritoryDecayed): void {
  const territory = Territory.load(event.params.territoryId);
  if (territory) {
    territory.strength = event.params.remainingStrength;
    territory.lastReinforced = event.params.decayedAt;
    territory.save();

    // Substreams-derived: territory strength history
    const historyId = event.transaction.hash.concatI32(event.logIndex.toI32());
    const history = new TerritoryStrengthHistory(historyId);
    history.territory = territory.id;
    history.strength = event.params.remainingStrength;
    history.changeType = 'decayed';
    history.blockNumber = event.block.number;
    history.timestamp = event.block.timestamp;
    history.save();
  }
}

export function handleTerritoryLost(event: TerritoryLost): void {
  const territory = Territory.load(event.params.territoryId);
  if (territory) {
    territory.isActive = false;
    territory.save();

    // Substreams-derived: territory strength history
    const historyId = event.transaction.hash.concatI32(event.logIndex.toI32());
    const history = new TerritoryStrengthHistory(historyId);
    history.territory = territory.id;
    history.strength = BigInt.zero();
    history.changeType = 'lost';
    history.blockNumber = event.block.number;
    history.timestamp = event.block.timestamp;
    history.save();
  }
}
