import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { AppButton } from '@/components/button';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ZeroGReceipts } from '@/components/zero-g-receipts';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCoachAuth } from '@/hooks/useCoachAuth';
import { useMaxHeartRate } from '@/hooks/useMaxHeartRate';
import {
  POSTER_STYLES,
  type PosterStyleId,
  requestDebrief,
  requestPoster,
  requestReview,
} from '@/services/coachService';
import type { HumanAuth } from '@/services/humanPassService';
import { useActivityStore } from '@/stores/activityStore';
import { useCoachStore } from '@/stores/coachStore';
import { useProfileStore } from '@/stores/profileStore';
import type { Activity } from '@/types';
import { Alert } from '@/utils/alert';
import { recentHistory, toCoachRun, toCoachVitals } from '@/utils/coachRun';
import { haptics } from '@/utils/haptics';

const MAX_DEBRIEF_MS = 45_000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}

function ReviewSection({ activity, auth }: { activity: Activity; auth: HumanAuth | null }) {
  const theme = useTheme();
  const saved = useCoachStore((s) => s.reviews[activity.id]);
  const debrief = useCoachStore((s) => s.debriefs[activity.id]);
  const maxHr = useMaxHeartRate();
  const restingHr = useProfileStore((s) => s.settings.restingHeartRate);
  const zoneFloors = useProfileStore((s) => s.settings.hrZoneFloors);
  const [busy, setBusy] = useState(false);

  const review = async () => {
    if (!auth) return;
    setBusy(true);
    try {
      const { activities } = useActivityStore.getState();
      const { debriefs } = useCoachStore.getState();
      const started = new Date(activity.stream?.startedAt ?? activity.createdAt).getTime();
      const history = recentHistory(
        activities.filter((a) => a.id !== activity.id),
        debriefs,
        started,
        { maxHr, restingHr, zoneFloors }
      );
      const result = await requestReview(
        auth,
        toCoachRun(activity, debrief),
        toCoachVitals(activity, { maxHr, restingHr, zoneFloors }),
        history
      );
      useCoachStore.getState().saveReview(activity.id, { ...result, createdAt: Date.now() });
      haptics.success();
    } catch (error) {
      Alert.alert('Coach review', errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (!saved) {
    return (
      <ThemedView style={styles.section}>
        <ThemedText type="smallBold">Coach review</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Your coach reads this activity's pace, splits, heart rate and cadence against your last
          two weeks, then tells you what went well and what to work on.
        </ThemedText>
        <AppButton
          onPress={review}
          loading={busy}
          disabled={busy || !auth}
          icon={<Ionicons name="clipboard-outline" size={18} color={theme.brand.white} />}
        >
          {busy ? 'Your coach is reviewing…' : 'Get my coach review'}
        </AppButton>
      </ThemedView>
    );
  }

  const { review: r } = saved;
  return (
    <ThemedView style={styles.section}>
      <ThemedText type="eyebrow" themeColor="textSecondary">
        Coach review
      </ThemedText>
      <ThemedText type="titleSmall">{r.headline}</ThemedText>
      <ThemedText type="small">{r.summary}</ThemedText>

      {r.wentWell.length > 0 && (
        <ThemedView style={styles.list}>
          <ThemedText type="smallBold">What went well</ThemedText>
          {r.wentWell.map((point) => (
            <ThemedView key={point} style={styles.bullet}>
              <Ionicons name="checkmark-circle" size={16} color={theme.brand.success} />
              <ThemedText type="small" style={styles.flex}>
                {point}
              </ThemedText>
            </ThemedView>
          ))}
        </ThemedView>
      )}

      {r.vitals.length > 0 && (
        <ThemedView style={styles.list}>
          <ThemedText type="smallBold">Your vitals</ThemedText>
          {r.vitals.map((v) => (
            <ThemedView
              key={v.label}
              style={[styles.vital, { backgroundColor: tint(theme.brand.primary, 0.06) }]}
            >
              <ThemedView style={styles.vitalHead}>
                <ThemedText type="caption" themeColor="textSecondary">
                  {v.label}
                </ThemedText>
                <ThemedText type="smallBold">{v.reading}</ThemedText>
              </ThemedView>
              {v.note ? <ThemedText type="caption">{v.note}</ThemedText> : null}
            </ThemedView>
          ))}
        </ThemedView>
      )}

      <ThemedView style={styles.list}>
        <ThemedText type="smallBold">Work on</ThemedText>
        {r.improve.map((item) => (
          <ThemedView key={item.focus} style={styles.bullet}>
            <Ionicons name="trending-up" size={16} color={theme.brand.primary} />
            <ThemedText type="small" style={styles.flex}>
              <ThemedText type="smallBold">{item.focus}: </ThemedText>
              {item.tip}
            </ThemedText>
          </ThemedView>
        ))}
      </ThemedView>

      {r.nextRun ? (
        <ThemedView style={styles.list}>
          <ThemedText type="smallBold">Next session</ThemedText>
          <ThemedText type="small">{r.nextRun}</ThemedText>
        </ThemedView>
      ) : null}

      <ZeroGReceipts receipts={saved.receipts} />
      <AppButton
        size="small"
        variant="ghost"
        fullWidth={false}
        onPress={review}
        loading={busy}
        disabled={busy || !auth}
      >
        {debrief ? 'Review again with my debrief' : 'Review again'}
      </AppButton>
    </ThemedView>
  );
}

function DebriefSection({ activity, auth }: { activity: Activity; auth: HumanAuth | null }) {
  const theme = useTheme();
  const saved = useCoachStore((s) => s.debriefs[activity.id]);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [busy, setBusy] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const start = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Microphone needed',
        'Allow microphone access to record a voice debrief for your coach.'
      );
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    haptics.tap();
  };

  const finish = async () => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    const uri = recorder.uri;
    if (!uri || !auth) return;
    setBusy(true);
    try {
      const result = await requestDebrief(auth, toCoachRun(activity), uri);
      useCoachStore.getState().saveDebrief(activity.id, {
        ...result.debrief,
        transcript: result.transcript,
        receipts: result.receipts,
        createdAt: Date.now(),
      });
      haptics.success();
    } catch (error) {
      Alert.alert('Debrief', errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: stops once, when the cap is reached
  useEffect(() => {
    if (recorderState.isRecording && recorderState.durationMillis >= MAX_DEBRIEF_MS) void finish();
  }, [recorderState.isRecording, recorderState.durationMillis >= MAX_DEBRIEF_MS]);

  if (saved) {
    return (
      <ThemedView style={styles.section}>
        <ThemedText type="smallBold">Your debrief</ThemedText>
        <ThemedText type="small">{saved.summary}</ThemedText>
        <ThemedView style={styles.chips}>
          {saved.effort ? <Chip label={`Effort ${saved.effort}/10`} /> : null}
          {saved.feel ? <Chip label={saved.feel} /> : null}
          {saved.tags.map((tag) => (
            <Chip key={tag} label={tag} />
          ))}
        </ThemedView>
        <ThemedText
          type="caption"
          style={{ color: theme.accentText }}
          onPress={() => setShowTranscript((v) => !v)}
        >
          {showTranscript ? `"${saved.transcript}"` : 'Show what you said'}
        </ThemedText>
        <ZeroGReceipts receipts={saved.receipts} />
      </ThemedView>
    );
  }

  const seconds = Math.floor(recorderState.durationMillis / 1000);
  return (
    <ThemedView style={styles.section}>
      <ThemedText type="smallBold">Voice debrief</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        Say how it felt in under 45 seconds. Your coach hears it with Whisper on 0G and uses it to
        plan tomorrow.
      </ThemedText>
      {recorderState.isRecording ? (
        <AppButton
          variant="secondary"
          onPress={finish}
          icon={<Ionicons name="stop-circle" size={18} color={theme.brand.danger} />}
        >
          {`Stop · ${seconds}s`}
        </AppButton>
      ) : (
        <AppButton
          variant="secondary"
          onPress={start}
          loading={busy}
          disabled={busy || !auth}
          icon={<Ionicons name="mic" size={18} color={theme.brand.primary} />}
        >
          {busy ? 'Your coach is listening…' : 'Record debrief'}
        </AppButton>
      )}
    </ThemedView>
  );
}

function PosterSection({
  activity,
  auth,
  onShare,
}: {
  activity: Activity;
  auth: HumanAuth | null;
  onShare: () => void;
}) {
  const saved = useCoachStore((s) => s.posters[activity.id]);
  const debrief = useCoachStore((s) => s.debriefs[activity.id]);
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  // null: the coach picks a style, so every poster comes out different.
  const [style, setStyle] = useState<PosterStyleId | null>(null);
  const savedStyle = POSTER_STYLES.find((s) => s.id === saved?.style)?.label;

  const make = async () => {
    if (!auth) return;
    setBusy(true);
    try {
      const run = toCoachRun(activity, debrief);
      const result = await requestPoster(auth, activity.id, run, style ?? undefined);
      useCoachStore.getState().savePoster(activity.id, { ...result, createdAt: Date.now() });
      haptics.success();
    } catch (error) {
      Alert.alert('Run poster', errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const picker = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.styleRow}
    >
      <StyleChip label="Surprise me" selected={style === null} onPress={() => setStyle(null)} />
      {POSTER_STYLES.map((s) => (
        <StyleChip
          key={s.id}
          label={s.label}
          selected={style === s.id}
          onPress={() => setStyle(s.id)}
        />
      ))}
    </ScrollView>
  );

  return (
    <ThemedView style={styles.section}>
      <ThemedText type="smallBold">Run poster</ThemedText>
      {saved ? (
        <>
          <Image
            source={{ uri: saved.uri }}
            style={styles.poster}
            contentFit="cover"
            transition={200}
          />
          {saved.title || savedStyle ? (
            <ThemedText type="caption" themeColor="textSecondary">
              {[saved.title ? `"${saved.title}"` : null, savedStyle].filter(Boolean).join(' · ')}
            </ThemedText>
          ) : null}
          <ZeroGReceipts receipts={saved.receipts} />
          <AppButton size="small" fullWidth={false} onPress={onShare}>
            Share poster
          </AppButton>
          <ThemedText type="caption" themeColor="textSecondary">
            Try another style
          </ThemedText>
          {picker}
          <AppButton
            size="small"
            variant="secondary"
            onPress={make}
            loading={busy}
            disabled={busy || !auth}
            icon={<Ionicons name="color-palette-outline" size={16} color={theme.brand.primary} />}
          >
            {busy ? 'Painting a new one…' : 'Remake poster'}
          </AppButton>
        </>
      ) : (
        <>
          <ThemedText type="caption" themeColor="textSecondary">
            An art director on 0G turns this run{debrief ? ' and how you said it felt' : ''} into a
            scene, then Seedream on 0G paints it as a collectible poster.
          </ThemedText>
          {picker}
          <AppButton
            variant="secondary"
            onPress={make}
            loading={busy}
            disabled={busy || !auth}
            icon={<Ionicons name="color-palette-outline" size={18} color={theme.brand.primary} />}
          >
            {busy ? 'Painting your run… (about 20 s)' : 'Make my run poster'}
          </AppButton>
        </>
      )}
    </ThemedView>
  );
}

function StyleChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.styleChip,
        selected
          ? { backgroundColor: theme.brand.primary, borderColor: theme.brand.primary }
          : { borderColor: theme.border },
      ]}
    >
      <ThemedText
        type="caption"
        style={selected ? { color: theme.brand.white } : { color: theme.text }}
      >
        {label}
      </ThemedText>
    </Tappable>
  );
}

function Chip({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <ThemedView style={[styles.chip, { backgroundColor: tint(theme.brand.primary, 0.12) }]}>
      <ThemedText type="caption" style={{ color: theme.accentText }}>
        {label}
      </ThemedText>
    </ThemedView>
  );
}

/** Just the review, for the screen shown right after a save. */
export function CoachReviewCard({ activity }: { activity: Activity }) {
  const theme = useTheme();
  const auth = useCoachAuth();
  return (
    <ThemedView style={[styles.card, { borderColor: theme.border }]}>
      <ThemedView style={styles.row}>
        <Ionicons name="sparkles" size={16} color={theme.brand.primary} />
        <ThemedText type="eyebrow" themeColor="textSecondary">
          Stryde Coach · runs on 0G
        </ThemedText>
      </ThemedView>
      <ReviewSection activity={activity} auth={auth} />
    </ThemedView>
  );
}

/** After a run: the AI coach on 0G reviews the numbers, hears the debrief and paints the poster. */
export function CoachRunCard({
  activity,
  onSharePoster,
}: {
  activity: Activity;
  onSharePoster: () => void;
}) {
  const theme = useTheme();
  const auth = useCoachAuth();
  return (
    <ThemedView style={[styles.card, { borderColor: theme.border }]}>
      <ThemedView style={styles.row}>
        <Ionicons name="sparkles" size={16} color={theme.brand.primary} />
        <ThemedText type="eyebrow" themeColor="textSecondary">
          Stryde Coach · runs on 0G
        </ThemedText>
      </ThemedView>
      <ReviewSection activity={activity} auth={auth} />
      <DebriefSection activity={activity} auth={auth} />
      <PosterSection activity={activity} auth={auth} onShare={onSharePoster} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  section: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  list: { gap: Spacing.one },
  styleRow: { gap: Spacing.one, paddingVertical: Spacing.half },
  styleChip: {
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  flex: { flex: 1 },
  vital: { borderRadius: BorderRadius.md, padding: Spacing.two, gap: Spacing.half },
  vitalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: BorderRadius.full,
  },
  poster: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 420,
    borderRadius: BorderRadius.md,
  },
});
