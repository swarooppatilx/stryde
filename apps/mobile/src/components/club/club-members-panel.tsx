import { Ionicons } from '@expo/vector-icons';
import type { ClubState } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { sendClubChange } from '@/backends/clubIntents';
import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import { AppButton } from '@/components/button';
import { ListMessage } from '@/components/list-message';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { UserAvatar } from '@/components/user-avatar';
import { BorderRadius, Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useUserResolver } from '@/hooks/useSocialUser';
import { useSocialStore } from '@/stores/socialStore';
import { Alert } from '@/utils/alert';
import { getDisplayName } from '@/utils/format';

interface ClubMembersPanelProps {
  clubId: string;
  /** Members from the chain (or the Sandbox seed); null while loading. */
  members: readonly string[] | null;
  state: ClubState | null;
  me: string;
  isOwner: boolean;
  isAdmin: boolean;
  /** Hands the club to another member (an on-chain transaction). */
  onTransferOwnership(member: string): void;
}

/** Everyone in the club, sorted into owner, admins, people you follow and the rest, with admin tools. */
export function ClubMembersPanel(props: ClubMembersPanelProps) {
  const { clubId, members, state, me, isOwner, isAdmin } = props;
  const theme = useTheme();
  const router = useRouter();
  const resolve = useUserResolver();
  const following = useSocialStore((s) => s.following);
  const [query, setQuery] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const owner = state?.owner?.toLowerCase() ?? '';
  const admins = new Set((state?.admins ?? []).map((a) => a.toLowerCase()));
  const removed = new Set((state?.removed ?? []).map((a) => a.toLowerCase()));
  const pending = (state?.requests ?? []).filter((r) => r.status === 'pending');
  const followed = useMemo(() => new Set([...following].map((f) => f.toLowerCase())), [following]);

  const nameOf = (id: string) => {
    const user = resolve(id);
    return user ? getDisplayName(user) : `${id.slice(0, 6)}…${id.slice(-4)}`;
  };
  const visible = (members ?? [])
    .map((m) => m.toLowerCase())
    .filter((m) => !removed.has(m))
    .filter((m) => !query.trim() || nameOf(m).toLowerCase().includes(query.trim().toLowerCase()));
  const sections = [
    { title: 'Owner', ids: visible.filter((m) => m === owner) },
    { title: 'Admins', ids: visible.filter((m) => m !== owner && admins.has(m)) },
    {
      title: 'Members you follow',
      ids: visible.filter((m) => m !== owner && !admins.has(m) && followed.has(m)),
    },
    {
      title: 'Members',
      ids: visible.filter((m) => m !== owner && !admins.has(m) && !followed.has(m)),
    },
  ].filter((s) => s.ids.length > 0);

  const actionsFor = (member: string): SheetAction[] => {
    const actions: SheetAction[] = [
      {
        label: 'View profile',
        icon: 'person-outline',
        onPress: () => router.push(`/athletes/${member}`),
      },
    ];
    if (member === me || member === owner) return actions;
    if (isOwner) {
      actions.push(
        admins.has(member)
          ? {
              label: 'Remove admin',
              icon: 'shield-outline',
              onPress: () =>
                void sendClubChange({
                  clubId,
                  action: 'set-role',
                  target: member,
                  data: { role: 'member' },
                }),
            }
          : {
              label: 'Make admin',
              icon: 'shield-checkmark-outline',
              onPress: () =>
                void sendClubChange({
                  clubId,
                  action: 'set-role',
                  target: member,
                  data: { role: 'admin' },
                }),
            },
        {
          label: 'Transfer ownership',
          icon: 'swap-horizontal-outline',
          onPress: () =>
            Alert.alert(
              `Make ${nameOf(member)} the owner?`,
              'You will no longer own this club or control its treasury.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Transfer',
                  style: 'destructive',
                  onPress: () => props.onTransferOwnership(member),
                },
              ]
            ),
        }
      );
    }
    if (isAdmin && (isOwner || !admins.has(member))) {
      actions.push({
        label: 'Remove from club',
        icon: 'person-remove-outline',
        destructive: true,
        onPress: () =>
          Alert.alert(
            `Remove ${nameOf(member)}?`,
            'They will no longer see posts or appear in the club.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () =>
                  void sendClubChange({
                    clubId,
                    action: 'remove-member',
                    target: member,
                    data: { removed: true },
                  }),
              },
            ]
          ),
      });
    }
    return actions;
  };

  if (!members) return <ActivityIndicator color={theme.brand.primary} />;

  return (
    <View style={styles.container}>
      {isAdmin && pending.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="eyebrow" themeColor="textSecondary">
            Requests to join · {pending.length}
          </ThemedText>
          {pending.map((r) => (
            <View key={r.member} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
              <UserAvatar uri={resolve(r.member)?.avatar} name={nameOf(r.member)} size="sm" />
              <ThemedText type="small" numberOfLines={1} style={styles.name}>
                {nameOf(r.member)}
              </ThemedText>
              <AppButton
                size="small"
                variant="secondary"
                fullWidth={false}
                onPress={() =>
                  void sendClubChange({
                    clubId,
                    action: 'decide',
                    target: r.member,
                    data: { approve: false },
                  })
                }
              >
                Decline
              </AppButton>
              <AppButton
                size="small"
                fullWidth={false}
                onPress={() =>
                  void sendClubChange({
                    clubId,
                    action: 'decide',
                    target: r.member,
                    data: { approve: true },
                  })
                }
              >
                Accept
              </AppButton>
            </View>
          ))}
        </View>
      )}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search members"
        placeholderTextColor={theme.placeholder}
        style={[
          styles.search,
          {
            color: theme.text,
            borderColor: theme.border,
            backgroundColor: theme.backgroundElement,
          },
        ]}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {sections.length === 0 ? (
        <ListMessage icon="people-outline" text={query ? 'No members match.' : 'No members yet.'} />
      ) : (
        sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <ThemedText type="eyebrow" themeColor="textSecondary">
              {section.title} · {section.ids.length}
            </ThemedText>
            {section.ids.map((id) => (
              <Tappable
                key={id}
                onPress={() => setMenuFor(id)}
                style={[styles.row, { backgroundColor: theme.backgroundElement }]}
                accessibilityRole="button"
                accessibilityLabel={`${nameOf(id)}, options`}
              >
                <UserAvatar uri={resolve(id)?.avatar} name={nameOf(id)} size="sm" />
                <ThemedText type="small" numberOfLines={1} style={styles.name}>
                  {nameOf(id)}
                  {id === me ? ' (you)' : ''}
                </ThemedText>
                {id === owner || admins.has(id) ? (
                  <View style={[styles.tag, { backgroundColor: theme.brand.primaryTint }]}>
                    <ThemedText type="caption" style={{ color: theme.brand.primary }}>
                      {id === owner ? 'Owner' : 'Admin'}
                    </ThemedText>
                  </View>
                ) : null}
                <Ionicons name="ellipsis-horizontal" size={16} color={theme.textSecondary} />
              </Tappable>
            ))}
          </View>
        ))
      )}

      <ActionSheet
        visible={menuFor !== null}
        title={menuFor ? nameOf(menuFor) : ''}
        actions={menuFor ? actionsFor(menuFor) : []}
        onClose={() => setMenuFor(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  section: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
  name: { flex: 1 },
  tag: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: BorderRadius.full },
  search: {
    ...textStyle(TypeScale.body),
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
  },
});
