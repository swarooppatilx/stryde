import { List } from '@ant-design/react-native';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { AppSwitch } from '@/components/app-switch';
import { AppButton } from '@/components/button';
import { ListIcon } from '@/components/list-icon';
import { ThemedText } from '@/components/themed-text';
import { getPlatform } from '@/platform';
import type { WatchStatus } from '@/platform/ports';
import { useSettingsStore } from '@/stores/settingsStore';

const STATUS_TEXT: Record<Exclude<WatchStatus, 'unsupported'>, string> = {
  'not-paired': 'No Apple Watch is paired with this iPhone.',
  'not-installed':
    'Install Stryde on your watch: open the Watch app on this iPhone, then Available Apps.',
  'needs-permission': 'Allow Stryde to read your workout data to use the watch.',
  ready: 'Heart rate, distance, cadence, power and calories come from your watch while you record.',
};

/** The Apple Watch section of the recording settings; nothing on phones without watch support. */
export function AppleWatchSettings() {
  const [status, setStatus] = useState<WatchStatus | null>(null);
  const [asking, setAsking] = useState(false);
  const enabled = useSettingsStore((s) => s.useAppleWatch);
  const setEnabled = useSettingsStore((s) => s.setUseAppleWatch);

  const refresh = useCallback(() => {
    void getPlatform().watch.status().then(setStatus);
  }, []);

  // Installing the watch app or pairing happens outside Stryde: check again on the way back.
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  if (status === null || status === 'unsupported') return null;

  const connect = async () => {
    setAsking(true);
    setStatus(await getPlatform().watch.requestAccess());
    setAsking(false);
  };

  return (
    <>
      <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
        APPLE WATCH
      </ThemedText>
      <List>
        <List.Item
          thumb={<ListIcon name="watch-outline" />}
          extra={
            status === 'ready' ? (
              <AppSwitch checked={enabled} onChange={setEnabled} label="Record with Apple Watch" />
            ) : undefined
          }
        >
          Record with Apple Watch
          <List.Item.Brief>{STATUS_TEXT[status]}</List.Item.Brief>
        </List.Item>
      </List>
      {status === 'needs-permission' && (
        <AppButton variant="secondary" loading={asking} onPress={() => void connect()}>
          Connect Apple Watch
        </AppButton>
      )}
    </>
  );
}
