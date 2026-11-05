import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MAX_PHOTOS, usePhotoPick } from '@/hooks/usePhotoPick';
import { haptics } from '@/utils/haptics';
import { uniqueKeys } from '@/utils/uniqueKeys';

interface PhotoPickerProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
  /** Called with a thumbnail's index when it is tapped, to look at it full screen. */
  onOpen?: (index: number) => void;
}

export function PhotoPicker({
  photos,
  onPhotosChange,
  maxPhotos = MAX_PHOTOS,
  onOpen,
}: PhotoPickerProps) {
  const theme = useTheme();
  const pickImage = usePhotoPick(photos, onPhotosChange, maxPhotos);

  const keys = uniqueKeys(photos);
  const removePhoto = (index: number) => {
    haptics.selection();
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  if (photos.length === 0) {
    return (
      <Tappable
        style={[
          styles.addButton,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}
        activeOpacity={0.7}
        onPress={pickImage}
        accessibilityRole="button"
        accessibilityLabel="Add photos"
      >
        <Ionicons name="camera-outline" size={28} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">
          Add Photos
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Up to {maxPhotos}
        </ThemedText>
      </Tappable>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {photos.map((uri, index) => (
          <View key={keys[index]} style={[styles.thumbnail, { borderColor: theme.border }]}>
            <Tappable
              style={styles.image}
              onPress={() => onOpen?.(index)}
              disabled={!onOpen}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Photo ${index + 1} of ${photos.length}. Open full screen`}
            >
              <Image
                source={{ uri }}
                style={styles.image}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            </Tappable>
            <Tappable
              style={[styles.removeBtn, { backgroundColor: theme.brand.primary }]}
              onPress={() => removePhoto(index)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
            >
              <Ionicons name="close" size={14} color={Palette.white} />
            </Tappable>
          </View>
        ))}
        {photos.length < maxPhotos && (
          <Tappable
            style={[styles.addButtonSmall, { backgroundColor: tint(theme.brand.primary, 0.1) }]}
            activeOpacity={0.7}
            onPress={pickImage}
            accessibilityRole="button"
            accessibilityLabel="Add more photos"
          >
            <Ionicons name="camera-outline" size={24} color={theme.brand.primary} />
          </Tappable>
        )}
      </ScrollView>
      <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.one }}>
        {photos.length}/{maxPhotos} photos
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  scroll: {
    gap: Spacing.two,
    alignItems: 'center',
  },
  addButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addButtonSmall: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    borderWidth: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
