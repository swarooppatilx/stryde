import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EventsPanel } from '@/components/dev/events-panel';
import { LogPanel } from '@/components/dev/log-panel';
import { OutboxPanel } from '@/components/dev/outbox-panel';
import { ProfilePanel } from '@/components/dev/profile-panel';
import { ReplayPanel } from '@/components/dev/replay-panel';
import { StatePanel } from '@/components/dev/state-panel';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UnderlineTabs } from '@/components/underline-tabs';
import { DEV_TOOLS } from '@/constants/devTools';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGoBack } from '@/hooks/useGoBack';

const TABS = ['Profile', 'State', 'Outbox', 'Logs', 'Events', 'Replay'] as const;
type TabKey = (typeof TABS)[number];

/** Development builds only: switch backends, read the app's logs, drive a scripted route. */
export default function DevToolsRoute() {
  // A release build ships this route too; only development builds may open it.
  if (!DEV_TOOLS.enabled) return <Redirect href="/" />;
  return <DevToolsScreen />;
}

function DevToolsScreen() {
  const goBack = useGoBack();
  const theme = useTheme();
  const [tab, setTab] = useState<TabKey>('Profile');

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Tappable
            onPress={goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Tappable>
          <ThemedText type="sectionTitle">Developer tools</ThemedText>
          <View style={styles.headerSpacer} />
        </View>
        <UnderlineTabs
          tabs={TABS}
          active={tab}
          onChange={(next) => setTab(next)}
          style={styles.tabs}
        />
        {tab === 'Profile' && <ProfilePanel />}
        {tab === 'State' && <StatePanel />}
        {tab === 'Outbox' && <OutboxPanel />}
        {tab === 'Logs' && <LogPanel />}
        {tab === 'Events' && <EventsPanel />}
        {tab === 'Replay' && <ReplayPanel />}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  headerSpacer: { width: 24 },
  tabs: { marginHorizontal: Spacing.four, marginTop: Spacing.two },
});
