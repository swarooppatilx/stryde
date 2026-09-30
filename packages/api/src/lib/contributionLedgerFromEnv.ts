import {
  arkivConfigFromEnv,
  arkivSignerFromEnv,
  createArkivPublicClient,
  createArkivWalletClient,
} from './arkiv.js';
import {
  type ContributionLedger,
  createArkivLedger,
  createMemoryLedger,
} from './contributionLedger.js';
import { isProduction } from './env.js';
import { ConfigError } from './relayErrors.js';

let ledger: ContributionLedger | null = null;

/**
 * The Arkiv ledger. Without Arkiv settings, production refuses (a ConfigError, answered as 503)
 * while local development falls back to remembering in memory until the server restarts.
 */
export function getContributionLedger(): ContributionLedger {
  if (ledger) return ledger;
  try {
    const config = arkivConfigFromEnv();
    ledger = createArkivLedger(
      createArkivPublicClient(config),
      createArkivWalletClient(arkivSignerFromEnv(), config)
    );
  } catch (error) {
    if (!(error instanceof ConfigError) || isProduction()) throw error;
    console.warn(
      '[relay] Arkiv not configured: season contributions are deduplicated in memory only'
    );
    ledger = createMemoryLedger();
  }
  return ledger;
}
