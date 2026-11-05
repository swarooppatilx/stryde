import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppSwitch } from '@/components/app-switch';
import { AppButton } from '@/components/button';
import { DayField } from '@/components/day-field';
import { FeelPicker } from '@/components/feel-picker';
import { GearPicker } from '@/components/gear-picker';
import { PhotoPicker } from '@/components/photo-picker';
import { PrivacyPicker } from '@/components/privacy-picker';
import { RouteThumbnail } from '@/components/route-thumbnail';
import { SegmentedChoice } from '@/components/segmented-choice';
import { SportField } from '@/components/sport-field';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EFFORT_OPTIONS, GPS_DISTANCE_SPORTS } from '@/constants/activity';
import { COPY, SIMULATED_LOCATION_NOTICE } from '@/constants/copy';
import { ACTIVITY_DESCRIPTION_MAX, NUMBER_INPUT_MAX, PRIVATE_NOTE_MAX } from '@/constants/limits';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useGoBack } from '@/hooks/useGoBack';
import { usePostRun } from '@/hooks/usePostRun';
import { useViemWallet } from '@/hooks/useViemWallet';
import { attachSessionToActivity, runPostActivityPipeline } from '@/services/activityPipeline';
import { EmptyRecordingError } from '@/services/postRun';
import { useGearStore } from '@/stores/gearStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type {
  ActivityEffort,
  ActivityFeel,
  ActivityPrivacy,
  ActivityStream,
  ActivityType,
  BestEffort,
  Lap,
  Ring,
  Split,
} from '@/types';
import { Alert } from '@/utils/alert';
import { confirmOnlyMe } from '@/utils/confirmOnlyMe';
import { formatTimeOfDay } from '@/utils/dates';
import { metersPerDistanceUnit } from '@/utils/distanceUnits';
import {
  formatArea,
  formatDistance,
  formatDuration,
  formatPaceOrSpeed,
  getActivityName,
} from '@/utils/format';
import { gearForSport } from '@/utils/gearMileage';
import { haptics } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { manualStartedAt, shouldConfirmDiscard, validateManualEntry } from '@/utils/manualActivity';
import { savePrivacyCaption } from '@/utils/privacyNotes';
import { dropRecordedRun, peekRecordedRun } from '@/utils/recordedRunHandoff';
import { parseJsonParam } from '@/utils/routeParams';

/** Tall enough to read the route's shape, short enough that the form stays in view. */
const MAP_PREVIEW_HEIGHT = 160;

type Params = {
  /** '1' when the numbers come from a recording (even a GPS-less one). */
  recorded?: string;
  /** When a recorded run began (ms since 1970). */
  startedAt?: string;
  /** '1' when the recording used a simulated location. */
  mocked?: string;
  /** '1' when the recording didn't loop back, so no territory was captured. */
  noTerritory?: string;
  polyline?: string;
  distance?: string;
  duration?: string;
  territory?: string;
  territoryArea?: string;
  splits?: string;
  stream?: string;
  elevationGain?: string;
  elevationLoss?: string;
  bestEfforts?: string;
  laps?: string;
  activityType?: ActivityType;
  photos?: string;
};

/** A route param that is a number, or undefined when it was not sent. */
function optionalNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export default function CreateActivityScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const routeParams = useLocalSearchParams<Params & { run?: string }>();
  // A just-recorded run arrives as a short id; its data (per-second points and all) is held in memory.
  const params: Params = routeParams.run
    ? ((peekRecordedRun(routeParams.run) as Params | undefined) ?? {})
    : routeParams;
  const { save } = usePostRun();
  const { address } = useViemWallet();
  const hideRouteEnds = useSettingsStore((s) => s.hideRouteEnds);
  const privacyZones = useSettingsStore((s) => s.privacyZones);

  const isFromTracking = params.recorded === '1' || !!params.polyline;
  const [isSaving, setIsSaving] = useState(false);

  // null until the user types: the title then follows the sport and the time of day.
  const [titleInput, setTitleInput] = useState<string | null>(null);
  const hourAtOpen = useRef(new Date().getHours()).current;
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>(
    (params.activityType as ActivityType) || 'run'
  );
  const [photos, setPhotos] = useState<string[]>(() =>
    parseJsonParam<string[]>(params.photos, 'photos', [])
  );
  const defaultPrivacy = useSettingsStore((s) => s.defaultPrivacy);
  const [privacy, setPrivacy] = useState<ActivityPrivacy>(defaultPrivacy);
  const privacyCaption = savePrivacyCaption({ recorded: isFromTracking, privacy });
  const [feel, setFeel] = useState<ActivityFeel | undefined>();
  const [effort, setEffort] = useState<ActivityEffort | undefined>();
  const [isCommute, setIsCommute] = useState(false);
  const [hideRoute, setHideRoute] = useState(false);
  const [privateNote, setPrivateNote] = useState('');

  const [manualDistance, setManualDistance] = useState('');
  const [manualMinutes, setManualMinutes] = useState('');
  const [manualDay, setManualDay] = useState(() => new Date());
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const distanceUnitMeters = metersPerDistanceUnit(unitSystem);
  const manualEntry = validateManualEntry({
    sport: activityType,
    distanceInput: manualDistance,
    minutesInput: manualMinutes,
    metersPerUnit: distanceUnitMeters,
  });
  const manualStartTimeFuture = manualDay.getTime() > Date.now();
  const manualDistanceValue = manualEntry.ok ? manualEntry.distance : 0;
  const manualDurationValue = manualEntry.ok ? manualEntry.duration : 0;
  const distance = isFromTracking ? Number.parseFloat(params.distance || '0') : manualDistanceValue;
  const duration = isFromTracking ? Number.parseFloat(params.duration || '0') : manualDurationValue;
  const canSave = !isSaving && (isFromTracking || (manualEntry.ok && !manualStartTimeFuture));
  const typedSomething = manualDistance.trim() !== '' || manualMinutes.trim() !== '';
  const polyline = params.polyline || '';
  const territoryArea = params.territoryArea ? Number.parseFloat(params.territoryArea) : 0;

  const territory = useMemo(
    () => parseJsonParam<Ring | null>(params.territory, 'territory', null),
    [params.territory]
  );
  const splits = useMemo(
    () => parseJsonParam<Split[] | undefined>(params.splits, 'splits', undefined),
    [params.splits]
  );
  const stream = useMemo(
    () => parseJsonParam<ActivityStream | undefined>(params.stream, 'stream', undefined),
    [params.stream]
  );
  const bestEfforts = useMemo(
    () => parseJsonParam<BestEffort[] | undefined>(params.bestEfforts, 'best efforts', undefined),
    [params.bestEfforts]
  );
  const laps = useMemo(
    () => parseJsonParam<Lap[] | undefined>(params.laps, 'laps', undefined),
    [params.laps]
  );

  const allGear = useGearStore((s) => s.gear);
  const gearOptions = useMemo(() => gearForSport(allGear, activityType), [allGear, activityType]);
  // Starts on the first pair of shoes or bike for this sport; the athlete can pick another or none.
  const [pickedGear, setPickedGear] = useState<string | null | undefined>(undefined);
  const gearId = pickedGear === undefined ? (gearOptions[0]?.id ?? null) : pickedGear;
  const setGearId = setPickedGear;

  // A recorded run is named and dated by when it began, not by when it was saved.
  const recordedStart = isFromTracking ? optionalNumber(params.startedAt) : undefined;
  const startHour = recordedStart === undefined ? hourAtOpen : new Date(recordedStart).getHours();
  const defaultTitle = getActivityName(activityType, startHour);
  const title = titleInput ?? defaultTitle;

  const handleSave = async () => {
    haptics.success();
    setIsSaving(true);
    try {
      const result = await save({
        title,
        description,
        activityType,
        distance,
        duration,
        polyline,
        splits,
        stream,
        elevationGain: optionalNumber(params.elevationGain),
        elevationLoss: optionalNumber(params.elevationLoss),
        gearId: gearId ?? undefined,
        bestEfforts,
        laps,
        territory,
        territoryArea,
        photos,
        privacy,
        feel,
        effort,
        isCommute,
        hideRoute: isFromTracking && privacy !== 'only_me' ? hideRoute : undefined,
        mocked: isFromTracking && params.mocked === '1' ? true : undefined,
        privateNote,
        isManual: !isFromTracking,
        startedAt: isFromTracking ? recordedStart : manualStartedAt(manualDay, Date.now()),
        hideRouteEnds,
        privacyZones,
      });

      // One dialog at a time: a failure outranks the nudge to verify.
      if (result.onchainFailed) {
        Alert.alert(COPY.saveFailedTitle, COPY.saveFailedBody);
      } else if (result.needsVerification && !result.rewardHold) {
        Alert.alert(
          'Verify to claim territory',
          'Verify with World ID Selfie Check to claim territory and help keep the map fair for everyone.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Verify', onPress: () => router.push('/verify') },
          ]
        );
      }

      if (isFromTracking && attachSessionToActivity(result.activity.id) && address) {
        void runPostActivityPipeline({
          activityId: result.activity.id,
          onchainActivityId: result.activity.onchainActivityId,
          name: title,
          distance,
          athlete: address,
        });
      }

      if (routeParams.run) dropRecordedRun(routeParams.run);
      router.replace({ pathname: '/post-upload', params: { id: result.activity.id } });
      // The finish line is the moment to sign the run, while the athlete is still holding the phone.
      if (result.rewardHold && !result.onchainFailed) {
        router.push({ pathname: '/finish-line', params: { id: result.activity.id } });
      }
    } catch (err) {
      logger.warn('[CreateActivity] Save failed', err);
      if (err instanceof EmptyRecordingError) {
        Alert.alert('Activity too short', 'This recording has no route, so it cannot be saved.');
        return;
      }
      Alert.alert(
        'Could not save activity',
        'Something went wrong saving this activity. Try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    const confirm = shouldConfirmDiscard({
      recorded: isFromTracking,
      titleEdited: !!titleInput?.trim(),
      description,
      privateNote,
      photoCount: photos.length,
      distanceInput: manualDistance,
      minutesInput: manualMinutes,
    });
    if (!confirm) {
      goBack();
      return;
    }
    Alert.alert(
      isFromTracking ? 'Discard this recording?' : 'Discard Activity?',
      isFromTracking ? "This recording can't be recovered." : 'Your changes will be lost.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            // A discarded run must not come back as an "unsaved run" on the next launch.
            if (routeParams.run) dropRecordedRun(routeParams.run);
            goBack();
          },
        },
      ]
    );
  };

  // Hardware back and the back gesture must show the same discard prompt as the close button.
  const handleBackRef = useRef(handleBack);
  useEffect(() => {
    handleBackRef.current = handleBack;
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackRef.current();
      return true;
    });
    return () => subscription.remove();
  }, []);

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedView style={[styles.header, { borderBottomColor: theme.border }]}>
          <Tappable
            onPress={handleBack}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </Tappable>
          <ThemedText type="sectionTitle">Save Activity</ThemedText>
          <Tappable
            onPress={handleSave}
            disabled={!canSave}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Save"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={theme.brand.primary} />
            ) : (
              <ThemedText
                type="smallBold"
                style={{ color: canSave ? theme.brand.primary : theme.textSecondary }}
              >
                Save
              </ThemedText>
            )}
          </Tappable>
        </ThemedView>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isFromTracking && params.mocked === '1' && (
            <ThemedText type="caption" style={{ color: theme.warningText }}>
              {SIMULATED_LOCATION_NOTICE}
            </ThemedText>
          )}

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Title
            </ThemedText>
            <TextField value={title} onChangeText={setTitleInput} placeholder={defaultTitle} />
          </ThemedView>

          <SportField value={activityType} onChange={setActivityType} />

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Description
            </ThemedText>
            <TextField
              value={description}
              onChangeText={setDescription}
              maxLength={ACTIVITY_DESCRIPTION_MAX}
              placeholder="Add a description"
              multiline
            />
          </ThemedView>

          {!isFromTracking && (
            <View style={styles.manualRow}>
              <ThemedView style={[styles.field, styles.manualField]}>
                <ThemedText type="eyebrow" themeColor="textSecondary">
                  Distance ({unitSystem === 'imperial' ? 'mi' : 'km'})
                  {GPS_DISTANCE_SPORTS.has(activityType) ? '' : ' (optional)'}
                </ThemedText>
                <TextField
                  value={manualDistance}
                  onChangeText={(t) => setManualDistance(t.replace(/[^0-9.,]/g, ''))}
                  placeholder="e.g. 5"
                  maxLength={NUMBER_INPUT_MAX}
                  keyboardType="decimal-pad"
                />
              </ThemedView>
              <ThemedView style={[styles.field, styles.manualField]}>
                <ThemedText type="eyebrow" themeColor="textSecondary">
                  Duration (min or h:mm)
                </ThemedText>
                <TextField
                  value={manualMinutes}
                  onChangeText={(t) => setManualMinutes(t.replace(/[^0-9.,:]/g, ''))}
                  placeholder="e.g. 30 or 1:30"
                  maxLength={NUMBER_INPUT_MAX}
                  keyboardType="numbers-and-punctuation"
                />
              </ThemedView>
            </View>
          )}
          {!isFromTracking && (
            <ThemedView style={styles.field}>
              <ThemedText type="eyebrow" themeColor="textSecondary">
                When
              </ThemedText>
              <DayField
                label="Date of the activity"
                value={manualDay}
                onChange={(day) => {
                  setManualDay((current) => {
                    const next = new Date(day);
                    next.setHours(current.getHours(), current.getMinutes(), 0, 0);
                    return next;
                  });
                }}
                maximum={new Date()}
              />
              <ThemedView style={styles.timeField}>
                <ThemedText type="eyebrow" themeColor="textSecondary">
                  Start time
                </ThemedText>
                <Tappable
                  style={[
                    styles.timeButton,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  ]}
                  onPress={() => setTimePickerOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Start time, ${formatTimeOfDay(manualDay)}`}
                >
                  <ThemedText>{formatTimeOfDay(manualDay)}</ThemedText>
                  <Ionicons name="time-outline" size={20} color={theme.textSecondary} />
                </Tappable>
                {manualStartTimeFuture && (
                  <ThemedText type="small" style={{ color: theme.brand.danger }}>
                    Start time must be in the past
                  </ThemedText>
                )}
                {timePickerOpen && (
                  <DateTimePicker
                    value={manualDay}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onValueChange={(_, time) => {
                      setTimePickerOpen(Platform.OS === 'ios');
                      if (time) {
                        setManualDay((current) => {
                          const next = new Date(current);
                          next.setHours(time.getHours(), time.getMinutes(), 0, 0);
                          return next;
                        });
                      }
                    }}
                    onDismiss={() => setTimePickerOpen(false)}
                  />
                )}
              </ThemedView>
            </ThemedView>
          )}
          {!isFromTracking && !manualEntry.ok && typedSomething && (
            <ThemedText type="small" style={{ color: theme.brand.danger }}>
              {manualEntry.reason}
            </ThemedText>
          )}
          {/* What the numbers add up to, so a mistyped minute or mile shows before it is saved. */}
          {!isFromTracking && manualEntry.ok && manualEntry.distance > 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Works out to{' '}
              {formatPaceOrSpeed(
                activityType,
                manualEntry.distance,
                manualEntry.duration,
                unitSystem
              )}
            </ThemedText>
          )}

          {isFromTracking && polyline !== '' && (
            // A preview for the athlete only: hiding the route from others changes what is published, not this.
            <View style={[styles.field, styles.mapPreview]}>
              <RouteThumbnail polyline={polyline} height={MAP_PREVIEW_HEIGHT} />
            </View>
          )}

          {isFromTracking && (
            <ThemedView
              style={[styles.field, styles.statsCard, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedView style={styles.statsRow}>
                <ThemedView style={styles.stat}>
                  <ThemedText type="caption" themeColor="textSecondary">
                    Distance
                  </ThemedText>
                  <ThemedText type="smallBold">{formatDistance(distance, unitSystem)}</ThemedText>
                </ThemedView>
                <ThemedView style={styles.stat}>
                  <ThemedText type="caption" themeColor="textSecondary">
                    Time
                  </ThemedText>
                  <ThemedText type="smallBold">{formatDuration(duration)}</ThemedText>
                </ThemedView>
                {territoryArea > 0 && (
                  <ThemedView style={styles.stat}>
                    <ThemedText type="caption" themeColor="textSecondary">
                      Territory
                    </ThemedText>
                    <ThemedText type="smallBold">
                      {formatArea(territoryArea, unitSystem)}
                    </ThemedText>
                  </ThemedView>
                )}
              </ThemedView>
            </ThemedView>
          )}

          {isFromTracking &&
            params.noTerritory === '1' &&
            GPS_DISTANCE_SPORTS.has(activityType) && (
              <ThemedText type="caption" themeColor="textSecondary">
                No territory this time. Loop back to where you started to claim the ground you
                cover.
              </ThemedText>
            )}

          {gearOptions.length > 0 && (
            <ThemedView style={styles.field}>
              <ThemedText type="eyebrow" themeColor="textSecondary">
                {activityType === 'ride' ? 'Bike' : 'Shoes'}
              </ThemedText>
              <GearPicker options={gearOptions} selected={gearId} onSelect={setGearId} />
            </ThemedView>
          )}

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Photos
            </ThemedText>
            <PhotoPicker photos={photos} onPhotosChange={setPhotos} />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              How did it feel?
            </ThemedText>
            <FeelPicker selected={feel} onSelect={setFeel} />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              How hard was it?
            </ThemedText>
            <SegmentedChoice<ActivityEffort>
              options={EFFORT_OPTIONS}
              selected={effort}
              onSelect={setEffort}
              onClear={() => setEffort(undefined)}
            />
            {effort && (
              <ThemedText type="caption" themeColor="textSecondary">
                {EFFORT_OPTIONS.find((o) => o.value === effort)?.description}
              </ThemedText>
            )}
          </ThemedView>

          <View style={styles.switchRow}>
            <ThemedText style={styles.switchLabel}>This was a commute</ThemedText>
            <AppSwitch checked={isCommute} onChange={setIsCommute} label="This was a commute" />
          </View>

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Private note
            </ThemedText>
            <TextField
              value={privateNote}
              onChangeText={setPrivateNote}
              maxLength={PRIVATE_NOTE_MAX}
              placeholder="Only you can see this"
              multiline
            />
          </ThemedView>

          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              Who can see?
            </ThemedText>
            <PrivacyPicker
              selected={privacy}
              onSelect={(next) =>
                next === 'only_me' && privacy !== 'only_me'
                  ? confirmOnlyMe(() => setPrivacy(next))
                  : setPrivacy(next)
              }
            />
            {!!privacyCaption && (
              <ThemedText type="caption" themeColor="textSecondary">
                {privacyCaption}
              </ThemedText>
            )}
          </ThemedView>

          {/* Map visibility: only a recorded route has a map to hide, and Only Me already hides everything. */}
          {isFromTracking && privacy !== 'only_me' && (
            <ThemedView style={styles.field}>
              <View style={styles.switchRow}>
                <ThemedText style={styles.switchLabel}>Hide the route map from others</ThemedText>
                <AppSwitch
                  checked={hideRoute}
                  onChange={setHideRoute}
                  label="Hide the route map from others"
                />
              </View>
              <ThemedText type="caption" themeColor="textSecondary">
                Your stats and photos still show. The route stays on this phone and no territory is
                claimed.
              </ThemedText>
            </ThemedView>
          )}

          <AppButton onPress={handleSave} disabled={!canSave} style={styles.saveBtn}>
            {isSaving ? 'Saving...' : 'Save Activity'}
          </AppButton>

          <View style={{ height: Spacing.five }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  switchLabel: { flex: 1 },
  manualRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  manualField: {
    flex: 1,
  },
  timeField: { gap: Spacing.two },
  timeButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  container: { flex: 1 },
  safeArea: { flex: 0 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  field: {
    gap: Spacing.two,
  },
  statsCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.three,
  },
  mapPreview: { borderRadius: BorderRadius.lg, overflow: 'hidden' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center', gap: Spacing.half },
  saveBtn: {
    marginTop: Spacing.two,
    borderRadius: BorderRadius.full,
  },
});
