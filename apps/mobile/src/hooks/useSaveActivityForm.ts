import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { COPY } from '@/constants/copy';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useGoBack } from '@/hooks/useGoBack';
import { useManualEntry } from '@/hooks/useManualEntry';
import { usePostRun } from '@/hooks/usePostRun';
import { type SaveActivityRecording, useSaveActivityParams } from '@/hooks/useSaveActivityParams';
import { useViemWallet } from '@/hooks/useViemWallet';
import { attachSessionToActivity, runPostActivityPipeline } from '@/services/activityPipeline';
import { EmptyRecordingError, type PostRunInput, type SavePhase } from '@/services/postRun';
import { useGearStore } from '@/stores/gearStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type {
  ActivityEffort,
  ActivityFeel,
  ActivityPrivacy,
  ActivityType,
  HiddenStat,
} from '@/types';
import { Alert } from '@/utils/alert';
import { confirmDestructive } from '@/utils/confirmDestructive';
import { confirmOnlyMe } from '@/utils/confirmOnlyMe';
import { getActivityName } from '@/utils/format';
import { gearForSport } from '@/utils/gearMileage';
import { haptics } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { manualStartedAt, shouldConfirmDiscard } from '@/utils/manualActivity';
import { savePrivacyCaption } from '@/utils/privacyNotes';
import { dropRecordedRun } from '@/utils/recordedRunHandoff';
import { parseJsonParam } from '@/utils/routeParams';
import {
  canSaveActivity,
  defaultGearId,
  discardPrompt,
  privacyChangeNeedsConfirm,
  showHideRoute,
  toggleHiddenStat,
  visibilityFlags,
} from '@/utils/saveActivityForm';

type SaveResult = Awaited<ReturnType<ReturnType<typeof usePostRun>['save']>>;

/** One dialog at a time: a failure outranks the nudge to verify. */
function announceOutcome(result: SaveResult, openVerify: () => void) {
  if (result.onchainFailed) {
    Alert.alert(COPY.saveFailedTitle, COPY.saveFailedBody);
  } else if (result.needsVerification && !result.rewardHold) {
    Alert.alert(
      'Verify to claim territory',
      'Verify with World ID Selfie Check to claim territory and help keep the map fair for everyone.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Verify', onPress: openVerify },
      ]
    );
  }
}

function announceFailure(err: unknown) {
  logger.warn('[CreateActivity] Save failed', err);
  if (err instanceof EmptyRecordingError) {
    Alert.alert('Activity too short', 'This recording has no route, so it cannot be saved.');
    return;
  }
  Alert.alert('Could not save activity', 'Something went wrong saving this activity. Try again.');
}

type FormValues = Pick<
  PostRunInput,
  | 'title'
  | 'description'
  | 'activityType'
  | 'distance'
  | 'duration'
  | 'gearId'
  | 'photos'
  | 'privacy'
  | 'feel'
  | 'effort'
  | 'isCommute'
  | 'privateNote'
  | 'startedAt'
  | 'mutedFromFeeds'
  | 'hiddenStats'
> & { hideRoute: boolean };

function postRunInput(
  recording: SaveActivityRecording,
  values: FormValues,
  settings: Pick<PostRunInput, 'hideRouteEnds' | 'privacyZones'>
): PostRunInput {
  const { isFromTracking } = recording;
  return {
    ...values,
    ...settings,
    polyline: recording.polyline,
    splits: recording.splits,
    stream: recording.stream,
    elevationGain: recording.elevationGain,
    elevationLoss: recording.elevationLoss,
    bestEfforts: recording.bestEfforts,
    laps: recording.laps,
    territory: recording.territory,
    territoryArea: recording.territoryArea,
    hideRoute: showHideRoute(isFromTracking, values.privacy) ? values.hideRoute : undefined,
    mocked: recording.mocked ? true : undefined,
    isManual: !isFromTracking,
  };
}

/** The save screen's state, checks and handlers; the screen and its sections only draw it. */
export function useSaveActivityForm() {
  const router = useRouter();
  const goBack = useGoBack();
  const unitSystem = useUnitSystem();
  const recording = useSaveActivityParams();
  const { isFromTracking, runId } = recording;
  const { address } = useViemWallet();
  const { save } = usePostRun();
  const hideRouteEnds = useSettingsStore((s) => s.hideRouteEnds);
  const privacyZones = useSettingsStore((s) => s.privacyZones);
  const defaultPrivacy = useSettingsStore((s) => s.defaultPrivacy);

  const [isSaving, setIsSaving] = useState(false);
  const [phase, setPhase] = useState<SavePhase | undefined>();
  // null until the user types: the title then follows the sport and the time of day.
  const [titleInput, setTitleInput] = useState<string | null>(null);
  const hourAtOpen = useRef(new Date().getHours()).current;
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>(recording.activityType || 'run');
  const [photos, setPhotos] = useState<string[]>(() =>
    parseJsonParam<string[]>(recording.initialPhotos, 'photos', [])
  );
  const [privacy, setPrivacy] = useState<ActivityPrivacy>(defaultPrivacy);
  const [feel, setFeel] = useState<ActivityFeel | undefined>();
  const [effort, setEffort] = useState<ActivityEffort | undefined>();
  const [isCommute, setIsCommute] = useState(false);
  const [hideRoute, setHideRoute] = useState(false);
  const [muted, setMuted] = useState(false);
  const [hiddenStats, setHiddenStats] = useState<HiddenStat[]>([]);
  const [privateNote, setPrivateNote] = useState('');
  const manual = useManualEntry(activityType, unitSystem);

  const allGear = useGearStore((s) => s.gear);
  const gearOptions = useMemo(() => gearForSport(allGear, activityType), [allGear, activityType]);
  const [pickedGear, setGearId] = useState<string | null | undefined>(undefined);
  const gearId = defaultGearId(pickedGear, gearOptions);

  const distance = isFromTracking ? recording.distance : manual.distance;
  const duration = isFromTracking ? recording.duration : manual.duration;
  const canSave = canSaveActivity({
    isSaving,
    fromRecording: isFromTracking,
    manual: manual.entry,
    startInFuture: manual.startInFuture,
  });

  // A recorded run is named and dated by when it began, not by when it was saved.
  const startHour =
    recording.startedAt === undefined ? hourAtOpen : new Date(recording.startedAt).getHours();
  const defaultTitle = getActivityName(activityType, startHour);
  const title = titleInput ?? defaultTitle;

  const selectPrivacy = (next: ActivityPrivacy) => {
    if (privacyChangeNeedsConfirm(privacy, next)) confirmOnlyMe(() => setPrivacy(next));
    else setPrivacy(next);
  };

  const handleSave = async () => {
    haptics.success();
    setIsSaving(true);
    setPhase(undefined);
    try {
      const input = postRunInput(
        recording,
        {
          title,
          description,
          activityType,
          distance,
          duration,
          gearId: gearId ?? undefined,
          photos,
          privacy,
          feel,
          effort,
          isCommute,
          hideRoute,
          ...visibilityFlags({ privacy, muted, hiddenStats }),
          privateNote,
          startedAt: isFromTracking ? recording.startedAt : manualStartedAt(manual.day, Date.now()),
        },
        { hideRouteEnds, privacyZones }
      );
      const result = await save(input, undefined, setPhase);
      announceOutcome(result, () => router.push('/verify'));
      if (isFromTracking && attachSessionToActivity(result.activity.id) && address) {
        void runPostActivityPipeline({
          activityId: result.activity.id,
          onchainActivityId: result.activity.onchainActivityId,
          name: title,
          distance,
          athlete: address,
        });
      }
      if (runId) dropRecordedRun(runId);
      router.replace({ pathname: '/post-upload', params: { id: result.activity.id } });
      // The finish line is the moment to sign the run, while the athlete is still holding the phone.
      if (result.rewardHold && !result.onchainFailed) {
        router.push({ pathname: '/finish-line', params: { id: result.activity.id } });
      }
    } catch (err) {
      announceFailure(err);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDiscard = () => {
    confirmDestructive({
      ...discardPrompt(isFromTracking),
      onConfirm: () => {
        // A discarded run must not come back as an "unsaved run" on the next launch.
        if (runId) dropRecordedRun(runId);
        goBack();
      },
    });
  };

  const handleBack = () => {
    const confirm = shouldConfirmDiscard({
      recorded: isFromTracking,
      titleEdited: !!titleInput?.trim(),
      description,
      privateNote,
      photoCount: photos.length,
      distanceInput: manual.distanceInput,
      minutesInput: manual.minutesInput,
    });
    if (confirm) confirmDiscard();
    else goBack();
  };

  // Hardware back and the back gesture must show the same discard prompt as the close button.
  useBackHandler(handleBack);

  return {
    recording,
    unitSystem,
    manual,
    distance,
    duration,
    title,
    defaultTitle,
    setTitleInput,
    description,
    setDescription,
    activityType,
    setActivityType,
    photos,
    setPhotos,
    privacy,
    selectPrivacy,
    privacyCaption: savePrivacyCaption({ recorded: isFromTracking, privacy }),
    feel,
    setFeel,
    effort,
    setEffort,
    isCommute,
    setIsCommute,
    hideRoute,
    setHideRoute,
    muted,
    setMuted,
    hiddenStats,
    setHiddenStat: (stat: HiddenStat, on: boolean) =>
      setHiddenStats((current) => toggleHiddenStat(current, stat, on)),
    privateNote,
    setPrivateNote,
    gearOptions,
    gearId,
    setGearId,
    canSave,
    isSaving,
    phase,
    handleSave,
    handleBack,
    handleDiscard: confirmDiscard,
  };
}

export type SaveActivityForm = ReturnType<typeof useSaveActivityForm>;
