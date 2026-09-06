import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/button';
import { PhotoPicker } from '@/components/photo-picker';
import { PrivacyPicker } from '@/components/privacy-picker';
import { SportTypePicker } from '@/components/sport-type-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FEEL_OPTIONS } from '@/constants/activity';
import { ENV, getCurrentUserId } from '@/constants/config';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useViemWallet } from '@/hooks/useViemWallet';
import { ipfsToHttpUrl, uploadImageToIpfs } from '@/services/ipfsService';
import { useActivityStore } from '@/stores/activityStore';
import { useTerritoryStore } from '@/stores/territoryStore';
import type { Activity, ActivityFeel, ActivityPrivacy, ActivityType, Ring } from '@/types';
import { formatArea, formatDistance, formatDuration, getActivityName } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { generateId } from '@/utils/id';

type Params = {
  polyline?: string;
  distance?: string;
  duration?: string;
  territory?: string;
  territoryArea?: string;
  activityType?: ActivityType;
  photos?: string;
};

export default function CreateActivityScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<Params>();
  const saveActivity = useActivityStore((s) => s.saveActivity);
  const updateActivity = useActivityStore((s) => s.updateActivity);
  const capturePolygon = useTerritoryStore((s) => s.capturePolygon);
  const { wallet, address } = useViemWallet(ENV.CHAIN_MODE);

  const isFromTracking = !!params.polyline;
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>(
    (params.activityType as ActivityType) || 'run'
  );
  const [photos, setPhotos] = useState<string[]>(() => {
    try {
      return params.photos ? JSON.parse(params.photos) : [];
    } catch {
      return [];
    }
  });
  const [privacy, setPrivacy] = useState<ActivityPrivacy>('everyone');
  const [feel, setFeel] = useState<ActivityFeel | undefined>();
  const [showSportPicker, setShowSportPicker] = useState(false);

  const distance = params.distance ? Number.parseFloat(params.distance) : 0;
  const duration = params.duration ? Number.parseFloat(params.duration) : 0;
  const polyline = params.polyline || '';
  const territoryArea = params.territoryArea ? Number.parseFloat(params.territoryArea) : 0;

  let territory: Ring | null = null;
  try {
    territory = params.territory ? JSON.parse(params.territory) : null;
  } catch {
    territory = null;
  }

  // Auto-generate title
  useEffect(() => {
    if (!title && !isFromTracking) {
      setTitle(getActivityName(activityType, new Date().getHours()));
    }
  }, [activityType, isFromTracking, title]);

  const handleSave = async () => {
    haptics.success();
    setIsSaving(true);

    const uploadedPhotos = await Promise.all(
      photos.map(async (uri) => {
        if (uri.startsWith('http')) return uri;
        try {
          const { cid } = await uploadImageToIpfs(`activity-${Date.now()}`, uri);
          return ipfsToHttpUrl(cid);
        } catch (err) {
          console.warn('[CreateActivity] Photo upload failed, keeping local URI', err);
          return uri;
        }
      })
    );

    const activityId = generateId();
    // Included in the hash so two activities with the same route/stats (e.g. manual
    // entries with no polyline) don't collide on-chain and revert as a duplicate.
    const activityHash = services.activity.computeActivityHash(polyline, territoryArea, activityId);

    const activity: Activity = {
      id: activityId,
      userId: getCurrentUserId(),
      name: title.trim() || getActivityName(activityType, new Date().getHours()),
      activityType,
      distance,
      duration,
      polyline,
      territory,
      territoryArea,
      description: description.trim() || undefined,
      feel,
      privacy,
      images: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
      isManual: !isFromTracking,
      activityHash,
      createdAt: new Date(),
    };

    saveActivity(activity);

    if (territory) {
      capturePolygon(getCurrentUserId(), territory);
    }

    if (wallet) {
      let onchainFailed = false;

      try {
        const { txHash, confirmed } = await services.activity.recordActivity(wallet, {
          polyline,
          activityType,
          distance,
          duration,
          territoryArea,
          metadata: activityId,
        });
        updateActivity(activity.id, { txHash });
        if (!confirmed) {
          onchainFailed = true;
        } else {
          try {
            if (address) {
              await services.season.ensureActiveSeason(wallet);
              await services.season.recordContribution(wallet, address, distance);
            }
          } catch (err) {
            // Leaderboard contribution is best-effort — only the local dev shared
            // account has the owner/permission to start seasons or record contributions.
            console.warn('[CreateActivity] Season contribution failed', err);
          }
        }
      } catch (err) {
        console.warn('[CreateActivity] recordActivity failed', err);
        onchainFailed = true;
      }

      if (territory) {
        try {
          const { confirmed } = await services.territory.claimTerritory(wallet, {
            polygon: territory,
            areaSqm: territoryArea,
          });
          if (!confirmed) onchainFailed = true;
        } catch (err) {
          console.warn('[CreateActivity] claimTerritory failed', err);
          onchainFailed = true;
        }
      }

      if (onchainFailed) {
        Alert.alert(
          'Saved locally, onchain sync failed',
          "Your activity is saved on this device, but recording it onchain didn't go through. It'll stay out of sync with the chain until you retry."
        );
      }
    }

    setIsSaving(false);

    router.replace({
      pathname: '/activity-summary',
      params: { id: activity.id },
    });
  };

  const handleBack = () => {
    if (title.trim() || description.trim() || photos.length > 0) {
      // eslint-disable-next-line no-alert
      require('react-native').Alert.alert('Discard Activity?', 'Your changes will be lost.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <ThemedView style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="sectionTitle">Save Activity</ThemedText>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Save"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={theme.brand.primary} />
            ) : (
              <ThemedText type="smallBold" style={{ color: theme.brand.primary }}>
                Save
              </ThemedText>
            )}
          </TouchableOpacity>
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
          {/* Title */}
          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              Title
            </ThemedText>
            <View
              style={[
                styles.input,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
            >
              {/* Using a plain TextInput since Ant Design Input may not be available */}
              <_TitleInput
                value={title}
                onChangeText={setTitle}
                placeholder={getActivityName(activityType, new Date().getHours())}
                theme={theme}
              />
            </View>
          </ThemedView>

          {/* Description */}
          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              Description
            </ThemedText>
            <View
              style={[
                styles.input,
                styles.textArea,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
            >
              <_DescInput
                value={description}
                onChangeText={setDescription}
                placeholder="How did it feel?"
                theme={theme}
              />
            </View>
          </ThemedView>

          {/* Sport Type */}
          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              Sport Type
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.sportSelector,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
              activeOpacity={0.7}
              onPress={() => {
                haptics.tap();
                setShowSportPicker(!showSportPicker);
              }}
            >
              <ThemedText type="smallBold">
                {activityType.charAt(0).toUpperCase() + activityType.slice(1)}
              </ThemedText>
              <Ionicons
                name={showSportPicker ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
            {showSportPicker && (
              <SportTypePicker
                selected={activityType}
                onSelect={(type) => {
                  setActivityType(type);
                  setShowSportPicker(false);
                }}
              />
            )}
          </ThemedView>

          {/* Stats Summary (if from tracking) */}
          {isFromTracking && (
            <ThemedView
              style={[styles.field, styles.statsCard, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedView style={styles.statsRow}>
                <ThemedView style={styles.stat}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Distance
                  </ThemedText>
                  <ThemedText type="smallBold">{formatDistance(distance)}</ThemedText>
                </ThemedView>
                <ThemedView style={styles.stat}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Time
                  </ThemedText>
                  <ThemedText type="smallBold">{formatDuration(duration)}</ThemedText>
                </ThemedView>
                {territoryArea > 0 && (
                  <ThemedView style={styles.stat}>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      Territory
                    </ThemedText>
                    <ThemedText type="smallBold">{formatArea(territoryArea)}</ThemedText>
                  </ThemedView>
                )}
              </ThemedView>
            </ThemedView>
          )}

          {/* Photos */}
          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              Photos
            </ThemedText>
            <PhotoPicker photos={photos} onPhotosChange={setPhotos} />
          </ThemedView>

          {/* Feel */}
          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              How did it feel?
            </ThemedText>
            <ThemedView style={styles.feelRow}>
              {FEEL_OPTIONS.map((option) => {
                const isSelected = feel === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.feelBtn,
                      {
                        backgroundColor: isSelected
                          ? tint(theme.brand.primary, 0.12)
                          : theme.backgroundElement,
                        borderColor: isSelected ? theme.brand.primary : theme.border,
                      },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      haptics.selection();
                      setFeel(isSelected ? undefined : option.value);
                    }}
                    accessibilityRole="radio"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <ThemedText style={{ fontSize: 24 }}>{option.emoji}</ThemedText>
                    <ThemedText
                      type="caption"
                      style={{ color: isSelected ? theme.brand.primary : theme.textSecondary }}
                    >
                      {option.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </ThemedView>
          </ThemedView>

          {/* Privacy */}
          <ThemedView style={styles.field}>
            <ThemedText type="eyebrow" style={{ color: theme.textSecondary }}>
              Who can see?
            </ThemedText>
            <PrivacyPicker selected={privacy} onSelect={setPrivacy} />
          </ThemedView>

          {/* Save CTA */}
          <AppButton onPress={handleSave} disabled={isSaving} style={styles.saveBtn}>
            {isSaving ? 'Saving...' : 'Save Activity'}
          </AppButton>

          <View style={{ height: Spacing.five }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

// Simple inline text inputs to avoid Ant Design dependency issues
import { TextInput } from 'react-native';

function _TitleInput({
  value,
  onChangeText,
  placeholder,
  theme,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.textSecondary}
      style={{ flex: 1, color: theme.text, fontSize: 16, padding: 0 }}
    />
  );
}

function _DescInput({
  value,
  onChangeText,
  placeholder,
  theme,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.textSecondary}
      multiline
      numberOfLines={3}
      textAlignVertical="top"
      style={{ flex: 1, color: theme.text, fontSize: 14, padding: 0, minHeight: 60 }}
    />
  );
}

const styles = StyleSheet.create({
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
  input: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  textArea: {
    minHeight: 80,
    alignItems: 'flex-start',
  },
  sportSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  statsCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.three,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center', gap: 2 },
  feelRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  feelBtn: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  saveBtn: {
    marginTop: Spacing.two,
    borderRadius: BorderRadius.full,
  },
});
