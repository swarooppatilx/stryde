import { useEffect, useState } from 'react';
import { DevSettings, ScrollView, StyleSheet, View } from 'react-native';
import { getActiveProfileId } from '@/backends/activeProfile';
import { PROFILE_KEY, saveProfile } from '@/backends/boot';
import { isProfileId, PROFILES, type ProfileId } from '@/backends/profiles';
import { AppButton } from '@/components/button';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ENV, getChainMode } from '@/constants/config';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getPlatform } from '@/platform';
import { logger } from '@/utils/logger';

/** Which backends this launch talks to. A change is saved now and applies after a reload. */
export function ProfilePanel() {
  const theme = useTheme();
  const running = getActiveProfileId();
  const [chosen, setChosen] = useState<ProfileId>(running);

  useEffect(() => {
    void getPlatform()
      .storage.getItem(PROFILE_KEY)
      .then((stored) => {
        if (isProfileId(stored) && PROFILES[stored].available) setChosen(stored);
      });
  }, []);

  const choose = async (id: ProfileId) => {
    setChosen(id);
    await saveProfile(getPlatform().storage, id);
    logger.info(`[Dev] Profile set to ${id}; applies after a reload`);
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <ThemedText type="caption" themeColor="textSecondary">
        A profile decides which backends the app uses. Each keeps its own saved data, so switching
        never mixes them. Live is the default for everyone.
      </ThemedText>

      {Object.values(PROFILES).map((profile) => {
        const selected = profile.id === chosen;
        return (
          <Tappable
            key={profile.id}
            disabled={!profile.available}
            onPress={() => void choose(profile.id)}
            accessibilityRole="radio"
            accessibilityLabel={profile.label}
            accessibilityState={{ selected, disabled: !profile.available }}
            style={[
              styles.card,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: selected ? theme.brand.primary : theme.border,
                opacity: profile.available ? 1 : 0.5,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <ThemedText type="sectionTitle">{profile.label}</ThemedText>
              {profile.id === running && (
                <ThemedText type="eyebrow" themeColor="accentText">
                  Running
                </ThemedText>
              )}
              {!profile.available && (
                <ThemedText type="eyebrow" themeColor="textSecondary">
                  Not built yet
                </ThemedText>
              )}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {profile.description}
            </ThemedText>
          </Tappable>
        );
      })}

      <ThemedText type="eyebrow" themeColor="textSecondary">
        Running now
      </ThemedText>
      <ConfigRow label="Profile" value={PROFILES[running].label} />
      <ConfigRow label="Chain" value={getChainMode()} />
      <ConfigRow label="API" value={ENV.API_URL} />
      <ConfigRow label="Login" value={PROFILES[running].auth === 'privy' ? 'Privy' : 'Developer'} />

      {chosen !== running && (
        <AppButton onPress={() => DevSettings.reload()}>Reload to apply</AppButton>
      )}
    </ScrollView>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={1} style={styles.rowValue}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.four, gap: Spacing.three },
  card: { borderRadius: BorderRadius.lg, borderWidth: 2, padding: Spacing.three, gap: Spacing.one },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  rowValue: { flexShrink: 1, textAlign: 'right' },
});
