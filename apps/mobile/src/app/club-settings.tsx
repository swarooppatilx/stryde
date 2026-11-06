import { Ionicons } from '@expo/vector-icons';
import { type ClubSettings, type NotifyLevel, services } from '@repo/shared';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendClubChange } from '@/backends/clubIntents';
import { setClubMember } from '@/backends/membership';
import { AppSwitch } from '@/components/app-switch';
import { AppButton } from '@/components/button';
import { ChipRow } from '@/components/filter-chips';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getCurrentUserId } from '@/constants/config';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGoBack } from '@/hooks/useGoBack';
import { getPlatform } from '@/platform';
import { uploadImageToIpfs } from '@/services/ipfsService';
import { useClubStore } from '@/stores/clubStore';
import { useCommunityStore } from '@/stores/communityStore';
import { Alert } from '@/utils/alert';
import { ipfsToHttpUrl } from '@/utils/ipfsUrl';
import { logger } from '@/utils/logger';
import { Toast } from '@/utils/toast';

const NOTIFY_OPTIONS: Array<{ value: NotifyLevel; label: string }> = [
  { value: 'all', label: 'All posts' },
  { value: 'announcements', label: 'Announcements' },
  { value: 'off', label: 'Off' },
];

const BLANK: ClubSettings = {
  name: '',
  location: '',
  description: '',
  photo: '',
  cover: '',
  inviteOnly: false,
  adminsOnlyPost: false,
  showLeaderboard: true,
};

/** What a member can change about their own membership, and what admins can change about the club. */
export default function ClubSettingsScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const goBack = useGoBack();
  const club = useCommunityStore((s) => s.clubs.find((c) => c.id === id));
  const events = useCommunityStore((s) => s.events);
  const view = useClubStore((s) => s.clubs[id]);
  const me = getCurrentUserId().toLowerCase();
  const state = view?.state;
  const saved = state?.settings ?? BLANK;
  const isOwner = club?.owner.toLowerCase() === me;
  const isAdmin = isOwner || (state?.admins ?? []).some((a) => a.toLowerCase() === me);

  // The form starts from what is saved, falling back to what the chain has for the club.
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState('');
  const [cover, setCover] = useState('');
  const [uploading, setUploading] = useState<'photo' | 'cover' | null>(null);
  const [notify, setNotify] = useState<NotifyLevel>('all');

  // biome-ignore lint/correctness/useExhaustiveDependencies: refill when the saved settings arrive
  useEffect(() => {
    setName(saved.name || club?.name || '');
    setLocation(saved.location || club?.location || '');
    setDescription(saved.description || club?.description || '');
    setPhoto(saved.photo);
    setCover(saved.cover);
  }, [state?.settings, club?.id]);

  useEffect(() => {
    let cancelled = false;
    services.clubs
      .getNotifyLevel(id, me as `0x${string}`)
      .then((level) => !cancelled && setNotify(level))
      .catch((error) => logger.warn('[Clubs] Could not read the notification choice', error));
    return () => {
      cancelled = true;
    };
  }, [id, me]);

  const save = (patch: Partial<ClubSettings>) =>
    void sendClubChange({
      clubId: id,
      action: 'settings',
      data: { ...saved, name, location, description, photo, cover, ...patch },
    });

  const pick = async (which: 'photo' | 'cover') => {
    const picked = await getPlatform().photos.pick({ aspect: which === 'photo' ? [1, 1] : [3, 1] });
    if (picked.status !== 'picked' || !picked.uris[0]) return;
    setUploading(which);
    try {
      const { cid } = await uploadImageToIpfs(`club-${which}`, picked.uris[0]);
      if (which === 'photo') setPhoto(cid);
      else setCover(cid);
    } catch (error) {
      logger.warn('[Clubs] Photo upload failed', error);
      Toast.fail("Couldn't upload that photo", 2);
    } finally {
      setUploading(null);
    }
  };

  const leave = () =>
    Alert.alert('Leave this club?', 'You can join again later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          void setClubMember(id, false);
          goBack();
        },
      },
    ]);

  const remove = () =>
    Alert.alert(
      'Delete this club?',
      'You are its only member: leaving closes the club for good and returns any treasury funds to you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete club',
          style: 'destructive',
          onPress: () => {
            void setClubMember(id, false);
            goBack();
          },
        },
      ]
    );

  const linked = new Set(state?.events ?? []);
  const myEvents = events.filter((e) => e.host?.toLowerCase() === me || linked.has(e.id));
  const onlyMember = (club?.memberCount ?? 0) <= 1;

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
          <ThemedText type="sectionTitle">Club settings</ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {isAdmin && (
            <View style={styles.section}>
              <ThemedText type="eyebrow" themeColor="textSecondary">
                Club details
              </ThemedText>
              <Tappable
                onPress={() => void pick('cover')}
                style={[styles.cover, { backgroundColor: theme.backgroundElement }]}
                accessibilityRole="button"
                accessibilityLabel="Change cover photo"
              >
                {cover ? (
                  <Image
                    source={{ uri: ipfsToHttpUrl(cover) }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    {uploading === 'cover' ? 'Uploading…' : 'Add a cover photo'}
                  </ThemedText>
                )}
              </Tappable>
              <View style={styles.photoRow}>
                <Tappable
                  onPress={() => void pick('photo')}
                  style={[styles.photo, { backgroundColor: theme.backgroundElement }]}
                  accessibilityRole="button"
                  accessibilityLabel="Change club photo"
                >
                  {photo ? (
                    <Image
                      source={{ uri: ipfsToHttpUrl(photo) }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons name="camera-outline" size={22} color={theme.textSecondary} />
                  )}
                </Tappable>
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  {uploading === 'photo' ? 'Uploading…' : 'Club photo'}
                </ThemedText>
              </View>
              <TextField label="Name" value={name} onChangeText={setName} maxLength={64} />
              <TextField
                label="Location"
                value={location}
                onChangeText={setLocation}
                maxLength={64}
              />
              <TextField
                label="About"
                value={description}
                onChangeText={setDescription}
                maxLength={500}
                multiline
              />
              <AppButton
                disabled={uploading !== null || !name.trim()}
                onPress={() => {
                  save({});
                  Toast.success('Club updated', 1);
                }}
              >
                Save details
              </AppButton>
            </View>
          )}

          {isAdmin && (
            <View style={styles.section}>
              <ThemedText type="eyebrow" themeColor="textSecondary">
                Permissions
              </ThemedText>
              {[
                {
                  key: 'inviteOnly' as const,
                  title: 'Invite only',
                  hint: 'New members need an admin to approve them',
                },
                {
                  key: 'adminsOnlyPost' as const,
                  title: 'Only admins can post',
                  hint: 'Members can still comment',
                },
                {
                  key: 'showLeaderboard' as const,
                  title: 'Show leaderboard',
                  hint: 'Weekly rankings and club totals',
                },
              ].map((row) => (
                <View
                  key={row.key}
                  style={[styles.toggle, { backgroundColor: theme.backgroundElement }]}
                >
                  <View style={styles.flex}>
                    <ThemedText>{row.title}</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {row.hint}
                    </ThemedText>
                  </View>
                  <AppSwitch
                    checked={saved[row.key]}
                    onChange={(on) => save({ [row.key]: on })}
                    label={row.title}
                  />
                </View>
              ))}
            </View>
          )}

          {isAdmin && myEvents.length > 0 && (
            <View style={styles.section}>
              <ThemedText type="eyebrow" themeColor="textSecondary">
                Club events
              </ThemedText>
              {myEvents.map((event) => (
                <View
                  key={event.id}
                  style={[styles.toggle, { backgroundColor: theme.backgroundElement }]}
                >
                  <ThemedText style={styles.flex} numberOfLines={1}>
                    {event.title}
                  </ThemedText>
                  <AppSwitch
                    checked={linked.has(event.id)}
                    onChange={(on) =>
                      void sendClubChange({
                        clubId: id,
                        action: on ? 'link-event' : 'unlink-event',
                        target: event.id,
                      })
                    }
                    label={`Show ${event.title} on the club page`}
                  />
                </View>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Notifications
            </ThemedText>
            <ChipRow
              options={NOTIFY_OPTIONS}
              value={notify}
              onChange={(level) => {
                setNotify(level);
                void sendClubChange({ clubId: id, action: 'notify', data: { level } });
              }}
              contentStyle={styles.chips}
            />
          </View>

          <View style={styles.section}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Membership
            </ThemedText>
            {!isOwner && (
              <AppButton variant="danger" onPress={leave}>
                Leave club
              </AppButton>
            )}
            {isOwner && onlyMember && (
              <AppButton variant="danger" onPress={remove}>
                Delete club
              </AppButton>
            )}
            {isOwner && !onlyMember && (
              <ThemedText type="small" themeColor="textSecondary">
                To leave, first hand the club to another member: Members tab, then a member's menu,
                then Transfer ownership.
              </ThemedText>
            )}
          </View>
        </ScrollView>
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
    paddingVertical: Spacing.two,
  },
  body: { padding: Spacing.four, gap: Spacing.five },
  section: { gap: Spacing.two },
  cover: {
    height: 110,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  photo: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
  flex: { flex: 1 },
  chips: { paddingHorizontal: 0 },
});
