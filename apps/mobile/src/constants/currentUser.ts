const SIGNED_OUT_ID = 'current';

let currentUserId = SIGNED_OUT_ID;
const listeners = new Set<() => void>();

function update(id: string): void {
  if (id === currentUserId) return;
  currentUserId = id;
  for (const listener of listeners) listener();
}

export function setCurrentUserId(id: string): void {
  update(id);
}

/** Back to the signed-out placeholder, so the last user's identity isn't reused after logout. */
export function clearCurrentUserId(): void {
  update(SIGNED_OUT_ID);
}

export function getCurrentUserId(): string {
  return currentUserId;
}

export function subscribeCurrentUserId(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
