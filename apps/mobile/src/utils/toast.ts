import { type ToastKind, useToastStore } from '@/stores/toastStore';

interface ShowOptions {
  content: string;
  duration?: number;
}

/** Themed drop-in for `@ant-design/react-native`'s `Toast` with the same call shape, backed by the app's own host because antd's icon font is not registered here and its icons render as missing-glyph boxes. */
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
  /** Removes the toast shown under `id`, if any. */
  removeStage: (id: string): void => useToastStore.getState().removeById(id),
  /** Shows a toast under `id`; showing the same id again updates it in place. `duration` 0 stays until removed. */
  stage: (
    id: string,
    content: string,
    kind: ToastKind,
    duration = 0,
    options: { onPress?: () => void } = {}
  ): number =>
    useToastStore.getState().show(content, kind, duration, { id, onPress: options.onPress }),
};
