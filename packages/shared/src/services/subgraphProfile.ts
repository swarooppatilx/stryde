import { getActiveConfig } from './client';
import { indexCall } from './indexApi';
import { paginate } from './subgraphPaginate';

interface ProfileAvatarEntity {
  id: string;
  avatarCid: string | null;
}

interface ProfileEntity {
  id: string;
  username: string;
  isVerified: boolean;
}

/** Returns null (rather than throwing) when no subgraph is configured for the
 * active chain mode, so callers can fall back to the getLogs-based scan
 * without treating "not deployed here" as an error. */
export async function getProfileAvatarsFromSubgraph(): Promise<Map<string, string> | null> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) {
    const answer = await indexCall<{
      profiles: { wallet: string; avatarCid: string | null }[];
    }>('profiles');
    if (!answer) return null;
    return new Map(
      answer.profiles
        .filter((profile) => profile.avatarCid)
        .map((profile) => [profile.wallet.toLowerCase(), profile.avatarCid as string])
    );
  }

  const profiles = await paginate<ProfileAvatarEntity>({
    url: subgraphUrl,
    collection: 'profiles',
    idType: 'Bytes',
    selection: 'id avatarCid',
    where: 'avatarCid_not: null',
  });

  const byWallet = new Map<string, string>();
  for (const profile of profiles) {
    if (profile.avatarCid) {
      byWallet.set(profile.id.toLowerCase(), profile.avatarCid);
    }
  }
  return byWallet;
}

/** Returns null (rather than throwing) when no subgraph is configured for the
 * active chain mode, so callers can fall back to the getLogs-based sync path
 * without treating "not deployed here" as an error. */
export async function getProfilesFromSubgraph(): Promise<
  { wallet: string; username: string; isVerified: boolean }[] | null
> {
  const { subgraphUrl } = getActiveConfig();
  if (!subgraphUrl) {
    const answer = await indexCall<{
      profiles: { wallet: string; username: string; isVerified: boolean }[];
    }>('profiles');
    return answer?.profiles ?? null;
  }

  const profiles = await paginate<ProfileEntity>({
    url: subgraphUrl,
    collection: 'profiles',
    idType: 'Bytes',
    selection: 'id username isVerified',
  });

  return profiles.map((p) => ({
    wallet: p.id,
    username: p.username,
    isVerified: p.isVerified,
  }));
}
