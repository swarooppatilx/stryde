import { Input, List, SwipeAction, Toast } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePrivy } from '@privy-io/expo';
import { services } from '@repo/shared';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { type ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatEther, formatUnits } from 'viem';

import { AchievementBadge } from '@/components/achievement-badge';
import { Card } from '@/components/card';
import { ListIcon } from '@/components/list-icon';
import {
  AnimatedScrollView,
  HeaderComponentWrapper,
  HeaderNavBar,
} from '@/components/parallax-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SPORT_ICONS } from '@/constants/activity';
import { ENV, getCurrentUserId } from '@/constants/config';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnitSystem } from '@/hooks/use-unit-system';
import { useEnsName } from '@/hooks/useEnsName';
import { useViemWallet } from '@/hooks/useViemWallet';
import { ipfsToHttpUrl, uploadImageToIpfs } from '@/services/ipfsService';
import { updatePrivyMetadata } from '@/services/profileService';
import { territoryService } from '@/services/territoryService';
import { useActivityStore } from '@/stores/activityStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSocialStore } from '@/stores/socialStore';
import { useTerritoryStore } from '@/stores/territoryStore';
import { computeAchievements } from '@/utils/achievements';
import {
  formatArea,
  formatDistance,
  formatDuration,
  formatPace,
  getSportStats,
  getWeeklyStats,
} from '@/utils/format';
import { computePersonalRecords, computeStreak } from '@/utils/profile';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TABS = ['Progress', 'Activities', 'More'] as const;
type TabKey = (typeof TABS)[number];

export default function ProfileScreen() {
  const { logout, user } = usePrivy();
  const router = useRouter();
  const theme = useTheme();
  const unitSystem = useUnitSystem();
  const username = useProfileStore((s) => s.username);
  const avatar = useProfileStore((s) => s.avatar);
  const avatarCid = useProfileStore((s) => s.avatarCid);
  const headerImage = useProfileStore((s) => s.headerImage);
  const createdAt = useProfileStore((s) => s.createdAt);
  const weeklyGoalDistance = useProfileStore((s) => s.settings.weeklyGoalDistance);
  const weeklyGoalActivities = useProfileStore((s) => s.settings.weeklyGoalActivities);
  const weeklyGoalTime = useProfileStore((s) => s.settings.weeklyGoalTime);
  const resetProfile = useProfileStore((s) => s.reset);
  const setAvatar = useProfileStore((s) => s.setAvatar);
  const setAvatarCid = useProfileStore((s) => s.setAvatarCid);
  const setHeaderImage = useProfileStore((s) => s.setHeaderImage);
  const setHeaderImageCid = useProfileStore((s) => s.setHeaderImageCid);
  const setUsername = useProfileStore((s) => s.setUsername);
  const activities = useActivityStore((s) => s.activities);
  const deleteActivity = useActivityStore((s) => s.deleteActivity);
  const getTotalArea = useTerritoryStore((s) => s.getTotalArea);
  const getUserPolygons = useTerritoryStore((s) => s.getUserPolygons);
  // getTotalArea/getUserPolygons read live store state via `get()` rather
  // than their arguments, so subscribing to their stable function
  // references alone never triggers a re-render when the underlying data
  // changes. On a fresh install, territoryMetadata starts empty and is
  // populated asynchronously by useChainSync once syncTerritoriesFromChain
  // resolves — subscribing to the raw state here (cheaply recomputed inline,
  // no memoization needed) is what makes totalTerritoryArea/userPolygons
  // pick that up instead of staying frozen at their initial values, which
  // would otherwise leave achievements/NFT-mint logic never seeing the
  // user's on-chain territory.
  useTerritoryStore((s) => s.polygons);
  useTerritoryStore((s) => s.territoryMetadata);
  const totalTerritoryArea = getTotalArea(getCurrentUserId());
  const userPolygons = getUserPolygons(getCurrentUserId());
  const { wallet, address } = useViemWallet(ENV.CHAIN_MODE);

  const [activeTab, setActiveTab] = useState<TabKey>('Progress');
  const [avatarUploadStatus, setAvatarUploadStatus] = useState<string | null>(null);
  const [headerUploading, setHeaderUploading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [mintedAchievementIds, setMintedAchievementIds] = useState<Set<string>>(new Set());
  const [mintedTerritoryIds, setMintedTerritoryIds] = useState<Set<string>>(new Set());
  const [balanceWei, setBalanceWei] = useState<bigint | null>(null);
  const [strdBalanceWei, setStrdBalanceWei] = useState<bigint | null>(null);

  // The on-chain identity address (from useViemWallet), not the Privy embedded
  // auth wallet — in local dev mode these differ (see AGENTS.md).
  const walletAddress = address;
  const ensName = useEnsName(walletAddress);

  useFocusEffect(
    useCallback(() => {
      if (!walletAddress) return;
      let cancelled = false;
      services.client
        .getBalance(walletAddress)
        .then((wei) => {
          if (!cancelled) setBalanceWei(wei);
        })
        .catch(() => {
          if (!cancelled) setBalanceWei(null);
        });
      return () => {
        cancelled = true;
      };
    }, [walletAddress])
  );

  useFocusEffect(
    useCallback(() => {
      if (!walletAddress) return;
      let cancelled = false;
      services.moveToEarnToken
        .getTokenBalance(walletAddress)
        .then((wei) => {
          if (!cancelled) setStrdBalanceWei(wei);
        })
        .catch(() => {
          if (!cancelled) setStrdBalanceWei(null);
        });
      return () => {
        cancelled = true;
      };
    }, [walletAddress])
  );

  const totalDistance = useMemo(
    () => activities.reduce((sum, a) => sum + a.distance, 0),
    [activities]
  );
  const totalDuration = useMemo(
    () => activities.reduce((sum, a) => sum + a.duration, 0),
    [activities]
  );

  const weeklyStats = useMemo(() => getWeeklyStats(activities), [activities]);
  const sportStats = useMemo(() => getSportStats(activities), [activities]);
  const achievements = useMemo(
    () => computeAchievements(activities, totalTerritoryArea),
    [activities, totalTerritoryArea]
  );
  const unlockedAchievements = useMemo(
    () => achievements.filter((a) => a.unlocked),
    [achievements]
  );
  const streak = useMemo(() => computeStreak(activities), [activities]);
  const records = useMemo(() => computePersonalRecords(activities), [activities]);

  // Mint any newly-unlocked achievement as a soulbound badge. Best-effort: minting is
  // role-gated on-chain and only succeeds today in local dev (shared owner/minter account).
  useEffect(() => {
    if (!wallet || !address || unlockedAchievements.length === 0) return;
    const activeWallet = wallet;
    const activeAddress = address;
    let cancelled = false;

    async function syncMintedBadges() {
      const unlockedIds = unlockedAchievements.map((a) => a.id);
      let minted: Set<string>;
      try {
        minted = await services.achievement.getMintedAchievementIds(activeAddress, unlockedIds);
      } catch {
        return;
      }
      if (cancelled) return;
      setMintedAchievementIds(minted);

      for (const a of unlockedAchievements) {
        if (minted.has(a.id) || cancelled) continue;
        try {
          await services.achievement.mintAchievement(activeWallet, a.id, a.title);
          if (!cancelled) setMintedAchievementIds((prev) => new Set(prev).add(a.id));
        } catch (err) {
          console.warn('[Profile] Achievement mint failed', a.id, err);
        }
      }
    }

    syncMintedBadges();
    return () => {
      cancelled = true;
    };
  }, [wallet, address, unlockedAchievements]);

  // Redundant safety-net auto-mint for territory NFTs — the primary mint already
  // happens right after capture in create-activity.tsx; this just catches any that
  // failed there. Same best-effort/local-dev-only caveat as achievement minting.
  useEffect(() => {
    if (!wallet || !address || userPolygons.length === 0) return;
    const activeWallet = wallet;
    const activeAddress = address;
    let cancelled = false;

    async function syncTerritoryNFTs() {
      const hashes = userPolygons.map((polygon) => services.territory.computePolygonHash(polygon));
      let minted: Set<`0x${string}`>;
      try {
        minted = await services.territoryNFT.getMintedTerritoryIds(hashes);
      } catch {
        return;
      }
      if (cancelled) return;
      setMintedTerritoryIds(new Set(minted));

      for (const hash of hashes) {
        if (minted.has(hash) || cancelled) continue;
        try {
          await services.territoryNFT.mintTerritoryNFT(activeWallet, hash, activeAddress);
          if (!cancelled) setMintedTerritoryIds((prev) => new Set(prev).add(hash));
        } catch (err) {
          console.warn('[Profile] Territory NFT mint failed', hash, err);
        }
      }
    }

    syncTerritoryNFTs();
    return () => {
      cancelled = true;
    };
  }, [wallet, address, userPolygons]);

  const firstName = useProfileStore((s) => s.firstName);
  const lastName = useProfileStore((s) => s.lastName);

  const displayName = firstName || username || 'Unknown';
  const initials = firstName
    ? (lastName ? `${firstName[0]}${lastName[0]}` : firstName.slice(0, 2)).toUpperCase()
    : username
      ? username.slice(0, 2).toUpperCase()
      : '??';

  const memberSince = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            resetProfile();
            useActivityStore.getState().reset();
            useTerritoryStore.getState().reset();
            useSocialStore.getState().reset();
            router.replace('/login');
          } catch (error) {
            console.error('[Profile] Logout failed', error);
            Alert.alert('Log out failed', 'Please try again.');
          }
        },
      },
    ]);
  };

  const copyAddress = async () => {
    if (!walletAddress) return;
    try {
      await Clipboard.setStringAsync(walletAddress);
      Toast.success('Address copied', 1);
    } catch (error) {
      console.error('[Profile] Copy address failed', error);
      Toast.fail('Could not copy address', 1);
    }
  };

  const handlePickImage = async () => {
    if (avatarUploadStatus) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const localUri = result.assets[0].uri;
        setAvatarUploadStatus('Uploading profile photo…');
        setAvatarCid('');
        setAvatar(localUri);

        try {
          const usernameForName = username || 'user';
          const { cid } = await uploadImageToIpfs(`avatar-${usernameForName}`, localUri);
          setAvatarCid(cid);
          setAvatar(ipfsToHttpUrl(cid));

          if (wallet) {
            setAvatarUploadStatus('Saving profile photo…');
            try {
              await services.profile.setAvatar(wallet, cid);
            } catch (chainError) {
              console.warn('[Profile] Publishing avatar on-chain failed', chainError);
              Toast.info('Photo uploaded, but profile sync failed. Try again later.', 4);
              return;
            }
          }
          Toast.success('Profile photo uploaded', 2);
        } catch (ipfsError) {
          console.warn('[Profile] IPFS upload failed, keeping local avatar', ipfsError);
          Toast.fail(
            'Upload failed. Photo is only on this device. Tap the camera to try again.',
            5
          );
        } finally {
          setAvatarUploadStatus(null);
        }
      }
    } catch (error) {
      console.error('[Profile] Image picker failed', error);
      Toast.fail('Could not open photo library', 1);
    }
  };

  const handleAvatarPress = () => {
    if (avatarUploadStatus) return;
    if (!avatar) {
      handlePickImage();
      return;
    }
    Alert.alert('Profile Photo', undefined, [
      { text: 'Change Photo', onPress: handlePickImage },
      {
        text: 'Remove Photo',
        style: 'destructive',
        onPress: () => {
          setAvatar('');
          setAvatarCid('');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handlePickHeaderImage = async () => {
    if (headerUploading) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const localUri = result.assets[0].uri;
        setHeaderUploading(true);
        setHeaderImageCid('');
        setHeaderImage(localUri);

        try {
          const usernameForName = username || 'user';
          const { cid } = await uploadImageToIpfs(`header-${usernameForName}`, localUri);
          setHeaderImageCid(cid);
          setHeaderImage(ipfsToHttpUrl(cid));
          Toast.success('Header photo uploaded', 2);
        } catch (ipfsError) {
          console.warn('[Profile] Header image IPFS upload failed, keeping local copy', ipfsError);
          Toast.fail(
            'Upload failed. Photo is only on this device. Tap the camera to try again.',
            5
          );
        } finally {
          setHeaderUploading(false);
        }
      }
    } catch (error) {
      console.error('[Profile] Header image picker failed', error);
      Toast.fail('Could not open photo library', 1);
    }
  };

  const handleHeaderImagePress = () => {
    if (headerUploading) return;
    if (!headerImage) {
      handlePickHeaderImage();
      return;
    }
    Alert.alert('Header Photo', undefined, [
      { text: 'Change Photo', onPress: handlePickHeaderImage },
      {
        text: 'Remove Photo',
        style: 'destructive',
        onPress: () => {
          setHeaderImage('');
          setHeaderImageCid('');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleStartEditName = () => {
    setEditedName(username);
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    const trimmed = editedName.trim();
    setIsEditingName(false);
    if (trimmed.length === 0 || trimmed === username) return;
    setUsername(trimmed);
    if (user?.id) {
      updatePrivyMetadata(user.id, { username: trimmed }).catch((error) => {
        console.warn('[Profile] Failed to sync username to Privy', error);
      });
    }
  };

  const weekDistProgress = Math.min(weeklyStats.totalDistance / weeklyGoalDistance, 1);
  const weekActProgress = Math.min(weeklyStats.activityCount / weeklyGoalActivities, 1);
  const weekTimeProgress = Math.min(weeklyStats.totalDuration / weeklyGoalTime, 1);

  const weeklyMax = Math.max(...weeklyStats.dailyActivityCount, 1);

  return (
    <ThemedView type="background" style={styles.container}>
      <AnimatedScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        headerMaxHeight={260}
        topBarHeight={90}
        renderHeaderComponent={() => (
          <HeaderComponentWrapper>
            {headerImage ? (
              <Image
                source={{ uri: headerImage }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : null}
            <LinearGradient
              colors={
                headerImage
                  ? ['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)']
                  : [Brand.primary, Brand.primaryPressed]
              }
              start={{ x: 0, y: 0 }}
              end={headerImage ? { x: 0, y: 1 } : { x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <SafeAreaView edges={['top']} style={styles.headerImageBtnWrap}>
              <TouchableOpacity
                onPress={handleHeaderImagePress}
                disabled={headerUploading}
                accessibilityState={{ disabled: headerUploading, busy: headerUploading }}
                activeOpacity={0.7}
                style={styles.headerImageBtn}
                accessibilityRole="button"
                accessibilityLabel={
                  headerImage ? 'Change or remove header photo' : 'Add header photo'
                }
              >
                {headerUploading ? (
                  <ActivityIndicator size="small" color={Brand.white} />
                ) : (
                  <Ionicons name="camera-outline" size={16} color={Brand.white} />
                )}
              </TouchableOpacity>
            </SafeAreaView>
            <SafeAreaView style={styles.parallaxAvatarWrap} pointerEvents="box-none">
              <TouchableOpacity
                onPress={handleAvatarPress}
                disabled={!!avatarUploadStatus}
                accessibilityState={{ disabled: !!avatarUploadStatus, busy: !!avatarUploadStatus }}
                activeOpacity={0.8}
                accessibilityRole="imagebutton"
                accessibilityLabel={
                  avatar ? 'Change or remove profile avatar' : 'Add profile avatar'
                }
              >
                {avatar ? (
                  <ThemedView style={styles.avatarRing}>
                    <Image
                      source={{ uri: avatarCid ? ipfsToHttpUrl(avatarCid) : avatar }}
                      style={styles.avatarImage}
                    />
                    <ThemedView
                      style={[styles.avatarBadge, { backgroundColor: theme.brand.primary }]}
                    >
                      {avatarUploadStatus ? (
                        <ActivityIndicator size="small" color={Brand.white} />
                      ) : (
                        <Ionicons name="camera" size={10} color={Brand.white} />
                      )}
                    </ThemedView>
                  </ThemedView>
                ) : (
                  <ThemedView style={styles.avatarRing}>
                    <ThemedView
                      style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                    >
                      <ThemedText style={styles.avatarInitials}>{initials}</ThemedText>
                    </ThemedView>
                    <ThemedView
                      style={[styles.avatarBadge, { backgroundColor: theme.backgroundElement }]}
                    >
                      <Ionicons name="camera" size={10} color={theme.brand.primary} />
                    </ThemedView>
                  </ThemedView>
                )}
              </TouchableOpacity>
            </SafeAreaView>
          </HeaderComponentWrapper>
        )}
        renderOveralComponent={() => (
          <View style={styles.parallaxOverlay}>
            {isEditingName ? (
              <Input
                value={editedName}
                onChangeText={setEditedName}
                onBlur={handleSaveName}
                onSubmitEditing={handleSaveName}
                autoFocus
                selectTextOnFocus
                maxLength={20}
                style={[styles.usernameInput, { borderColor: 'rgba(255,255,255,0.5)' }]}
                inputStyle={[styles.usernameInputText, { color: Brand.white }]}
              />
            ) : (
              <TouchableOpacity onPress={handleStartEditName} activeOpacity={0.7}>
                <ThemedText style={[styles.username, { color: Brand.white }]}>
                  {displayName}
                </ThemedText>
              </TouchableOpacity>
            )}
            {ensName && (
              <ThemedText type="small" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {ensName}
              </ThemedText>
            )}
          </View>
        )}
        renderTopNavBarComponent={() => (
          <HeaderNavBar headerHeight={90} tint={theme.isDark ? 'dark' : 'light'} intensity={80}>
            <ThemedText type="headline">You</ThemedText>
            <ThemedView style={styles.topBarActions}>
              <TouchableOpacity
                onPress={() => router.push('/leaderboard')}
                style={[styles.iconBtn, { backgroundColor: theme.backgroundElement }]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Leaderboard"
              >
                <Ionicons name="trophy-outline" size={18} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/profile-edit')}
                style={[styles.iconBtn, { backgroundColor: theme.backgroundElement }]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Edit Profile"
              >
                <Ionicons name="create-outline" size={18} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/settings')}
                style={[styles.iconBtn, { backgroundColor: theme.backgroundElement }]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Settings"
              >
                <Ionicons name="settings-outline" size={18} color={theme.text} />
              </TouchableOpacity>
            </ThemedView>
          </HeaderNavBar>
        )}
      >
        <View style={styles.bodyPadding}>
          {(headerUploading || avatarUploadStatus) && (
            <View style={styles.uploadStatus} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={theme.brand.primary} />
              <View style={{ flex: 1 }}>
                {headerUploading && <ThemedText type="small">Uploading header photo…</ThemedText>}
                {avatarUploadStatus && <ThemedText type="small">{avatarUploadStatus}</ThemedText>}
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  You can keep browsing while we save your photo.
                </ThemedText>
              </View>
            </View>
          )}
          <ThemedView style={styles.postHeaderContent}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
              {memberSince ? ` · Since ${memberSince}` : ''}
            </ThemedText>

            {/* ── Streak ── */}
            {streak.current > 0 && (
              <ThemedView style={[styles.streakHero, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="flame" size={14} color={theme.brand.primary} />
                <ThemedText type="small" style={[styles.streakText, { color: theme.text }]}>
                  {streak.current} day streak
                </ThemedText>
                {streak.longest > streak.current && (
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    · Best {streak.longest}
                  </ThemedText>
                )}
              </ThemedView>
            )}

            {/* ── Pill Actions ── */}
            <ThemedView style={styles.pillRow}>
              {walletAddress && (
                <TouchableOpacity
                  style={[styles.pillButton, { borderColor: theme.brand.primary }]}
                  onPress={copyAddress}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Copy wallet address"
                >
                  <Ionicons name="wallet-outline" size={13} color={theme.brand.primary} />
                  <ThemedText
                    type="small"
                    style={[styles.badgeText, { color: theme.brand.primary }]}
                  >
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </ThemedText>
                  <Ionicons name="copy-outline" size={11} color={theme.brand.primary} />
                </TouchableOpacity>
              )}

              {walletAddress && balanceWei !== null && (
                <ThemedView style={[styles.pillButton, { borderColor: theme.backgroundElement }]}>
                  <Ionicons name="cash-outline" size={13} color={theme.textSecondary} />
                  <ThemedText
                    type="small"
                    style={[styles.badgeText, { color: theme.textSecondary }]}
                  >
                    {Number(formatEther(balanceWei)).toFixed(4)} ETH
                  </ThemedText>
                </ThemedView>
              )}

              {walletAddress && strdBalanceWei !== null && (
                <ThemedView style={[styles.pillButton, { borderColor: theme.backgroundElement }]}>
                  {/* Placeholder icon — swap for the custom STRD coin icon once ready */}
                  <Ionicons name="disc-outline" size={13} color={theme.textSecondary} />
                  <ThemedText
                    type="small"
                    style={[styles.badgeText, { color: theme.textSecondary }]}
                  >
                    {Number(formatUnits(strdBalanceWei, 18)).toFixed(2)} STRD
                  </ThemedText>
                </ThemedView>
              )}
            </ThemedView>
          </ThemedView>

          {/* ── Compact Stats Row ── */}
          <ThemedView style={[styles.statsRow, { backgroundColor: theme.backgroundElement }]}>
            <ThemedView style={styles.statItem}>
              <Ionicons name="resize-outline" size={16} color={theme.textSecondary} />
              <ThemedText style={[styles.statVal, { color: theme.text }]}>
                {formatDistance(totalDistance, unitSystem)}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Distance
              </ThemedText>
            </ThemedView>
            <ThemedView style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <ThemedView style={styles.statItem}>
              <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
              <ThemedText style={[styles.statVal, { color: theme.text }]}>
                {formatDuration(totalDuration)}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Time
              </ThemedText>
            </ThemedView>
            <ThemedView style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <ThemedView style={styles.statItem}>
              <Ionicons name="map-outline" size={16} color={theme.textSecondary} />
              <ThemedText style={[styles.statVal, { color: theme.text }]}>
                {formatArea(totalTerritoryArea, unitSystem)}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Territory
              </ThemedText>
            </ThemedView>
          </ThemedView>

          {/* ── Sub-Tab Bar ── */}
          <ThemedView style={[styles.tabBar, { borderBottomColor: theme.border }]}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabItem,
                  activeTab === tab && { borderBottomColor: theme.brand.primary },
                ]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === tab }}
              >
                <ThemedText
                  type="small"
                  style={{
                    fontWeight: activeTab === tab ? '700' : '500',
                    color: activeTab === tab ? theme.brand.primary : theme.textSecondary,
                  }}
                >
                  {tab}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ThemedView>

          {/* ── Tab Content ── */}
          {activeTab === 'Progress' && (
            <ThemedView style={styles.tabContent}>
              {/* Weekly Progress */}
              <Card style={styles.section}>
                <ThemedView style={styles.sectionHeader}>
                  <ThemedView>
                    <ThemedText type="sectionTitle">This Week</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {weeklyStats.activityCount} activities ·{' '}
                      {formatDistance(weeklyStats.totalDistance, unitSystem)}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>

                <ThemedView style={styles.weekStatsRow}>
                  <ThemedView style={styles.weekStatItem}>
                    <ThemedText style={[styles.weekStatValue, { color: theme.text }]}>
                      {formatDistance(weeklyStats.totalDistance, unitSystem)}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      Distance
                    </ThemedText>
                    <ThemedView
                      style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}
                    >
                      <ThemedView
                        style={[
                          styles.progressFill,
                          { width: `${weekDistProgress * 100}%`, backgroundColor: theme.text },
                        ]}
                      />
                    </ThemedView>
                  </ThemedView>
                  <ThemedView style={styles.weekStatItem}>
                    <ThemedText style={[styles.weekStatValue, { color: theme.text }]}>
                      {weeklyStats.activityCount}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      Activities
                    </ThemedText>
                    <ThemedView
                      style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}
                    >
                      <ThemedView
                        style={[
                          styles.progressFill,
                          { width: `${weekActProgress * 100}%`, backgroundColor: theme.text },
                        ]}
                      />
                    </ThemedView>
                  </ThemedView>
                  <ThemedView style={styles.weekStatItem}>
                    <ThemedText style={[styles.weekStatValue, { color: theme.text }]}>
                      {formatDuration(weeklyStats.totalDuration)}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      Time
                    </ThemedText>
                    <ThemedView
                      style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}
                    >
                      <ThemedView
                        style={[
                          styles.progressFill,
                          { width: `${weekTimeProgress * 100}%`, backgroundColor: theme.text },
                        ]}
                      />
                    </ThemedView>
                  </ThemedView>
                </ThemedView>

                <ThemedView style={[styles.chartBar, { borderTopColor: theme.border }]}>
                  {weeklyStats.dailyActivityCount.map((count, i) => (
                    <ThemedView key={i} style={styles.dayCol}>
                      <ThemedView
                        style={[
                          styles.dayBar,
                          {
                            height: Math.max((count / weeklyMax) * 44, count > 0 ? 6 : 2),
                            backgroundColor:
                              count > 0 ? theme.brand.primary : theme.backgroundSelected,
                          },
                        ]}
                      />
                      <ThemedText
                        type="caption"
                        style={[styles.dayLabel, { color: theme.textSecondary }]}
                      >
                        {DAY_LABELS[i]}
                      </ThemedText>
                    </ThemedView>
                  ))}
                </ThemedView>
              </Card>
            </ThemedView>
          )}

          {activeTab === 'Activities' && (
            <ThemedView style={styles.tabContent}>
              {activities.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <Ionicons name="walk-outline" size={32} color={theme.textSecondary} />
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, textAlign: 'center' }}
                  >
                    No activities yet.{'\n'}Start your first one!
                  </ThemedText>
                </Card>
              ) : (
                <>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {activities.length} {activities.length === 1 ? 'activity' : 'activities'} ·
                    swipe to delete
                  </ThemedText>
                  {activities
                    .slice()
                    .sort(
                      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    )
                    .map((activity) => {
                      const icon = (SPORT_ICONS[activity.activityType] ||
                        'walk-outline') as keyof typeof Ionicons.glyphMap;
                      const date = new Date(activity.createdAt);
                      const dateStr = date.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      });
                      const timeStr = date.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      });
                      return (
                        <SwipeAction
                          key={activity.id}
                          right={[
                            {
                              text: 'Delete',
                              color: Brand.white,
                              backgroundColor: theme.brand.danger,
                              onPress: () => {
                                Alert.alert(
                                  'Delete Activity',
                                  `Are you sure you want to delete "${activity.name || 'Activity'}"?`,
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'Delete',
                                      style: 'destructive',
                                      onPress: () => {
                                        deleteActivity(activity.id);
                                        Toast.info('Activity deleted', 1.2);
                                      },
                                    },
                                  ]
                                );
                              },
                            },
                          ]}
                        >
                          <TouchableOpacity
                            style={[
                              styles.activityCard,
                              { backgroundColor: theme.backgroundElement },
                            ]}
                            onPress={() => router.push(`/activity-summary?id=${activity.id}`)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name={icon} size={22} color={theme.textSecondary} />
                            <ThemedView style={styles.activityInfo}>
                              <ThemedText type="small" style={styles.activityName}>
                                {activity.name || 'Activity'}
                              </ThemedText>
                              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                                {dateStr} at {timeStr}
                              </ThemedText>
                              <ThemedView style={styles.activityStats}>
                                <ThemedView style={styles.activityStat}>
                                  <Ionicons
                                    name="resize-outline"
                                    size={12}
                                    color={theme.textSecondary}
                                  />
                                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                                    {formatDistance(activity.distance, unitSystem)}
                                  </ThemedText>
                                </ThemedView>
                                <ThemedView style={styles.activityStat}>
                                  <Ionicons
                                    name="time-outline"
                                    size={12}
                                    color={theme.textSecondary}
                                  />
                                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                                    {formatDuration(activity.duration)}
                                  </ThemedText>
                                </ThemedView>
                                <ThemedView style={styles.activityStat}>
                                  <Ionicons
                                    name="map-outline"
                                    size={12}
                                    color={theme.textSecondary}
                                  />
                                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                                    {activity.territory
                                      ? formatArea(activity.territoryArea, unitSystem)
                                      : 'No territory'}
                                  </ThemedText>
                                </ThemedView>
                              </ThemedView>
                            </ThemedView>
                            <Ionicons
                              name="chevron-forward"
                              size={14}
                              color={theme.textSecondary}
                            />
                          </TouchableOpacity>
                        </SwipeAction>
                      );
                    })}
                </>
              )}
            </ThemedView>
          )}

          {activeTab === 'More' && (
            <ThemedView style={styles.tabContent}>
              {/* Personal Records */}
              {(records.longestDistance ||
                records.fastestPace ||
                (records.largestTerritory && records.largestTerritory.territoryArea > 0)) && (
                <ThemedView style={styles.listSection}>
                  <ThemedText
                    type="eyebrow"
                    style={[styles.sectionLabel, { color: theme.textSecondary }]}
                  >
                    Personal Records
                  </ThemedText>
                  <List>
                    {
                      (
                        [
                          records.longestDistance && (
                            <List.Item
                              key="longest-distance"
                              thumb={<ListIcon name="resize-outline" />}
                              extra={
                                <View style={styles.recordExtra}>
                                  <ThemedText style={styles.recordValue}>
                                    {formatDistance(records.longestDistance.distance, unitSystem)}
                                  </ThemedText>
                                </View>
                              }
                            >
                              Longest Distance
                            </List.Item>
                          ),
                          records.fastestPace && (
                            <List.Item
                              key="fastest-pace"
                              thumb={<ListIcon name="speedometer-outline" />}
                              extra={
                                <View style={styles.recordExtra}>
                                  <ThemedText style={styles.recordValue}>
                                    {formatPace(
                                      records.fastestPace.distance,
                                      records.fastestPace.duration,
                                      unitSystem
                                    )}
                                  </ThemedText>
                                </View>
                              }
                            >
                              Fastest Pace
                            </List.Item>
                          ),
                          records.largestTerritory &&
                            records.largestTerritory.territoryArea > 0 && (
                              <List.Item
                                key="largest-territory"
                                thumb={<ListIcon name="map-outline" />}
                                extra={
                                  <View style={styles.recordExtra}>
                                    <ThemedText style={styles.recordValue}>
                                      {formatArea(
                                        records.largestTerritory.territoryArea,
                                        unitSystem
                                      )}
                                    </ThemedText>
                                  </View>
                                }
                              >
                                Largest Territory
                              </List.Item>
                            ),
                        ] as (ReactElement | false | null)[]
                      ).filter(Boolean) as ReactElement[]
                    }
                  </List>
                </ThemedView>
              )}

              {/* By Sport */}
              {sportStats.length > 0 && (
                <ThemedView style={styles.listSection}>
                  <ThemedText
                    type="eyebrow"
                    style={[styles.sectionLabel, { color: theme.textSecondary }]}
                  >
                    By Sport
                  </ThemedText>
                  <List>
                    {sportStats.map((stat) => (
                      <List.Item
                        key={stat.type}
                        thumb={<ListIcon name={SPORT_ICONS[stat.type] || 'walk-outline'} />}
                        extra={
                          <ThemedView style={styles.sportExtra}>
                            <ThemedText type="small" style={styles.sportDistance}>
                              {formatDistance(stat.totalDistance, unitSystem)}
                            </ThemedText>
                            <ThemedText type="small" style={{ color: theme.textSecondary }}>
                              {stat.count} {stat.count === 1 ? 'activity' : 'activities'}
                            </ThemedText>
                          </ThemedView>
                        }
                      >
                        {stat.type.charAt(0).toUpperCase() + stat.type.slice(1)}
                      </List.Item>
                    ))}
                  </List>
                </ThemedView>
              )}

              {/* Statistics */}
              <ThemedView style={styles.listSection}>
                <ThemedText
                  type="eyebrow"
                  style={[styles.sectionLabel, { color: theme.textSecondary }]}
                >
                  Statistics
                </ThemedText>
                <List>
                  <List.Item
                    thumb={<ListIcon name="bar-chart-outline" />}
                    extra={
                      <ThemedView style={styles.sportExtra}>
                        <ThemedText type="small" style={styles.sportDistance}>
                          {formatDistance(totalDistance, unitSystem)}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>
                          This year
                        </ThemedText>
                      </ThemedView>
                    }
                  >
                    Total Distance
                  </List.Item>
                  <List.Item
                    thumb={<ListIcon name="time-outline" />}
                    extra={
                      <ThemedView style={styles.sportExtra}>
                        <ThemedText type="small" style={styles.sportDistance}>
                          {formatDuration(totalDuration)}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>
                          This year
                        </ThemedText>
                      </ThemedView>
                    }
                  >
                    Total Time
                  </List.Item>
                </List>
              </ThemedView>

              {/* Achievements */}
              {unlockedAchievements.length > 0 && (
                <ThemedView style={styles.listSection}>
                  <ThemedText
                    type="eyebrow"
                    style={[styles.sectionLabel, { color: theme.textSecondary }]}
                  >
                    Achievements
                  </ThemedText>
                  <ThemedView style={styles.achievementsGrid}>
                    {unlockedAchievements.map((a) => {
                      const minted = mintedAchievementIds.has(a.id);
                      return (
                        <ThemedView
                          key={a.id}
                          style={[styles.achievementCard, { borderColor: theme.border }]}
                        >
                          {minted && (
                            <View style={styles.achievementBadge}>
                              <Ionicons
                                name="checkmark-circle"
                                size={14}
                                color={theme.brand.success}
                              />
                            </View>
                          )}
                          {minted ? (
                            <AchievementBadge
                              icon={a.icon as keyof typeof Ionicons.glyphMap}
                              size={40}
                            />
                          ) : (
                            <Ionicons
                              name={a.icon as keyof typeof Ionicons.glyphMap}
                              size={22}
                              color={theme.text}
                            />
                          )}
                          <ThemedText
                            type="caption"
                            style={[styles.achievementTitle, { color: theme.textSecondary }]}
                          >
                            {a.title}
                          </ThemedText>
                        </ThemedView>
                      );
                    })}
                  </ThemedView>
                </ThemedView>
              )}

              {/* Territory NFTs */}
              {userPolygons.length > 0 && (
                <ThemedView style={styles.listSection}>
                  <ThemedText
                    type="eyebrow"
                    style={[styles.sectionLabel, { color: theme.textSecondary }]}
                  >
                    Territories
                  </ThemedText>
                  <ThemedView style={styles.achievementsGrid}>
                    {userPolygons.map((polygon) => {
                      const hash = services.territory.computePolygonHash(polygon);
                      return (
                        <ThemedView
                          key={hash}
                          style={[styles.achievementCard, { borderColor: theme.border }]}
                        >
                          {mintedTerritoryIds.has(hash) && (
                            <View style={styles.achievementBadge}>
                              <Ionicons
                                name="checkmark-circle"
                                size={14}
                                color={theme.brand.success}
                              />
                            </View>
                          )}
                          <Ionicons name="flag-outline" size={22} color={theme.text} />
                          <ThemedText
                            type="caption"
                            style={[styles.achievementTitle, { color: theme.textSecondary }]}
                          >
                            {formatArea(territoryService.getPolygonArea(polygon), unitSystem)}
                          </ThemedText>
                        </ThemedView>
                      );
                    })}
                  </ThemedView>
                </ThemedView>
              )}

              {/* Logout */}
              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={handleLogout}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Log out"
              >
                <Ionicons name="log-out-outline" size={16} color={theme.brand.danger} />
                <ThemedText type="small" style={{ color: theme.brand.danger }}>
                  Log Out
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>
          )}

          <ThemedView style={{ height: Spacing.six }} />
        </View>
      </AnimatedScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: Spacing.three },
  bodyPadding: { paddingHorizontal: Spacing.four, gap: Spacing.three },

  /* Top Bar */
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.one,
  },
  topBarActions: { flexDirection: 'row', gap: Spacing.two },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Parallax Header */
  uploadStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  headerImageBtnWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  headerImageBtn: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
    marginRight: Spacing.three,
  },
  parallaxAvatarWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parallaxOverlay: {
    alignItems: 'center',
    gap: Spacing.half,
    paddingBottom: Spacing.three,
  },
  postHeaderContent: {
    alignItems: 'center',
    paddingTop: Spacing.three,
    gap: Spacing.one,
  },
  avatarRing: { position: 'relative' },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.full,
  },
  avatarInitials: {
    color: Brand.white,
    fontSize: 26,
    fontWeight: '700',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Brand.white,
  },
  username: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: Spacing.one,
  },
  usernameInput: {
    marginTop: Spacing.one,
    borderBottomWidth: 1,
    minWidth: 160,
    paddingBottom: 2,
  },
  usernameInputText: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* Streak Hero */
  streakHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.one,
  },
  streakText: { fontWeight: '600', fontSize: 13 },

  /* Pill Actions */
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  badgeText: { fontWeight: '600', fontSize: 12 },

  /* Stats Row */
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.three,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  statVal: {
    fontSize: 18,
    fontWeight: '700',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
  },

  /* Sub-Tab Bar */
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },

  /* Tab Content */
  tabContent: { gap: Spacing.three },

  /* Section */
  section: { padding: Spacing.four, gap: Spacing.three },
  listSection: { gap: Spacing.two },
  sectionLabel: { paddingHorizontal: Spacing.one, marginBottom: Spacing.one },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  /* Empty */
  emptyCard: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },

  /* Activity */
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: BorderRadius.sm,
    gap: Spacing.two,
  },
  activityInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  activityName: {
    fontWeight: '600',
  },
  activityStats: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  activityStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },

  /* Weekly Stats */
  weekStatsRow: {
    flexDirection: 'row',
    gap: Spacing.four,
    paddingVertical: Spacing.one,
  },
  weekStatItem: { flex: 1, gap: Spacing.one },
  weekStatValue: { fontSize: 20, fontWeight: '700' },
  progressTrack: {
    height: 3,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.one,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },

  /* Weekly Chart */
  chartBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 72,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dayCol: { alignItems: 'center', gap: 4 },
  dayBar: { width: 28, borderRadius: BorderRadius.sm },
  dayLabel: { fontWeight: '600' },

  /* Records */
  recordExtra: { alignItems: 'flex-end' },
  recordValue: { fontWeight: '700', fontSize: 15 },

  /* Sport */
  sportExtra: { alignItems: 'flex-end', gap: 2 },
  sportDistance: { fontWeight: '600' },

  /* Achievements */
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  achievementCard: {
    width: '30%',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.two,
  },
  achievementBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  achievementTitle: { textAlign: 'center' },

  /* Logout */
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    marginTop: Spacing.one,
  },
});
