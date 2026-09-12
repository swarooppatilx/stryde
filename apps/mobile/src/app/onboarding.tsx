import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandWordmark } from '@/components/brand';
import { AppButton } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';

const SLIDES = [
  {
    image: require('@/assets/images/onboarding-0.jpg'),
    title: 'Track every mile',
    body: 'Record runs, rides, hikes and walks with GPS tracking, pace, and elevation in real time.',
  },
  {
    image: require('@/assets/images/onboarding-1.jpg'),
    title: 'Claim your territory',
    body: 'Every route you finish maps the ground you covered. Build your world as you move.',
  },
  {
    image: require('@/assets/images/onboarding-2.jpg'),
    title: 'Train with friends',
    body: 'See what the people around you are up to. Share routes, compare stats, and keep each other honest.',
  },
  {
    image: require('@/assets/images/onboarding-3.jpg'),
    title: 'Your progress, always',
    body: 'Everything you record stays with you. No lock-in, no paywall — just your data, wherever you go.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();

  const activeSlide = SLIDES[index];

  const goToSlide = (next: number) => {
    scrollRef.current?.scrollTo({ x: next * screenWidth, animated: true });
    setIndex(next);
  };

  const handleGetStarted = () => {
    router.replace('/login');
  };

  const handleLogin = () => {
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      {/* Placeholder — swap for a real background photo when one is ready, see
          onboarding-background-placeholder.tsx for the exact replacement. */}
      <Image
        source={require('@/assets/images/onboarding_bg.webp')}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(11,11,12,0.35)', 'rgba(11,11,12,0.8)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.wordmark}>
          <BrandWordmark width={140} color={Brand.white} />
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const next = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
            setIndex(next);
          }}
          style={styles.carousel}
          accessibilityRole="adjustable"
          accessibilityLabel="Onboarding tutorial"
          accessibilityHint="Swipe left to continue through the tutorial"
        >
          {SLIDES.map((slide) => (
            <View key={slide.title} style={[styles.slideVisual, { width: screenWidth }]}>
              <View style={styles.phoneFrame}>
                <Image source={slide.image} style={styles.phoneImage} resizeMode="cover" />
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <TouchableOpacity
              key={slide.title}
              onPress={() => goToSlide(i)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Go to slide ${i + 1} of ${SLIDES.length}`}
              accessibilityState={{ selected: i === index }}
            >
              <View style={[styles.dot, i === index ? styles.dotActive : styles.dotInactive]} />
            </TouchableOpacity>
          ))}
        </View>

        <Animated.View key={index} entering={FadeIn.duration(220)} style={styles.textArea}>
          <ThemedText type="title" style={styles.slideTitle}>
            {activeSlide.title}
          </ThemedText>
          <ThemedText style={styles.slideBody}>{activeSlide.body}</ThemedText>
        </Animated.View>

        <View style={styles.footer}>
          <AppButton variant="secondary" style={styles.joinButton} onPress={handleGetStarted}>
            Get Started
          </AppButton>
          <TouchableOpacity onPress={handleLogin} hitSlop={8} activeOpacity={0.7}>
            <ThemedText style={styles.loginLink}>Login</ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  wordmark: {
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  carousel: {
    flex: 1,
  },
  slideVisual: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneFrame: {
    width: 210,
    height: 446,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  phoneImage: {
    width: '100%',
    height: '100%',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.three,
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
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  textArea: {
    paddingHorizontal: Spacing.five,
    gap: Spacing.two,
    minHeight: 96,
  },
  slideTitle: {
    color: Brand.white,
    textAlign: 'center',
    fontSize: 28,
  },
  slideBody: {
    color: Brand.white,
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  joinButton: {
    borderRadius: BorderRadius.full,
  },
  loginLink: {
    color: Brand.white,
    fontWeight: '600',
    fontSize: 16,
    padding: Spacing.one,
  },
});
