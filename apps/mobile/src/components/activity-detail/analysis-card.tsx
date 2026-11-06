import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  title: string;
  /** A quiet figure beside the title, such as a total. */
  aside?: string;
  children: ReactNode;
}

/** The shared card shell, flat: no edge, a step below the sheet. */
export function FlatCard({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Card
      padding={Spacing.three}
      style={{ backgroundColor: theme.backgroundSunken, borderWidth: 0 }}
    >
      {children}
    </Card>
  );
}

/** One analysis section: a flat card with a title (and an optional quiet figure beside it). */
export function AnalysisCard({ title, aside, children }: Props) {
  return (
    <FlatCard>
      <View accessibilityLabel={title} style={styles.body}>
        <View style={styles.header}>
          <ThemedText type="sectionTitle">{title}</ThemedText>
          {aside ? (
            <ThemedText type="small" themeColor="textSecondary">
              {aside}
            </ThemedText>
          ) : null}
        </View>
        {children}
      </View>
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
