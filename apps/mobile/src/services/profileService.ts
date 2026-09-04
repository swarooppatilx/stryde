import { getAccessToken } from '@privy-io/expo';

import type { IProfileService } from '../types/services';

const PRIVY_BASE_URL = 'https://auth.privy.io/api/v1';

export interface PrivyMetadata {
  username?: string;
}

type TokenProvider = () => Promise<string | null>;

class ProfileService implements IProfileService {
  constructor(private readonly getAuthToken: TokenProvider) {}

  async fetchMetadata(userId: string): Promise<PrivyMetadata | null> {
    try {
      const token = await this.getAuthToken();
      if (!token) return null;

      const res = await fetch(`${PRIVY_BASE_URL}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return null;

      const data = await res.json();
      return data?.user?.custom_metadata ?? null;
    } catch (error) {
      console.error('[ProfileService] fetchMetadata failed', error);
      return null;
    }
  }

  async updateMetadata(userId: string, metadata: PrivyMetadata): Promise<boolean> {
    try {
      const token = await this.getAuthToken();
      if (!token) return false;

      const res = await fetch(`${PRIVY_BASE_URL}/users/${userId}/custom_metadata`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ custom_metadata: metadata }),
      });

      return res.ok;
    } catch (error) {
      console.error('[ProfileService] updateMetadata failed', error);
      return false;
    }
  }
}

export const profileService: IProfileService = new ProfileService(getAccessToken);

export const fetchPrivyMetadata = profileService.fetchMetadata.bind(profileService);
export const updatePrivyMetadata = profileService.updateMetadata.bind(profileService);
