import { services } from '@repo/shared';
import { useRouter } from 'expo-router';
import { SettingsRow, SettingsSection } from '@/components/settings-row';
import { SettingsScreen } from '@/components/settings-screen';
import { ThemedText } from '@/components/themed-text';
import { DEV_TOOLS } from '@/constants/devTools';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useBalances } from '@/hooks/useBalances';
import { useViemWallet } from '@/hooks/useViemWallet';
import { useWorldVerification } from '@/hooks/useWorldVerification';
import { type TFunction, useT } from '@/i18n';
import { getPlatform } from '@/platform';
import { shortAddress } from '@/utils/address';
import { formatEthAmount, formatTokenAmount } from '@/utils/eth';
import { haptics } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { Toast } from '@/utils/toast';

export default function AccountScreen() {
  const t = useT();
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
      Toast.success(t('account.addressCopied'), 1);
    } catch (error) {
      logger.warn('[Account] Copying the address failed', error);
      Toast.fail(t('account.copyFailed'), 1);
    }
  };

  const details = address ? (
    <>
      <SettingsRow
        icon="person-circle-outline"
        title={t('account.walletAddress')}
        subtitle={t('account.tapToCopy', { address: shortAddress(address) })}
        onPress={() => void copyAddress()}
      />
      {DEV_TOOLS.enabled ? (
        <SettingsRow
          icon="globe-outline"
          title={t('account.network')}
          subtitle={services.client.getActiveConfig().chain.name}
        />
      ) : null}
      <SettingsRow
        icon="cash-outline"
        title={t('account.challengeFunds')}
        subtitle={balanceWei === null ? '—' : formatEthAmount(balanceWei)}
      />
      <SettingsRow
        icon="disc-outline"
        title={t('account.strdBalance')}
        subtitle={strdWei === null ? '—' : formatTokenAmount(strdWei, 'STRD')}
      />
    </>
  ) : (
    <UnavailableRows
      failed={walletError !== null && walletError !== undefined}
      retry={retry}
      t={t}
    />
  );

  return (
    <SettingsScreen title={t('account.title')}>
      <SettingsSection title={t('account.sectionSignIn')}>
        <SettingsRow
          icon="mail-outline"
          title={t('account.email')}
          subtitle={email ?? t('account.emailNotSet')}
        />
        <SettingsRow
          icon="shield-checkmark-outline"
          title={isVerified ? t('account.worldVerified') : t('account.worldVerify')}
          subtitle={isVerified ? t('account.worldVerifiedHint') : t('account.worldNotVerifiedHint')}
          onPress={() => router.push('/verify')}
        />
      </SettingsSection>

      <SettingsSection title={t('account.sectionDetails')}>{details}</SettingsSection>
      {address && walletKind ? (
        <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: -Spacing.one }}>
          {walletKind === 'smart' ? t('account.savingFree') : t('account.ownFees')}
        </ThemedText>
      ) : null}
    </SettingsScreen>
  );
}

function UnavailableRows({
  failed,
  retry,
  t,
}: {
  failed: boolean;
  retry: () => void;
  t: TFunction;
}) {
  if (!failed) {
    return (
      <SettingsRow
        icon="person-circle-outline"
        title={t('account.accountId')}
        subtitle={t('account.loading')}
      />
    );
  }
  return (
    <>
      <SettingsRow
        icon="person-circle-outline"
        title={t('account.title')}
        subtitle={t('account.unavailable')}
      />
      <SettingsRow
        icon="refresh-outline"
        title={t('account.retryTitle')}
        subtitle={t('account.tryAgain')}
        onPress={retry}
      />
    </>
  );
}
