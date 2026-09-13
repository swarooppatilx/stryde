import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'fail' | 'loading';

interface ToastState {
  activeKey: number | null;
  content: string;
  kind: ToastKind;
  show: (content: string, kind: ToastKind, duration: number) => number;
  remove: (key: number) => void;
}

let nextKey = 1;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

/** Backs the themed `Toast` shim in `@/utils/toast` — a single active toast
 * at a time (matching how every call site already uses it: show, then
 * later replace/remove), rendered by `<ToastHost/>` mounted once in the
 * root layout. */
export const useToastStore = create<ToastState>((set, get) => ({
  activeKey: null,
  content: '',
  kind: 'info',
  show: (content, kind, duration) => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    const key = nextKey++;
    set({ activeKey: key, content, kind });
    if (duration > 0) {
      hideTimer = setTimeout(() => {
        if (get().activeKey === key) set({ activeKey: null });
      }, duration * 1000);
    }
    return key;
  },
  remove: (key) => {
    if (get().activeKey === key) {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      set({ activeKey: null });
    }
  },
}));
