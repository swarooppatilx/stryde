import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageStyle } from 'expo-image';
import { useRef, useState } from 'react';
import {
  Dimensions,
  type LayoutChangeEvent,
  ScrollView,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { RouteThumbnail } from '@/components/route-thumbnail';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { Feed } from '@/constants/feed';
import { BorderRadius, Spacing } from '@/constants/theme';
import type { useTheme } from '@/hooks/use-theme';
import type { SocialActivity } from '@/stores/socialStore';
import { parsePolyline } from '@/utils/format';

function RouteSlide({
  activity,
  icon,
  theme,
  height,
}: {
  activity: SocialActivity;
  icon: keyof typeof Ionicons.glyphMap;
  theme: ReturnType<typeof useTheme>;
  height: number;
}) {
  return (
    <RouteThumbnail
      polyline={activity.polyline}
      territory={activity.territory}
      height={height}
      fallback={
        <View style={[styles.thumbnailFallback, { backgroundColor: theme.background, height }]}>
          <Ionicons name={icon} size={32} color={theme.textSecondary} />
        </View>
      }
    />
  );
}

/** A post photo; when it can't be loaded (offline, a slow gateway) it shows the sport icon instead of a black box. */
function FeedPhoto({
  uri,
  icon,
  theme,
  style,
}: {
  uri: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme: ReturnType<typeof useTheme>;
  style: StyleProp<ImageStyle>;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View
        style={[
          style as StyleProp<ViewStyle>,
          styles.photoFailed,
          { backgroundColor: theme.backgroundSelected },
        ]}
        accessibilityLabel="Photo unavailable"
      >
        <Ionicons name={icon} size={20} color={theme.textSecondary} />
        <ThemedText type="caption" themeColor="textSecondary">
          Photo unavailable
        </ThemedText>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[style, { backgroundColor: theme.backgroundSelected }]}
      contentFit="cover"
      onError={() => setFailed(true)}
    />
  );
}

export function FeedMedia({
  activity,
  icon,
  theme,
  onPress,
  onMapPress,
}: {
  activity: SocialActivity;
  icon: keyof typeof Ionicons.glyphMap;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
  onMapPress?: () => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const images = activity.images ?? (activity.image ? [activity.image] : []);
  // A route that cannot be drawn (fewer than two points) gets no slot: an empty grey box is worse than none.
  const hasMap = parsePolyline(activity.polyline).length > 1;
  const totalItems = images.length + (hasMap ? 1 : 0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== containerWidth) setContainerWidth(w);
  };

  const onScroll = (e: {
    nativeEvent: { contentOffset: { x: number }; layoutMeasurement: { width: number } };
  }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
    setActiveIndex(idx);
  };

  const carouselHeight = Feed.mediaHeight;

  if (totalItems === 0) return null;

  if (totalItems === 1 && images.length === 1) {
    return (
      <Tappable
        activeOpacity={0.7}
        onPress={onPress}
        style={styles.thumbnailContainer}
        accessibilityRole="imagebutton"
        accessibilityLabel="Activity photo"
      >
        <FeedPhoto uri={images[0] ?? ''} icon={icon} theme={theme} style={styles.activityImage} />
      </Tappable>
    );
  }

  if (totalItems === 1 && hasMap) {
    return (
      <Tappable
        activeOpacity={0.7}
        onPress={onMapPress ?? onPress}
        accessibilityRole="imagebutton"
        accessibilityLabel="Route map"
        style={styles.thumbnailContainer}
      >
        <RouteSlide activity={activity} icon={icon} theme={theme} height={carouselHeight} />
      </Tappable>
    );
  }

  const itemWidth = containerWidth || Dimensions.get('window').width;

  return (
    <View onLayout={onLayout}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.carousel}
      >
        {images.map((uri, i) => (
          <Tappable
            key={uri}
            activeOpacity={0.7}
            onPress={onPress}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Photo ${i + 1} of ${images.length}`}
            style={[styles.carouselItem, { width: itemWidth, height: carouselHeight }]}
          >
            <FeedPhoto
              uri={uri}
              icon={icon}
              theme={theme}
              style={StyleSheet.absoluteFill as StyleProp<ImageStyle>}
            />
          </Tappable>
        ))}
        {hasMap && (
          <Tappable
            activeOpacity={0.7}
            onPress={onMapPress ?? onPress}
            accessibilityRole="imagebutton"
            accessibilityLabel="Route map"
            style={[styles.carouselItem, { width: itemWidth, height: carouselHeight }]}
          >
            <RouteSlide activity={activity} icon={icon} theme={theme} height={carouselHeight} />
          </Tappable>
        )}
      </ScrollView>
      {totalItems > 1 && (
        <View style={styles.pagination}>
          {Array.from({ length: totalItems }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === activeIndex ? theme.brand.primary : theme.border },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  thumbnailContainer: {
    marginTop: Feed.edge,
    overflow: 'hidden',
  },
  activityImage: {
    width: '100%',
    height: Feed.mediaHeight,
  },
  thumbnailFallback: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Short on purpose: a failed photo should not hold a full-height blank in the feed.
  photoFailed: {
    height: 64,
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carousel: {
    marginTop: Feed.edge,
  },
  carouselItem: {
    overflow: 'hidden',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: BorderRadius.full,
  },
});
