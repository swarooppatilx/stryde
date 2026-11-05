import { usePrivy } from '@privy-io/expo';
import { getActiveProfileId } from '@/backends/activeProfile';
import { signOutDev, useDevSession } from '@/backends/auth/devSession';
import { selectAuth } from '@/backends/auth/selectAuth';
import type { AuthSession } from '@/backends/auth/types';
import { PROFILES } from '@/backends/profiles';

/** Privy account on Live, the developer persona on other profiles. Both hooks always run so hook order is stable. */
export function useAuth(): AuthSession {
  const { isReady, user, logout } = usePrivy();
  const personaId = useDevSession((s) => s.personaId);
  const kind = PROFILES[getActiveProfileId()].auth;
  return selectAuth({ kind, privy: { isReady, user, logout }, personaId, signOutDev });
}
