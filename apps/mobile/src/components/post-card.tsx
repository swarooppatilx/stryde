import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { FeedHeader } from '@/components/feed-header';
import { PhotoGallery } from '@/components/photo-gallery';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Feed } from '@/constants/feed';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { retryDeliveries, useDeliveryState } from '@/hooks/useOutbox';
import { formatRelativeTime } from '@/utils/format';
import { type PostEntry, postPhotoUri, postStatusLine } from '@/utils/postFeed';
import { Tappable } from './tappable';

function subtextIconFor(failed: boolean, pending: boolean | undefined) {
  if (failed) return 'alert-circle-outline';
  return pending ? 'time-outline' : 'chatbubble-ellipses-outline';
}

interface PostCardProps {
  post: PostEntry;
  name: string;
  avatarUri?: string | null;
  verified?: boolean;
  /** Only the author can remove a post, and only once it has been sent. */
  onDelete?: () => void;
  onUserPress: () => void;
}

/** A text-and-photos post in the feed, in the same frame as an activity. */
export function PostCard({
  post,
  name,
  avatarUri,
  verified,
  onDelete,
  onUserPress,
}: PostCardProps) {
  const theme = useTheme();
  const delivery = useDeliveryState(`post:${post.id}`);
  const status = postStatusLine(
    post,
    delivery,
    formatRelativeTime(new Date(post.createdAt * 1000))
  );
  const retry = () => void retryDeliveries([`post:${post.id}`]);
  return (
    <ThemedView style={[styles.entry, { backgroundColor: theme.backgroundElement }]}>
      <FeedHeader
        name={name}
        avatarUri={avatarUri}
        verified={verified}
        subtextIcon={subtextIconFor(status.failed, post.pending)}
        subtext={status.text}
        onPress={onUserPress}
      />
      {post.text ? (
        <ThemedText style={styles.text} selectable>
          {post.text}
        </ThemedText>
      ) : null}
      {post.photos.length > 0 ? (
        <View style={styles.photos}>
          <PhotoGallery photos={post.photos.map(postPhotoUri)} />
        </View>
      ) : null}
      {status.failed || (onDelete && !post.pending) ? (
        <View style={styles.actions}>
          {status.failed ? (
            <Tappable
              onPress={retry}
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel="Try sending this post again"
            >
              <Ionicons name="refresh" size={16} color={theme.dangerText} />
              <ThemedText type="smallBold" themeColor="dangerText">
                Try again
              </ThemedText>
            </Tappable>
          ) : (
            <View />
          )}
          {onDelete && !post.pending ? (
            <Tappable
              onPress={onDelete}
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel="Delete post"
            >
              <ThemedText type="small" themeColor="textSecondary">
                Delete
              </ThemedText>
            </Tappable>
          ) : null}
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  entry: { paddingBottom: Spacing.three },
  text: { paddingHorizontal: Feed.edge, paddingTop: Spacing.three },
  photos: { paddingHorizontal: Feed.edge, paddingTop: Spacing.three },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Feed.edge,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 44,
  },
});
