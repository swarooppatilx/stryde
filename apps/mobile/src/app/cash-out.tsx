import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatEther, formatUnits, parseUnits } from 'viem';

import { AppButton } from '@/components/button';
import { Card } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTransactor } from '@/hooks/useTransactor';
import { useViemWallet } from '@/hooks/useViemWallet';
import { isNotConfigured } from '@/services/strydeApi';
import {
  type FeeInfo,
  feePipsToPercent,
  getFeeInfo,
  getStrdBalance,
  getUniswapInfo,
  quoteSellWithoutPass,
  requestFeePass,
  rescaleForFee,
  sellStrd,
  type UniswapInfo,
} from '@/services/uniswapService';

const TIER_COPY: Record<
  number,
  { title: string; caption: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  1: {
    title: 'Active athlete',
    caption: 'World-verified and trained in the last 7 days. Lowest fee in the pool.',
    icon: 'flame',
  },
  2: {
    title: 'Verified athlete',
    caption: 'World-verified. Record an activity this week to drop to 0.05%.',
    icon: 'checkmark-circle',
  },
  4: {
    title: 'Unverified seller',
    caption:
      'Bots and farms that never ran pay 3% — that fee goes to the athletes providing liquidity.',
    icon: 'alert-circle',
  },
};

export default function CashOutScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { wallet, address } = useViemWallet();
  const { transact } = useTransactor();
  const [info, setInfo] = useState<UniswapInfo | null>(null);
  const [fee, setFee] = useState<FeeInfo | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<{ base: bigint; mine: bigint } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    try {
      const nextInfo = await getUniswapInfo();
      const [nextFee, nextBalance] = await Promise.all([
        getFeeInfo(address),
        getStrdBalance(nextInfo, address),
      ]);
      setInfo(nextInfo);
      setFee(nextFee);
      setBalance(nextBalance);
      setError(null);
    } catch (e) {
      setError(
        isNotConfigured(e)
          ? 'The Proof-of-Sweat pool is not deployed yet (SWEAT_FEE_HOOK_ADDRESS on the API).'
          : (e as Error).message
      );
    }
  }, [address]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const amountWei = (() => {
    try {
      return amount ? parseUnits(amount, 18) : 0n;
    } catch {
      return 0n;
    }
  })();

  useEffect(() => {
    if (!info || !fee || amountWei <= 0n) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      quoteSellWithoutPass(info, amountWei)
        .then((base) => {
          if (!cancelled) {
            setQuote({
              base,
              mine: rescaleForFee(base, fee.unverifiedSell.feePips, fee.sell.feePips),
            });
          }
        })
        .catch(() => !cancelled && setQuote(null));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [info, fee, amountWei]);

  const sell = async () => {
    if (!wallet || !address || !info || amountWei <= 0n) return;
    const result = await transact(
      async () => {
        const hookData = await requestFeePass(wallet, address);
        return sellStrd(wallet, address, info, amountWei, hookData);
      },
      { pending: 'Swapping STRD → ETH…', success: 'Cashed out' }
    );
    if (result?.confirmed) {
      setAmount('');
      load();
    }
  };

  const tier = fee ? TIER_COPY[fee.sell.tier] : null;
  const saved = quote ? quote.mine - quote.base : 0n;
  const insufficient = balance !== null && amountWei > balance;

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.flex}>
        <ScreenHeader title="Cash out" />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {error && (
            <Card style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {error}
              </ThemedText>
            </Card>
          )}
          {!error && !info && <ActivityIndicator color={theme.brand.primary} />}

          {fee && tier && (
            <Card style={styles.card}>
              <ThemedView style={styles.tierRow}>
                <Ionicons
                  name={tier.icon}
                  size={28}
                  color={fee.sell.tier === 4 ? theme.brand.warning : theme.brand.primary}
                />
                <ThemedView style={styles.flex}>
                  <ThemedText type="sectionTitle">
                    {tier.title} · {feePipsToPercent(fee.sell.feePips)}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {tier.caption}
                  </ThemedText>
                </ThemedView>
              </ThemedView>
              {fee.sell.tier === 4 && (
                <AppButton variant="secondary" onPress={() => router.push('/verify')}>
                  Verify with World ID to cut fees 10×
                </AppButton>
              )}
              {fee.sell.tier === 2 && (
                <AppButton variant="secondary" onPress={() => router.push('/(tabs)/tracking')}>
                  Go for a run
                </AppButton>
              )}
            </Card>
          )}

          {info && (
            <Card style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                Balance:{' '}
                {balance === null ? '—' : Number(formatUnits(balance, 18)).toLocaleString()} STRD
              </ThemedText>
              <TextField
                label="Amount (STRD)"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                placeholder="0.0"
                error={insufficient ? 'More than your balance' : null}
              />
              {balance !== null && balance > 0n && (
                <TouchableOpacity onPress={() => setAmount(formatUnits(balance, 18))}>
                  <ThemedText type="small" style={{ color: theme.brand.primary }}>
                    Use max
                  </ThemedText>
                </TouchableOpacity>
              )}
              {quote && (
                <ThemedView style={styles.quote}>
                  <ThemedText type="sectionTitle">
                    ≈ {Number(formatEther(quote.mine)).toFixed(6)} ETH
                  </ThemedText>
                  {saved > 0n && (
                    <ThemedText type="caption" style={{ color: theme.brand.success }}>
                      Proof-of-Sweat saves you {Number(formatEther(saved)).toFixed(6)} ETH vs. an
                      unverified seller
                    </ThemedText>
                  )}
                </ThemedView>
              )}
              <AppButton
                onPress={sell}
                disabled={!wallet || amountWei <= 0n || insufficient}
                icon={<Ionicons name="swap-horizontal" size={18} color={Brand.white} />}
              >
                Swap STRD for ETH
              </AppButton>
              <TouchableOpacity
                onPress={() => Linking.openURL(`https://sepolia.etherscan.io/address/${info.hook}`)}
              >
                <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
                  Uniswap v4 pool with the SweatFeeHook · {info.hook.slice(0, 8)}…
                </ThemedText>
              </TouchableOpacity>
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  card: { gap: Spacing.three },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  quote: { gap: Spacing.half },
  center: { textAlign: 'center' },
});
