import { Ionicons } from '@expo/vector-icons';
import { Share } from 'react-native';
import { Tappable } from '@/components/tappable';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { Toast } from '@/utils/toast';

/** A header icon that opens the system share sheet with `message` (a name and a link). */
export function ShareButton({ message, label }: { message: string; label: string }) {
  const theme = useTheme();
  return (
    <Tappable
      onPress={async () => {
        haptics.tap();
        try {
          await Share.share({ message });
        } catch (error) {
          logger.warn('[Share] Failed', error);
          Toast.fail("Couldn't open sharing", 1.5);
        }
      }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name="share-outline" size={24} color={theme.text} />
    </Tappable>
  );
}
