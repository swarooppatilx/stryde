import { useCallback, useState } from 'react';

import { getCurrentUserId } from '@/constants/config';
import { isWorldIdConfigured, runSelfieCheck } from '@/services/worldIdService';
import { useWorldVerificationStore } from '@/stores/worldVerificationStore';
import type { WorldVerificationError, WorldVerificationStatus } from '@/types/worldId';

export function useWorldVerification() {
  const isVerified = useWorldVerificationStore((s) => s.isVerified);
  const verifiedAt = useWorldVerificationStore((s) => s.verifiedAt);
  const setVerified = useWorldVerificationStore((s) => s.setVerified);

  const [status, setStatus] = useState<WorldVerificationStatus>('idle');
  const [error, setError] = useState<WorldVerificationError | null>(null);

  const startVerification = useCallback(async () => {
    setError(null);
    setStatus('opening');

    try {
      setStatus('polling');
      const result = await runSelfieCheck(getCurrentUserId());
      setVerified(result.nullifier);
      setStatus('success');
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
        const verificationError = err as WorldVerificationError;
        setError(verificationError);
        setStatus(verificationError.code === 'cancelled' ? 'cancelled' : 'error');
        return;
      }

      const message = err instanceof Error ? err.message : 'Verification failed';
      setError({ code: 'unknown', message });
      setStatus('error');
    }
  }, [setVerified]);

  const resetFlow = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return {
    isVerified,
    verifiedAt,
    status,
    error,
    isConfigured: isWorldIdConfigured(),
    startVerification,
    resetFlow,
    isBusy: status === 'opening' || status === 'polling',
  };
}
