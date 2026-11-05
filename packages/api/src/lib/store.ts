import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Minimal JSON-file persistence for Human Pass state (World ID links, bans,
 * agent grants, approvals). One long-lived Node process owns the file; on a
 * read-only/serverless filesystem it degrades to in-memory only.
 */

export interface HumanLink {
  iss: string;
  sub: string;
  wallet: string;
  linkedAt: number;
  /** Previous wallets this human recovered away from. */
  previousWallets: string[];
}

export interface Ban {
  iss: string;
  sub: string;
  reason: string;
  bannedAt: number;
}

export interface AgentGrant {
  id: string;
  tokenHash: string;
  iss: string;
  sub: string;
  wallet: string;
  label: string;
  createdAt: number;
  revokedAt: number | null;
}

export type ApprovalStatus =
  | 'pending'
  | 'executing'
  | 'completed'
  | 'denied'
  | 'expired'
  | 'cancelled'
  | 'failed';

export interface Approval {
  id: string;
  wallet: string;
  action: string;
  params: Record<string, unknown>;
  paramsHash: string;
  initiator: 'app' | 'agent';
  agentGrantId: string | null;
  /** sha256 of the secret only the creating client holds; gates one-time results. */
  clientSecretHash: string | null;
  status: ApprovalStatus;
  createdAt: number;
  expiresAt: number;
  /** Private: never returned to clients. */
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  pollIntervalSec: number;
  nextPollAt: number;
  requiredAcr: string | null;
  authTime: number | null;
  acr: string | null;
  amr: string[] | null;
  sub: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  updatedAt: number;
}

/** A wallet that proved ownership with a signature; the app sends the token on /human calls. */
export interface HumanSession {
  tokenHash: string;
  wallet: string;
  expiresAt: number;
}

interface StoreShape {
  links: HumanLink[];
  bans: Ban[];
  agentGrants: AgentGrant[];
  approvals: Approval[];
  humanSessions: HumanSession[];
}

const STORE_FILE = process.env.STORE_FILE || '.data/stryde-store.json';
const MAX_APPROVALS = 500;

let state: StoreShape | null = null;
let persistDisabled = false;

function load(): StoreShape {
  if (state) return state;
  state = { links: [], bans: [], agentGrants: [], approvals: [], humanSessions: [] };
  try {
    if (existsSync(STORE_FILE)) {
      const parsed = JSON.parse(readFileSync(STORE_FILE, 'utf8')) as Partial<StoreShape>;
      state = {
        links: parsed.links ?? [],
        bans: parsed.bans ?? [],
        agentGrants: parsed.agentGrants ?? [],
        approvals: parsed.approvals ?? [],
        humanSessions: parsed.humanSessions ?? [],
      };
    }
  } catch (error) {
    console.warn('[store] Could not read store file, starting empty:', error);
  }
  return state;
}

function persist(): void {
  if (persistDisabled || !state) return;
  try {
    mkdirSync(dirname(STORE_FILE), { recursive: true });
    if (state.approvals.length > MAX_APPROVALS) {
      state.approvals = state.approvals.slice(-MAX_APPROVALS);
    }
    writeFileSync(STORE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    persistDisabled = true;
    console.warn('[store] Filesystem not writable, continuing in-memory only:', error);
  }
}

const norm = (wallet: string) => wallet.toLowerCase();

export const store = {
  findLinkByWallet(wallet: string): HumanLink | undefined {
    return load().links.find((l) => norm(l.wallet) === norm(wallet));
  },
  findLinkBySubject(iss: string, sub: string): HumanLink | undefined {
    return load().links.find((l) => l.iss === iss && l.sub === sub);
  },
  upsertLink(link: HumanLink): void {
    const s = load();
    s.links = s.links.filter((l) => !(l.iss === link.iss && l.sub === link.sub));
    s.links.push(link);
    persist();
  },
  findBan(iss: string, sub: string): Ban | undefined {
    return load().bans.find((b) => b.iss === iss && b.sub === sub);
  },
  addBan(ban: Ban): void {
    const s = load();
    if (!s.bans.some((b) => b.iss === ban.iss && b.sub === ban.sub)) {
      s.bans.push(ban);
      persist();
    }
  },
  removeBan(iss: string, sub: string): boolean {
    const s = load();
    const before = s.bans.length;
    s.bans = s.bans.filter((b) => !(b.iss === iss && b.sub === sub));
    persist();
    return s.bans.length !== before;
  },
  listBannedWallets(): string[] {
    const s = load();
    return s.links
      .filter((l) => s.bans.some((b) => b.iss === l.iss && b.sub === l.sub))
      .flatMap((l) => [l.wallet, ...l.previousWallets])
      .map(norm);
  },
  addAgentGrant(grant: AgentGrant): void {
    load().agentGrants.push(grant);
    persist();
  },
  findAgentGrantByTokenHash(tokenHash: string): AgentGrant | undefined {
    return load().agentGrants.find((g) => g.tokenHash === tokenHash && g.revokedAt === null);
  },
  listAgentGrants(wallet: string): AgentGrant[] {
    return load().agentGrants.filter((g) => norm(g.wallet) === norm(wallet));
  },
  revokeAgentGrant(id: string, wallet: string): boolean {
    const grant = load().agentGrants.find((g) => g.id === id && norm(g.wallet) === norm(wallet));
    if (!grant || grant.revokedAt !== null) return false;
    grant.revokedAt = Date.now();
    persist();
    return true;
  },
  addApproval(approval: Approval): void {
    load().approvals.push(approval);
    persist();
  },
  getApproval(id: string): Approval | undefined {
    return load().approvals.find((a) => a.id === id);
  },
  listApprovals(wallet: string): Approval[] {
    return load()
      .approvals.filter((a) => norm(a.wallet) === norm(wallet))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
  updateApproval(id: string, patch: Partial<Approval>): Approval | undefined {
    const approval = load().approvals.find((a) => a.id === id);
    if (!approval) return undefined;
    Object.assign(approval, patch, { updatedAt: Date.now() });
    persist();
    return approval;
  },
  addHumanSession(session: HumanSession): void {
    const s = load();
    const now = Date.now();
    s.humanSessions = s.humanSessions.filter((x) => x.expiresAt > now);
    s.humanSessions.push(session);
    persist();
  },
  findHumanSession(tokenHash: string): HumanSession | undefined {
    return load().humanSessions.find((x) => x.tokenHash === tokenHash && x.expiresAt > Date.now());
  },
  /** Test helper. */
  reset(): void {
    state = { links: [], bans: [], agentGrants: [], approvals: [], humanSessions: [] };
  },
};
