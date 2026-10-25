import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListMessage } from '@/components/list-message';
import { PersonRow } from '@/components/search-rows';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useGoBack } from '@/hooks/useGoBack';
import { useHiddenAuthors } from '@/hooks/useHiddenAuthors';
import { useUserResolver } from '@/hooks/useSocialUser';
import { activityKey, useSocialStore } from '@/stores/socialStore';
import { followListUsers } from '@/utils/followListUsers';
import { withoutHidden } from '@/utils/withoutHidden';

/** Who gave kudos to an activity. Opened from the kudos count on a feed card. */
export default function KudosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useGoBack();
  const theme = useTheme();
  const me = useCurrentUserId();
  const resolve = useUserResolver();
  const hidden = useHiddenAuthors();
  const kudos = useSocialStore((s) =>
    id ? (s.activities[activityKey(s.activities, id)]?.kudos ?? null) : null
  );

  const users = kudos ? withoutHidden(followListUsers(kudos, resolve), (u) => u.id, hidden) : [];

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
            Kudos
          </ThemedText>
          <View style={styles.spacer} />
        </View>
        <FlatList
          data={users}
          keyExtractor={(user) => user.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ListMessage icon="thumbs-up-outline" text="No kudos on this activity yet." />
          }
          renderItem={({ item }) => (
            <PersonRow
              user={item}
              showFollow={item.id.toLowerCase() !== me.toLowerCase()}
              onPress={() => router.push(`/athletes/${item.id}`)}
            />
          )}
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
});
