import { getIpfsConfig } from './ipfs';

export interface RelayResult {
  hash: `0x${string}`;
  confirmed: boolean;
}

async function relayPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const config = getIpfsConfig();
  if (!config) {
    throw new Error('Relay not configured — call setIpfsConfig() first');
  }

  const response = await fetch(`${config.apiUrl}/api/relay/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { 'X-API-Key': config.apiKey } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Relay request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function relayMintAchievement(
  recipient: `0x${string}`,
  achievementId: `0x${string}`,
  achievementName: string
): Promise<RelayResult> {
  return relayPost<RelayResult>('mint-achievement', {
    recipient,
    achievementId,
    achievementName,
  });
}

export function relayMintReward(
  recipient: `0x${string}`,
  activityHash: `0x${string}`,
  distance: number
): Promise<RelayResult> {
  return relayPost<RelayResult>('mint-reward', {
    recipient,
    activityHash,
    distance,
  });
}

export function relayMintTerritoryNFT(
  recipient: `0x${string}`,
  polygonHash: `0x${string}`
): Promise<RelayResult> {
  return relayPost<RelayResult>('mint-territory-nft', {
    recipient,
    polygonHash,
  });
}

export function relayStartSeason(durationSeconds: number): Promise<RelayResult> {
  return relayPost<RelayResult>('start-season', { durationSeconds });
}
