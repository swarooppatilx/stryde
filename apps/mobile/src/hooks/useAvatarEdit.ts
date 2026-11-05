import { getOutbox } from '@/backends/outbox/appOutbox';
import { getPlatform } from '@/platform';
import { SET_AVATAR } from '@/services/profileIntents';
import { requestAvatar } from '@/services/requestAvatar';
import { useProfileStore } from '@/stores/profileStore';
import { Alert } from '@/utils/alert';
import { Toast } from '@/utils/toast';
import { useOutboxEntries } from './useOutbox';

const AVATAR_KEY = 'profile:avatar';

function avatarStatus(entry: { status: string; attempts: number }): string {
  if (entry.status === 'failed') return "Couldn't save your photo. It's only on this device.";
  if (entry.attempts > 0) return 'Still saving your photo…';
  return 'Saving your photo…';
}

/** Profile photo editor: a new photo shows at once and the outbox uploads it; `status` is null when nothing is waiting. */
export function useAvatarEdit() {
  const avatar = useProfileStore((s) => s.avatar);
  const entry = useOutboxEntries().find((e) => e.key === AVATAR_KEY);

  const status = entry ? avatarStatus(entry) : null;

  const pick = async () => {
    const outbox = getOutbox();
    const profile = useProfileStore.getState();
    const result = await requestAvatar({
      pick: (options) => getPlatform().photos.pick(options),
      showLocally: profile.setAvatar,
      forgetPublished: () => profile.setAvatarCid(''),
      queue: async (intent) => {
        await outbox.enqueue({ kind: SET_AVATAR, key: AVATAR_KEY, payload: intent });
        void outbox.drain();
      },
    });
    if (result === 'denied') Toast.fail('Allow photo access in Settings to choose a photo', 2);
    if (result === 'failed') Toast.fail('Could not open photo library', 1);
  };

  const onPress = () => {
    if (!avatar) {
      void pick();
      return;
    }
    Alert.alert('Profile photo', undefined, [
      { text: 'Change Photo', onPress: () => void pick() },
      {
        text: 'Remove Photo',
        style: 'destructive',
        onPress: () => {
          const profile = useProfileStore.getState();
          profile.setAvatar('');
          profile.setAvatarCid('');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return { status, onPress };
}
