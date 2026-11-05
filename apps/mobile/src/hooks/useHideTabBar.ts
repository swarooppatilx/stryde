import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { tabBarStyle } from '@/utils/tabBarStyle';

/** Hides the tab bar while `hidden`, restoring the themed one when it turns false or the screen leaves. */
export function useHideTabBar(hidden: boolean) {
  const navigation = useNavigation();
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();

  useEffect(() => {
    const visible = tabBarStyle(theme, bottom);
    navigation.setOptions({ tabBarStyle: hidden ? { display: 'none' } : visible });
    return () => navigation.setOptions({ tabBarStyle: visible });
  }, [hidden, navigation, theme, bottom]);
}
