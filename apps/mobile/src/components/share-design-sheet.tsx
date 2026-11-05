import { useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/button';
import { QrSheet } from '@/components/qr-sheet';
import { ShareRouteImage } from '@/components/share-route-image';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/palette';
import { BorderRadius, Spacing, tint } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ActivityType, Ring } from '@/types';
import { SHARE_DESIGN_LABEL, type ShareDesign } from '@/utils/shareDesigns';

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;
const PREVIEW_WIDTH = 180;
const PREVIEW_HEIGHT = (PREVIEW_WIDTH * CARD_HEIGHT) / CARD_WIDTH;
const DOT = 8;

interface Props {
  visible: boolean;
  designs: readonly ShareDesign[];
  selected: ShareDesign;
  onSelect: (design: ShareDesign) => void;
  onShare: () => void;
  onSave: () => void;
  onClose: () => void;
  /** The activity's link; when given, the sheet offers a QR code for it. */
  qrLink?: string;
  card: {
    coordinates: [number, number][];
    territory?: Ring | null;
    territoryArea: number;
    distance: number;
    duration: number;
    activityType: ActivityType;
    photoUri?: string;
  };
}

/** The full-size card drawn small: scaled about its centre, then shifted so it fills the preview box. */
function Preview({ design, card }: { design: ShareDesign; card: Props['card'] }) {
  const scale = PREVIEW_WIDTH / CARD_WIDTH;
  return (
    <View style={styles.preview}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          left: -(CARD_WIDTH - PREVIEW_WIDTH) / 2,
          top: -(CARD_HEIGHT - PREVIEW_HEIGHT) / 2,
          transform: [{ scale }],
        }}
      >
        <ShareRouteImage {...card} design={design} height={CARD_HEIGHT} />
      </View>
    </View>
  );
}

/** A bottom sheet to pick the share card design from a swipeable preview, then share it or save it. */
export function ShareDesignSheet({
  visible,
  designs,
  selected,
  onSelect,
  onShare,
  onSave,
  onClose,
  qrLink,
  card,
}: Props) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [qrOpen, setQrOpen] = useState(false);
  const page = Math.max(designs.indexOf(selected), 0);

  const select = (index: number) => {
    const design = designs[index];
    if (design) onSelect(design);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: tint(Palette.black, 0.4) }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.backgroundElement, paddingBottom: bottom + Spacing.three },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
        <ThemedText type="sectionTitle">Choose a card</ThemedText>
        <View
          style={styles.pager}
          onLayout={(e: LayoutChangeEvent) => {
            const next = e.nativeEvent.layout.width;
            setWidth(next);
            // Open on the design chosen last time rather than the first.
            scroller.current?.scrollTo({ x: page * next, animated: false });
          }}
        >
          <ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
              width > 0 && select(Math.round(e.nativeEvent.contentOffset.x / width))
            }
          >
            {designs.map((design) => (
              <View key={design} style={[styles.page, { width }]}>
                <Preview design={design} card={card} />
              </View>
            ))}
          </ScrollView>
        </View>
        <ThemedText type="smallBold">{SHARE_DESIGN_LABEL[selected]}</ThemedText>
        <View style={styles.dots} accessibilityRole="tablist">
          {designs.map((design, index) => (
            <Tappable
              key={design}
              hitSlop={12}
              onPress={() => {
                scroller.current?.scrollTo({ x: index * width, animated: true });
                select(index);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: design === selected }}
              accessibilityLabel={`${SHARE_DESIGN_LABEL[design]} card`}
              style={[
                styles.dot,
                { backgroundColor: design === selected ? theme.brand.primary : theme.border },
              ]}
            />
          ))}
        </View>
        <View style={styles.actions}>
          <AppButton
            onPress={() => {
              onClose();
              onShare();
            }}
          >
            Share
          </AppButton>
          <AppButton
            variant="secondary"
            onPress={() => {
              onClose();
              onSave();
            }}
          >
            Save to Photos
          </AppButton>
          {qrLink && (
            <AppButton variant="secondary" onPress={() => setQrOpen(true)}>
              Show QR code
            </AppButton>
          )}
        </View>
      </View>
      {qrLink && (
        <QrSheet visible={qrOpen} title="Activity" link={qrLink} onClose={() => setQrOpen(false)} />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.three,
    alignItems: 'center',
  },
  grabber: { width: 36, height: 4, borderRadius: BorderRadius.xxs },
  pager: { alignSelf: 'stretch' },
  page: { alignItems: 'center' },
  // Share cards are white on transparent, so the preview sits on black like a story would.
  preview: {
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    overflow: 'hidden',
    borderRadius: BorderRadius.md,
    backgroundColor: Palette.black,
  },
  dots: { flexDirection: 'row', gap: Spacing.two },
  dot: { width: DOT, height: DOT, borderRadius: BorderRadius.full },
  actions: { alignSelf: 'stretch', gap: Spacing.two },
});
