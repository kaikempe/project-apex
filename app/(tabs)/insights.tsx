import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Route,
  Clock,
  Zap,
  Gauge,
  Calendar,
  TrendingUp,
  Car,
  Timer,
  Trophy,
} from 'lucide-react-native';
import { Colors } from '@/src/theme/colors';
import { supabase } from '@/src/services/supabase';
import { useAuth } from '@/src/context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DriveRecord {
  duration: number;
  top_speed: number;
  distance: number;
  start_time: string;
  end_time: string;
  vehicle_name: string;
}

interface SprintRecord {
  mode_id: string;
  mode_label: string;
  time: number;
  top_speed: number;
  date: string;
}

interface InsightsData {
  totalDrives: number;
  totalDistance: number;
  totalDuration: number;
  topSpeed: number;
  avgSpeed: number;
  avgDriveDistance: number;
  avgDriveDuration: number;
  bestSprints: Record<string, number>;
  drivesByDay: { date: string; count: number; distance: number }[];
  speedDistribution: { range: string; count: number }[];
  vehicleStats: { name: string; drives: number; distance: number; topSpeed: number }[];
}

export default function InsightsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [insights, setInsights] = useState<InsightsData | null>(null);

  const fetchInsights = useCallback(async () => {
    if (!user) return;

    try {
      const { data: vehicles, error } = await supabase
        .from('vehicles')
        .select('id, name, specs_json')
        .eq('owner_id', user.id);

      if (error) throw error;

      // Aggregate data
      const allDrives: (DriveRecord & { vehicle_name: string })[] = [];
      const allSprints: SprintRecord[] = [];
      const vehicleStats: Map<string, { drives: number; distance: number; topSpeed: number }> = new Map();
      const bestSprints: Record<string, number> = {};

      vehicles?.forEach((vehicle) => {
        const specs = vehicle.specs_json || {};
        const driveHistory = specs.drive_history || [];
        const sprintHistory = specs.sprint_history || [];
        const vehicleBestTimes = specs.best_times || {};

        // Process drives
        driveHistory.forEach((drive: any) => {
          allDrives.push({
            duration: drive.duration || 0,
            top_speed: drive.top_speed || 0,
            distance: drive.distance || 0,
            start_time: drive.start_time || '',
            end_time: drive.end_time || '',
            vehicle_name: drive.vehicle_name || vehicle.name,
          });
        });

        // Process sprints
        sprintHistory.forEach((sprint: any) => {
          allSprints.push({
            mode_id: sprint.mode_id,
            mode_label: sprint.mode_label,
            time: sprint.time,
            top_speed: sprint.top_speed || 0,
            date: sprint.date,
          });
        });

        // Best sprint times
        Object.entries(vehicleBestTimes).forEach(([modeId, time]) => {
          if (!bestSprints[modeId] || (time as number) < bestSprints[modeId]) {
            bestSprints[modeId] = time as number;
          }
        });

        // Vehicle stats
        const vStats = vehicleStats.get(vehicle.name) || { drives: 0, distance: 0, topSpeed: 0 };
        vStats.drives += driveHistory.length;
        driveHistory.forEach((drive: any) => {
          vStats.distance += drive.distance || 0;
          vStats.topSpeed = Math.max(vStats.topSpeed, drive.top_speed || 0);
        });
        vehicleStats.set(vehicle.name, vStats);
      });

      // Calculate totals
      const totalDrives = allDrives.length;
      const totalDistance = allDrives.reduce((sum, d) => sum + d.distance, 0);
      const totalDuration = allDrives.reduce((sum, d) => sum + d.duration, 0);
      const topSpeed = Math.max(...allDrives.map(d => d.top_speed), 0);
      
      // Average speed (total distance / total time)
      const avgSpeed = totalDuration > 0 ? (totalDistance / 1000) / (totalDuration / 3600) : 0;
      const avgDriveDistance = totalDrives > 0 ? totalDistance / totalDrives : 0;
      const avgDriveDuration = totalDrives > 0 ? totalDuration / totalDrives : 0;

      // Drives by day (last 7 days)
      const drivesByDay: { date: string; count: number; distance: number }[] = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayDrives = allDrives.filter(d => {
          try {
            return d.end_time.split('T')[0] === dateStr;
          } catch {
            return false;
          }
        });
        
        drivesByDay.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          count: dayDrives.length,
          distance: dayDrives.reduce((sum, d) => sum + d.distance, 0),
        });
      }

      // Speed distribution
      const speedRanges = [
        { range: '0-50', min: 0, max: 50 },
        { range: '50-80', min: 50, max: 80 },
        { range: '80-120', min: 80, max: 120 },
        { range: '120-160', min: 120, max: 160 },
        { range: '160+', min: 160, max: Infinity },
      ];
      
      const speedDistribution = speedRanges.map(({ range, min, max }) => ({
        range,
        count: allDrives.filter(d => d.top_speed >= min && d.top_speed < max).length,
      }));

      setInsights({
        totalDrives,
        totalDistance,
        totalDuration,
        topSpeed,
        avgSpeed,
        avgDriveDistance,
        avgDriveDuration,
        bestSprints,
        drivesByDay,
        speedDistribution,
        vehicleStats: Array.from(vehicleStats.entries()).map(([name, stats]) => ({
          name,
          ...stats,
        })),
      });
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  useFocusEffect(
    useCallback(() => {
      fetchInsights();
    }, [fetchInsights])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchInsights();
  };

  // Format helpers
  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const formatSprintTime = (seconds: number): string => {
    return seconds.toFixed(2);
  };

  // Bar chart component
  const BarChart = ({ data, maxValue, color }: { 
    data: { label: string; value: number }[]; 
    maxValue: number;
    color: string;
  }) => {
    const barWidth = (SCREEN_WIDTH - 80) / data.length - 4;
    
    return (
      <View style={styles.chartContainer}>
        <View style={styles.barsRow}>
          {data.map((item, index) => {
            const height = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
            return (
              <View key={index} style={styles.barWrapper}>
                <View style={[styles.barBackground, { width: barWidth }]}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${Math.max(height, 2)}%`,
                        backgroundColor: color,
                        width: barWidth,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Insights</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const hasData = insights && insights.totalDrives > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Insights</Text>
        {hasData && (
          <Text style={styles.headerSubtitle}>
            {insights.totalDrives} drive{insights.totalDrives !== 1 ? 's' : ''} analyzed
          </Text>
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {!hasData ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <TrendingUp size={64} color={Colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptySubtitle}>
              Start driving to see your{'\n'}statistics and insights
            </Text>
          </View>
        ) : (
          <>
            {/* Overview Stats */}
            <View style={styles.overviewGrid}>
              <View style={styles.overviewCard}>
                <Route size={24} color={Colors.primary} />
                <Text style={styles.overviewValue}>{formatDistance(insights.totalDistance)}</Text>
                <Text style={styles.overviewLabel}>Total Distance</Text>
              </View>
              <View style={styles.overviewCard}>
                <Clock size={24} color={Colors.warning} />
                <Text style={styles.overviewValue}>{formatDuration(insights.totalDuration)}</Text>
                <Text style={styles.overviewLabel}>Total Time</Text>
              </View>
              <View style={styles.overviewCard}>
                <Zap size={24} color={Colors.error} />
                <Text style={styles.overviewValue}>{Math.round(insights.topSpeed)}</Text>
                <Text style={styles.overviewLabel}>Top Speed (km/h)</Text>
              </View>
              <View style={styles.overviewCard}>
                <Gauge size={24} color={Colors.success} />
                <Text style={styles.overviewValue}>{Math.round(insights.avgSpeed)}</Text>
                <Text style={styles.overviewLabel}>Avg Speed (km/h)</Text>
              </View>
            </View>

            {/* Weekly Activity */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Calendar size={20} color={Colors.primary} />
                <Text style={styles.sectionTitle}>This Week</Text>
              </View>
              <View style={styles.chartCard}>
                <BarChart
                  data={insights.drivesByDay.map(d => ({ label: d.date, value: d.distance }))}
                  maxValue={Math.max(...insights.drivesByDay.map(d => d.distance), 1)}
                  color={Colors.primary}
                />
                <Text style={styles.chartSubtitle}>Distance driven per day</Text>
              </View>
            </View>

            {/* Speed Distribution */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Gauge size={20} color={Colors.warning} />
                <Text style={styles.sectionTitle}>Speed Distribution</Text>
              </View>
              <View style={styles.chartCard}>
                <BarChart
                  data={insights.speedDistribution.map(d => ({ label: d.range, value: d.count }))}
                  maxValue={Math.max(...insights.speedDistribution.map(d => d.count), 1)}
                  color={Colors.warning}
                />
                <Text style={styles.chartSubtitle}>Number of drives by top speed (km/h)</Text>
              </View>
            </View>

            {/* Personal Records */}
            {Object.keys(insights.bestSprints).length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Trophy size={20} color={Colors.warning} />
                  <Text style={styles.sectionTitle}>Personal Records</Text>
                </View>
                <View style={styles.recordsCard}>
                  {Object.entries(insights.bestSprints).map(([modeId, time]) => (
                    <View key={modeId} style={styles.recordRow}>
                      <View style={styles.recordMode}>
                        <Timer size={16} color={Colors.warning} />
                        <Text style={styles.recordModeText}>{modeId}</Text>
                      </View>
                      <Text style={styles.recordTime}>{formatSprintTime(time)}s</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Vehicle Breakdown */}
            {insights.vehicleStats.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Car size={20} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>By Vehicle</Text>
                </View>
                {insights.vehicleStats.map((vehicle, index) => (
                  <View key={index} style={styles.vehicleCard}>
                    <Text style={styles.vehicleName}>{vehicle.name}</Text>
                    <View style={styles.vehicleStats}>
                      <View style={styles.vehicleStat}>
                        <Text style={styles.vehicleStatValue}>{vehicle.drives}</Text>
                        <Text style={styles.vehicleStatLabel}>Drives</Text>
                      </View>
                      <View style={styles.vehicleStat}>
                        <Text style={styles.vehicleStatValue}>{formatDistance(vehicle.distance)}</Text>
                        <Text style={styles.vehicleStatLabel}>Distance</Text>
                      </View>
                      <View style={styles.vehicleStat}>
                        <Text style={styles.vehicleStatValue}>{Math.round(vehicle.topSpeed)}</Text>
                        <Text style={styles.vehicleStatLabel}>Top km/h</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Averages */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <TrendingUp size={20} color={Colors.success} />
                <Text style={styles.sectionTitle}>Averages</Text>
              </View>
              <View style={styles.averagesCard}>
                <View style={styles.avgRow}>
                  <Text style={styles.avgLabel}>Avg. drive distance</Text>
                  <Text style={styles.avgValue}>{formatDistance(insights.avgDriveDistance)}</Text>
                </View>
                <View style={styles.avgRow}>
                  <Text style={styles.avgLabel}>Avg. drive duration</Text>
                  <Text style={styles.avgValue}>{formatDuration(insights.avgDriveDuration)}</Text>
                </View>
                <View style={styles.avgRow}>
                  <Text style={styles.avgLabel}>Avg. speed</Text>
                  <Text style={styles.avgValue}>{Math.round(insights.avgSpeed)} km/h</Text>
                </View>
              </View>
            </View>

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
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

  // Overview Grid
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  overviewCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  overviewValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  overviewLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // Chart Card
  chartCard: {
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    padding: 16,
  },
  chartContainer: {
    height: 120,
  },
  barsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  barWrapper: {
    alignItems: 'center',
  },
  barBackground: {
    height: 100,
    backgroundColor: Colors.background,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  chartSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },

  // Records Card
  recordsCard: {
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    overflow: 'hidden',
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  recordMode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordModeText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  recordTime: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.warning,
    fontVariant: ['tabular-nums'],
  },

  // Vehicle Card
  vehicleCard: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  vehicleStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  vehicleStat: {
    alignItems: 'center',
  },
  vehicleStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  vehicleStatLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Averages Card
  averagesCard: {
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    overflow: 'hidden',
  },
  avgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  avgLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  avgValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
