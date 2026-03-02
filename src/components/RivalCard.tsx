import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Rival, RivalHeadToHead } from '../services/RivalService';

interface Props {
  rival: Rival;
  stats: RivalHeadToHead | null;
  onRemove: () => void;
  onPress?: () => void;
}

function StatCell({
  label,
  myVal,
  rivalVal,
  lowerIsBetter = false,
}: {
  label: string;
  myVal: string;
  rivalVal: string;
  lowerIsBetter?: boolean;
}) {
  const myNum = parseFloat(myVal);
  const rivalNum = parseFloat(rivalVal);
  const myWins =
    !isNaN(myNum) && !isNaN(rivalNum)
      ? lowerIsBetter
        ? myNum < rivalNum
        : myNum > rivalNum
      : false;
  const rivalWins =
    !isNaN(myNum) && !isNaN(rivalNum)
      ? lowerIsBetter
        ? rivalNum < myNum
        : rivalNum > myNum
      : false;

  return (
    <View style={cellStyles.container}>
      <Text style={cellStyles.label}>{label}</Text>
      <Text style={[cellStyles.value, myWins && cellStyles.winning]}>{myVal}</Text>
      <Text style={cellStyles.vs}>vs</Text>
      <Text style={[cellStyles.value, rivalWins && cellStyles.losing]}>{rivalVal}</Text>
    </View>
  );
}

const cellStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 8 },
  label: { color: Colors.textSecondary, fontSize: 10, marginBottom: 4, textAlign: 'center' },
  value: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  vs: { color: Colors.textSecondary, fontSize: 10, marginVertical: 2 },
  winning: { color: '#30D158' },
  losing: { color: '#FF453A' },
});

export function RivalCard({ rival, stats, onRemove, onPress }: Props) {
  const profile = rival.rival_profile;

  const winning = stats ? stats.myWins > stats.rivalWins : false;
  const losing  = stats ? stats.rivalWins > stats.myWins : false;

  const borderColor = winning ? '#30D158' : losing ? '#FF453A' : '#2A2A2A';

  const initials = (profile.display_name || profile.username || '?')
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
    >
      {/* Top row */}
      <View style={styles.topRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.displayName} numberOfLines={1}>
            {profile.display_name || profile.username}
          </Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Lv.{profile.level}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Trash2 size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Score */}
      {stats ? (
        <>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreNum, winning && styles.scoreWin]}>
              {stats.myWins}
            </Text>
            <Text style={styles.scoreSep}> — </Text>
            <Text style={[styles.scoreNum, losing && styles.scoreLose]}>
              {stats.rivalWins}
            </Text>
          </View>
          <Text style={styles.scoreLabel}>
            {winning ? 'You\'re ahead' : losing ? 'They\'re ahead' : 'Tied'}
          </Text>

          {/* 2×2 stats grid */}
          <View style={styles.statsGrid}>
            <StatCell
              label="0–100 km/h"
              myVal={stats.my_sprint_0_100 != null ? `${stats.my_sprint_0_100.toFixed(3)}s` : '—'}
              rivalVal={stats.rival_sprint_0_100 != null ? `${stats.rival_sprint_0_100.toFixed(3)}s` : '—'}
              lowerIsBetter
            />
            <StatCell
              label="100–200 km/h"
              myVal={stats.my_sprint_100_200 != null ? `${stats.my_sprint_100_200.toFixed(3)}s` : '—'}
              rivalVal={stats.rival_sprint_100_200 != null ? `${stats.rival_sprint_100_200.toFixed(3)}s` : '—'}
              lowerIsBetter
            />
            <StatCell
              label="Total XP"
              myVal={stats.my_xp.toLocaleString()}
              rivalVal={stats.rival_xp.toLocaleString()}
            />
            <StatCell
              label="Distance"
              myVal={`${stats.my_distance.toFixed(0)} km`}
              rivalVal={`${stats.rival_distance.toFixed(0)} km`}
            />
          </View>
        </>
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading stats…</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.primary, fontSize: 16, fontWeight: '700' },
  displayName: { color: '#FFF', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  levelBadge: {
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignSelf: 'flex-start',
  },
  levelText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },

  scoreRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  scoreNum: { color: '#FFF', fontSize: 28, fontWeight: '800' },
  scoreSep: { color: Colors.textSecondary, fontSize: 18 },
  scoreWin: { color: '#30D158' },
  scoreLose: { color: '#FF453A' },
  scoreLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 2,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderColor: '#2A2A2A',
    paddingTop: 8,
  },

  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingText: { color: Colors.textSecondary, fontSize: 13 },
});
