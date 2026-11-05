const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 20;

export type UsernameCheck = { ok: true; username: string } | { ok: false; error: string };

/** The app's username rule (the contract itself only requires 1 to 32 bytes). */
export function validateUsername(raw: string): UsernameCheck {
  const username = raw.trim();
  if (username.length < USERNAME_MIN_LENGTH) {
    return { ok: false, error: `Username must be at least ${USERNAME_MIN_LENGTH} characters` };
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return { ok: false, error: `Username must be ${USERNAME_MAX_LENGTH} characters or less` };
  }
  return { ok: true, username };
}
