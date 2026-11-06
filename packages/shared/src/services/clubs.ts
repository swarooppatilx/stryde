import type { WalletClient } from 'viem';
import { getActiveConfig } from './client';
import { type ClubAction, clubTypedData, newClubIntent } from './clubIntent';
import { apiCall } from './socialApi';

export type { ClubAction } from './clubIntent';
export { MAX_CLUB_COMMENT_LENGTH, MAX_CLUB_PHOTOS, MAX_CLUB_POST_LENGTH } from './clubIntent';

export type NotifyLevel = 'all' | 'announcements' | 'off';
export type RequestStatus = 'pending' | 'approved' | 'declined';

/** What a club looks like and how it runs, beyond what the chain stores. */
export interface ClubSettings {
  name: string;
  location: string;
  description: string;
  /** IPFS content ids; empty when not set. */
  photo: string;
  cover: string;
  inviteOnly: boolean;
  adminsOnlyPost: boolean;
  showLeaderboard: boolean;
}

export interface ClubState {
  clubId: string;
  owner: `0x${string}` | null;
  settings: ClubSettings;
  admins: `0x${string}`[];
  removed: `0x${string}`[];
  requests: Array<{ member: `0x${string}`; status: RequestStatus; at: number }>;
  /** Ids of the events this club hosts. */
  events: string[];
}

export interface ClubComment {
  id: string;
  postId: string;
  author: `0x${string}`;
  text: string;
  createdAt: number;
}

export interface ClubPost {
  id: string;
  author: `0x${string}`;
  text: string;
  photos: string[];
  /** Posted by an admin as an announcement. */
  announcement: boolean;
  createdAt: number;
  comments: ClubComment[];
}

const clubsCall = <T>(path: string, init?: RequestInit) => apiCall<T>('clubs', path, init);

/** Signs one club action with the wallet and sends it. */
export async function sendClubAction<T>(
  wallet: WalletClient,
  fields: {
    clubId: string;
    action: ClubAction;
    target?: string;
    data?: Record<string, unknown>;
    clientId?: string;
  }
): Promise<T> {
  const account = wallet.account;
  if (!account) throw new Error('No wallet account found');
  const intent = newClubIntent({ actor: account.address, ...fields });
  const signature = await wallet.signTypedData({
    account,
    ...clubTypedData(intent, getActiveConfig().chain.id),
  });
  return clubsCall<T>('action', { method: 'POST', body: JSON.stringify({ intent, signature }) });
}

export async function getClubState(clubId: string): Promise<ClubState> {
  return (await clubsCall<{ club: ClubState }>(clubId)).club;
}

export async function getClubFeed(clubId: string, limit = 20): Promise<ClubPost[]> {
  return (await clubsCall<{ posts: ClubPost[] }>(`${clubId}/feed?limit=${limit}`)).posts;
}

/** Settings of several clubs (only those that changed any), for lists. */
export async function getClubSettings(
  clubIds: readonly string[]
): Promise<Record<string, ClubSettings>> {
  if (clubIds.length === 0) return {};
  return (
    await clubsCall<{ settings: Record<string, ClubSettings> }>(`settings?ids=${clubIds.join(',')}`)
  ).settings;
}

export async function getNotifyLevel(clubId: string, member: `0x${string}`): Promise<NotifyLevel> {
  return (await clubsCall<{ level: NotifyLevel }>(`${clubId}/notify/${member}`)).level;
}
