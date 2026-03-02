import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Trophy,
  Crown,
  Medal,
  Award,
  Zap,
  Users,
  Clock,
  Flag,
  Lock,
} from 'lucide-react-native';
import { Colors } from '@/src/theme/colors';
import { useAuth } from '@/src/context/AuthContext';
import { useTournament } from '@/src/context/TournamentContext';
import {
  tournamentService,
  Tournament,
  TournamentLeaderboardEntry,
  TOURNAMENT_TYPE_EMOJI,
  TOURNAMENT_TYPE_LABELS,
  formatResult,
  timeUntil,
  timeUntilStart,
} from '@/src/services/TournamentService';

const STATUS_COLORS = {
  active:    { bg: '#30D15822', text: '#30D158' },
  upcoming:  { bg: '#007AFF22', text: '#007AFF' },
  completed: { bg: '#44444422', text: '#888' },
};

export default function TournamentDetailScreen() {
  const router = useRouter();
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const { user, profile } = useAuth();
  const { joinTournament, claimReward, refresh: refreshContext } = useTournament();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [leaderboard, setLeaderboard] = useState<TournamentLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    if (!user || !tournamentId) return;
    try {
      const [t, lb] = await Promise.all([
        tournamentService.getTournament(tournamentId, user.id),
        tournament
          ? tournamentService.getLeaderboard(tournamentId, tournament.type)
          : Promise.resolve([]),
      ]);
      if (t) {
        setTournament(t);
        const lb2 = await tournamentService.getLeaderboard(tournamentId, t.type);
        setLeaderboard(lb2);
      }
    } catch (e) {
      console.error('tournament-detail load:', e);
    } finally {
      setLoading(false);
    }
  }, [user, tournamentId]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleJoin = async () => {
    if (!tournament || !user) return;
    const level = profile?.level ?? 1;
    if (level < tournament.min_level) {
      Alert.alert('Level Required', `You need to be level ${tournament.min_level} to enter.`);
      return;
    }
    setJoining(true);
    const ok = await joinTournament(tournament.id);
    setJoining(false);
    if (ok) {
      await load();
    } else {
      Alert.alert('Error', 'Could not join tournament. Please try again.');
    }
  };

  const handleClaim = async () => {
    if (!tournament) return;
    setClaiming(true);
    const xp = await claimReward(tournament.id);
    setClaiming(false);
    if (xp > 0) {
      Alert.alert('Reward Claimed! 🏆', `+${xp.toLocaleString()} XP added to your profile!`);
      await load();
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={16} color="#FFD700" />;
    if (rank === 2) return <Medal size={16} color="#C0C0C0" />;
    if (rank === 3) return <Award size={16} color="#CD7F32" />;
    return <Text style={styles.rankNum}>#{rank}</Text>;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tournament</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tournament</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Tournament not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const entered = !!tournament.my_entry;
  const canClaim =
    entered &&
    tournament.status === 'completed' &&
    (tournament.my_entry?.xp_awarded ?? 0) > 0 &&
    !tournament.my_entry?.reward_claimed;

  const myEntry = leaderboard.find(e => e.userId === user?.id);
  const myRank = myEntry?.rank;
  const showPinnedRow = myRank != null && myRank > 10;

  const statusColors = STATUS_COLORS[tournament.status] ?? STATUS_COLORS.completed;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{tournament.name}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {tournament.status === 'active' ? '● LIVE' :
               tournament.status === 'upcoming' ? 'SOON' : 'ENDED'}
            </Text>
          </View>
        </View>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Description + meta */}
        <View style={styles.section}>
          {tournament.description ? (
            <Text style={styles.description}>{tournament.description}</Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaEmoji}>{TOURNAMENT_TYPE_EMOJI[tournament.type]}</Text>
              <Text style={styles.metaLabel}>{TOURNAMENT_TYPE_LABELS[tournament.type]}</Text>
            </View>
            <View style={styles.metaItem}>
              <Users size={14} color={Colors.textSecondary} />
              <Text style={styles.metaLabel}>{tournament.participant_count ?? 0} players</Text>
            </View>
            <View style={styles.metaItem}>
              <Clock size={14} color={Colors.textSecondary} />
              <Text style={styles.metaLabel}>
                {tournament.status === 'active'
                  ? timeUntil(tournament.end_at)
                  : tournament.status === 'upcoming'
                  ? timeUntilStart(tournament.start_at)
                  : 'Ended'}
              </Text>
            </View>
            {tournament.min_level > 1 && (
              <View style={styles.metaItem}>
                <Lock size={14} color={Colors.textSecondary} />
                <Text style={styles.metaLabel}>Lv.{tournament.min_level}+</Text>
              </View>
            )}
          </View>
        </View>

        {/* Prize breakdown */}
        <View style={styles.prizeSection}>
          <Text style={styles.sectionTitle}>Prizes</Text>
          <View style={styles.prizeRow}>
            {[
              { icon: <Crown size={18} color="#FFD700" />, xp: tournament.prize_xp_1st, label: '1st Place' },
              { icon: <Medal size={18} color="#C0C0C0" />, xp: tournament.prize_xp_2nd, label: '2nd Place' },
              { icon: <Award size={18} color="#CD7F32" />, xp: tournament.prize_xp_3rd, label: '3rd Place' },
            ].map(p => (
              <View key={p.label} style={styles.prizeBox}>
                {p.icon}
                <Text style={styles.prizeXP}>{p.xp.toLocaleString()}</Text>
                <Text style={styles.prizeXPLabel}>XP</Text>
                <Text style={styles.prizeLabel}>{p.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.participationRow}>
            <Zap size={13} color={Colors.textSecondary} />
            <Text style={styles.participationText}>
              +{tournament.prize_xp_participation.toLocaleString()} XP participation reward
            </Text>
          </View>
        </View>

        {/* My result card */}
        {entered && tournament.my_entry && (
          <View style={styles.myResultCard}>
            <Text style={styles.myResultTitle}>Your Entry</Text>
            <View style={styles.myResultBody}>
              {tournament.my_entry.best_result != null ? (
                <>
                  <Text style={styles.myResultValue}>
                    {formatResult(tournament.type, tournament.my_entry.best_result)}
                  </Text>
                  {tournament.my_entry.rank != null && (
                    <View style={styles.myRankBadge}>
                      <Text style={styles.myRankText}>#{tournament.my_entry.rank}</Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.noResultText}>
                  No result yet — complete a {TOURNAMENT_TYPE_LABELS[tournament.type]} to submit
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Leaderboard */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Leaderboard</Text>
          {leaderboard.length === 0 ? (
            <Text style={styles.emptyText}>No results yet — be the first!</Text>
          ) : (
            <>
              {leaderboard.slice(0, 10).map(entry => {
                const isMe = entry.userId === user?.id;
                return (
                  <View key={entry.userId} style={[styles.lbRow, isMe && styles.lbRowMe]}>
                    <View style={styles.lbRank}>{getRankIcon(entry.rank)}</View>
                    <View style={styles.lbInfo}>
                      <Text style={[styles.lbName, isMe && styles.lbNameMe]} numberOfLines={1}>
                        {entry.displayName}{isMe ? ' (You)' : ''}
                      </Text>
                      <Text style={styles.lbLevel}>Lv.{entry.level}</Text>
                    </View>
                    <Text style={[styles.lbResult, isMe && { color: Colors.primary }]}>
                      {formatResult(tournament.type, entry.bestResult)}
                    </Text>
                  </View>
                );
              })}

              {showPinnedRow && myEntry && (
                <>
                  <View style={styles.ellipsisRow}>
                    <Text style={styles.ellipsisText}>•••</Text>
                  </View>
                  <View style={[styles.lbRow, styles.lbRowMe]}>
                    <View style={styles.lbRank}>
                      <Text style={styles.rankNum}>#{myRank}</Text>
                    </View>
                    <View style={styles.lbInfo}>
                      <Text style={styles.lbNameMe} numberOfLines={1}>
                        {myEntry.displayName} (You)
                      </Text>
                      <Text style={styles.lbLevel}>Lv.{myEntry.level}</Text>
                    </View>
                    <Text style={[styles.lbResult, { color: Colors.primary }]}>
                      {formatResult(tournament.type, myEntry.bestResult)}
                    </Text>
                  </View>
                </>
              )}
            </>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom action */}
      <View style={styles.actionArea}>
        {canClaim ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.claimBtn, claiming && styles.disabledBtn]}
            onPress={handleClaim}
            disabled={claiming}
          >
            <Zap size={18} color="#000" style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>
              {claiming ? 'Claiming…' : `Claim ${(tournament.my_entry?.xp_awarded ?? 0).toLocaleString()} XP`}
            </Text>
          </TouchableOpacity>
        ) : !entered && tournament.status === 'active' ? (
          <TouchableOpacity
            style={[styles.actionBtn, joining && styles.disabledBtn]}
            onPress={handleJoin}
            disabled={joining}
          >
            <Flag size={18} color="#000" style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>{joining ? 'Joining…' : 'Enter Tournament'}</Text>
          </TouchableOpacity>
        ) : !entered && tournament.status === 'upcoming' ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.remindBtn, joining && styles.disabledBtn]}
            onPress={handleJoin}
            disabled={joining}
          >
            <Text style={styles.remindBtnText}>{joining ? 'Registering…' : 'Register Interest'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.keepDrivingRow}>
            <Trophy size={16} color={Colors.textSecondary} />
            <Text style={styles.keepDrivingText}>Keep driving to improve your result</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: Colors.textSecondary, fontSize: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '700', flexShrink: 1 },
  statusPill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },

  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#111' },
  sectionTitle: { color: '#FFF', fontWeight: '700', fontSize: 16, marginBottom: 12 },

  description: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 12 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaEmoji: { fontSize: 14 },
  metaLabel: { color: Colors.textSecondary, fontSize: 13 },

  prizeSection: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#111' },
  prizeRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  prizeBox: { alignItems: 'center', gap: 3 },
  prizeXP: { color: '#FFD700', fontWeight: '800', fontSize: 16 },
  prizeXPLabel: { color: Colors.textSecondary, fontSize: 11, marginTop: -2 },
  prizeLabel: { color: Colors.textSecondary, fontSize: 11 },
  participationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  participationText: { color: Colors.textSecondary, fontSize: 12 },

  myResultCard: {
    margin: 16,
    backgroundColor: Colors.primary + '15',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
  },
  myResultTitle: { color: Colors.primary, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  myResultBody: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  myResultValue: { color: '#FFF', fontSize: 22, fontWeight: '800', flex: 1 },
  myRankBadge: {
    backgroundColor: Colors.primary + '33',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  myRankText: { color: Colors.primary, fontSize: 16, fontWeight: '800' },
  noResultText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },

  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  lbRowMe: { backgroundColor: Colors.primary + '15', borderRadius: 8, paddingHorizontal: 6 },
  lbRank: { width: 32, alignItems: 'center', marginRight: 10 },
  rankNum: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  lbInfo: { flex: 1 },
  lbName: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  lbNameMe: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  lbLevel: { color: Colors.textSecondary, fontSize: 11, marginTop: 1 },
  lbResult: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  ellipsisRow: { alignItems: 'center', paddingVertical: 4 },
  ellipsisText: { color: Colors.textSecondary, fontSize: 18, letterSpacing: 4 },

  emptyText: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', paddingVertical: 20 },

  actionArea: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    backgroundColor: '#000',
  },
  actionBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: { color: '#000', fontWeight: '700', fontSize: 16 },
  claimBtn: { backgroundColor: '#30D158' },
  remindBtn: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: Colors.primary + '55',
  },
  remindBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 16 },
  disabledBtn: { opacity: 0.4 },

  keepDrivingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  keepDrivingText: { color: Colors.textSecondary, fontSize: 14 },
});
