import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  View,
} from 'react-native';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/palette';
import { BorderRadius, Brand, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { pageIndex, pagePosition } from '@/utils/photoPaging';
import { uniqueKeys } from '@/utils/uniqueKeys';

/** Photos are shown 4:3, as wide as the screen lets them be. */
const ASPECT = 3 / 4;

function CarouselPhoto({ uri, width, height }: { uri: string; width: number; height: number }) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View
        style={[styles.failed, { width, height, backgroundColor: theme.backgroundSelected }]}
        accessibilityLabel="Photo unavailable"
      >
        <Ionicons name="image-outline" size={28} color={theme.textTertiary} />
        <ThemedText type="caption" themeColor="textSecondary">
          Photo unavailable
        </ThemedText>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width, height, backgroundColor: theme.backgroundSelected }}
      contentFit="cover"
      onError={() => setFailed(true)}
    />
  );
}

interface PhotoCarouselProps {
  photos: readonly string[];
  /** Called with the tapped photo's index. */
  onOpen(index: number): void;
}

/** A post's or activity's photos: one 4:3 frame, swipe for more, a "1/4" chip and dots when there are several. */
export function PhotoCarousel({ photos, onOpen }: PhotoCarouselProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [current, setCurrent] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(Math.round(event.nativeEvent.layout.width));
  };
  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    setCurrent(pageIndex(event.nativeEvent.contentOffset.x, width, photos.length));

  if (photos.length === 0) return null;
  const keys = uniqueKeys(photos);
  const height = Math.round(width * ASPECT);
  const position = pagePosition(current, photos.length);

  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          keyExtractor={(_, index) => keys[index] ?? String(index)}
          onMomentumScrollEnd={onScrollEnd}
          renderItem={({ item, index }) => (
            <Tappable
              activeOpacity={0.9}
              onPress={() => onOpen(index)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Photo ${index + 1} of ${photos.length}. Open full screen`}
            >
              <CarouselPhoto uri={item} width={width} height={height} />
            </Tappable>
          )}
        />
      )}
      {position !== '' && width > 0 && (
        <View style={styles.chip} pointerEvents="none">
          <ThemedText type="caption" style={styles.chipText}>
            {position}
          </ThemedText>
        </View>
      )}
      {photos.length > 1 && (
        <View style={styles.dots} accessibilityElementsHidden>
          {photos.map((_uri, index) => (
            <View
              key={keys[index]}
              style={[
                styles.dot,
                { backgroundColor: index === current ? theme.brand.primary : theme.border },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  failed: { alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  chip: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: BorderRadius.full,
    backgroundColor: tint(Palette.black, 0.55),
  },
  chipText: { color: Brand.white },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  dot: { width: 6, height: 6, borderRadius: BorderRadius.full },
});
