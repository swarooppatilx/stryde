import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PRIVACY_ZONE_RADIUS_MAX, PRIVACY_ZONE_RADIUS_MIN } from '@/constants/limits';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useGoBack } from '@/hooks/useGoBack';
import { getPlatform } from '@/platform';
import { ensureForegroundLocation } from '@/services/locationPermission';
import { MAX_PRIVACY_ZONES, useSettingsStore } from '@/stores/settingsStore';
import { confirmDestructive } from '@/utils/confirmDestructive';
import { formatDistance } from '@/utils/format';
import { logger } from '@/utils/logger';
import { Toast } from '@/utils/toast';
import { stepZoneRadius } from '@/utils/zoneRadius';

const DEFAULT_RADIUS_M = 400;

/** Places (home, work) whose surroundings are cut from the route other people see. */
export default function PrivacyZonesScreen() {
  const goBack = useGoBack();
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const zones = useSettingsStore((s) => s.privacyZones);
  const addZone = useSettingsStore((s) => s.addPrivacyZone);
  const removeZone = useSettingsStore((s) => s.removePrivacyZone);
  const [name, setName] = useState('');
  const [radius, setRadius] = useState(DEFAULT_RADIUS_M);
  const [locating, setLocating] = useState(false);

  const addHere = async () => {
    if (!name.trim() || locating) return;
    setLocating(true);
    try {
      if (!(await ensureForegroundLocation())) {
        Toast.info('Location is needed to add the place you are at.', 2.5);
        return;
      }
      const here = await getPlatform().location.getCurrent('balanced');
      addZone({ name, latitude: here.latitude, longitude: here.longitude, radius });
      setName('');
      Toast.success('Private place added', 1.5);
    } catch (error) {
      logger.warn('[PrivacyZones] Could not read the location', error);
      Toast.fail("Couldn't get your location. Check that location is on.", 2.5);
    } finally {
      setLocating(false);
    }
  };

  const confirmRemove = (id: string, zoneName: string) =>
    confirmDestructive({
      title: `Remove ${zoneName}?`,
      message: 'New activities will show the route near it again.',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
      onConfirm: () => removeZone(id),
    });

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
            Private places
          </ThemedText>
          <View style={styles.spacer} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ThemedText type="small" themeColor="textSecondary">
            Where a route others can see starts or ends inside one of these places, those points are
            left out. Your own copy stays whole. Places are kept on this phone.
          </ThemedText>

          {zones.map((zone) => (
            <View
              key={zone.id}
              style={[styles.zone, { backgroundColor: theme.backgroundElement }]}
              accessible
              accessibilityLabel={`${zone.name}, ${formatDistance(zone.radius, unitSystem)} around it`}
            >
              <Ionicons name="shield-checkmark-outline" size={22} color={theme.brand.primary} />
              <View style={styles.zoneText}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {zone.name}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {formatDistance(zone.radius, unitSystem)} around it
                </ThemedText>
              </View>
              <Tappable
                onPress={() => confirmRemove(zone.id, zone.name)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${zone.name}`}
              >
                <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
              </Tappable>
            </View>
          ))}

          {zones.length < MAX_PRIVACY_ZONES ? (
            <View style={styles.form}>
              <ThemedText type="eyebrow" themeColor="textSecondary" accessibilityRole="header">
                ADD WHERE YOU ARE NOW
              </ThemedText>
              <TextField
                placeholder="Name, e.g. Home"
                value={name}
                onChangeText={setName}
                maxLength={30}
                autoCorrect={false}
              />
              <View style={styles.radiusRow}>
                <ThemedText type="smallBold">Keep private at least</ThemedText>
                <View style={styles.stepper}>
                  <Tappable
                    onPress={() => setRadius((r) => stepZoneRadius(r, -1))}
                    disabled={radius <= PRIVACY_ZONE_RADIUS_MIN}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Smaller radius"
                  >
                    <Ionicons
                      name="remove-circle-outline"
                      size={28}
                      color={radius <= PRIVACY_ZONE_RADIUS_MIN ? theme.textSecondary : theme.text}
                    />
                  </Tappable>
                  <ThemedText type="smallBold" style={styles.radiusValue}>
                    {formatDistance(radius, unitSystem)}
                  </ThemedText>
                  <Tappable
                    onPress={() => setRadius((r) => stepZoneRadius(r, 1))}
                    disabled={radius >= PRIVACY_ZONE_RADIUS_MAX}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Larger radius"
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={28}
                      color={radius >= PRIVACY_ZONE_RADIUS_MAX ? theme.textSecondary : theme.text}
                    />
                  </Tappable>
                </View>
              </View>
              <AppButton onPress={addHere} disabled={!name.trim()} loading={locating}>
                Add this place
              </AppButton>
            </View>
          ) : (
            <ThemedText type="caption" themeColor="textSecondary">
              You have {MAX_PRIVACY_ZONES} places, the most that can be kept. Remove one to add
              another.
            </ThemedText>
          )}
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
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  spacer: { width: 24 },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  zone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
  zoneText: { flex: 1, gap: Spacing.half },
  form: { gap: Spacing.three, marginTop: Spacing.two },
  radiusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  radiusValue: { minWidth: 64, textAlign: 'center' },
});
