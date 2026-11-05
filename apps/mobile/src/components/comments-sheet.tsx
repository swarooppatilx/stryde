import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getOutbox } from '@/backends/outbox/appOutbox';
import { AvatarStack } from '@/components/avatar-stack';
import { CommentRow } from '@/components/comment-row';
import { ReportSheet } from '@/components/report-sheet';
import { shimmerPresetFor } from '@/components/Shimmer/const';
import { ShimmerEffect as Shimmer } from '@/components/Shimmer/Shimmer';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Tray } from '@/components/tray';
import { Palette } from '@/constants/palette';
import { BorderRadius, Brand, Spacing, tint } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useHiddenAuthors } from '@/hooks/useHiddenAuthors';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { useDeliveryContext, useOutboxEntries } from '@/hooks/useOutbox';
import { useReportSheet } from '@/hooks/useReport';
import { useReportedHidden } from '@/hooks/useReportedHidden';
import { useUserResolver } from '@/hooks/useSocialUser';
import { activityKey, useSocialStore } from '@/stores/socialStore';
import { sameAddress } from '@/utils/address';
import { charactersLeft, commentListMaxHeight } from '@/utils/commentUi';
import { deliveryStateOf } from '@/utils/deliveryState';
import { formatRelativeTime, getDisplayName } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { canReport } from '@/utils/reporting';
import { visibleComments } from '@/utils/visibleComments';
import { ListMessage } from './list-message';

const MAX_COMMENT_LENGTH = 500;
const SKELETON_ROWS = 3;

interface CommentsSheetProps {
  visible: boolean;
  activityId: string | null;
  onClose: () => void;
}

function CommentSkeleton() {
  const theme = useTheme();
  const preset = shimmerPresetFor(theme.isDark);
  return (
    <View style={styles.skeleton} accessibilityLabel="Loading comments">
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <Shimmer isLoading preset={preset} style={styles.skeletonAvatar} />
          <View style={styles.skeletonLines}>
            <Shimmer isLoading preset={preset} style={styles.skeletonName} />
            <Shimmer isLoading preset={preset} style={styles.skeletonText} />
          </View>
        </View>
      ))}
    </View>
  );
}

function commentAuthorName(
  isMe: boolean,
  user: Parameters<typeof getDisplayName>[0] | undefined
): string {
  if (isMe) return 'You';
  return user ? getDisplayName(user) : 'Unknown';
}

export function CommentsSheet({ visible, activityId, onClose }: CommentsSheetProps) {
  const theme = useTheme();
  const me = useCurrentUserId();
  const [text, setText] = useState('');
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  // The tray already leaves a margin above the bottom inset, so only the rest of the keyboard needs room.
  const keyboardGap = Math.max(0, keyboardHeight - Math.max(insets.bottom, 12));
  const outboxEntries = useOutboxEntries();
  const deliveryContext = useDeliveryContext(outboxEntries.length > 0);

  const activity = useSocialStore((s) =>
    activityId ? (s.activities[activityKey(s.activities, activityId)] ?? null) : null
  );
  const addComment = useSocialStore((s) => s.addComment);
  const toggleCommentLike = useSocialStore((s) => s.toggleCommentLike);
  const fetchActivities = useSocialStore((s) => s.fetchActivities);
  const getUserById = useUserResolver();
  const [loading, setLoading] = useState(false);
  const report = useReportSheet();
  const reportedComments = useReportedHidden().comments;

  // Reset text when switching activities
  // biome-ignore lint/correctness/useExhaustiveDependencies: activityId is a trigger, not read in the body
  useEffect(() => {
    setText('');
  }, [activityId]);

  const reload = async () => {
    setLoading(true);
    await fetchActivities();
    setLoading(false);
  };

  if (!activityId) return null;

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !activity) return;
    void addComment(activity.id, trimmed);
    setText('');
    haptics.tap();
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const handleLike = (commentId: string) => {
    if (!activity) return;
    toggleCommentLike(activity.id, commentId);
    haptics.tap();
  };

  const retry = (commentId: string) => {
    const outbox = getOutbox();
    const entry = outbox.entries().find((e) => e.key === `comment:${commentId}`);
    if (entry) void outbox.retry(entry.id).then(() => outbox.drain());
  };

  // Held-down comment: offered a report unless it is the athlete's own.
  const askReport = (comment: { id: string; userId: string }) => {
    const target = { kind: 'comment', id: comment.id, ownerId: comment.userId } as const;
    if (!canReport(target, me)) return;
    haptics.tap();
    report.ask(target);
  };

  const hiddenAuthors = useHiddenAuthors();
  const comments = activity
    ? visibleComments(activity.comments, reportedComments, hiddenAuthors)
    : [];
  const left = charactersLeft(text.length, MAX_COMMENT_LENGTH);
  const keyboardOpen = keyboardHeight > 0;

  const renderComments = () => {
    if (!activity) {
      if (loading || !visible) {
        return <CommentSkeleton />;
      }
      return (
        <ListMessage
          icon="cloud-offline-outline"
          text="Couldn't load this discussion."
          action={{ label: 'Try again', onPress: () => void reload() }}
        />
      );
    }
    if (comments.length === 0) {
      return (
        <View style={styles.empty}>
          <Ionicons name="chatbubble-outline" size={36} color={theme.brand.primary} />
          <ThemedText type="sectionTitle">No comments yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
            Be the first to say something about this activity.
          </ThemedText>
        </View>
      );
    }
    return comments.map((comment) => {
      const commentUser = getUserById(comment.userId);
      const isMe = sameAddress(comment.userId, me);
      const displayName = commentAuthorName(isMe, commentUser);
      const likes = comment.likedBy ?? [];
      return (
        <CommentRow
          key={comment.id}
          name={displayName}
          avatarUri={commentUser?.avatar}
          verified={commentUser?.isVerified}
          text={comment.text}
          createdAt={comment.createdAt}
          likes={likes.length}
          liked={likes.some((id) => sameAddress(id, me))}
          delivery={deliveryStateOf(outboxEntries, `comment:${comment.id}`, deliveryContext)}
          onLike={() => handleLike(comment.id)}
          onRetry={() => retry(comment.id)}
          onLongPress={isMe ? undefined : () => askReport(comment)}
        />
      );
    });
  };

  return (
    <>
      <Tray
        open={visible}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
        theme={theme.isDark ? 'dark' : 'light'}
        palette={{
          surface: theme.backgroundElement,
          border: theme.border,
          handle: theme.border,
          text: theme.text,
          mutedText: theme.textSecondary,
          backdrop: tint(Palette.black, 0.4),
        }}
      >
        <Tray.Content>
          {/* The tray renders in its own layer that neither the system nor a KeyboardAvoidingView
            lifts (it cannot place itself inside the tray), so make room for the keyboard by hand. */}
          <View style={{ paddingBottom: keyboardGap }}>
            <Tray.View id="default">
              <Tray.Header>
                <ThemedText type="sectionTitle">Comments</ThemedText>
                <Tray.Close>
                  {({ color, size }) => <Ionicons name="close" size={size} color={color} />}
                </Tray.Close>
              </Tray.Header>

              {/* What is being discussed, and who gave kudos: one quiet row, out of the way while typing. */}
              {activity && !keyboardOpen && (
                <ThemedView style={styles.summary}>
                  <ThemedView style={styles.summaryText}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {activity.name}
                    </ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {formatRelativeTime(activity.createdAt, true)}
                    </ThemedText>
                  </ThemedView>
                  {activity.kudos.length > 0 && (
                    <ThemedView style={styles.kudos}>
                      <Ionicons name="thumbs-up" size={16} color={theme.brand.primary} />
                      <ThemedText type="small" themeColor="textSecondary">
                        {activity.kudos.length}
                      </ThemedText>
                      <AvatarStack userIds={activity.kudos} max={3} size={22} />
                    </ThemedView>
                  )}
                </ThemedView>
              )}

              <Tray.ScrollView
                maxHeight={commentListMaxHeight(windowHeight, keyboardHeight)}
                contentContainerStyle={styles.listContent}
              >
                {renderComments()}
              </Tray.ScrollView>

              <Tray.Footer>
                <View style={styles.inputRow}>
                  <View style={styles.inputColumn}>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.background,
                          color: theme.text,
                          borderColor: theme.border,
                        },
                      ]}
                      placeholder="Add a comment"
                      placeholderTextColor={theme.placeholder}
                      accessibilityLabel="Add a comment"
                      value={text}
                      onChangeText={setText}
                      multiline
                      autoCapitalize="sentences"
                      returnKeyType="send"
                      submitBehavior="submit"
                      onSubmitEditing={handleSend}
                      maxLength={MAX_COMMENT_LENGTH}
                    />
                    {left !== null && (
                      <ThemedText
                        type="caption"
                        themeColor={left <= 10 ? 'dangerText' : 'textTertiary'}
                        style={styles.counter}
                        accessibilityLiveRegion="polite"
                      >
                        {left} characters left
                      </ThemedText>
                    )}
                  </View>
                  <Tappable
                    style={[
                      styles.sendBtn,
                      {
                        backgroundColor: text.trim()
                          ? theme.brand.primary
                          : theme.backgroundSelected,
                      },
                    ]}
                    onPress={handleSend}
                    disabled={!text.trim() || !activity}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Send comment"
                    accessibilityState={{ disabled: !text.trim() || !activity }}
                  >
                    <Ionicons
                      name="send"
                      size={16}
                      color={text.trim() ? Brand.white : theme.textSecondary}
                    />
                  </Tappable>
                </View>
              </Tray.Footer>
            </Tray.View>
          </View>
        </Tray.Content>
      </Tray>
      <ReportSheet {...report.props} />
    </>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  summaryText: { flex: 1, gap: Spacing.half },
  kudos: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  listContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 180,
  },
  emptyText: { textAlign: 'center' },
  skeleton: { gap: Spacing.three },
  skeletonRow: { flexDirection: 'row', gap: Spacing.two },
  skeletonAvatar: { width: 36, height: 36, borderRadius: 18 },
  skeletonLines: { flex: 1, gap: Spacing.one },
  skeletonName: { width: '40%', height: 12, borderRadius: 4 },
  skeletonText: { width: '85%', height: 12, borderRadius: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  inputColumn: { flex: 1, gap: Spacing.half },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 44,
    maxHeight: 112,
    ...textStyle(TypeScale.callout),
  },
  counter: { textAlign: 'right' },
  sendBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
