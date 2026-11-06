import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/button';
import { Card } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ENV } from '@/constants/config';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useViemWallet } from '@/hooks/useViemWallet';
import {
  type Approval,
  cancelApproval,
  getApproval,
  getHumanStatus,
  type HumanAction,
  type HumanStatus,
  isTerminal,
  listApprovals,
  openInWorldApp,
  requestHumanApproval,
  revokeAgent,
} from '@/services/humanPassService';
import { useWorldVerificationStore } from '@/stores/worldVerificationStore';
import { Alert } from '@/utils/alert';
import { Toast } from '@/utils/toast';

const REFRESH_MS = 5_000;

function mcpConfig(token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        'stryde-coach': {
          command: 'npx',
          args: ['-y', 'tsx', '<path-to-stryde>/packages/mcp/src/index.ts'],
          env: { STRYDE_API_URL: ENV.API_URL, STRYDE_AGENT_TOKEN: token },
        },
      },
    },
    null,
    2
  );
}

function LadderStep({ done, title, caption }: { done: boolean; title: string; caption: string }) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.ladderRow}>
      <Ionicons
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={done ? Brand.verified : theme.textSecondary}
      />
      <ThemedView style={styles.flex}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {caption}
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

export default function CoachScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { address } = useViemWallet();
  const selfieVerified = useWorldVerificationStore((s) => s.isVerified);
  const [status, setStatus] = useState<HumanStatus | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [active, setActive] = useState<Approval | null>(null);
  const [busy, setBusy] = useState<HumanAction | null>(null);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) return;
    try {
      const [nextStatus, list] = await Promise.all([
        getHumanStatus(address),
        listApprovals(address),
      ]);
      // Reading an approval advances it, so an agent request approved in World
      // App completes even if the agent has stopped polling.
      const advanced = await Promise.all(
        list.approvals.map((a) =>
          a.initiator === 'agent' && !isTerminal(a.status)
            ? getApproval(a.id, address).catch(() => a)
            : Promise.resolve(a)
        )
      );
      setStatus(nextStatus);
      setApprovals(advanced);
      setLoadError(null);
    } catch (error) {
      setLoadError((error as Error).message);
    }
  }, [address]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      const timer = setInterval(refresh, REFRESH_MS);
      return () => clearInterval(timer);
    }, [refresh])
  );

  const run = async (action: HumanAction, params: Record<string, unknown> = {}) => {
    if (!address) return;
    setBusy(action);
    try {
      const result = await requestHumanApproval(address, action, params, setActive);
      if (result.status === 'completed') {
        Toast.success('Approved with World ID', 2);
        const token = result.result?.token;
        if (action === 'issue_agent_token' && typeof token === 'string') setIssuedToken(token);
      } else {
        Alert.alert('Not approved', result.error ?? `The request was ${result.status}.`);
      }
    } catch (error) {
      Alert.alert('World ID', (error as Error).message);
    } finally {
      setBusy(null);
      setActive(null);
      void refresh();
    }
  };

  const decline = async (approval: Approval) => {
    if (!address) return;
    await cancelApproval(approval.id, address).catch(() => undefined);
    void refresh();
  };

  const revoke = (grantId: string, label: string) => {
    if (!address) return;
    Alert.alert('Disconnect agent?', `${label} will lose access immediately.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await revokeAgent(grantId, address).catch(() => undefined);
          void refresh();
        },
      },
    ]);
  };

  const agentRequests = approvals.filter((a) => a.initiator === 'agent' && !isTerminal(a.status));
  const recentAgentResults = approvals
    .filter((a) => a.initiator === 'agent' && isTerminal(a.status))
    .slice(0, 3);
  const grants = status?.agentGrants.filter((g) => !g.revokedAt) ?? [];

  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.flex}>
        <ScreenHeader title="Stryde Coach" />
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await refresh();
                setRefreshing(false);
              }}
            />
          }
        >
          {status?.banned && (
            <Card style={{ ...styles.card, borderWidth: 1, borderColor: theme.brand.danger }}>
              <ThemedText type="sectionTitle" style={{ color: theme.brand.danger }}>
                Account suspended
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {status.banReason ?? 'This human is suspended.'} The suspension follows your World
                ID, so new accounts are blocked too.
              </ThemedText>
            </Card>
          )}

          {loadError && (
            <Card style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                Can't reach the Stryde API ({loadError}). Check EXPO_PUBLIC_API_URL.
              </ThemedText>
            </Card>
          )}

          {status && !status.configured && (
            <Card style={{ ...styles.card, borderWidth: 1, borderColor: theme.brand.warning }}>
              <ThemedText type="sectionTitle">World ID Agent Pass not configured</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Set WORLD_OIDC_CLIENT_ID / WORLD_OIDC_CLIENT_SECRET on the API, or
                WORLD_OIDC_MOCK=true for a local demo.
              </ThemedText>
            </Card>
          )}

          <Card style={styles.card}>
            <ThemedText type="sectionTitle">Your human credentials</ThemedText>
            <LadderStep
              done={selfieVerified}
              title="Selfie Check"
              caption="Verified badge, territory claims, onchain ProfileRegistry."
            />
            <LadderStep
              done={Boolean(status?.linked)}
              title="World ID linked"
              caption="One human, one Stryde account. Ranked segments, recovery and bans follow you."
            />
            <LadderStep
              done={grants.length > 0}
              title="AI Coach connected"
              caption="Your agent can read your training; value-moving actions still need your World ID."
            />
            {status?.mode === 'mock' && (
              <ThemedText type="caption" themeColor="textSecondary">
                Demo mode: approvals open a local mock of World App.
              </ThemedText>
            )}
            {!selfieVerified && (
              <AppButton variant="secondary" onPress={() => router.push('/verify')}>
                Do Selfie Check
              </AppButton>
            )}
          </Card>

          {active && !isTerminal(active.status) && (
            <Card style={{ ...styles.card, borderWidth: 1, borderColor: theme.brand.primary }}>
              <ThemedText type="sectionTitle">Waiting for World App</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {active.actionLabel}. Approve with a fresh World ID check, then come back.
              </ThemedText>
              <ThemedText type="sectionTitle" style={styles.code}>
                {active.userCode}
              </ThemedText>
              <AppButton variant="secondary" onPress={() => openInWorldApp(active)}>
                Open World App again
              </AppButton>
            </Card>
          )}

          {status && !status.linked && !status.banned && (
            <Card style={styles.card}>
              <ThemedText type="sectionTitle">Link your World ID</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Proves a unique human owns this account. Required for ranked segment leaderboards
                and your AI coach.
              </ThemedText>
              <AppButton
                onPress={() => run('link_human')}
                loading={busy === 'link_human'}
                disabled={busy !== null}
                icon={<Ionicons name="finger-print" size={18} color={Brand.white} />}
              >
                Link World ID
              </AppButton>
              <TouchableOpacity onPress={() => run('recover_account')} disabled={busy !== null}>
                <ThemedText type="small" style={styles.link}>
                  {busy === 'recover_account'
                    ? 'Recovering…'
                    : 'New phone? Recover your Stryde account with World ID'}
                </ThemedText>
              </TouchableOpacity>
            </Card>
          )}

          {status?.linked && !status.banned && (
            <Card style={styles.card}>
              <ThemedText type="sectionTitle">AI Coach (MCP)</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Connect Claude, Cursor or any MCP agent. It can read your profile, segments and
                efforts. Claiming rewards always comes back here for your World ID approval.
              </ThemedText>

              {issuedToken ? (
                <ThemedView
                  style={[styles.tokenBox, { backgroundColor: theme.backgroundSelected }]}
                >
                  <ThemedText type="caption" themeColor="textSecondary">
                    Shown once. Paste this into your agent's MCP config:
                  </ThemedText>
                  <ThemedText type="code" selectable numberOfLines={12}>
                    {mcpConfig(issuedToken)}
                  </ThemedText>
                  <AppButton
                    size="small"
                    variant="secondary"
                    onPress={async () => {
                      await Clipboard.setStringAsync(mcpConfig(issuedToken));
                      Toast.success('MCP config copied', 1.5);
                    }}
                  >
                    Copy MCP config
                  </AppButton>
                </ThemedView>
              ) : (
                <AppButton
                  onPress={() => run('issue_agent_token', { label: 'Stryde Coach' })}
                  loading={busy === 'issue_agent_token'}
                  disabled={busy !== null}
                  icon={<Ionicons name="sparkles" size={18} color={Brand.white} />}
                >
                  Connect an AI agent
                </AppButton>
              )}

              {grants.map((grant) => (
                <ThemedView key={grant.id} style={styles.ladderRow}>
                  <Ionicons name="hardware-chip-outline" size={18} color={theme.brand.primary} />
                  <ThemedView style={styles.flex}>
                    <ThemedText type="smallBold">{grant.label}</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      Connected {new Date(grant.createdAt).toLocaleDateString()}
                    </ThemedText>
                  </ThemedView>
                  <TouchableOpacity onPress={() => revoke(grant.id, grant.label)} hitSlop={8}>
                    <ThemedText type="small" style={{ color: theme.brand.danger }}>
                      Disconnect
                    </ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              ))}
            </Card>
          )}

          {agentRequests.length > 0 && (
            <Card style={{ ...styles.card, borderWidth: 1, borderColor: theme.brand.primary }}>
              <ThemedText type="sectionTitle">Your agent is asking</ThemedText>
              {agentRequests.map((approval) => (
                <ThemedView key={approval.id} style={styles.request}>
                  <ThemedText type="smallBold">{approval.actionLabel}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {Object.entries(approval.params)
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(' · ')}
                  </ThemedText>
                  <View style={styles.requestActions}>
                    <AppButton
                      size="small"
                      fullWidth={false}
                      onPress={() => openInWorldApp(approval)}
                    >
                      Approve in World App
                    </AppButton>
                    <AppButton
                      size="small"
                      variant="ghost"
                      fullWidth={false}
                      onPress={() => decline(approval)}
                    >
                      Decline
                    </AppButton>
                  </View>
                </ThemedView>
              ))}
            </Card>
          )}

          {recentAgentResults.length > 0 && (
            <Card style={styles.card}>
              <ThemedText type="sectionTitle">Recent agent requests</ThemedText>
              {recentAgentResults.map((approval) => (
                <ThemedView key={approval.id} style={styles.ladderRow}>
                  <Ionicons
                    name={approval.status === 'completed' ? 'checkmark-circle' : 'close-circle'}
                    size={18}
                    color={
                      approval.status === 'completed' ? theme.brand.success : theme.brand.danger
                    }
                  />
                  <ThemedView style={styles.flex}>
                    <ThemedText type="small">{approval.actionLabel}</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {approval.status}
                      {approval.error ? ` · ${approval.error}` : ''}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              ))}
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  card: { gap: Spacing.three },
  ladderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  code: {
    textAlign: 'center',
    letterSpacing: 4,
  },
  link: {
    textAlign: 'center',
    color: Brand.primary,
  },
  tokenBox: {
    borderRadius: BorderRadius.md,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  request: { gap: Spacing.one },
  requestActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
});
