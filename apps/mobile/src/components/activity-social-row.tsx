import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AvatarStack } from '@/components/avatar-stack';
import { SocialStrip } from '@/components/social-strip';
import { Tappable } from '@/components/tappable';
import { IconSize, Spacing, Touch } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { activityKey, useSocialStore } from '@/stores/socialStore';
import { sameAddress } from '@/utils/address';
import { haptics } from '@/utils/haptics';
import { countOf } from '@/utils/plural';
import { ThemedText } from './themed-text';

interface Props {
  activityId: string;
  onOpen(): void;
  onShare(): void;
}

/**
 * Who gave kudos and how many comments, then the three buttons: kudos, comment, share.
 * Until the feed knows the activity there is nothing to give kudos to, so only share shows.
 */
export function ActivitySocialRow({ activityId, onOpen, onShare }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const me = useCurrentUserId();
  const toggleKudos = useSocialStore((s) => s.toggleKudos);
  const social = useSocialStore((s) => s.activities[activityKey(s.activities, activityId)]);

  if (!social) {
    return (
      <Tappable
        onPress={onShare}
        style={styles.shareOnly}
        accessibilityRole="button"
        accessibilityLabel="Share activity"
      >
        <Ionicons name="share-social-outline" size={IconSize.action} color={theme.text} />
      </Tappable>
    );
  }

  const hasKudoed = !!me && social.kudos.some((id) => sameAddress(id, me));
  const kudosCount = countOf(social.kudos.length, 'kudo', 'kudos');
  const commentCount = countOf(social.comments.length, 'comment', 'comments');
  const seeKudos = () => router.push(`/kudos?id=${activityId}`);
  const takeKudos = () => {
    haptics.tap();
    void toggleKudos(activityId);
  };

  return (
    <View style={styles.column}>
      <View style={styles.counts}>
        <Tappable
          onPress={seeKudos}
          disabled={social.kudos.length === 0}
          hitSlop={8}
          style={styles.count}
          accessibilityRole="button"
          accessibilityLabel={`${kudosCount}. See who gave them`}
        >
          {social.kudos.length > 0 && <AvatarStack userIds={social.kudos} max={3} size={22} />}
          <ThemedText type="caption" themeColor="textSecondary">
            {kudosCount}
          </ThemedText>
        </Tappable>
        <Tappable
          onPress={onOpen}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${commentCount}. Open comments`}
        >
          <ThemedText type="caption" themeColor="textSecondary">
            {commentCount}
          </ThemedText>
        </Tappable>
      </View>
      <SocialStrip
        hasKudoed={hasKudoed}
        commentCount={social.comments.length}
        onKudos={takeKudos}
        onSeeKudos={seeKudos}
        onComment={onOpen}
        onShare={onShare}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: Spacing.one },
  counts: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  shareOnly: { alignSelf: 'center', minHeight: Touch.target, justifyContent: 'center' },
});
