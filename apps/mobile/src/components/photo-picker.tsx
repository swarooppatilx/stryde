import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';

const MAX_PHOTOS = 4;

interface PhotoPickerProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
}

export function PhotoPicker({ photos, onPhotosChange, maxPhotos = MAX_PHOTOS }: PhotoPickerProps) {
  const theme = useTheme();
  const [_loading, setLoading] = useState(false);

  const pickImage = async () => {
    haptics.tap();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Photo library access is required to add photos to your activity.'
      );
      return;
    }

    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: maxPhotos - photos.length,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newUris = result.assets.map((a) => a.uri);
        onPhotosChange([...photos, ...newUris].slice(0, maxPhotos));
      }
    } finally {
      setLoading(false);
    }
  };

  const removePhoto = (index: number) => {
    haptics.selection();
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  if (photos.length === 0) {
    return (
      <TouchableOpacity
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
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Add Photos
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          Up to {maxPhotos}
        </ThemedText>
      </TouchableOpacity>
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
          <View key={`${uri}-${index}`} style={[styles.thumbnail, { borderColor: theme.border }]}>
            <Image source={{ uri }} style={styles.image} />
            <TouchableOpacity
              style={[styles.removeBtn, { backgroundColor: theme.brand.primary }]}
              onPress={() => removePhoto(index)}
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
            >
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < maxPhotos && (
          <TouchableOpacity
            style={[styles.addButtonSmall, { backgroundColor: tint(theme.brand.primary, 0.1) }]}
            activeOpacity={0.7}
            onPress={pickImage}
            accessibilityRole="button"
            accessibilityLabel="Add more photos"
          >
            <Ionicons name="camera-outline" size={24} color={theme.brand.primary} />
          </TouchableOpacity>
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
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
