import { Tabs, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBarIcon } from '@/components/tab-bar-icon';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import type { TKey } from '@/i18n';
import { useT } from '@/i18n';
import { useSettingsStore } from '@/stores/settingsStore';
import { haptics } from '@/utils/haptics';
import { shouldOpenStartTab, startTabRoute } from '@/utils/startTab';
import { tabBarStyle } from '@/utils/tabBarStyle';
import { tabTints } from '@/utils/tabBarTint';

const TABS = [
  { name: 'index', title: 'tabs.home', kind: 'home' },
  { name: 'map', title: 'tabs.maps', kind: 'map' },
  { name: 'tracking', title: 'tabs.record', kind: 'record' },
  { name: 'groups', title: 'tabs.groups', kind: 'groups' },
  { name: 'profile', title: 'tabs.you', kind: 'you' },
] as const satisfies ReadonlyArray<{ name: string; title: TKey; kind: string }>;

export default function TabLayout() {
  const theme = useTheme();
  const t = useT();
  const { bottom } = useSafeAreaInsets();
  const tints = tabTints(theme);
  const router = useRouter();
  const segments = useSegments();
  const startTab = useSettingsStore((s) => s.startTab);
  // Once per launch: the tab the athlete chose to open on, unless a link already named one.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || segments[0] !== '(tabs)') return;
    opened.current = true;
    const route = startTabRoute(startTab);
    if (route && shouldOpenStartTab(startTab, segments)) router.replace(route as never);
  }, [router, segments, startTab]);

  return (
    <Tabs
      screenListeners={{
        tabPress: () => haptics.selection(),
      }}
      screenOptions={{
        headerShown: false,
        // The selected label turns with its icon; both are read from one place so they cannot drift apart.
        tabBarActiveTintColor: tints.label.active,
        tabBarInactiveTintColor: tints.label.inactive,
        tabBarStyle: tabBarStyle(theme, bottom),
        tabBarLabelStyle: textStyle(TypeScale.tabLabel),
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.title),
            tabBarIcon: ({ focused }) => <TabBarIcon kind={tab.kind} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}
