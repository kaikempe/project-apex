import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Target, Flag, Trophy, Users, X, Crown, Medal, Award, Calendar } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { SpeedTrap, Segment, CarMeet, LeaderboardEntry } from '../context/POIContext';

type POIType = SpeedTrap | Segment | CarMeet | null;

interface POIDetailSheetProps {
  poi: POIType;
  poiType: 'speed_trap' | 'segment' | 'car_meet' | null;
  onClose: () => void;
  onViewLeaderboard?: () => void;
}

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Crown size={14} color="#FFD700" />;
  if (rank === 2) return <Medal size={14} color="#C0C0C0" />;
  if (rank === 3) return <Award size={14} color="#CD7F32" />;
  return <Text style={styles.rankText}>{rank}</Text>;
};

export const POIDetailSheet: React.FC<POIDetailSheetProps> = ({
  poi,
  poiType,
  onClose,
  onViewLeaderboard,
}) => {
  if (!poi || !poiType) return null;

  const renderSpeedTrapDetail = () => {
    const trap = poi as SpeedTrap;
    const topThree = trap.leaderboard.slice(0, 3);
    
    return (
      <>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: Colors.error + '20' }]}>
            <Target size={22} color={Colors.error} />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{trap.name}</Text>
            <Text style={styles.subtitle}>Speed Trap · Top Speed Wins</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {trap.description && (
          <Text style={styles.description}>{trap.description}</Text>
        )}

        {topThree.length > 0 ? (
          <View style={styles.miniLeaderboard}>
            {topThree.map((entry, index) => (
              <View key={index} style={styles.leaderboardRow}>
                <View style={styles.rankContainer}>{getRankIcon(entry.rank)}</View>
                <Text style={styles.username} numberOfLines={1}>{entry.username}</Text>
                <Text style={styles.value}>{entry.value} <Text style={styles.unit}>km/h</Text></Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyLeaderboard}>
            <Text style={styles.emptyText}>No records yet - be the first!</Text>
          </View>
        )}

        <TouchableOpacity style={styles.actionButton} onPress={onViewLeaderboard}>
          <Trophy size={16} color={Colors.textPrimary} />
          <Text style={styles.actionButtonText}>View Leaderboard</Text>
        </TouchableOpacity>
      </>
    );
  };

  const renderSegmentDetail = () => {
    const segment = poi as Segment;
    const topThree = segment.leaderboard.slice(0, 3);
    
    return (
      <>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: Colors.warning + '20' }]}>
            <Flag size={22} color={Colors.warning} />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{segment.name}</Text>
            <Text style={styles.subtitle}>
              {(segment.distance_meters / 1000).toFixed(1)} km · Fastest Time Wins
            </Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {segment.description && (
          <Text style={styles.description}>{segment.description}</Text>
        )}

        {topThree.length > 0 ? (
          <View style={styles.miniLeaderboard}>
            {topThree.map((entry, index) => (
              <View key={index} style={styles.leaderboardRow}>
                <View style={styles.rankContainer}>{getRankIcon(entry.rank)}</View>
                <Text style={styles.username} numberOfLines={1}>{entry.username}</Text>
                <Text style={styles.value}>{entry.value.toFixed(1)} <Text style={styles.unit}>sec</Text></Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyLeaderboard}>
            <Text style={styles.emptyText}>No records yet - be the first!</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.actionButton, { backgroundColor: Colors.warning }]} onPress={onViewLeaderboard}>
          <Trophy size={16} color={Colors.textPrimary} />
          <Text style={styles.actionButtonText}>View Leaderboard</Text>
        </TouchableOpacity>
      </>
    );
  };

  const renderCarMeetDetail = () => {
    const meet = poi as CarMeet;
    
    return (
      <>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: Colors.primary + '20' }]}>
            <Users size={22} color={Colors.primary} />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{meet.name}</Text>
            <Text style={styles.subtitle}>Car Meet</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {meet.description && (
          <Text style={styles.description}>{meet.description}</Text>
        )}

        <View style={styles.meetInfo}>
          {meet.schedule && (
            <View style={styles.meetInfoRow}>
              <Calendar size={14} color={Colors.textSecondary} />
              <Text style={styles.meetInfoText}>{meet.schedule}</Text>
            </View>
          )}
          <View style={styles.meetInfoRow}>
            <Users size={14} color={Colors.textSecondary} />
            <Text style={styles.meetInfoText}>{meet.attendees_count} interested</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.actionButton, { backgroundColor: Colors.primary }]}>
          <Users size={16} color={Colors.textPrimary} />
          <Text style={styles.actionButtonText}>I'm Interested</Text>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <View style={styles.container}>
      {poiType === 'speed_trap' && renderSpeedTrapDetail()}
      {poiType === 'segment' && renderSegmentDetail()}
      {poiType === 'car_meet' && renderCarMeetDetail()}
    </View>
  );
};

const styles = StyleSheet.create({
  // Positioned above the speedometer and drive session HUD
  container: {
    position: 'absolute',
    bottom: 220, // Above speedometer (centered) and drive session button
    left: 16,
    right: 16,
    backgroundColor: Colors.secondary,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 10,
    lineHeight: 18,
  },
  miniLeaderboard: {
    marginBottom: 10,
    gap: 6,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  rankContainer: {
    width: 20,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  username: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  unit: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  emptyLeaderboard: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.error,
    borderRadius: 10,
    paddingVertical: 10,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  meetInfo: {
    marginBottom: 10,
    gap: 6,
  },
  meetInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meetInfoText: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
});

export default POIDetailSheet;
