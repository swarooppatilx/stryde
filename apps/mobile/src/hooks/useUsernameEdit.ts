import { useRef, useState } from 'react';
import { getOutbox } from '@/backends/outbox/appOutbox';
import { useAuth } from '@/hooks/useAuth';
import { useShake } from '@/hooks/useShake';
import {
  SET_USERNAME,
  type SetUsernameIntent,
  SYNC_PRIVY_USERNAME,
} from '@/services/profileIntents';
import { requestRename } from '@/services/requestRename';
import { useProfileStore } from '@/stores/profileStore';
import { Alert } from '@/utils/alert';
import { validateUsername } from '@/utils/username';

const USERNAME_KEY = 'profile:username';

/** The profile's inline username editor: the new name shows at once and is delivered by the outbox. */
export function useUsernameEdit() {
  const { user } = useAuth();
  const username = useProfileStore((s) => s.username);
  const setUsername = useProfileStore((s) => s.setUsername);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const { style: shakeStyle, shake } = useShake();
  const refused = useRef<string | null>(null);

  const start = () => {
    refused.current = null;
    setDraft(username);
    setIsEditing(true);
  };

  const rename = async () => {
    const check = validateUsername(draft);
    if (!check.ok) {
      // An empty box just cancels the edit; anything else is told why it's not allowed and kept to fix.
      if (draft.trim().length === 0) {
        setIsEditing(false);
        return;
      }
      // The alert blurs the field, which saves again: say it once per draft.
      if (refused.current === draft) return;
      refused.current = draft;
      shake();
      Alert.alert('Username', check.error);
      return;
    }
    setIsEditing(false);
    const outbox = getOutbox();
    const result = await requestRename(
      {
        showLocally: setUsername,
        unsentPrevious: () => {
          const waiting = outbox.entries().find((entry) => entry.key === USERNAME_KEY);
          return (waiting?.payload as SetUsernameIntent | undefined)?.previous;
        },
        queue: async (intent) => {
          await outbox.enqueue({ kind: SET_USERNAME, key: USERNAME_KEY, payload: intent });
          if (user?.kind === 'privy') {
            await outbox.enqueue({
              kind: SYNC_PRIVY_USERNAME,
              key: `privy:username:${user.id}`,
              payload: { userId: user.id, username: intent.username },
            });
          }
          void outbox.drain();
        },
      },
      username,
      check.username
    );
    if (!result.ok) {
      shake();
      Alert.alert('Username', result.error);
    }
  };

  // Pressing "done" fires submit and then blur: only the first may rename.
  const renaming = useRef(false);
  const save = async () => {
    if (renaming.current) return;
    renaming.current = true;
    try {
      await rename();
    } finally {
      renaming.current = false;
    }
  };

  const editDraft = (text: string) => {
    refused.current = null;
    setDraft(text);
  };

  return { isEditing, draft, setDraft: editDraft, start, save, shakeStyle };
}
