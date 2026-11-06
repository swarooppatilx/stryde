import { Ionicons } from '@expo/vector-icons';
import { type ClubPost, MAX_CLUB_COMMENT_LENGTH, MAX_CLUB_POST_LENGTH } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { sendClubChange } from '@/backends/clubIntents';
import { AppSwitch } from '@/components/app-switch';
import { AppButton } from '@/components/button';
import { ListMessage } from '@/components/list-message';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { UserAvatar } from '@/components/user-avatar';
import { BorderRadius, Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useUserResolver } from '@/hooks/useSocialUser';
import { Alert } from '@/utils/alert';
import { formatRelativeTime, getDisplayName } from '@/utils/format';
import { haptics } from '@/utils/haptics';

interface ClubFeedProps {
  clubId: string;
  posts: readonly ClubPost[];
  me: string;
  isMember: boolean;
  isAdmin: boolean;
  /** Only admins may post in this club. */
  adminsOnlyPost: boolean;
  loading: boolean;
  error: string | null;
  onRetry(): void;
}

/** The club's posts and announcements, newest first, with a box to write one and comments under each. */
export function ClubFeed(props: ClubFeedProps) {
  const { clubId, posts, me, isMember, isAdmin, adminsOnlyPost } = props;
  const theme = useTheme();
  const [draft, setDraft] = useState('');
  const [announce, setAnnounce] = useState(false);
  const canPost = isMember && (isAdmin || !adminsOnlyPost);

  const publish = () => {
    const text = draft.trim();
    if (!text) return;
    haptics.impactMedium();
    void sendClubChange({
      clubId,
      action: 'post',
      data: { text, photos: [], announcement: announce && isAdmin },
    });
    setDraft('');
    setAnnounce(false);
  };

  const composerHint = (() => {
    if (!isMember) return 'Join the club to post and comment.';
    if (!canPost) return 'Only admins post in this club. You can still comment.';
    return null;
  })();

  const feedBody = () => {
    if (props.error && posts.length === 0) {
      return (
        <ListMessage
          icon="cloud-offline-outline"
          text="Couldn't load the club's posts."
          action={{ label: 'Try again', onPress: props.onRetry }}
        />
      );
    }
    if (posts.length === 0 && !props.loading) {
      return (
        <ListMessage icon="chatbubbles-outline" text="No posts yet. Start the conversation." />
      );
    }
    return posts.map((post) => (
      <PostItem
        key={post.id}
        clubId={clubId}
        post={post}
        me={me}
        isMember={isMember}
        isAdmin={isAdmin}
      />
    ));
  };

  return (
    <View style={styles.container}>
      {canPost ? (
        <View style={[styles.composer, { backgroundColor: theme.backgroundElement }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={
              isAdmin ? 'Share an update or announcement' : 'Share something with the club'
            }
            placeholderTextColor={theme.placeholder}
            multiline
            maxLength={MAX_CLUB_POST_LENGTH}
            style={[styles.input, { color: theme.text }]}
            accessibilityLabel="Write a club post"
          />
          <View style={styles.composerRow}>
            {isAdmin ? (
              <View style={styles.announceRow}>
                <AppSwitch
                  checked={announce}
                  onChange={setAnnounce}
                  label="Post as an announcement"
                />
                <ThemedText type="caption" themeColor="textSecondary">
                  Announcement
                </ThemedText>
              </View>
            ) : (
              <View />
            )}
            <AppButton size="small" fullWidth={false} disabled={!draft.trim()} onPress={publish}>
              Post
            </AppButton>
          </View>
        </View>
      ) : (
        composerHint && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {composerHint}
          </ThemedText>
        )
      )}

      {feedBody()}
    </View>
  );
}

function PostItem({
  clubId,
  post,
  me,
  isMember,
  isAdmin,
}: {
  clubId: string;
  post: ClubPost;
  me: string;
  isMember: boolean;
  isAdmin: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const resolve = useUserResolver();
  const author = resolve(post.author);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const pending = post.id.startsWith('local-');
  const canDelete = !pending && (post.author.toLowerCase() === me || isAdmin);

  const remove = () =>
    Alert.alert('Delete this post?', 'Its comments go with it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void sendClubChange({ clubId, action: 'delete-post', target: post.id }),
      },
    ]);

  const sendReply = () => {
    const text = reply.trim();
    if (!text) return;
    void sendClubChange({ clubId, action: 'comment', target: post.id, data: { text } });
    setReply('');
  };

  return (
    <View
      style={[
        styles.post,
        { backgroundColor: theme.backgroundElement },
        post.announcement && { borderColor: theme.brand.primary, borderWidth: 1 },
      ]}
    >
      <View style={styles.postHeader}>
        <Tappable
          onPress={() => router.push(`/athletes/${post.author}`)}
          style={styles.author}
          accessibilityRole="button"
          accessibilityLabel={`Open ${author ? getDisplayName(author) : 'author'}'s profile`}
        >
          <UserAvatar uri={author?.avatar} name={author ? getDisplayName(author) : '?'} size="sm" />
          <View style={styles.authorText}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {author ? getDisplayName(author) : `${post.author.slice(0, 6)}…`}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {pending ? 'Sending…' : formatRelativeTime(new Date(post.createdAt * 1000), true)}
            </ThemedText>
          </View>
        </Tappable>
        {post.announcement && (
          <View style={[styles.badge, { backgroundColor: theme.brand.primaryTint }]}>
            <Ionicons name="megaphone-outline" size={12} color={theme.brand.primary} />
            <ThemedText type="caption" style={{ color: theme.brand.primary }}>
              Announcement
            </ThemedText>
          </View>
        )}
        {canDelete && (
          <Tappable
            onPress={remove}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Delete post"
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={theme.textSecondary} />
          </Tappable>
        )}
      </View>
      {post.text ? <ThemedText style={styles.body}>{post.text}</ThemedText> : null}

      {post.comments.map((comment) => {
        const who = resolve(comment.author);
        const mine = comment.author.toLowerCase() === me;
        const deletable = !comment.id.startsWith('local-') && (mine || isAdmin);
        return (
          <View key={comment.id} style={[styles.comment, { borderTopColor: theme.border }]}>
            <ThemedText type="small" style={styles.commentText}>
              <ThemedText type="smallBold">
                {who ? getDisplayName(who) : `${comment.author.slice(0, 6)}…`}{' '}
              </ThemedText>
              {comment.text}
            </ThemedText>
            {deletable && (
              <Tappable
                onPress={() =>
                  Alert.alert('Delete this comment?', undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () =>
                        void sendClubChange({
                          clubId,
                          action: 'delete-comment',
                          target: comment.id,
                        }),
                    },
                  ])
                }
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Delete comment"
              >
                <Ionicons name="close" size={14} color={theme.textSecondary} />
              </Tappable>
            )}
          </View>
        );
      })}

      {isMember && !pending && (
        <View style={styles.replyRow}>
          {replying ? (
            <>
              <TextInput
                value={reply}
                onChangeText={setReply}
                placeholder="Add a comment"
                placeholderTextColor={theme.placeholder}
                maxLength={MAX_CLUB_COMMENT_LENGTH}
                style={[styles.replyInput, { color: theme.text, borderColor: theme.border }]}
                onSubmitEditing={sendReply}
                returnKeyType="send"
                autoFocus
              />
              <Tappable
                onPress={sendReply}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Send comment"
              >
                <Ionicons name="send" size={18} color={theme.brand.primary} />
              </Tappable>
            </>
          ) : (
            <Tappable onPress={() => setReplying(true)} accessibilityRole="button">
              <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                {post.comments.length > 0 ? `Comment · ${post.comments.length}` : 'Comment'}
              </ThemedText>
            </Tappable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  composer: { borderRadius: BorderRadius.lg, padding: Spacing.three, gap: Spacing.two },
  input: { ...textStyle(TypeScale.body), minHeight: 44, maxHeight: 160 },
  composerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  announceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  hint: { textAlign: 'center' },
  post: { borderRadius: BorderRadius.lg, padding: Spacing.three, gap: Spacing.two },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  authorText: { flex: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  body: textStyle(TypeScale.body),
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  commentText: { flex: 1 },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  replyInput: {
    flex: 1,
    ...textStyle(TypeScale.footnote),
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.two,
    minHeight: 36,
  },
});
