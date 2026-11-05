import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

interface Props {
  bio?: string;
  location?: string;
}

/** The athlete's bio and place, when they have set either; nothing at all when they have not. */
export function AboutLines({ bio, location }: Props) {
  const theme = useTheme();
  if (!bio && !location) return null;
  return (
    <View style={styles.container}>
      {bio ? <ThemedText type="small">{bio}</ThemedText> : null}
      {location ? (
        <View style={styles.location}>
          <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
          <ThemedText type="caption" themeColor="textSecondary">
            {location}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.half },
  location: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
