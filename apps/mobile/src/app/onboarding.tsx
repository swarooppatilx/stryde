import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandWordmark } from '@/components/brand';
import { AppButton } from '@/components/button';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ONBOARDING_COPY } from '@/constants/copy';
import { Palette } from '@/constants/palette';
import { BorderRadius, Brand, Spacing, tint } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useSettingsStore } from '@/stores/settingsStore';

const IMAGES = [
  require('@/assets/images/onboarding-0.jpg'),
  require('@/assets/images/onboarding-1.jpg'),
  require('@/assets/images/onboarding-2.jpg'),
  require('@/assets/images/onboarding-3.jpg'),
];
const SLIDES = ONBOARDING_COPY.map((slide, i) => ({ ...slide, image: IMAGES[i] }));

// Space the fixed dots + buttons take at the bottom, so each slide's caption
// sits just above them instead of underneath.
const FOOTER_HEIGHT = 168;

export default function OnboardingScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const goToSlide = (next: number) => {
    scrollRef.current?.scrollTo({ x: next * screenWidth, animated: true });
    setIndex(next);
  };

  // Sign-up and log-in are the same wallet flow, so both buttons lead to the same screen.
  const setHasOnboarded = useSettingsStore((state) => state.setHasOnboarded);
  // Having seen the carousel counts, whether or not they finish signing in this time.
  const goToLogin = () => {
    setHasOnboarded();
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {/* The photos are the slides: each page fills the screen and its caption
          travels with it. Controls below are overlaid, not part of the pager. */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
          setIndex(next);
        }}
        style={StyleSheet.absoluteFill}
        accessibilityRole="adjustable"
        accessibilityLabel="Onboarding tutorial"
        accessibilityHint="Swipe up or down to change slide"
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const step = e.nativeEvent.actionName === 'increment' ? 1 : -1;
          goToSlide(Math.min(SLIDES.length - 1, Math.max(0, index + step)));
        }}
      >
        {SLIDES.map((slide) => (
          <View key={slide.title} style={{ width: screenWidth, height: screenHeight }}>
            {/* expo-image, not RN Image: RN's cover rendered these ~2x too
                large on device, cropping out the subject of each photo. */}
            <Image source={slide.image} contentFit="cover" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={[tint(Palette.black, 0.55), tint(Palette.black, 0)]}
              style={[styles.topScrim, { height: insets.top + 120 }]}
            />
            <LinearGradient
              colors={[tint(Palette.black, 0), tint(Palette.black, 0.6), tint(Palette.black, 0.92)]}
              locations={[0, 0.45, 1]}
              style={styles.bottomScrim}
            />
            <View style={[styles.caption, { bottom: FOOTER_HEIGHT + insets.bottom }]}>
              <ThemedText type="display" style={styles.slideTitle}>
                {slide.title}
              </ThemedText>
              <ThemedText style={styles.slideBody}>{slide.body}</ThemedText>
            </View>
          </View>
        ))}
      </ScrollView>

      <View pointerEvents="none" style={[styles.wordmark, { top: insets.top + Spacing.three }]}>
        <BrandWordmark width={140} color={Brand.white} />
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.four }]}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <Tappable
              key={slide.title}
              onPress={() => goToSlide(i)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Go to slide ${i + 1} of ${SLIDES.length}`}
              accessibilityState={{ selected: i === index }}
            >
              <View style={[styles.dot, i === index ? styles.dotActive : styles.dotInactive]} />
            </Tappable>
          ))}
        </View>
        <AppButton variant="secondary" style={styles.joinButton} onPress={goToLogin}>
          Get Started
        </AppButton>
        <Tappable onPress={goToLogin} hitSlop={8} activeOpacity={0.7}>
          <ThemedText style={styles.loginLink}>Login</ThemedText>
        </Tappable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.black,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.five,
    gap: Spacing.two,
  },
  wordmark: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  slideTitle: {
    color: Brand.white,
    textAlign: 'center',
    ...textStyle(TypeScale.title),
  },
  slideBody: {
    color: Brand.white,
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 22,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
  },
  dotActive: {
    backgroundColor: Brand.white,
    width: 20,
  },
  dotInactive: {
    backgroundColor: tint(Palette.white, 0.4),
  },
  joinButton: {
    borderRadius: BorderRadius.full,
  },
  loginLink: {
    color: Brand.white,
    ...textStyle(TypeScale.bodyBold),
    padding: Spacing.one,
  },
});
