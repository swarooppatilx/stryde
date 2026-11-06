import { StyleSheet, View } from 'react-native';
import { AchievementNotice } from '@/components/achievement-notice';
import { AvatarStack } from '@/components/avatar-stack';
import { FeedHeader } from '@/components/feed-header';
import { FeedMedia } from '@/components/feed-media';
import { PopupMenu } from '@/components/popup-menu';
import { ReportSheet } from '@/components/report-sheet';
import { OffscreenShareImage } from '@/components/share-route-image';
import { SocialStrip } from '@/components/social-strip';
import { StatRow } from '@/components/stat-row';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DELIVERY_COPY } from '@/constants/copy';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFeedCard } from '@/hooks/useFeedCard';
import type { SocialActivity, SocialUser } from '@/stores/socialStore';
import type { Achievement } from '@/utils/achievements';
import { activityTitle } from '@/utils/format';
import { countOf } from '@/utils/plural';

const MENU_WIDTH = 248;

interface FeedCardProps {
  activity: SocialActivity;
  user: SocialUser;
  onKudos: () => void;
  onComment: () => void;
  onPress: () => void;
  onMapPress?: () => void;
  onUserPress?: () => void;
  /** Badges this activity earned (only known for the viewer's own activities). */
  earned?: readonly Achievement[];
}

export function FeedCard({
  activity,
  user,
  onKudos,
  onComment,
  onPress,
  onMapPress,
  onUserPress,
  earned,
}: FeedCardProps) {
  const theme = useTheme();
  const card = useFeedCard({ activity, user, onKudos, onComment, onPress });
  const { comments, latestComment, commentDelivery } = card;
  const title = activityTitle(activity);

  return (
    <View>
      <View ref={card.cardRef} collapsable={false}>
        <ThemedView style={[styles.entry, { backgroundColor: theme.backgroundElement }]}>
          <FeedHeader
            name={card.authorName}
            avatarUri={user.avatar}
            verified={user.isVerified}
            subtextIcon={card.icon}
            subtext={card.subtext}
            onPress={onUserPress ?? onPress}
            onMore={card.menu.open}
          />

          <Tappable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
            <ThemedText type="titleSmall" numberOfLines={2} style={styles.title}>
              {title}
            </ThemedText>
          </Tappable>

          {card.description ? (
            // Another athlete's text arrives as `metadataDescription` from their IPFS metadata (see feedFromChain); it shows once that fetch has succeeded.
            <ThemedText type="default" numberOfLines={3} style={styles.description}>
              {card.description}
            </ThemedText>
          ) : null}

          <StatRow stats={card.stats} />

          <FeedMedia
            activity={activity}
            icon={card.icon}
            theme={theme}
            onPress={card.onMediaTap}
            onMapPress={onMapPress}
          />

          {(activity.kudos.length > 0 || comments.length > 0) && (
            <ThemedView style={styles.socialProof}>
              {activity.kudos.length > 0 && (
                <Tappable
                  onPress={card.openKudos}
                  hitSlop={8}
                  style={styles.kudosInfo}
                  accessibilityRole="button"
                  accessibilityLabel={`${countOf(activity.kudos.length, 'kudo', 'kudos')}. See who gave them`}
                >
                  <AvatarStack userIds={activity.kudos} max={3} size={22} />
                  <ThemedText type="caption" themeColor="textSecondary">
                    {countOf(activity.kudos.length, 'kudo', 'kudos')}
                  </ThemedText>
                </Tappable>
              )}
              {comments.length > 0 && (
                <Tappable
                  onPress={card.handleComment}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`${countOf(comments.length, 'comment', 'comments')}. Open comments`}
                >
                  <ThemedText type="caption" themeColor="textSecondary">
                    {countOf(comments.length, 'comment', 'comments')}
                  </ThemedText>
                </Tappable>
              )}
            </ThemedView>
          )}

          {earned && earned.length > 0 && (
            <AchievementNotice earned={earned} onPress={(badge) => card.openBadge(badge.id)} />
          )}

          <SocialStrip
            hasKudoed={card.hasKudoed}
            kudosFailed={card.kudosFailed}
            commentCount={comments.length}
            kudosStyle={card.kudosAnimatedStyle}
            onKudos={card.handleKudos}
            onSeeKudos={card.openKudos}
            onComment={card.handleComment}
            onShare={card.handleSharePress}
          />

          {card.notSent && (
            <Tappable
              onPress={card.retrySend}
              accessibilityRole="button"
              accessibilityLabel="Your change was not sent. Try again"
              style={styles.notSent}
            >
              <ThemedText type="caption" themeColor="dangerText">
                Not sent. Tap to try again
              </ThemedText>
            </Tappable>
          )}

          {latestComment && (
            <Tappable
              onPress={card.handleComment}
              accessibilityRole="button"
              accessibilityLabel="Open comments"
              style={[styles.commentPreview, { backgroundColor: theme.backgroundSunken }]}
            >
              <ThemedText type="small" numberOfLines={2}>
                <ThemedText type="smallBold">{card.latestCommentAuthor} </ThemedText>
                <ThemedText type="small">{latestComment.text}</ThemedText>
                {commentDelivery && (
                  <ThemedText
                    type="caption"
                    themeColor={commentDelivery === 'failed' ? 'dangerText' : 'textTertiary'}
                  >
                    {commentDelivery === 'failed'
                      ? ' · Not sent'
                      : ` · ${DELIVERY_COPY[commentDelivery]}`}
                  </ThemedText>
                )}
              </ThemedText>
              {comments.length > 1 && (
                <ThemedText type="caption" themeColor="textSecondary" style={styles.viewAll}>
                  View all {comments.length} comments
                </ThemedText>
              )}
            </Tappable>
          )}
        </ThemedView>
      </View>

      <PopupMenu
        anchor={card.menu.anchor}
        items={card.menu.items}
        width={MENU_WIDTH}
        onClose={card.menu.close}
        accessibilityLabel="Activity options"
      />
      <ReportSheet {...card.report.props} />

      {/* Off-screen 9:16 stat card, mounted only while sharing; the share effect runs once it is attached. */}
      {card.sharing && (
        <OffscreenShareImage
          ref={card.svgRef}
          coordinates={card.routeCoordinates}
          territory={activity.territory}
          territoryArea={activity.territoryArea}
          distance={activity.distance}
          duration={activity.duration}
          activityType={activity.activityType}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  entry: { overflow: 'hidden' },
  title: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  description: { paddingHorizontal: Spacing.three, paddingTop: Spacing.one },
  socialProof: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  kudosInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  commentPreview: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.twoHalf },
  viewAll: { marginTop: Spacing.one },
  notSent: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
});
