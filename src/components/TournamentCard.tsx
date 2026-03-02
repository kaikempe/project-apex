import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Crown, Medal, Award, Users, Clock, Lock, Flag, Zap } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import {
  Tournament,
  TOURNAMENT_TYPE_EMOJI,
  TOURNAMENT_TYPE_LABELS,
  formatResult,
  timeUntil,
  timeUntilStart,
} from '../services/TournamentService';

interface Props {
  tournament: Tournament;
  onPress: () => void;
  onJoin?: () => void;
  onClaim?: () => void;
  joining?: boolean;
}

const STATUS_COLORS = {
  active:    { bg: '#30D15822', text: '#30D158' },
  upcoming:  { bg: '#007AFF22', text: '#007AFF' },
  completed: { bg: '#44444422', text: '#888' },
};

export function TournamentCard({ tournament: t, onPress, onJoin, onClaim, joining }: Props) {
  const entered = !!t.my_entry;
  const canClaim =
    entered &&
    t.status === 'completed' &&
    (t.my_entry?.xp_awarded ?? 0) > 0 &&
    !t.my_entry?.reward_claimed;

  const statusColors = STATUS_COLORS[t.status] ?? STATUS_COLORS.completed;

  const borderColor = canClaim
    ? '#30D158'
    : entered && t.status === 'active'
    ? Colors.primary
    : '#2A2A2A';

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.emoji}>{TOURNAMENT_TYPE_EMOJI[t.type]}</Text>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.name}>{t.name}</Text>
          <Text style={styles.type}>{TOURNAMENT_TYPE_LABELS[t.type]}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusText, { color: statusColors.text }]}>
            {t.status === 'active' ? '● LIVE' : t.status === 'upcoming' ? 'SOON' : 'ENDED'}
          </Text>
        </View>
      </View>

      {/* Meta */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Clock size={12} color={Colors.textSecondary} />
          <Text style={styles.metaText}>
            {t.status === 'active'
              ? timeUntil(t.end_at)
              : t.status === 'upcoming'
              ? timeUntilStart(t.start_at)
              : 'Completed'}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Users size={12} color={Colors.textSecondary} />
          <Text style={styles.metaText}>{t.participant_count ?? 0} entered</Text>
        </View>
        {t.min_level > 1 && (
          <View style={styles.metaItem}>
            <Lock size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>Lv.{t.min_level}+</Text>
          </View>
        )}
      </View>

      {/* Prizes */}
      <View style={styles.prizeRow}>
        <View style={styles.prizeItem}>
          <Crown size={12} color="#FFD700" />
          <Text style={styles.prizeText}>{t.prize_xp_1st.toLocaleString()} XP</Text>
        </View>
        <View style={styles.prizeItem}>
          <Medal size={12} color="#C0C0C0" />
          <Text style={styles.prizeText}>{t.prize_xp_2nd.toLocaleString()} XP</Text>
        </View>
        <View style={styles.prizeItem}>
          <Award size={12} color="#CD7F32" />
          <Text style={styles.prizeText}>{t.prize_xp_3rd.toLocaleString()} XP</Text>
        </View>
      </View>

      {/* My result */}
      {entered && t.my_entry?.best_result != null && (
        <View style={styles.myResultRow}>
          <Text style={styles.myResultLabel}>Your best:</Text>
          <Text style={styles.myResultValue}>
            {formatResult(t.type, t.my_entry.best_result)}
          </Text>
          {t.my_entry.rank != null && (
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>#{t.my_entry.rank}</Text>
            </View>
          )}
        </View>
      )}

      {/* Action buttons */}
      {canClaim && onClaim && (
        <TouchableOpacity style={styles.claimBtn} onPress={onClaim} activeOpacity={0.8}>
          <Zap size={14} color="#000" style={{ marginRight: 6 }} />
          <Text style={styles.claimBtnText}>
            Claim {(t.my_entry?.xp_awarded ?? 0).toLocaleString()} XP
          </Text>
        </TouchableOpacity>
      )}

      {!entered && t.status === 'active' && onJoin && (
        <TouchableOpacity
          style={[styles.joinBtn, joining && styles.disabledBtn]}
          onPress={onJoin}
          disabled={joining}
          activeOpacity={0.8}
        >
          {joining ? (
            <ActivityIndicator size="small" color="#000" style={{ marginRight: 6 }} />
          ) : (
            <Flag size={14} color="#000" style={{ marginRight: 6 }} />
          )}
          <Text style={styles.joinBtnText}>{joining ? 'Joining…' : 'Enter Tournament'}</Text>
        </TouchableOpacity>
      )}

      {!entered && t.status === 'upcoming' && onJoin && (
        <TouchableOpacity
          style={[styles.remindBtn, joining && styles.disabledBtn]}
          onPress={onJoin}
          disabled={joining}
          activeOpacity={0.8}
        >
          <Text style={styles.remindBtnText}>{joining ? 'Registering…' : 'Register Interest'}</Text>
        </TouchableOpacity>
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  emoji: { fontSize: 28 },
  name: { color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  type: { color: Colors.textSecondary, fontSize: 12 },
  statusPill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  metaRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: Colors.textSecondary, fontSize: 12 },

  prizeRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  prizeItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  prizeText: { color: Colors.textSecondary, fontSize: 12 },

  myResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary + '15',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  myResultLabel: { color: Colors.textSecondary, fontSize: 13 },
  myResultValue: { color: Colors.primary, fontSize: 15, fontWeight: '700', flex: 1 },
  rankBadge: {
    backgroundColor: Colors.primary + '33',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rankText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },

  joinBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  joinBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },

  remindBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '55',
    marginBottom: 4,
  },
  remindBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },

  claimBtn: {
    backgroundColor: '#30D158',
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  claimBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },

  disabledBtn: { opacity: 0.4 },
});
