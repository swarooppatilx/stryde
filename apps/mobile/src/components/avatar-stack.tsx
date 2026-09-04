import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useSocialStore } from '@/stores/socialStore';

interface AvatarStackProps {
  userIds: string[];
  max?: number;
  size?: number;
}

export function AvatarStack({ userIds, max = 3, size = 24 }: AvatarStackProps) {
  const theme = useTheme();
  const getUserById = useSocialStore((s) => s.getUserById);

  const visible = userIds.slice(0, max);
  const remaining = userIds.length - max;
  const overlap = size * 0.35;

  return (
    <View style={styles.container}>
      {visible.map((userId, i) => {
        const user = getUserById(userId);
        const name = user?.name ?? '?';
        const initials = name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();

        return (
          <View
            key={userId}
            style={[
              styles.avatar,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: theme.brand.primaryTint,
                borderColor: theme.backgroundElement,
                marginLeft: i > 0 ? -overlap : 0,
                zIndex: visible.length - i,
              },
            ]}
          >
            <ThemedText
              type="caption"
              style={[styles.initials, { color: theme.brand.primary, fontSize: size * 0.38 }]}
            >
              {initials}
            </ThemedText>
          </View>
        );
      })}
      {remaining > 0 && (
        <View
          style={[
            styles.avatar,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: theme.backgroundSelected,
              borderColor: theme.backgroundElement,
              marginLeft: -overlap,
              zIndex: 0,
            },
          ]}
        >
          <ThemedText
            type="caption"
            style={[styles.initials, { color: theme.textSecondary, fontSize: size * 0.35 }]}
          >
            +{remaining}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  initials: {
    fontWeight: '700',
  },
});
