import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { PhotoGallery } from '@/components/photo-gallery';
import { PhotoPicker } from '@/components/photo-picker';
import { PhotoViewer } from '@/components/photo-viewer';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

interface Props {
  photos: string[] | undefined;
  isOwner: boolean;
  onPhotosChange: (photos: string[]) => void;
}

/** The owner edits their photos; everyone else only sees them, and nothing renders when there are none. */
export function ActivityPhotos({ photos, isOwner, onPhotosChange }: Props) {
  const [viewed, setViewed] = useState<number | null>(null);
  const list = photos ?? [];
  if (isOwner) {
    return (
      <ThemedView style={styles.section}>
        <PhotoPicker photos={list} onPhotosChange={onPhotosChange} onOpen={setViewed} />
        <PhotoViewer photos={list} startIndex={viewed} onClose={() => setViewed(null)} />
      </ThemedView>
    );
  }
  if (list.length === 0) return null;
  return (
    <ThemedView style={styles.section}>
      <PhotoGallery photos={list} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: Spacing.two },
});
