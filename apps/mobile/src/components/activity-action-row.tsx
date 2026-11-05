import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { Tappable } from '@/components/tappable';
import { BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedView } from './themed-view';

interface Props {
  /** The activity has a line worth exporting or saving as a route. */
  hasRoute: boolean;
  routeSaved: boolean;
  isOwner: boolean;
  onCopy(): void;
  onDownload(): void;
  onShare(): void;
  onExportGpx(): void;
  onToggleSavedRoute(): void;
  onDelete(): void;
}

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Copy, save, share, export, bookmark and (for the owner) delete, as one row of round buttons. */
export function ActivityActionRow({
  hasRoute,
  routeSaved,
  isOwner,
  onCopy,
  onDownload,
  onShare,
  onExportGpx,
  onToggleSavedRoute,
  onDelete,
}: Props) {
  const theme = useTheme();
  const actions: Array<{
    key: string;
    show: boolean;
    icon: IconName;
    label: string;
    color?: string;
    selected?: boolean;
    onPress(): void;
  }> = [
    { key: 'copy', show: true, icon: 'copy-outline', label: 'Copy route image', onPress: onCopy },
    {
      key: 'download',
      show: true,
      icon: 'download-outline',
      label: 'Save route image to device',
      onPress: onDownload,
    },
    { key: 'share', show: true, icon: 'share-outline', label: 'Share activity', onPress: onShare },
    {
      key: 'gpx',
      show: hasRoute,
      icon: 'document-text-outline',
      label: 'Export route as GPX',
      onPress: onExportGpx,
    },
    {
      key: 'route',
      show: hasRoute,
      icon: routeSaved ? 'bookmark' : 'bookmark-outline',
      label: routeSaved ? 'Remove saved route' : 'Save route',
      color: routeSaved ? theme.brand.primary : undefined,
      selected: routeSaved,
      onPress: onToggleSavedRoute,
    },
    {
      key: 'delete',
      show: isOwner,
      icon: 'trash-outline',
      label: 'Delete activity',
      color: theme.brand.danger,
      onPress: onDelete,
    },
  ];

  return (
    <ThemedView style={styles.row}>
      {actions
        .filter((action) => action.show)
        .map((action) => (
          <Tappable
            key={action.key}
            style={[styles.button, { backgroundColor: theme.backgroundSelected }]}
            onPress={action.onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={
              action.selected === undefined ? undefined : { selected: action.selected }
            }
            accessibilityLabel={action.label}
          >
            <Ionicons name={action.icon} size={20} color={action.color ?? theme.text} />
          </Tappable>
        ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  button: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
