import { Ionicons } from '@expo/vector-icons';
import { Tappable } from '@/components/tappable';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';
import { shareMessage } from '@/utils/shareMessage';

/** A header icon that opens the system share sheet with `message` (a name and a link). */
export function ShareButton({ message, label }: { message: string; label: string }) {
  const theme = useTheme();
  return (
    <Tappable
      onPress={async () => {
        haptics.tap();
        await shareMessage(message, "Couldn't open sharing");
      }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name="share-outline" size={24} color={theme.text} />
    </Tappable>
  );
}
