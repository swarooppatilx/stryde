import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps, useState } from 'react';
import { StyleSheet } from 'react-native';
import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import { Tappable } from '@/components/tappable';
import { BorderRadius, Touch } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type OverflowActionKey, overflowActionKeys } from '@/utils/activityActions';
import { EXPORT_FORMAT_LABEL, type ExportFormat } from '@/utils/activityExport';
import { ThemedView } from './themed-view';

interface Props {
  /** The activity has a line worth exporting or saving as a route. */
  hasRoute: boolean;
  routeSaved: boolean;
  isOwner: boolean;
  onCopy(): void;
  onFlyover(): void;
  onDownload(): void;
  onExport(format: ExportFormat): void;
  onToggleSavedRoute(): void;
  onDelete(): void;
}

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Bookmark stays one tap away; the rest sits behind "More", with delete last. */
export function ActivityActionRow({
  hasRoute,
  routeSaved,
  isOwner,
  onCopy,
  onFlyover,
  onDownload,
  onExport,
  onToggleSavedRoute,
  onDelete,
}: Props) {
  const theme = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const overflow = overflowActionKeys({ hasRoute, isOwner });
  const menu: Record<OverflowActionKey, SheetAction> = {
    flyover: { label: 'Fly over route', icon: 'airplane-outline', onPress: onFlyover },
    copy: { label: 'Copy route image', icon: 'copy-outline', onPress: onCopy },
    download: {
      label: 'Save route image to device',
      icon: 'download-outline',
      onPress: onDownload,
    },
    gpx: {
      label: 'Export activity file',
      icon: 'document-text-outline',
      onPress: () => setFormatOpen(true),
    },
    delete: {
      label: 'Delete activity',
      icon: 'trash-outline',
      onPress: onDelete,
      destructive: true,
    },
  };
  const formatActions: SheetAction[] = (['gpx', 'tcx', 'fit'] as const).map((format) => ({
    label: EXPORT_FORMAT_LABEL[format],
    icon: 'document-text-outline',
    onPress: () => onExport(format),
  }));
  const round: Array<{
    key: string;
    show: boolean;
    icon: IconName;
    label: string;
    color?: string;
    selected?: boolean;
    onPress(): void;
  }> = [
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
      key: 'more',
      show: overflow.length > 0,
      icon: 'ellipsis-horizontal',
      label: 'More actions',
      onPress: () => setMenuOpen(true),
    },
  ];
  return (
    <ThemedView style={styles.row}>
      {round
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
      <ActionSheet
        visible={menuOpen}
        actions={overflow.map((key) => menu[key])}
        onClose={() => setMenuOpen(false)}
      />
      <ActionSheet
        visible={formatOpen}
        title="Export as"
        actions={formatActions}
        onClose={() => setFormatOpen(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  button: {
    width: Touch.target,
    height: Touch.target,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
