export interface AuthUser {
  id: string;
  /** `privy` is a real account; `dev` is a developer persona that exists only on this device. */
  kind: 'privy' | 'dev';
  email?: string;
}

export interface AuthSession {
  /** False until it is known whether anyone is signed in. */
  isReady: boolean;
  user: AuthUser | null;
  logout(): Promise<void>;
}
