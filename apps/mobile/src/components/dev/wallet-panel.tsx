import { List } from '@ant-design/react-native';
import { services } from '@repo/shared';
import { ListIcon } from '@/components/list-icon';
import { ENV } from '@/constants/config';
import { useChainAction } from '@/hooks/useChainAction';
import { useViemWallet } from '@/hooks/useViemWallet';

const WALLET_KIND_LABEL: Record<string, string> = { smart: 'Gas-free', embedded: 'Standard' };

/** Which kind of wallet is signing, and a zero-value transaction to check the gas sponsor works. */
export function WalletPanel() {
  const { walletKind } = useViemWallet();
  const { run } = useChainAction();

  // Verifies the smart-account/paymaster path sponsors gas without needing any app contract deployed.
  const sendTestGaslessTx = async () => {
    await run(
      async (wallet, address) => {
        const hash = await wallet.sendTransaction({
          to: address,
          value: 0n,
        } as Parameters<typeof wallet.sendTransaction>[0]);
        const client = services.client.getPublicClient();
        const receipt = await client.waitForTransactionReceipt({ hash });
        return { confirmed: receipt.status === 'success', txHash: hash };
      },
      { pending: 'Sending gasless test tx...', success: 'Gasless tx confirmed' }
    );
  };

  const rows = [
    <List.Item
      key="wallet-type"
      thumb={<ListIcon name="wallet-outline" />}
      extra={WALLET_KIND_LABEL[walletKind ?? ''] ?? 'Local test wallet'}
    >
      Wallet type
    </List.Item>,
    ...(ENV.USE_SMART_WALLET
      ? [
          <List.Item
            key="test-gasless"
            thumb={<ListIcon name="flash-outline" />}
            onPress={sendTestGaslessTx}
            arrow="horizontal"
          >
            Send test gasless transaction
          </List.Item>,
        ]
      : []),
  ];

  return <List>{rows}</List>;
}
