import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandWordmark } from '@/components/brand';
import { AppButton } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';

const SLIDES = [
  {
    icon: 'footsteps' as const,
    title: 'Track every mile',
    body: 'Record runs, rides, hikes and walks with live GPS tracking, pace, and elevation.',
  },
  {
    icon: 'grid' as const,
    title: 'Capture real-world territory',
    body: 'Every route you complete claims the ground you covered. Explore to expand your map.',
  },
  {
    icon: 'shield-checkmark' as const,
    title: 'Own it onchain',
    body: 'Activities and territory are yours - verified onchain, not locked in someone else’s app.',
  },
  {
    icon: 'wallet' as const,
    title: 'One identity, no friction',
    body: 'Sign in with email. We create and manage your wallet automatically.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();

  const handleContinue = () => {
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Brand.primary, Brand.primaryPressed]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
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
        >
          {SLIDES.map((slide) => (
            <View key={slide.title} style={[styles.slide, { width: screenWidth }]}>
              <View style={styles.iconCircle}>
                <Ionicons name={slide.icon} size={40} color={Brand.white} />
              </View>
              <ThemedText type="title" style={styles.slideTitle}>
                {slide.title}
              </ThemedText>
              <ThemedText style={styles.slideBody}>{slide.body}</ThemedText>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <View
              key={slide.title}
              style={[styles.dot, i === index ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>

        <View style={styles.footer}>
          <AppButton variant="secondary" style={styles.joinButton} onPress={handleContinue}>
            Join for free
          </AppButton>
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
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
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
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.four,
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
  footer: {
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  joinButton: {
    borderRadius: BorderRadius.full,
  },
});
