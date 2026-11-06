import { useCallback, useEffect, useState } from 'react';
import { getActiveProfileId } from '@/backends/activeProfile';
import { PROFILES } from '@/backends/profiles';
import { getCurrentUserId } from '@/constants/config';
import { DEV_TOOLS } from '@/constants/devTools';
import {
  fetchPassStatus,
  isWorldIdConfigured,
  runWorldCheck,
  type SelfieCheckResult,
} from '@/services/worldIdService';
import { useWorldVerificationStore } from '@/stores/worldVerificationStore';
import type {
  WorldCheckKind,
  WorldVerificationError,
  WorldVerificationStatus,
} from '@/types/worldId';
import { logger } from '@/utils/logger';

/**
 * Uses the on-device stand-in when the profile has no real API (Sandbox), or on Local when World ID
 * credentials are not configured. When World ID is configured, Local and Live both run the real
 * World ID check against the API server. Dev builds only, and kept out of release bundles.
 */
const usesDevVerification = () => {
  const profile = PROFILES[getActiveProfileId()];
  return DEV_TOOLS.enabled && profile.auth === 'dev' && (profile.fakeApi || !isWorldIdConfigured());
};

async function checkForProfile(
  kind: WorldCheckKind,
  wallet: string,
  activityHash?: string
): Promise<SelfieCheckResult> {
  if (!usesDevVerification()) return runWorldCheck(kind, wallet, activityHash);
  const { devSelfieCheck } =
    require('@/backends/sandbox/devSelfieCheck') as typeof import('@/backends/sandbox/devSelfieCheck');
  const result = await devSelfieCheck(wallet);
  const now = Date.now();
  return {
    ...result,
    pass: {
      wallet,
      credential: 'proof_of_human',
      band: 'low',
      sybilScore: null,
      enrolledAt: now,
      steppedUp: kind === 'step_up',
      lastPresenceAt: kind === 'presence' ? now : null,
      presenceCount: kind === 'presence' ? 1 : 0,
      finishLineMeters: 0,
    },
    ticket: activityHash ? { activityHash, wallet, verifiedAt: now, sybilScore: 0 } : undefined,
  };
}

export function useWorldVerification() {
  const isVerified = useWorldVerificationStore((s) => s.isVerified);
  const verifiedAt = useWorldVerificationStore((s) => s.verifiedAt);
  const pass = useWorldVerificationStore((s) => s.pass);
  const setVerified = useWorldVerificationStore((s) => s.setVerified);
  const setPass = useWorldVerificationStore((s) => s.setPass);
  const addTicket = useWorldVerificationStore((s) => s.addTicket);

  const [status, setStatus] = useState<WorldVerificationStatus>('idle');
  const [error, setError] = useState<WorldVerificationError | null>(null);
  const [activeKind, setActiveKind] = useState<WorldCheckKind | null>(null);

  const startCheck = useCallback(
    async (kind: WorldCheckKind, activityHash?: string): Promise<SelfieCheckResult | null> => {
      setError(null);
      setActiveKind(kind);
      setStatus('polling');

      try {
        const result = await checkForProfile(kind, getCurrentUserId(), activityHash);
        if (kind === 'enroll') setVerified(result.nullifier);
        if (result.pass) setPass(result.pass);
        if (result.ticket) addTicket(result.ticket);
        setStatus('success');
        return result;
      } catch (err) {
        if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
          const verificationError = err as WorldVerificationError;
          setError(verificationError);
          setStatus(verificationError.code === 'cancelled' ? 'cancelled' : 'error');
          return null;
        }

        const message = err instanceof Error ? err.message : 'Verification failed';
        logger.warn('[WorldId] Check failed', err);
        setError({ code: 'unknown', message });
        setStatus('error');
        return null;
      }
    },
    [setVerified, setPass, addTicket]
  );

  const startVerification = useCallback(() => startCheck('enroll'), [startCheck]);

  const resetFlow = useCallback(() => {
    setStatus('idle');
    setError(null);
    setActiveKind(null);
  }, []);

  return {
    isVerified,
    verifiedAt,
    pass,
    status,
    error,
    activeKind,
    isConfigured: isWorldIdConfigured() || usesDevVerification(),
    startVerification,
    startCheck,
    resetFlow,
    isBusy: status === 'opening' || status === 'polling',
  };
}

/** Keeps the stored pass in step with the server (a new Sybil score, a step-up done elsewhere). */
export function useRefreshAthletePass() {
  const setPass = useWorldVerificationStore((s) => s.setPass);
  useEffect(() => {
    if (usesDevVerification() || !isWorldIdConfigured()) return;
    const wallet = getCurrentUserId();
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) return;
    fetchPassStatus(wallet)
      .then(({ pass }) => {
        if (pass) setPass(pass);
      })
      .catch((err) => logger.warn('[WorldId] Could not refresh Athlete Pass', err));
  }, [setPass]);
}
