import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { usePostActions } from '@/hooks/usePostActions';
import { usePostStore } from '@/stores/postStore';
import { sameAddress } from '@/utils/address';
import { confirmDeletePost } from '@/utils/confirmDeletePost';
import { postsBy } from '@/utils/postFeed';
import { PostCard } from './post-card';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface Props {
  author: string;
  viewerId: string;
  name: string;
  avatarUri?: string | null;
  verified?: boolean;
}

/** An athlete's posts on their profile; nothing at all when they have none. */
export function ProfilePosts({ author, viewerId, name, avatarUri, verified }: Props) {
  const router = useRouter();
  const posts = usePostStore((s) => s.posts);
  const fetchPosts = usePostStore((s) => s.fetchPosts);
  const { remove } = usePostActions();
  const mine = postsBy(Object.values(posts), author);

  useEffect(() => {
    void fetchPosts([author as `0x${string}`]);
  }, [author, fetchPosts]);

  if (mine.length === 0) return null;
  const own = sameAddress(author, viewerId);
  return (
    <ThemedView style={styles.section}>
      <ThemedText type="sectionTitle">Posts</ThemedText>
      {mine.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          name={name}
          avatarUri={avatarUri}
          verified={verified}
          onUserPress={() => router.push(`/athletes/${author}`)}
          onDelete={own ? () => confirmDeletePost(() => remove(post.id)) : undefined}
        />
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({ section: { gap: 12 } });
