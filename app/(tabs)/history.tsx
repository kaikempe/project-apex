import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Timer, Car, Trophy, Clock, Route, Gauge, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/src/theme/colors';
import { supabase } from '@/src/services/supabase';
import { useAuth } from '@/src/context/AuthContext';

type RecordType = 'drive' | 'sprint';

interface HistoryRecord {
  id: string;
  type: RecordType;
  date: string;
  vehicle_name: string;
  vehicle_id: string;
  top_speed: number;
  duration?: number;
  distance?: number;
  mode_id?: string;
  mode_label?: string;
  time?: number;
  is_best?: boolean;
  // Route and speed data for drives
  route?: { lat: number; lon: number; timestamp: number }[];
  speedData?: { speed: number; timestamp: number }[];
  drive_name?: string;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'drives' | 'sprints'>('all');
  const [bestTimes, setBestTimes] = useState<Record<string, number>>({});

  const fetchHistory = useCallback(async () => {
    if (!user) return;

    try {
      const { data: vehicles, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id, name, specs_json')
        .eq('owner_id', user.id);

      if (vehicleError) throw vehicleError;

      if (!vehicles || vehicles.length === 0) {
        setRecords([]);
        setLoading(false);
        return;
      }

      const allRecords: HistoryRecord[] = [];
      const globalBestTimes: Record<string, number> = {};

      vehicles.forEach((vehicle) => {
        const specs = vehicle.specs_json || {};
        
        // Get drives
        const driveHistory = specs.drive_history || [];
        driveHistory.forEach((drive: any, index: number) => {
          allRecords.push({
            id: `drive_${vehicle.id}_${index}_${drive.end_time || Date.now()}`,
            type: 'drive',
            date: drive.end_time || drive.start_time || new Date().toISOString(),
            vehicle_name: drive.vehicle_name || vehicle.name,
            vehicle_id: vehicle.id,
            top_speed: drive.top_speed || 0,
            duration: drive.duration || 0,
            distance: drive.distance || 0,
            route: drive.route || [],
            speedData: drive.speed_data || [],
            drive_name: drive.drive_name || '',
          });
        });

        // Get sprints
        const sprintHistory = specs.sprint_history || [];
        const vehicleBestTimes = specs.best_times || {};

        Object.entries(vehicleBestTimes).forEach(([modeId, time]) => {
          if (!globalBestTimes[modeId] || (time as number) < globalBestTimes[modeId]) {
            globalBestTimes[modeId] = time as number;
          }
        });

        sprintHistory.forEach((sprint: any, index: number) => {
          allRecords.push({
            id: `sprint_${vehicle.id}_${index}_${sprint.date || Date.now()}`,
            type: 'sprint',
            date: sprint.date || new Date().toISOString(),
            vehicle_name: vehicle.name,
            vehicle_id: vehicle.id,
            top_speed: sprint.top_speed || 0,
            mode_id: sprint.mode_id,
            mode_label: sprint.mode_label,
            time: sprint.time,
            is_best: vehicleBestTimes[sprint.mode_id] === sprint.time,
          });
        });
      });

      allRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecords(allRecords);
      setBestTimes(globalBestTimes);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 10) return seconds.toFixed(3);
    if (seconds < 60) return seconds.toFixed(2);
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Unknown';
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else if (diffDays === 1) {
        return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else {
        return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
      }
    } catch {
      return 'Unknown';
    }
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const handleDrivePress = (item: HistoryRecord) => {
    router.push({
      pathname: '/drive-detail',
      params: {
        id: item.id,
        vehicleId: item.vehicle_id,
        vehicleName: item.vehicle_name,
        date: item.date,
        duration: item.duration,
        topSpeed: item.top_speed,
        distance: item.distance,
        route: JSON.stringify(item.route || []),
        speedData: JSON.stringify(item.speedData || []),
        driveName: item.drive_name || '',
      },
    });
  };

  const filteredRecords = records.filter((record) => {
    if (filter === 'all') return true;
    if (filter === 'drives') return record.type === 'drive';
    if (filter === 'sprints') return record.type === 'sprint';
    return true;
  });

  const getDriveName = (item: HistoryRecord): string => {
    if (item.drive_name) return item.drive_name;
    
    // Generate default name based on time with date
    try {
      const date = new Date(item.date);
      const hour = date.getHours();
      const day = date.getDate();
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      
      let timeOfDay = 'Night';
      if (hour >= 5 && hour < 12) timeOfDay = 'Morning';
      else if (hour >= 12 && hour < 17) timeOfDay = 'Afternoon';
      else if (hour >= 17 && hour < 21) timeOfDay = 'Evening';
      
      return `${timeOfDay} Drive · ${day} ${month}`;
    } catch {
      return 'Drive';
    }
  };

  const renderDriveCard = (item: HistoryRecord) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleDrivePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardType}>
          <Route size={16} color={Colors.primary} />
          <Text style={styles.cardTypeText}>{getDriveName(item)}</Text>
        </View>
        <ChevronRight size={20} color={Colors.textSecondary} />
      </View>

      <View style={styles.driveStats}>
        <View style={styles.driveStat}>
          <Clock size={18} color={Colors.textSecondary} />
          <Text style={styles.driveStatValue}>{formatDuration(item.duration || 0)}</Text>
          <Text style={styles.driveStatLabel}>Duration</Text>
        </View>
        <View style={styles.driveStat}>
          <Gauge size={18} color={Colors.success} />
          <Text style={styles.driveStatValue}>{Math.round(item.top_speed)}</Text>
          <Text style={styles.driveStatLabel}>Top km/h</Text>
        </View>
        <View style={styles.driveStat}>
          <Route size={18} color={Colors.primary} />
          <Text style={styles.driveStatValue}>{formatDistance(item.distance || 0)}</Text>
          <Text style={styles.driveStatLabel}>Distance</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.vehicleTag}>
          <Car size={12} color={Colors.textSecondary} />
          <Text style={styles.vehicleTagText}>{item.vehicle_name}</Text>
        </View>
        <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSprintCard = (item: HistoryRecord) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardType}>
          <Timer size={16} color={Colors.warning} />
          <Text style={[styles.cardTypeText, { color: Colors.warning }]}>
            {item.mode_label}
          </Text>
        </View>
        {item.is_best && (
          <View style={styles.bestBadge}>
            <Trophy size={12} color={Colors.warning} />
            <Text style={styles.bestBadgeText}>PB</Text>
          </View>
        )}
      </View>

      <View style={styles.sprintTimeRow}>
        <Text style={styles.sprintTime}>{formatTime(item.time || 0)}</Text>
        <Text style={styles.sprintTimeUnit}>s</Text>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.vehicleTag}>
          <Car size={12} color={Colors.textSecondary} />
          <Text style={styles.vehicleTagText}>{item.vehicle_name}</Text>
        </View>
        <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: HistoryRecord }) => {
    if (item.type === 'drive') return renderDriveCard(item);
    return renderSprintCard(item);
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Car size={64} color={Colors.textSecondary} />
      </View>
      <Text style={styles.emptyTitle}>No drives yet</Text>
      <Text style={styles.emptySubtitle}>
        Start a drive session to see{'\n'}your history here
      </Text>
    </View>
  );

  const renderBestTimes = () => {
    const entries = Object.entries(bestTimes);
    if (entries.length === 0) return null;

    return (
      <View style={styles.bestTimesContainer}>
        <Text style={styles.bestTimesTitle}>Personal Bests</Text>
        <View style={styles.bestTimesGrid}>
          {entries.map(([modeId, time]) => (
            <View key={modeId} style={styles.bestTimeCard}>
              <Text style={styles.bestTimeMode}>{modeId}</Text>
              <Text style={styles.bestTimeValue}>{formatTime(time)}</Text>
              <Text style={styles.bestTimeUnit}>seconds</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderFilters = () => (
    <View style={styles.filterContainer}>
      {(['all', 'drives', 'sprints'] as const).map((f) => (
        <TouchableOpacity
          key={f}
          style={[styles.filterButton, filter === f && styles.filterButtonActive]}
          onPress={() => setFilter(f)}
        >
          <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>History</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        <Text style={styles.headerSubtitle}>
          {records.length} record{records.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {records.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredRecords}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              {renderBestTimes()}
              {renderFilters()}
            </>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.secondary,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },

  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.secondary,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.textPrimary,
  },

  bestTimesContainer: {
    marginBottom: 20,
  },
  bestTimesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  bestTimesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bestTimeCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.warning + '40',
  },
  bestTimeMode: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.warning,
    marginBottom: 4,
  },
  bestTimeValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  bestTimeUnit: {
    fontSize: 10,
    color: Colors.textSecondary,
  },

  card: {
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  cardTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    flexShrink: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.background,
  },
  vehicleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vehicleTagText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  cardDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  driveStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  driveStat: {
    alignItems: 'center',
    gap: 4,
  },
  driveStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  driveStatLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
  },

  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bestBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.warning,
  },
  sprintTimeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sprintTime: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  sprintTimeUnit: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginLeft: 4,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
