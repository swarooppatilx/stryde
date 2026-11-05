import { services } from '@repo/shared';
import { useRouter } from 'expo-router';
import { SettingsRow, SettingsSection } from '@/components/settings-row';
import { SettingsScreen } from '@/components/settings-screen';
import { ThemedText } from '@/components/themed-text';
import { COPY } from '@/constants/copy';
import { DEV_TOOLS } from '@/constants/devTools';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useBalances } from '@/hooks/useBalances';
import { useViemWallet } from '@/hooks/useViemWallet';
import { useWorldVerification } from '@/hooks/useWorldVerification';
import { getPlatform } from '@/platform';
import { shortAddress } from '@/utils/challengeForm';
import { formatEthAmount, formatTokenAmount } from '@/utils/eth';
import { haptics } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { Toast } from '@/utils/toast';

export default function AccountScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isVerified } = useWorldVerification();
  // The on-chain identity address (from useViemWallet), not the Privy embedded auth wallet; in local dev mode these differ.
  const { address, walletKind, walletError, retry } = useViemWallet();
  const { eth: balanceWei, strd: strdWei } = useBalances(address);
  const email = user?.email ?? null;

  const copyAddress = async () => {
    if (!address) return;
    try {
      await getPlatform().clipboard.copyText(address);
      haptics.success();
      Toast.success('Address copied', 1);
    } catch (error) {
      logger.warn('[Account] Copying the address failed', error);
      Toast.fail('Could not copy the address', 1);
    }
  };

  const details = address ? (
    <>
      <SettingsRow
        icon="person-circle-outline"
        title="Wallet address"
        subtitle={`${shortAddress(address)} · Tap to copy`}
        onPress={() => void copyAddress()}
      />
      {DEV_TOOLS.enabled ? (
        <SettingsRow
          icon="globe-outline"
          title="Network (dev)"
          subtitle={services.client.getActiveConfig().chain.name}
        />
      ) : null}
      <SettingsRow
        icon="cash-outline"
        title="Challenge funds"
        subtitle={balanceWei === null ? '—' : formatEthAmount(balanceWei)}
      />
      <SettingsRow
        icon="disc-outline"
        title="STRD balance"
        subtitle={strdWei === null ? '—' : formatTokenAmount(strdWei, 'STRD')}
      />
    </>
  ) : (
    <UnavailableRows failed={walletError !== null && walletError !== undefined} retry={retry} />
  );

  return (
    <SettingsScreen title="Account">
      <SettingsSection title="Sign-in">
        <SettingsRow icon="mail-outline" title="Email" subtitle={email ?? 'Not set'} />
        <SettingsRow
          icon="shield-checkmark-outline"
          title={isVerified ? 'World ID' : 'Verify with World ID'}
          subtitle={
            isVerified
              ? 'Verified · you are counted as one person on the leaderboard.'
              : 'Not verified · counts you as one person on the leaderboard and gives your score a small bonus.'
          }
          onPress={() => router.push('/verify')}
        />
      </SettingsSection>

      <SettingsSection title="Details">{details}</SettingsSection>
      {address && walletKind ? (
        <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: -Spacing.one }}>
          {walletKind === 'smart' ? COPY.accountSavingFree : COPY.accountOwnFees}
        </ThemedText>
      ) : null}
    </SettingsScreen>
  );
}

function UnavailableRows({ failed, retry }: { failed: boolean; retry: () => void }) {
  if (!failed) {
    return <SettingsRow icon="person-circle-outline" title="Account ID" subtitle="Loading" />;
  }
  return (
    <>
      <SettingsRow icon="person-circle-outline" title="Account" subtitle="Unavailable" />
      <SettingsRow
        icon="refresh-outline"
        title={COPY.accountUnavailable}
        subtitle="Try again"
        onPress={retry}
      />
    </>
  );
}
