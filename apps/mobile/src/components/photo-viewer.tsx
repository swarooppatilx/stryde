import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Palette } from '@/constants/palette';
import { Brand, Spacing, tint } from '@/constants/theme';
import { pageCounter, pageIndex } from '@/utils/photoPaging';
import { dismissOpacity } from '@/utils/zoomMath';
import { Tappable } from './tappable';
import { ThemedText } from './themed-text';
import { ZoomablePhoto } from './zoomable-photo';

interface PhotoViewerProps {
  photos: readonly string[];
  /** The photo to open on; the viewer is hidden while this is null. */
  startIndex: number | null;
  onClose(): void;
}

/** Full-screen photo pager with zoom; drag vertically or press Back to close. */
export function PhotoViewer({ photos, startIndex, onClose }: PhotoViewerProps) {
  const { width, height } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const [current, setCurrent] = useState(startIndex ?? 0);
  const [chrome, setChrome] = useState(true);
  const dragY = useSharedValue(0);

  // Each time the viewer opens it starts on the photo that was tapped, with the controls showing.
  useEffect(() => {
    if (startIndex === null) return;
    setCurrent(startIndex);
    setChrome(true);
    dragY.value = 0;
  }, [startIndex, dragY]);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    setCurrent(pageIndex(event.nativeEvent.contentOffset.x, width, photos.length));
  const toggleChrome = () => setChrome((visible) => !visible);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: dismissOpacity(dragY.value) }));

  if (startIndex === null) return null;
  const counter = pageCounter(current, photos.length);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(startIndex, photos.length - 1)}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          keyExtractor={(uri, index) => `${uri}-${index}`}
          onMomentumScrollEnd={onScrollEnd}
          renderItem={({ item, index }) => (
            <ZoomablePhoto
              uri={item}
              width={width}
              height={height}
              dragY={dragY}
              onTap={toggleChrome}
              onDismiss={onClose}
              accessibilityLabel={`Photo ${index + 1} of ${photos.length}`}
            />
          )}
        />
        {chrome && (
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={[styles.bar, { top: top + Spacing.two }]}
            pointerEvents="box-none"
          >
            <ThemedText type="smallBold" style={styles.counter} accessibilityLiveRegion="polite">
              {counter}
            </ThemedText>
            <Tappable
              onPress={onClose}
              style={styles.close}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close photo"
            >
              <Ionicons name="close" size={26} color={Brand.white} />
            </Tappable>
          </Animated.View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: Palette.black },
  bar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: { color: Brand.white },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tint(Palette.black, 0.5),
  },
});
