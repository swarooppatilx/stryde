import { useToastStore } from '@/stores/toastStore';

interface ShowOptions {
  content: string;
  duration?: number;
}

/** Drop-in themed replacement for `@ant-design/react-native`'s `Toast` —
 * same call shape as every existing call site (`Toast.show`, `.info`,
 * `.success`, `.fail`, `.loading` + `.remove(key)`), backed by our own
 * store/host instead of antd's icon font (which isn't registered in this
 * app, so antd's Toast icons render as missing-glyph boxes). */
export const Toast = {
  show: (options: ShowOptions | string, duration = 2): number => {
    const content = typeof options === 'string' ? options : options.content;
    const d = typeof options === 'string' ? duration : (options.duration ?? duration);
    return useToastStore.getState().show(content, 'info', d);
  },
  info: (content: string, duration = 2): number =>
    useToastStore.getState().show(content, 'info', duration),
  success: (content: string, duration = 2): number =>
    useToastStore.getState().show(content, 'success', duration),
  fail: (content: string, duration = 2): number =>
    useToastStore.getState().show(content, 'fail', duration),
  loading: (content: string, duration = 0): number =>
    useToastStore.getState().show(content, 'loading', duration),
  remove: (key: number): void => useToastStore.getState().remove(key),
};
