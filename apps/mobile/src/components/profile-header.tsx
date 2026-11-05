import { Input } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Tappable } from '@/components/tappable';
import { Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { USERNAME_MAX_LENGTH } from '@/utils/username';
import { ThemedText } from './themed-text';
import { UserAvatar } from './user-avatar';

const AVATAR_SIZE = 60;

interface ProfileHeroProps {
  displayName: string;
  /** Resolved avatar URL, or null to show initials. */
  avatar: string | null;
  /** The ENS avatar, shown only while there is no uploaded photo. */
  fallbackAvatar?: string | null;
  /** The athlete's ENS name, a quiet line under the name. */
  ensName?: string | null;
  avatarBusy: boolean;
  onAvatarPress(): void;
  isVerified: boolean;
  /** The "N activities · N followers · N following" line. */
  subline: string;
  isEditingName: boolean;
  editedName: string;
  setEditedName(name: string): void;
  onSaveName(): void;
  onStartEditName(): void;
  /** Moves the name block sideways when a rename is refused. */
  nameShakeStyle?: ComponentProps<typeof Animated.View>['style'];
}

/** Who this is: avatar (tap to change), name (tap to rename), and the activity count. */
export function ProfileHero({
  displayName,
  avatar,
  fallbackAvatar,
  ensName,
  avatarBusy,
  onAvatarPress,
  isVerified,
  subline,
  isEditingName,
  editedName,
  setEditedName,
  onSaveName,
  onStartEditName,
  nameShakeStyle,
}: ProfileHeroProps) {
  const theme = useTheme();
  return (
    <View style={styles.hero}>
      <Tappable
        onPress={onAvatarPress}
        disabled={avatarBusy}
        accessibilityRole="imagebutton"
        accessibilityState={{ disabled: avatarBusy, busy: avatarBusy }}
        accessibilityLabel={avatar ? 'Change or remove profile photo' : 'Add profile photo'}
      >
        <UserAvatar uri={avatar ?? fallbackAvatar} name={displayName} size={AVATAR_SIZE} />
        <View
          style={[
            styles.badge,
            { backgroundColor: theme.backgroundSelected, borderColor: theme.background },
          ]}
        >
          {avatarBusy ? (
            <ActivityIndicator size="small" color={theme.text} />
          ) : (
            <Ionicons name="camera" size={12} color={theme.text} />
          )}
        </View>
      </Tappable>
      <Animated.View style={[styles.text, nameShakeStyle]}>
        {isEditingName ? (
          <Input
            value={editedName}
            onChangeText={setEditedName}
            onBlur={onSaveName}
            onSubmitEditing={onSaveName}
            autoFocus
            selectTextOnFocus
            maxLength={USERNAME_MAX_LENGTH}
            style={[styles.nameInput, { borderColor: theme.borderBold }]}
            inputStyle={[styles.nameInputText, { color: theme.text }]}
          />
        ) : (
          <Tappable
            onPress={onStartEditName}
            style={styles.nameRow}
            accessibilityRole="button"
            accessibilityLabel={`${displayName}, tap to rename`}
          >
            <ThemedText numberOfLines={1} style={styles.name}>
              {displayName}
            </ThemedText>
            {isVerified && (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.brand.verified}
                accessibilityLabel="Verified account"
              />
            )}
          </Tappable>
        )}
        {ensName && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {ensName}
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          {subline}
        </ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: Spacing.half },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  name: { flexShrink: 1, ...textStyle(TypeScale.titleSmall) },
  nameInput: { borderBottomWidth: 1, paddingBottom: Spacing.half },
  nameInputText: textStyle(TypeScale.headline),
});
