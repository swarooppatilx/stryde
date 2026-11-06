import { ListLoading, ListMessage } from '@/components/list-message';
import { COMMUNITY_COPY } from '@/constants/copy';
import type { GroupsEmptyView } from '@/utils/groupsEmptyView';

interface Props {
  view: GroupsEmptyView;
  /** Reload whatever list is showing. */
  onRetry(): void;
  onRetryWallet(): void;
  onShowAllChallenges(): void;
}

/** The empty, loading and failed states of the Groups lists; what to say is decided by `groupsEmptyView`. */
export function GroupsEmptyState({ view, onRetry, onRetryWallet, onShowAllChallenges }: Props) {
  switch (view.kind) {
    case 'loading':
      return <ListLoading />;
    case 'error':
      return (
        <ListMessage
          icon="cloud-offline-outline"
          text={`Couldn't load ${view.what}. Check your connection and try again.`}
          action={{ label: 'Retry', onPress: onRetry }}
        />
      );
    case 'no-clubs':
      return (
        <ListMessage
          icon="people-outline"
          title={COMMUNITY_COPY.clubsEmptyTitle}
          text="Create the first one and invite your friends."
        />
      );
    case 'no-clubs-found':
      return <ListMessage icon="people-outline" text="No clubs found" />;
    case 'no-events':
      return (
        <ListMessage
          icon="trophy-outline"
          title={COMMUNITY_COPY.eventsEmptyTitle}
          text="Host a run or ride and let others join in."
        />
      );
    case 'events-not-live':
      return <ListMessage icon="trophy-outline" text="Events aren't live on this network yet" />;
    case 'sandbox':
      return <ListMessage icon="flag-outline" text={COMMUNITY_COPY.challengesSandbox} />;
    case 'wallet':
      return (
        <ListMessage
          icon="wallet-outline"
          title="Wallet not connected"
          text="Your gas-free wallet is still starting. We keep trying, or you can try now."
          action={{ label: 'Try now', onPress: onRetryWallet }}
        />
      );
    case 'filtered-challenges':
      return (
        <ListMessage
          icon="flag-outline"
          text="No challenges here."
          action={{ label: 'Show all', onPress: onShowAllChallenges }}
        />
      );
    case 'no-challenges':
      return (
        <ListMessage
          icon="flag-outline"
          title={COMMUNITY_COPY.challengesEmptyTitle}
          text={COMMUNITY_COPY.challengesEmpty}
        />
      );
  }
}
