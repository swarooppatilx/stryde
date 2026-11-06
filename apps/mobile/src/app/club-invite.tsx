import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { QrCode } from '@/components/qr-code';
import { ShareButton } from '@/components/share-button';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGoBack } from '@/hooks/useGoBack';
import { getPlatform } from '@/platform';
import { useClubStore } from '@/stores/clubStore';
import { useCommunityStore } from '@/stores/communityStore';
import { buildDetailDeepLink } from '@/utils/deepLink';
import { formatMemberCount } from '@/utils/format';
import { Toast } from '@/utils/toast';

/** Bring people into a club: a QR code to scan in person, or a link to send. */
export default function ClubInviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const goBack = useGoBack();
  const club = useCommunityStore((s) => s.clubs.find((c) => c.id === id));
  const settings = useClubStore((s) => s.clubs[id ?? '']?.state?.settings);
  const name = settings?.name || club?.name || 'this club';
  const link = buildDetailDeepLink('clubs', id ?? '');
  const message = `You're invited to join ${name} on Stryde\n${link}`;

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
          <ThemedText type="sectionTitle">Invite to club</ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.body}>
          <ThemedText type="titleSmall" style={styles.center}>
            Join {name}
          </ThemedText>
          {club ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {formatMemberCount(club.memberCount)} members
              {settings?.inviteOnly ? ' · new members are approved by an admin' : ''}
            </ThemedText>
          ) : null}
          <View style={styles.qr}>
            <QrCode text={link} size={220} label={`QR code to join ${name}`} />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Scan with a phone camera to open the club in Stryde.
          </ThemedText>
          <View style={styles.actions}>
            <ShareButton label="Share invite" message={message} />
            <AppButton
              variant="secondary"
              onPress={async () => {
                await getPlatform().clipboard.copyText(link);
                Toast.success('Link copied', 1);
              }}
            >
              Copy invite link
            </AppButton>
          </View>
        </View>
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
    paddingVertical: Spacing.two,
  },
  body: { padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch' },
  center: { textAlign: 'center' },
  qr: { alignItems: 'center', paddingVertical: Spacing.three },
  actions: { gap: Spacing.two, alignItems: 'center' },
});
