import { Result } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapBottomSheet } from '@/components/map-bottom-sheet';
import { MapRoute } from '@/components/map-route';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MAP_STYLES } from '@/constants/config';
import { BorderRadius, Shadow, ShadowDark, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMap } from '@/hooks/useMap';

export default function MapScreen() {
  const theme = useTheme();
  const {
    location,
    errorMsg,
    followMode,
    showRoutes,
    cameraRef,
    userPolygons,
    activityRoutes,
    loadLocation,
    recenter,
    toggleFollow,
    toggleRoutes,
  } = useMap();
  const insets = useSafeAreaInsets();

  // Bottom edge of the 3-button control stack below (each controlBtn is 44px
  // tall with Spacing.two gaps between), plus breathing room, so MapLibre's
  // native compass widget never renders underneath it.
  const controlStackHeight = 44 * 3 + Spacing.two * 2;
  const compassTopOffset = insets.top + 16 + controlStackHeight + Spacing.three;

  const routes = useMemo(
    () =>
      activityRoutes.map((r) => ({
        ...r,
        color: theme.brand.primary,
      })),
    [activityRoutes, theme]
  );

  return (
    <ThemedView type="background" style={styles.container}>
      {location ? (
        <>
          <MapRoute
            cameraRef={cameraRef}
            territoryPolygons={userPolygons}
            territoryColor={theme.brand.primary}
            territoryOpacity={0.22}
            followUser={followMode ?? undefined}
            initialCenter={[location.longitude, location.latitude]}
            initialZoom={15}
            mapStyleUrl={theme.isDark ? MAP_STYLES.darkMatter : MAP_STYLES.voyager}
            activityRoutes={routes}
            compassTopOffset={compassTopOffset}
          />

          {/* Map Controls */}
          <ThemedView style={[styles.controls, { top: insets.top + 16 }]}>
            <TouchableOpacity
              style={[
                styles.controlBtn,
                theme.isDark ? ShadowDark.card : Shadow.card,
                {
                  backgroundColor: showRoutes
                    ? tint(theme.brand.primary, 0.12)
                    : theme.backgroundElement,
                },
              ]}
              onPress={toggleRoutes}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Toggle activity routes"
              accessibilityState={{ selected: showRoutes }}
            >
              <Ionicons
                name="map"
                size={20}
                color={showRoutes ? theme.brand.primary : theme.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlBtn,
                theme.isDark ? ShadowDark.card : Shadow.card,
                {
                  backgroundColor: followMode ? theme.brand.primaryTint : theme.backgroundElement,
                },
              ]}
              onPress={toggleFollow}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Toggle location follow"
              accessibilityState={{ selected: !!followMode }}
            >
              <Ionicons
                name={followMode === 'heading' ? 'compass' : 'locate'}
                size={20}
                color={followMode ? theme.brand.primary : theme.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlBtn,
                theme.isDark ? ShadowDark.card : Shadow.card,
                { backgroundColor: theme.backgroundElement },
              ]}
              onPress={recenter}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Recenter map"
            >
              <Ionicons name="navigate" size={20} color={theme.brand.primary} />
            </TouchableOpacity>
          </ThemedView>

          <MapBottomSheet />
        </>
      ) : (
        <ThemedView style={styles.loadingContainer}>
          {errorMsg ? (
            <Result
              img={<Ionicons name="location-outline" size={48} color={theme.textSecondary} />}
              title={errorMsg}
              buttonText="Try Again"
              onButtonClick={loadLocation}
            />
          ) : (
            <ThemedText type="small">Loading map...</ThemedText>
          )}
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
  },
  controls: {
    position: 'absolute',
    right: Spacing.three,
    gap: Spacing.two,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
