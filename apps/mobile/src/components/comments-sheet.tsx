import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { AvatarStack } from '@/components/avatar-stack';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getCurrentUserId } from '@/constants/config';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSocialStore } from '@/stores/socialStore';
import { getDisplayName } from '@/utils/format';
import { haptics } from '@/utils/haptics';

interface CommentsSheetProps {
  visible: boolean;
  activityId: string | null;
  onClose: () => void;
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatLikeCount(count: number): string {
  if (count === 0) return 'Like';
  if (count === 1) return '1 Like';
  return `${count} Likes`;
}

export function CommentsSheet({ visible, activityId, onClose }: CommentsSheetProps) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Subscribe to store by activity ID — always fresh, never stale
  const activity = useSocialStore((s) =>
    activityId ? (s.activities.find((a) => a.id === activityId) ?? null) : null
  );
  const addComment = useSocialStore((s) => s.addComment);
  const toggleCommentLike = useSocialStore((s) => s.toggleCommentLike);
  const getUserById = useSocialStore((s) => s.getUserById);

  // Reset text when switching activities
  // biome-ignore lint/correctness/useExhaustiveDependencies: activityId is a trigger, not read in the body
  useEffect(() => {
    setText('');
  }, [activityId]);

  // Auto-scroll to bottom when comments change
  useEffect(() => {
    if (activity && activity.comments.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [activity, activity?.comments.length]);

  if (!activityId || !activity) return null;

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addComment(activity.id, trimmed);
    setText('');
    haptics.success();
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const handleLike = (commentId: string) => {
    toggleCommentLike(activity.id, commentId);
    haptics.tap();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <ThemedView style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}>
          {/* Handle */}
          <TouchableOpacity
            onPress={handleClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
          </TouchableOpacity>

          {/* Header */}
          <ThemedView style={[styles.header, { borderBottomColor: theme.border }]}>
            <ThemedText type="sectionTitle">Discussion</ThemedText>
            <TouchableOpacity
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close comments"
            >
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </ThemedView>

          {/* Activity info banner */}
          <ThemedView style={[styles.activityBanner, { backgroundColor: theme.background }]}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {activity.name}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {formatRelativeTime(activity.createdAt)}
            </ThemedText>
          </ThemedView>

          {/* Kudos section */}
          {activity.kudos.length > 0 && (
            <ThemedView style={styles.kudosSection}>
              <Ionicons name="thumbs-up" size={16} color={theme.brand.primary} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {activity.kudos.length}
              </ThemedText>
              <AvatarStack userIds={activity.kudos} max={5} size={24} />
            </ThemedView>
          )}

          {/* Comments list */}
          <ScrollView
            ref={scrollRef}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            onScrollBeginDrag={() => Keyboard.dismiss()}
          >
            {activity.comments.length === 0 ? (
              <ThemedView style={styles.empty}>
                <Ionicons name="chatbubble-outline" size={32} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  No comments yet. Start the conversation!
                </ThemedText>
              </ThemedView>
            ) : (
              activity.comments.map((comment) => {
                const commentUser = getUserById(comment.userId);
                const isMe = comment.userId === getCurrentUserId();
                const displayName = isMe
                  ? 'You'
                  : commentUser
                    ? getDisplayName(commentUser)
                    : 'Unknown';
                const likeCount = comment.likedBy?.length ?? 0;
                const hasLiked = (comment.likedBy ?? []).includes(getCurrentUserId());

                return (
                  <ThemedView
                    key={comment.id}
                    style={styles.comment}
                    accessibilityRole="text"
                    accessibilityLabel={`${displayName} said: ${comment.text}`}
                  >
                    <View
                      style={[styles.commentAvatar, { backgroundColor: theme.brand.primaryTint }]}
                    >
                      <ThemedText
                        type="caption"
                        style={{ color: theme.brand.primary, fontWeight: '700' }}
                      >
                        {displayName.charAt(0).toUpperCase()}
                      </ThemedText>
                    </View>
                    <ThemedView style={styles.commentBody}>
                      <ThemedView style={styles.commentHeader}>
                        <ThemedText type="smallBold">{displayName}</ThemedText>
                        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                          · {formatRelativeTime(comment.createdAt)}
                        </ThemedText>
                      </ThemedView>
                      <ThemedText type="small" style={{ color: theme.text }}>
                        {comment.text}
                      </ThemedText>
                      <TouchableOpacity
                        style={styles.likeBtn}
                        onPress={() => handleLike(comment.id)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={hasLiked ? 'Unlike comment' : 'Like comment'}
                      >
                        <Ionicons
                          name={hasLiked ? 'heart' : 'heart-outline'}
                          size={14}
                          color={hasLiked ? theme.brand.danger : theme.textSecondary}
                        />
                        <ThemedText
                          type="caption"
                          style={{ color: hasLiked ? theme.brand.danger : theme.textSecondary }}
                        >
                          {formatLikeCount(likeCount)}
                        </ThemedText>
                      </TouchableOpacity>
                    </ThemedView>
                  </ThemedView>
                );
              })
            )}
          </ScrollView>

          {/* Input bar */}
          <ThemedView style={[styles.inputBar, { borderTopColor: theme.border }]}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
              ]}
              placeholder="Add a comment..."
              placeholderTextColor={theme.textSecondary}
              value={text}
              onChangeText={setText}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                { backgroundColor: text.trim() ? theme.brand.primary : theme.backgroundSelected },
              ]}
              onPress={handleSend}
              disabled={!text.trim()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Send comment"
            >
              <Ionicons name="send" size={16} color={text.trim() ? '#fff' : theme.textSecondary} />
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '75%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  activityBanner: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    gap: 2,
  },
  kudosSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  list: {
    flexShrink: 1,
  },
  listContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  comment: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentBody: {
    flex: 1,
    gap: Spacing.one,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
