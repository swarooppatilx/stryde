import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/button';
import { ListMessage } from '@/components/list-message';
import { PersonRow } from '@/components/search-rows';
import { SETUP_COPY } from '@/constants/copy';
import { useTheme } from '@/hooks/use-theme';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useHiddenAuthors } from '@/hooks/useHiddenAuthors';
import { useOnline } from '@/hooks/useOnline';
import { useSocialStore } from '@/stores/socialStore';
import { Alert } from '@/utils/alert';
import { followNudgeNeeded } from '@/utils/setupFlow';
import type { SocialUser } from '@/utils/socialSelectors';
import { suggestPeople } from '@/utils/suggestedPeople';

const SHOWN = 8;
type Load = 'loading' | 'ready' | 'error';

/** People to follow. A row stays on screen after it is followed, so the button can say so. */
export function SetupPeopleStep({ onNext }: { onNext: () => void }) {
  const router = useRouter();
  const theme = useTheme();
  const online = useOnline();
  const me = useCurrentUserId();
  const hidden = useHiddenAuthors();
  const fetchUsers = useSocialStore((s) => s.fetchUsers);
  const followingCount = useSocialStore((s) => s.following.size);
  const [load, setLoad] = useState<Load>('loading');
  const [shown, setShown] = useState<SocialUser[]>([]);
  const nudged = useRef(false);

  const loadPeople = useCallback(async () => {
    setLoad('loading');
    let ok = false;
    try {
      ok = await fetchUsers();
    } catch {
      ok = false;
    }
    const { users, following } = useSocialStore.getState();
    const people = suggestPeople(users, new Set([...following, ...hidden]), me, SHOWN);
    setShown(people);
    // Whatever is already on the phone is worth showing even when the refresh failed.
    setLoad(ok || people.length > 0 ? 'ready' : 'error');
  }, [fetchUsers, hidden, me]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: load once on opening; retry is explicit
  useEffect(() => {
    void loadPeople();
  }, []);

  const next = () => {
    if (
      !followNudgeNeeded({
        followingCount,
        suggestionCount: shown.length,
        alreadyShown: nudged.current,
      })
    ) {
      onNext();
      return;
    }
    nudged.current = true;
    const { title, message, back, later } = SETUP_COPY.people.nudge;
    Alert.alert(title, message, [
      { text: back, style: 'cancel' },
      { text: later, onPress: onNext },
    ]);
  };

  const copy = SETUP_COPY.people;
  const body = () => {
    if (load === 'loading') return <ActivityIndicator color={theme.brand.primary} />;
    if (load === 'error') {
      return (
        <ListMessage
          icon="cloud-offline-outline"
          text={online ? copy.failed : copy.offline}
          action={{ label: copy.retry, onPress: () => void loadPeople() }}
        />
      );
    }
    if (shown.length === 0) return <ListMessage icon="people-outline" text={copy.empty} />;
    return (
      <View>
        {shown.map((user) => (
          <PersonRow
            key={user.id}
            user={user}
            showFollow
            onPress={() => router.push(`/athletes/${user.id}`)}
          />
        ))}
      </View>
    );
  };

  return (
    <>
      <View style={styles.list}>{body()}</View>
      <AppButton onPress={next}>{SETUP_COPY.done}</AppButton>
    </>
  );
}

const styles = StyleSheet.create({
  list: { minHeight: 120, justifyContent: 'center' },
});
