import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { getWeatherAt } from '@/services/weatherService';
import { parsePolyline } from '@/utils/format';
import { describeWeather, formatWeatherLine, type Weather } from '@/utils/weather';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

/** The weather where and when the activity started. Renders nothing for a manual entry (no place) or when no answer comes. */
export function ActivityWeather({
  polyline,
  startedAt,
}: {
  polyline: string;
  startedAt: Date | number;
}) {
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const [weather, setWeather] = useState<Weather | null>(null);
  const start = parsePolyline(polyline)[0];
  const lng = start?.[0];
  const lat = start?.[1];
  const at = new Date(startedAt).getTime();

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    let cancelled = false;
    void getWeatherAt({ lat, lng, at: new Date(at) }).then((result) => {
      if (!cancelled) setWeather(result);
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, at]);

  if (!weather) return null;
  return (
    <ThemedView style={styles.row}>
      <Ionicons name={describeWeather(weather.code).icon} size={16} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary">
        {formatWeatherLine(weather, unitSystem)}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
