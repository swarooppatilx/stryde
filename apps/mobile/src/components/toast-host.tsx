import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToastStore } from '@/stores/toastStore';

const ICONS = {
  info: 'information-circle' as const,
  success: 'checkmark-circle' as const,
  fail: 'close-circle' as const,
  loading: null,
};

/** Mounted once at the app root. Renders whatever `@/utils/toast`'s `Toast`
 * shim currently has active — themed card, Ionicons (not antd's
 * unregistered icon font), slide/fade in from the top. */
export function ToastHost() {
  const theme = useTheme();
  const activeKey = useToastStore((s) => s.activeKey);
  const content = useToastStore((s) => s.content);
  const kind = useToastStore((s) => s.kind);

  if (activeKey === null) return null;

  const accentColor =
    kind === 'success'
      ? theme.brand.success
      : kind === 'fail'
        ? theme.brand.danger
        : theme.brand.primary;

  return (
    <View style={styles.wrapper} pointerEvents="none">
      <SafeAreaView edges={['top']}>
        <Animated.View
          key={activeKey}
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(150)}
          style={[
            styles.toast,
            {
              backgroundColor: theme.isDark ? 'rgba(32,32,32,0.97)' : 'rgba(255,255,255,0.98)',
              borderColor: theme.border,
            },
          ]}
        >
          {kind === 'loading' ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : (
            <Ionicons name={ICONS[kind]} size={20} color={accentColor} />
          )}
          <ThemedText type="small" style={styles.text} numberOfLines={2}>
            {content}
          </ThemedText>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  text: {
    flexShrink: 1,
  },
});
