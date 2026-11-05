import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListMessage } from '@/components/list-message';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserAvatar } from '@/components/user-avatar';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGoBack } from '@/hooks/useGoBack';
import { useUserResolver } from '@/hooks/useSocialUser';
import { useBlockStore } from '@/stores/blockStore';
import { getDisplayName } from '@/utils/format';
import { hiddenList } from '@/utils/hiddenList';
import { Toast } from '@/utils/toast';

/** Athletes blocked or muted on this device, each with a way back. */
export default function BlockedScreen() {
  const goBack = useGoBack();
  const router = useRouter();
  const theme = useTheme();
  const resolve = useUserResolver();
  const blocked = useBlockStore((s) => s.blocked);
  const muted = useBlockStore((s) => s.muted);
  const unblock = useBlockStore((s) => s.unblock);
  const unmute = useBlockStore((s) => s.unmute);
  const entries = hiddenList(blocked, muted);

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Tappable
            onPress={goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Tappable>
          <ThemedText type="sectionTitle" accessibilityRole="header">
            Blocked and muted
          </ThemedText>
          <View style={styles.spacer} />
        </View>
        <FlatList
          data={entries}
          keyExtractor={(entry) => entry.address}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ListMessage icon="ban-outline" text="You haven't blocked or muted anyone." />
          }
          renderItem={({ item: { address, kind } }) => {
            const undo = kind === 'blocked' ? unblock : unmute;
            const verb = kind === 'blocked' ? 'Unblock' : 'Unmute';
            const done = kind === 'blocked' ? 'Unblocked' : 'Unmuted';
            const user = resolve(address);
            const name = user
              ? getDisplayName(user)
              : `${address.slice(0, 6)}…${address.slice(-4)}`;
            return (
              <View style={styles.row}>
                <Tappable
                  style={styles.rowMain}
                  onPress={() => router.push(`/athletes/${address}`)}
                  accessibilityRole="button"
                  accessibilityLabel={name}
                >
                  <UserAvatar uri={user?.avatar} name={name} size={40} />
                  <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
                    {name}
                  </ThemedText>
                </Tappable>
                <Tappable
                  style={[styles.unblock, { borderColor: theme.border }]}
                  onPress={() => {
                    undo(address);
                    Toast.success(`${done} ${name}`);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${verb} ${name}`}
                >
                  <ThemedText type="smallBold">{verb}</ThemedText>
                </Tappable>
              </View>
            );
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  spacer: { width: 24 },
  list: { flexGrow: 1, paddingBottom: Spacing.four },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 60,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.twoHalf },
  name: { flexShrink: 1 },
  unblock: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
