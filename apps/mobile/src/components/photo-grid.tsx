import { Image } from 'expo-image';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { BorderRadius, Spacing } from '@/constants/theme';

interface PhotoGridProps {
  photos: string[];
  onPress?: (index: number) => void;
  maxHeight?: number;
}

export function PhotoGrid({ photos, onPress, maxHeight = 300 }: PhotoGridProps) {
  if (photos.length === 0) return null;

  const count = Math.min(photos.length, 4);

  return (
    <View style={styles.container}>
      {count === 1 && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onPress?.(0)}
          style={[styles.single, { borderRadius: BorderRadius.md }]}
        >
          <Image
            source={{ uri: photos[0] }}
            style={[styles.image, { height: maxHeight }]}
            contentFit="cover"
          />
        </TouchableOpacity>
      )}

      {count === 2 && (
        <View style={styles.row}>
          {photos.slice(0, 2).map((uri, i) => (
            <TouchableOpacity
              key={`${uri}-${i}`}
              activeOpacity={0.8}
              onPress={() => onPress?.(i)}
              style={[styles.half, { borderRadius: BorderRadius.md }]}
            >
              <Image
                source={{ uri }}
                style={[styles.image, { height: maxHeight }]}
                contentFit="cover"
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {count === 3 && (
        <View style={styles.grid3}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onPress?.(0)}
            style={[styles.tall, { borderRadius: BorderRadius.md }]}
          >
            <Image source={{ uri: photos[0] }} style={styles.image} contentFit="cover" />
          </TouchableOpacity>
          <View style={styles.rightCol}>
            {photos.slice(1, 3).map((uri, i) => (
              <TouchableOpacity
                key={`${uri}-${i}`}
                activeOpacity={0.8}
                onPress={() => onPress?.(i + 1)}
                style={[styles.short, { borderRadius: BorderRadius.md }]}
              >
                <Image source={{ uri }} style={styles.image} contentFit="cover" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {count === 4 && (
        <View style={styles.grid4}>
          {photos.slice(0, 4).map((uri, i) => (
            <TouchableOpacity
              key={`${uri}-${i}`}
              activeOpacity={0.8}
              onPress={() => onPress?.(i)}
              style={[styles.quarter, { borderRadius: BorderRadius.md }]}
            >
              <Image source={{ uri }} style={styles.image} contentFit="cover" />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  single: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  half: {
    flex: 1,
    overflow: 'hidden',
  },
  grid3: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  tall: {
    flex: 1,
    overflow: 'hidden',
  },
  rightCol: {
    flex: 1,
    gap: Spacing.one,
  },
  short: {
    flex: 1,
    overflow: 'hidden',
  },
  grid4: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  quarter: {
    width: '48%',
    aspectRatio: 1,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
