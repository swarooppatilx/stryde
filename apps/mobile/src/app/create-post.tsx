import { Ionicons } from '@expo/vector-icons';
import { services } from '@repo/shared';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PhotoPicker } from '@/components/photo-picker';
import { Tappable } from '@/components/tappable';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGoBack } from '@/hooks/useGoBack';
import { usePostActions } from '@/hooks/usePostActions';
import { Toast } from '@/utils/toast';

/** Write a post: some text, some photos, no activity needed. It shows in the feed at once and is sent when it can be. */
export default function CreatePostScreen() {
  const goBack = useGoBack();
  const theme = useTheme();
  const { publish } = usePostActions();
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canPost = text.trim().length > 0 || photos.length > 0;

  const posting = useRef(false);

  const handlePost = async () => {
    // A second tap before the first finishes must not file the post twice.
    if (posting.current) return;
    posting.current = true;
    try {
      const result = await publish({ text, photoUris: photos });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      Toast.info('Posting…', 1.2);
      goBack();
    } finally {
      posting.current = false;
    }
  };

  const left = services.posts.MAX_POST_LENGTH - text.length;

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView edges={['top']}>
        <ThemedView style={[styles.header, { borderBottomColor: theme.border }]}>
          <Tappable
            onPress={goBack}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </Tappable>
          <ThemedText type="sectionTitle">New post</ThemedText>
          <Tappable
            onPress={handlePost}
            disabled={!canPost}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Post"
          >
            <ThemedText
              type="smallBold"
              style={{ color: canPost ? theme.brand.primary : theme.textSecondary }}
            >
              Post
            </ThemedText>
          </Tappable>
        </ThemedView>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TextField
            placeholder="What's on your mind?"
            value={text}
            onChangeText={(t) => {
              setText(t);
              setError(null);
            }}
            maxLength={services.posts.MAX_POST_LENGTH}
            multiline
            autoFocus
            error={error}
          />
          <ThemedText
            type="caption"
            themeColor={left < 50 ? 'warningText' : 'textSecondary'}
            style={styles.counter}
          >
            {left} left
          </ThemedText>
          <PhotoPicker
            photos={photos}
            onPhotosChange={setPhotos}
            maxPhotos={services.posts.MAX_POST_PHOTOS}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: { minWidth: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  counter: { alignSelf: 'flex-end' },
});
