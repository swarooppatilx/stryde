import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/** A titled group of related fields on one raised surface. */
export function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card padding={Spacing.three}>
      <ThemedView style={styles.body}>
        <ThemedText type="sectionTitle">{title}</ThemedText>
        {children}
      </ThemedView>
    </Card>
  );
}

const styles = StyleSheet.create({ body: { gap: Spacing.three } });
