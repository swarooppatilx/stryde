/** Pure state for the stacked status toasts: no timers, no React. The caller passes the time in. */
export type ToastKind = 'info' | 'success' | 'fail' | 'loading';

export const MAX_TOASTS = 3;

export interface ToastItem {
  /** Unique per toast shown; what `Toast.remove` takes. */
  key: number;
  /** Names what the toast is about; showing the same id again updates this one in place. */
  id?: string;
  content: string;
  kind: ToastKind;
  /** Leaving: still drawn until its exit finishes, then dropped by `finalizeToast`. */
  exiting: boolean;
  /** When it leaves by itself; null stays until removed. */
  expiresAt: number | null;
  onPress?: () => void;
}

export interface ToastStack {
  /** Oldest first; the newest is drawn on top. */
  items: readonly ToastItem[];
  nextKey: number;
}

export interface ToastInput {
  id?: string;
  content: string;
  kind: ToastKind;
  /** Seconds on screen; 0 stays until removed. */
  duration: number;
  onPress?: () => void;
}

export const emptyToastStack: ToastStack = { items: [], nextKey: 1 };

/** The toasts that count toward the limit (not already leaving). */
export function liveToasts(stack: ToastStack): ToastItem[] {
  return stack.items.filter((item) => !item.exiting);
}

export function showToast(
  stack: ToastStack,
  input: ToastInput,
  now: number
): { stack: ToastStack; key: number } {
  const expiresAt = input.duration > 0 ? now + input.duration * 1000 : null;
  const existing =
    input.id === undefined
      ? undefined
      : stack.items.find((item) => item.id === input.id && !item.exiting);
  if (existing) {
    const items = stack.items.map((item) =>
      item.key === existing.key
        ? { ...item, content: input.content, kind: input.kind, expiresAt, onPress: input.onPress }
        : item
    );
    return { stack: { ...stack, items }, key: existing.key };
  }
  const key = stack.nextKey;
  const added: ToastItem = {
    key,
    id: input.id,
    content: input.content,
    kind: input.kind,
    exiting: false,
    expiresAt,
    onPress: input.onPress,
  };
  let items = [...stack.items, added];
  // Over the limit: the oldest ones start leaving.
  const overflow = liveToasts({ ...stack, items }).length - MAX_TOASTS;
  if (overflow > 0) {
    let toDrop = overflow;
    items = items.map((item) => {
      if (toDrop > 0 && !item.exiting) {
        toDrop -= 1;
        return { ...item, exiting: true };
      }
      return item;
    });
  }
  return { stack: { items, nextKey: key + 1 }, key };
}

/** Starts a toast leaving. Unknown or already-leaving keys change nothing. */
export function removeToast(stack: ToastStack, key: number): ToastStack {
  if (!stack.items.some((item) => item.key === key && !item.exiting)) return stack;
  return {
    ...stack,
    items: stack.items.map((item) => (item.key === key ? { ...item, exiting: true } : item)),
  };
}

/** Drops a toast whose exit has finished. */
export function finalizeToast(stack: ToastStack, key: number): ToastStack {
  if (!stack.items.some((item) => item.key === key)) return stack;
  return { ...stack, items: stack.items.filter((item) => item.key !== key) };
}

/** Starts leaving every toast whose time is up. */
export function expireToasts(stack: ToastStack, now: number): ToastStack {
  const due = (item: ToastItem) =>
    !item.exiting && item.expiresAt !== null && item.expiresAt <= now;
  if (!stack.items.some(due)) return stack;
  return {
    ...stack,
    items: stack.items.map((item) => (due(item) ? { ...item, exiting: true } : item)),
  };
}

/** When the next toast is due to leave, or null when none will by itself. */
export function nextExpiry(stack: ToastStack): number | null {
  let soonest: number | null = null;
  for (const item of stack.items) {
    if (item.exiting || item.expiresAt === null) continue;
    if (soonest === null || item.expiresAt < soonest) soonest = item.expiresAt;
  }
  return soonest;
}
