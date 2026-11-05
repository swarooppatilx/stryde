import { sameAddress } from './address';
import { parseEthAmount } from './eth';

export type AlertSeverity = 'info' | 'warning' | 'danger';

export interface StakeAlert {
  id: string;
  severity: AlertSeverity;
  message: string;
}

export interface StakeAlertInput {
  me: string;
  opponent: string | null;
  /** Null when it is not known (the profile list did not load): that alert is skipped. */
  opponentVerified: boolean | null;
  stakeWei: bigint;
  /** Null while the balance hasn't loaded: don't alert on it. */
  balanceWei: bigint | null;
  durationSeconds: number;
  hasOpenChallengeWithOpponent: boolean;
}

const DAY_SECONDS = 24 * 60 * 60;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const BURN_ADDRESS = '0x000000000000000000000000000000000000dead';

const RANK: Record<AlertSeverity, number> = { danger: 0, warning: 1, info: 2 };

/**
 * Things to know before a stake is sent, most serious first. Whether the amount and the balance
 * are valid at all stays with validateChallenge; this only judges how risky a valid stake is.
 */
export function stakeAlerts(input: StakeAlertInput): StakeAlert[] {
  const alerts: StakeAlert[] = [];
  const { opponent, stakeWei, balanceWei } = input;

  if (opponent && [ZERO_ADDRESS, BURN_ADDRESS].includes(opponent.toLowerCase())) {
    alerts.push({
      id: 'opponent-unusable',
      severity: 'danger',
      message: 'Nobody can take this challenge up, so the stake would be lost. Pick someone else.',
    });
  } else if (opponent && sameAddress(opponent, input.me)) {
    alerts.push({
      id: 'opponent-self',
      severity: 'danger',
      message: 'You cannot challenge yourself. Pick someone else.',
    });
  }

  if (balanceWei === null) {
    alerts.push({
      id: 'balance-unknown',
      severity: 'warning',
      message: 'We could not check your balance, so this stake may be more than you have.',
    });
  } else if (balanceWei > 0n) {
    if (stakeWei > balanceWei) {
      alerts.push({
        id: 'stake-over-balance',
        severity: 'danger',
        message: 'This stake is more than your balance. Lower it to continue.',
      });
    } else if (stakeWei * 10n > balanceWei * 9n) {
      alerts.push({
        id: 'stake-over-ninety',
        severity: 'danger',
        message: 'This stake is more than 90% of your balance. Lower it to continue.',
      });
    } else if (stakeWei * 2n > balanceWei) {
      alerts.push({
        id: 'stake-over-half',
        severity: 'warning',
        message: 'This stake is more than half of your balance.',
      });
    }
  }

  if (input.opponentVerified === false) {
    alerts.push({
      id: 'opponent-unverified',
      severity: 'warning',
      message: 'This person has not been verified as a real person yet.',
    });
  }

  if (input.durationSeconds < DAY_SECONDS) {
    alerts.push({
      id: 'deadline-soon',
      severity: 'warning',
      message:
        'The deadline is under 24 hours away, which leaves little time to cover the distance.',
    });
  }

  if (input.hasOpenChallengeWithOpponent) {
    alerts.push({
      id: 'open-challenge',
      severity: 'info',
      message: 'You already have an open challenge with this person.',
    });
  }

  return alerts.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

/** A danger always blocks; warnings need the athlete to say they understand first. */
export function canConfirmStake(alerts: readonly StakeAlert[], acknowledged: boolean): boolean {
  if (alerts.some((a) => a.severity === 'danger')) return false;
  return acknowledged || !alerts.some((a) => a.severity === 'warning');
}

/**
 * What is wrong with a typed treasury amount, or null (also for an empty box, which is not an
 * error yet). `limitWei` is the athlete's balance for a deposit and the fund's for a withdrawal.
 */
export function treasuryAmountError(
  input: string,
  limitWei: bigint | null,
  mode: 'deposit' | 'withdraw'
): string | null {
  if (input.trim() === '') return null;
  const amount = parseEthAmount(input);
  if (amount === null || amount <= 0n) return 'Enter a larger amount';
  if (limitWei !== null && amount > limitWei) {
    return mode === 'deposit' ? 'More than your balance' : 'More than the fund holds';
  }
  return null;
}
