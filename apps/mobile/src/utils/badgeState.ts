export type BadgeState = 'locked' | 'checking' | 'unavailable' | 'notSaved' | 'minted';

export type MintRead = 'loading' | 'failed' | 'minted' | 'notMinted';

/**
 * Where a badge stands. Nothing is claimed until a read has answered: loading and failed reads are
 * their own states, and "not saved" never promises a save is running, because this screen cannot tell.
 */
export function badgeState({ unlocked, read }: { unlocked: boolean; read: MintRead }): BadgeState {
  if (!unlocked) return 'locked';
  switch (read) {
    case 'loading':
      return 'checking';
    case 'failed':
      return 'unavailable';
    case 'minted':
      return 'minted';
    case 'notMinted':
      return 'notSaved';
  }
}

/** What the badge page says for each state. Kept free of plumbing words (see BANNED_USER_WORDS). */
export const BADGE_COPY: Record<BadgeState, { title: string; body: string }> = {
  locked: { title: 'Not earned yet', body: 'Keep going and it will be yours.' },
  checking: { title: 'Checking', body: '' },
  unavailable: {
    title: 'We could not check this badge right now',
    body: 'Check your connection and try again.',
  },
  notSaved: {
    title: 'Not saved to the chain yet',
    body: 'You have earned it. It is saved in the background when you are online.',
  },
  minted: {
    title: 'Badge minted',
    body: 'Saved to the chain with your name on it. It is yours for good.',
  },
};

export function badgeShareMessage(title: string): string {
  return `I earned the ${title} badge on Stryde.`;
}
