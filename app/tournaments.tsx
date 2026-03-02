import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { ArrowLeft, Trophy } from 'lucide-react-native';
import { Colors } from '@/src/theme/colors';
import { useAuth } from '@/src/context/AuthContext';
import { useTournament } from '@/src/context/TournamentContext';
import { TournamentCard } from '@/src/components/TournamentCard';
import { Tournament } from '@/src/services/TournamentService';

type TabName = 'active' | 'upcoming' | 'history';

export default function TournamentsScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const {
    activeTournaments,
    upcomingTournaments,
    myTournaments,
    loading,
    joinTournament,
    claimReward,
    refresh,
  } = useTournament();

  const [tab, setTab] = useState<TabName>('active');
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleJoin = async (t: Tournament) => {
    if (!user) return;
    const level = profile?.level ?? 1;
    if (level < t.min_level) {
      Alert.alert('Level Required', `You need to be level ${t.min_level} to enter this tournament.`);
      return;
    }
    setJoining(t.id);
    const ok = await joinTournament(t.id);
    setJoining(null);
    if (!ok) {
      Alert.alert('Error', 'Could not join tournament. Please try again.');
    }
  };

  const handleClaim = async (t: Tournament) => {
    const xp = await claimReward(t.id);
    if (xp > 0) {
      Alert.alert('Reward Claimed! 🏆', `+${xp.toLocaleString()} XP added to your profile!`);
    }
  };

  const historyTournaments = myTournaments.filter(t => t.status === 'completed');

  const displayList =
    tab === 'active' ? activeTournaments :
    tab === 'upcoming' ? upcomingTournaments :
    historyTournaments;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tournaments</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Trophy size={18} color="#FFD700" style={{ marginRight: 6 }} />
          <Text style={styles.headerTitle}>Tournaments</Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {([
          { key: 'active',   label: `Live${activeTournaments.length > 0 ? ` (${activeTournaments.length})` : ''}` },
          { key: 'upcoming', label: 'Upcoming' },
          { key: 'history',  label: 'History' },
        ] as { key: TabName; label: string }[]).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {displayList.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🏆</Text>
            <Text style={styles.emptyTitle}>
              {tab === 'active' ? 'No live tournaments' :
               tab === 'upcoming' ? 'No upcoming tournaments' :
               'No tournament history'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {tab === 'active' ? 'Check back on weekends for live competitions!' :
               tab === 'upcoming' ? 'New tournaments are announced every week.' :
               'Enter a tournament to see your results here.'}
            </Text>
          </View>
        )}

        {displayList.map(t => (
          <TournamentCard
            key={t.id}
            tournament={t}
            onPress={() => router.push(`/tournament-detail?tournamentId=${t.id}`)}
            onJoin={() => handleJoin(t)}
            onClaim={() => handleClaim(t)}
            joining={joining === t.id}
          />
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backBtn:      { padding: 4 },
  headerCenter: { flexDirection: 'row', alignItems: 'center' },
  headerTitle:  { color: '#FFF', fontSize: 18, fontWeight: '700' },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500' },
  tabTextActive: { color: '#FFF', fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji:     { fontSize: 48, marginBottom: 8 },
  emptyTitle:     { color: '#FFF', fontSize: 18, fontWeight: '700' },
  emptySubtitle:  { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
});
