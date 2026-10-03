import { StyleSheet } from 'react-native';
import { Notice } from '@/components/notice';
import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LookAlike, Segment } from '@/utils/counterpartyChecks';

function Address({ label, segments }: { label: string; segments: Segment[] }) {
  const theme = useTheme();
  return (
    <ThemedText type="small" accessibilityLabel={label} style={styles.address}>
      {segments.map((s, i) => (
        <ThemedText
          // Segments alternate and never reorder, so the position is a stable key.
          key={`${i}-${s.text}`}
          type={s.differs ? 'smallBold' : 'small'}
          style={[styles.address, s.differs && { color: theme.dangerText }]}
        >
          {s.text}
        </ThemedText>
      ))}
    </ThemedText>
  );
}

/** Names the athlete the typed address imitates and lines the two up, with the differing characters marked. */
export function LookAlikeNotice({ lookAlike }: { lookAlike: LookAlike }) {
  return (
    <Notice severity="warning">
      {`This address starts and ends like ${lookAlike.athlete}'s, but it is a different address. Check the marked characters.`}
      {'\n'}
      <Address label="Address you typed" segments={lookAlike.typed} />
      {'\n'}
      <Address label={`${lookAlike.athlete}'s address`} segments={lookAlike.known} />
    </Notice>
  );
}

const styles = StyleSheet.create({
  address: { fontFamily: Fonts.mono },
});
