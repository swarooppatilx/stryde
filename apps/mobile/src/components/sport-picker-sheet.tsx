import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPORT_PICKER_COPY as C } from '@/constants/copy';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityType } from '@/types';
import { groupSports } from '@/utils/topSports';
import { SearchBar } from './search-bar';
import { Tappable } from './tappable';
import { ThemedText } from './themed-text';

interface SportPickerSheetProps {
  visible: boolean;
  onClose(): void;
  /** Called with the chosen sport after the sheet closes. */
  onPick(type: ActivityType): void;
}

/** Every sport in groups, with a search; picking one starts it. */
export function SportPickerSheet({ visible, onClose, onPick }: SportPickerSheetProps) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const groups = groupSports(query);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: tint(Palette.black, 0.4) }]}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={C.close}
      />
      <KeyboardAvoidingView behavior="padding" style={styles.anchor} pointerEvents="box-none">
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.backgroundElement, paddingBottom: bottom + Spacing.two },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          <ThemedText type="sectionTitle">{C.title}</ThemedText>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder={C.searchPlaceholder}
            accessibilityLabel={C.searchPlaceholder}
          />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
            {groups.length === 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                {C.empty}
              </ThemedText>
            )}
            {groups.map((group) => (
              <View key={group.title} style={styles.group}>
                <ThemedText type="eyebrow" themeColor="textSecondary">
                  {group.title}
                </ThemedText>
                {group.sports.map((sport) => (
                  <Tappable
                    key={sport.type}
                    accessibilityRole="button"
                    accessibilityLabel={`Start ${sport.label}`}
                    onPress={() => {
                      close();
                      onPick(sport.type);
                    }}
                    style={[styles.row, { backgroundColor: theme.backgroundSunken }]}
                  >
                    <Ionicons name={sport.icon} size={22} color={theme.text} />
                    <ThemedText style={styles.label}>{sport.label}</ThemedText>
                    <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                  </Tappable>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2 },
  list: { gap: Spacing.three, paddingBottom: Spacing.two },
  group: { gap: Spacing.one },
  row: {
    minHeight: 52,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: { flex: 1 },
});
