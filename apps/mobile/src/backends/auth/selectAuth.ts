import type { AuthSession, AuthUser } from './types';

interface PrivyLike {
  isReady: boolean;
  user: { id: string; linked_accounts?: ReadonlyArray<{ type: string; address?: string }> } | null;
  logout(): Promise<void>;
}

/** Picks who is signed in: Privy's account on Live, the chosen developer persona otherwise. */
export function selectAuth({
  kind,
  privy,
  personaId,
  signOutDev,
}: {
  kind: 'privy' | 'dev';
  privy: PrivyLike;
  personaId: string | null;
  signOutDev(): void;
}): AuthSession {
  if (kind === 'dev') {
    return {
      isReady: true,
      user: personaId ? { id: `dev:${personaId}`, kind: 'dev' } : null,
      logout: async () => signOutDev(),
    };
  }
  const email = privy.user?.linked_accounts?.find((a) => a.type === 'email')?.address;
  const user: AuthUser | null = privy.user
    ? { id: privy.user.id, kind: 'privy', ...(email ? { email } : {}) }
    : null;
  return { isReady: privy.isReady, user, logout: privy.logout };
}
