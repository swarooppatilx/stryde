import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/** A small caption over one field. */
export function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ThemedView style={styles.field}>
      <ThemedText type="eyebrow" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({ field: { gap: Spacing.two } });
