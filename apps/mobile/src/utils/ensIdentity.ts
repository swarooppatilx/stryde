interface EnsIdentityInput {
  ensName: string | null;
  ensAvatar: string | null;
  /** The athlete uploaded a photo; theirs always wins. */
  hasOwnAvatar: boolean;
}

/** ENS identity to show. The avatar record is set by whoever owns the name, so it is used only once the name resolved from the athlete's own address, only as a fallback for a missing photo, and only as a plain web URL (no data: or file:). */
export function chooseEnsIdentity({ ensName, ensAvatar, hasOwnAvatar }: EnsIdentityInput): {
  ensLine: string | null;
  fallbackAvatar: string | null;
} {
  const ensLine = ensName?.trim() || null;
  const fallbackAvatar =
    ensLine && !hasOwnAvatar && ensAvatar && /^https?:\/\//i.test(ensAvatar) ? ensAvatar : null;
  return { ensLine, fallbackAvatar };
}
