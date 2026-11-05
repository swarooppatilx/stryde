import { create } from 'zustand';
import {
  emptyToastStack,
  expireToasts,
  finalizeToast,
  nextExpiry,
  removeToast,
  showToast,
  type ToastInput,
  type ToastItem,
  type ToastKind,
} from '@/utils/toastStack';

export type { ToastKind };

interface ToastState {
  /** Oldest first; the host draws the newest on top. */
  items: readonly ToastItem[];
  nextKey: number;
  show: (
    content: string,
    kind: ToastKind,
    duration: number,
    extra?: Pick<ToastInput, 'id' | 'onPress'>
  ) => number;
  remove: (key: number) => void;
  /** Called by the host once a toast's exit has finished. */
  finalize: (key: number) => void;
  /** Removes the toast shown under `id`, if any. */
  removeById: (id: string) => void;
  /** Drops every toast (signing out): nothing from one account stays up for the next. */
  reset: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Backs the themed `Toast` shim in `@/utils/toast`: a small stack (see `toastStack`) rendered by `<ToastHost/>`, mounted once in the root layout. */
export const useToastStore = create<ToastState>((set, get) => {
  const stack = () => ({ items: get().items, nextKey: get().nextKey });

  function schedule(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const due = nextExpiry(stack());
    if (due === null) return;
    timer = setTimeout(
      () => {
        timer = null;
        set(expireToasts(stack(), Date.now()));
        schedule();
      },
      Math.max(0, due - Date.now())
    );
  }

  return {
    items: emptyToastStack.items,
    nextKey: emptyToastStack.nextKey,
    show: (content, kind, duration, extra) => {
      const result = showToast(stack(), { content, kind, duration, ...extra }, Date.now());
      set(result.stack);
      schedule();
      return result.key;
    },
    remove: (key) => {
      set(removeToast(stack(), key));
      schedule();
    },
    finalize: (key) => set(finalizeToast(stack(), key)),
    removeById: (id) => {
      const target = get().items.find((item) => item.id === id && !item.exiting);
      if (target) get().remove(target.key);
    },
    reset: () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      set({ items: emptyToastStack.items, nextKey: get().nextKey });
    },
  };
});
