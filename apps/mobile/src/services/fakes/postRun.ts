import type {
  ActivityChain,
  ActivityMetadataInput,
  PhotoUploader,
  PostRunStore,
} from '@/services/postRun';
import type { Activity, Ring } from '@/types';

const hex = (byte: string) => `0x${byte.repeat(32)}` as `0x${string}`;

type ChainMethod = keyof ActivityChain;

/**
 * Scriptable stand-in for the chain. Every call is recorded in order; any
 * method can be made to throw, and the results of each can be overridden.
 */
export class FakeActivityChain implements ActivityChain {
  calls: Array<{ method: ChainMethod; args: unknown[] }> = [];
  failures: Partial<Record<ChainMethod, unknown>> = {};
  /** While set, `recordActivity` waits for it: lets a test look at the world mid-record. */
  recordGate: Promise<void> | null = null;

  recordResult = { onchainActivityId: 7n, txHash: hex('aa'), confirmed: true };
  metadataResult: { cid: string; confirmed: boolean } | null = {
    cid: 'bafy-meta',
    confirmed: true,
  };
  rewardResult = { amount: 5n * 10n ** 18n, confirmed: true };
  claimResult = { territoryId: hex('bb'), confirmed: true };
  nftResult = { confirmed: true };

  get methods(): ChainMethod[] {
    return this.calls.map((c) => c.method);
  }

  callsTo(method: ChainMethod): unknown[][] {
    return this.calls.filter((c) => c.method === method).map((c) => c.args);
  }

  private async run<T>(method: ChainMethod, args: unknown[], result: T): Promise<T> {
    this.calls.push({ method, args });
    if (method === 'recordActivity' && this.recordGate) await this.recordGate;
    if (method in this.failures) throw this.failures[method];
    return result;
  }

  recordActivity(params: Parameters<ActivityChain['recordActivity']>[0]) {
    return this.run('recordActivity', [params], this.recordResult);
  }

  setMetadata(id: bigint, metadata: ActivityMetadataInput) {
    return this.run('setMetadata', [id, metadata], this.metadataResult);
  }

  recordSeasonContribution(hash: `0x${string}`, distance: number) {
    return this.run('recordSeasonContribution', [hash, distance], undefined);
  }

  mintReward(hash: `0x${string}`, distance: number) {
    return this.run('mintReward', [hash, distance], this.rewardResult);
  }

  claimTerritory(polygon: Ring, areaSqm: number) {
    return this.run('claimTerritory', [polygon, areaSqm], this.claimResult);
  }

  mintTerritoryNft(territoryId: `0x${string}`) {
    return this.run('mintTerritoryNft', [territoryId], this.nftResult);
  }
}

export class FakePhotoUploader implements PhotoUploader {
  uploads: Array<{ name: string; uri: string }> = [];
  failFor = new Set<string>();
  inFlight = 0;
  peakInFlight = 0;

  async upload(name: string, uri: string): Promise<string> {
    this.uploads.push({ name, uri });
    this.inFlight++;
    this.peakInFlight = Math.max(this.peakInFlight, this.inFlight);
    await new Promise((resolve) => setTimeout(resolve, 1));
    this.inFlight--;
    if (this.failFor.has(uri)) throw new Error(`upload failed: ${uri}`);
    return `https://ipfs.test/${encodeURIComponent(uri)}`;
  }
}

export class MemoryPostRunStore implements PostRunStore {
  activities = new Map<string, Activity>();
  polygons: Array<{ userId: string; territory: Ring }> = [];
  /** Every write in order, for asserting what happened when. */
  log: string[] = [];

  saveActivity(activity: Activity): void {
    this.log.push('save');
    this.activities.set(activity.id, activity);
  }

  updateActivity(id: string, patch: Partial<Activity>): void {
    this.log.push(`update:${Object.keys(patch).join(',')}`);
    const current = this.activities.get(id);
    if (current) this.activities.set(id, { ...current, ...patch });
  }

  capturePolygon(userId: string, territory: Ring): void {
    this.log.push('polygon');
    this.polygons.push({ userId, territory });
  }

  get(id: string): Activity {
    const activity = this.activities.get(id);
    if (!activity) throw new Error(`no activity ${id}`);
    return activity;
  }
}
