import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { TabBar } from '@/constants/tabBar';
import { BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useProfileStore } from '@/stores/profileStore';
import { resolveAvatarUri } from '@/utils/avatarUri';
import { tabTints } from '@/utils/tabBarTint';
import { UserAvatar } from './user-avatar';

type TabKind = 'home' | 'map' | 'record' | 'groups' | 'you';

const GLYPH: Record<
  'home' | 'map' | 'groups',
  { off: keyof typeof Ionicons.glyphMap; on: keyof typeof Ionicons.glyphMap }
> = {
  home: { off: 'home-outline', on: 'home' },
  map: { off: 'map-outline', on: 'map' },
  groups: { off: 'people-outline', on: 'people' },
};

/** A bottom-bar icon; the selected tab differs by colour alone (filled brand icon, label tinted via `tabTints`). */
export function TabBarIcon({ kind, focused }: { kind: TabKind; focused: boolean }) {
  const theme = useTheme();
  const { icon } = tabTints(theme);
  const color = focused ? icon.active : icon.inactive;
  const avatar = useProfileStore((s) => s.avatar);
  const avatarCid = useProfileStore((s) => s.avatarCid);
  const username = useProfileStore((s) => s.username);

  let glyph: React.ReactNode;
  if (kind === 'record') {
    // A ring around a filled dot, the same mark whether selected or not.
    glyph = (
      <View style={[styles.ring, { borderColor: color }]}>
        <View style={[styles.dot, { backgroundColor: color }]} />
      </View>
    );
  } else if (kind === 'you') {
    glyph = (
      <UserAvatar
        uri={resolveAvatarUri(avatar, avatarCid)}
        name={username || 'You'}
        size={TabBar.avatar}
        borderColor={focused ? icon.active : undefined}
      />
    );
  } else {
    const names = GLYPH[kind];
    glyph = <Ionicons name={focused ? names.on : names.off} size={TabBar.icon} color={color} />;
  }

  return <View style={styles.slot}>{glyph}</View>;
}

const styles = StyleSheet.create({
  slot: {
    height: TabBar.iconSlot,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: TabBar.iconGap,
  },
  ring: {
    width: TabBar.ring,
    height: TabBar.ring,
    borderRadius: BorderRadius.full,
    borderWidth: TabBar.ringStroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: TabBar.ringDot,
    height: TabBar.ringDot,
    borderRadius: BorderRadius.full,
  },
});
