import { useState } from 'react';
import { DevSettings, ScrollView, StyleSheet } from 'react-native';
import { getActiveProfileId } from '@/backends/activeProfile';
import { PROFILES } from '@/backends/profiles';
import { parseSnapshot, resetData, restoreSnapshot, takeSnapshot } from '@/backends/snapshot';
import { AppButton } from '@/components/button';
import { WalletPanel } from '@/components/dev/wallet-panel';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { getPlatform } from '@/platform';
import { Alert } from '@/utils/alert';
import { chainScopedStorageAdapter } from '@/utils/storage';
import { Toast } from '@/utils/toast';

/** Save, restore or wipe everything this profile has stored, to get back to a known state quickly. */
export function StatePanel() {
  const profile = getActiveProfileId();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const { clock, clipboard } = getPlatform();
      const snapshot = await takeSnapshot({
        storage: chainScopedStorageAdapter,
        profile,
        now: clock.now(),
      });
      await clipboard.copyText(JSON.stringify(snapshot));
      Toast.success(`Copied ${Object.keys(snapshot.entries).length} items`, 2);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const snapshot = parseSnapshot(await getPlatform().clipboard.readText());
      if (!snapshot) {
        Toast.fail('The clipboard does not hold a snapshot', 3);
        return;
      }
      const result = await restoreSnapshot({
        storage: chainScopedStorageAdapter,
        snapshot,
        profile,
      });
      if (!result.ok) {
        Toast.fail(result.error, 4);
        return;
      }
      DevSettings.reload();
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    Alert.alert(
      'Reset this profile?',
      `Deletes everything saved on the ${PROFILES[profile].label} profile, then reloads.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void resetData(chainScopedStorageAdapter).then(() => DevSettings.reload());
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <ThemedText type="caption" themeColor="textSecondary">
        Everything the {PROFILES[profile].label} profile has saved (activities, profile, feed,
        clubs, queued changes). Copy it to the clipboard, and paste it back later to return to
        exactly that state. A snapshot only fits the profile it came from.
      </ThemedText>
      <AppButton disabled={busy} onPress={() => void save()}>
        Copy snapshot
      </AppButton>
      <AppButton variant="secondary" disabled={busy} onPress={() => void restore()}>
        Restore from clipboard
      </AppButton>
      <AppButton variant="danger" disabled={busy} onPress={reset}>
        Reset this profile
      </AppButton>
      <WalletPanel />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.four, gap: Spacing.three },
});
