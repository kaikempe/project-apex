import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import {
  Users,
  Trophy,
  Search,
  UserPlus,
  MapPin,
  Zap,
  Timer,
  ChevronRight,
  Car,
  Crown,
  Medal,
  Award,
  Activity,
  Target,
  X,
  Flag,
  Calendar,
  Plus,
  Trash2,
  TrendingUp,
} from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';

import { Colors } from '@/src/theme/colors';
import { useAuth } from '@/src/context/AuthContext';
import { usePOI, SpeedTrap, Segment, LeaderboardEntry } from '@/src/context/POIContext';
import { useFriends } from '@/src/context/FriendsContext';
import { useConvoy } from '@/src/context/ConvoyContext';
import { useLocation } from '@/src/hooks/useLocation';
import { useMapTheme } from '@/src/context/MapThemeContext';
import { useRouter } from 'expo-router';
import { POICreator } from '@/src/components/POICreator';
import { ConvoyPanel } from '@/src/components/ConvoyPanel';
import { CrewSection } from '@/src/components/CrewSection';
import { useChallenge } from '@/src/context/ChallengeContext';
import { useTournament } from '@/src/context/TournamentContext';
import { useRivals } from '@/src/context/RivalContext';
import { Swords, Route } from 'lucide-react-native';
import { haversineDistanceKm } from '@/src/utils/distance';
import { supabase } from '@/src/services/supabase';
import { SpeedTrapRecord, SegmentRecord, SpeedTrapData, SegmentData } from '@/src/types/supabase';

// Types
interface NearbyDriver {
  id: string;
  username: string;
  distance_km: number;
  current_speed: number;
  vehicle_name?: string;
  is_friend: boolean;
}

interface ActivityItem {
  id: string;
  username: string;
  type: 'speed_trap' | 'segment';
  location_name: string;
  value: number;
  unit: string;
  timestamp: string;
  poi_id: string;
}

interface TrendingPOI {
  id: string;
  name: string;
  type: 'speed_trap' | 'segment';
  record_count: number;
}

interface TopRecord {
  id: string;
  username: string;
  value: number;
  poi_name: string;
  type: 'speed' | 'time';
  poi_id: string;
}

// Tournaments row — separate component to use TournamentContext
function TournamentsRow() {
  const router = useRouter();
  const { theme } = useTheme();
  const { activeCount } = useTournament();

  return (
    <View style={{ marginBottom: 0 }}>
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
        onPress={() => router.push('/tournaments')}
        activeOpacity={0.7}
      >
        <Flag size={20} color="#FF6B35" />
        <Text style={{ fontSize: 18, fontWeight: '600', color: theme.textPrimary, flex: 1 }}>
          Tournaments
        </Text>
        {activeCount > 0 && (
          <View style={{
            backgroundColor: '#FF6B35',
            borderRadius: 10,
            minWidth: 20,
            height: 20,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 5,
          }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF' }}>{activeCount}</Text>
          </View>
        )}
        <ChevronRight size={18} color={theme.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

// Rivals row — separate component to use RivalContext
function RivalsRow() {
  const router = useRouter();
  const { theme } = useTheme();
  const { rivals } = useRivals();

  return (
    <View style={{ marginBottom: 0 }}>
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
        onPress={() => router.push('/rivals')}
        activeOpacity={0.7}
      >
        <Swords size={20} color={Colors.error} />
        <Text style={{ fontSize: 18, fontWeight: '600', color: theme.textPrimary, flex: 1 }}>
          Rivals
        </Text>
        {rivals.length > 0 && (
          <View style={{
            backgroundColor: '#2A2A2A',
            borderRadius: 10,
            minWidth: 20,
            height: 20,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 5,
          }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textSecondary }}>
              {rivals.length}/3
            </Text>
          </View>
        )}
        <ChevronRight size={18} color={theme.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

// Challenges shortcut row — separate component so it can use ChallengeContext
function ChallengesRow() {
  const router = useRouter();
  const { theme } = useTheme();
  const { pendingCount, activeChallenges } = useChallenge();
  const totalBadge = pendingCount + activeChallenges.length;

  return (
    <View style={{ marginBottom: 24 }}>
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}
        onPress={() => router.push('/challenges')}
        activeOpacity={0.7}
      >
        <Swords size={20} color={theme.primary} />
        <Text style={{ fontSize: 18, fontWeight: '600', color: theme.textPrimary, flex: 1 }}>
          Challenges
        </Text>
        {totalBadge > 0 && (
          <View style={{
            backgroundColor: Colors.error,
            borderRadius: 10,
            minWidth: 20,
            height: 20,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 5,
          }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textPrimary }}>{totalBadge}</Text>
          </View>
        )}
        <ChevronRight size={18} color={theme.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

export default function SocialScreen() {
  const { user } = useAuth();
  const { speedTraps, segments, deleteSpeedTrap, deleteSegment } = usePOI();
  const { liveLocations } = useFriends();
  const { activeConvoy } = useConvoy();
  const { location } = useLocation();
  const router = useRouter();
  const { mapStyle, mapType } = useMapTheme();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrap, setSelectedTrap] = useState<SpeedTrap | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);

  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [trendingPOIs, setTrendingPOIs] = useState<TrendingPOI[]>([]);
  const [topSpeeds, setTopSpeeds] = useState<TopRecord[]>([]);
  const [topTimes, setTopTimes] = useState<TopRecord[]>([]);
  const [showPOICreator, setShowPOICreator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activityExpanded, setActivityExpanded] = useState(false);

  // Format distance for display
  const formatDistance = (distanceKm: number): string => {
    if (distanceKm < 1) {
      // Show in meters if less than 1 km
      return `${Math.round(distanceKm * 1000)} m away`;
    } else {
      // Show in km with 2 decimal places
      return `${distanceKm.toFixed(2)} km away`;
    }
  };

  // Format timestamp as "X ago"
  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // Fetch activity feed data
  const fetchActivityFeed = async () => {
    try {
      // Get recent speed trap records
      const { data: speedRecords, error: speedError } = await supabase
        .from('speed_trap_records')
        .select('id, speed, created_at, user_id, profiles(username, display_name), speed_traps(id, name)')
        .order('created_at', { ascending: false })
        .limit(10);

      // Get recent segment records
      const { data: segmentRecords, error: segmentError } = await supabase
        .from('segment_records')
        .select('id, time_seconds, created_at, user_id, profiles(username, display_name), segments(id, name)')
        .order('created_at', { ascending: false })
        .limit(10);

      if (speedError || segmentError) {
        console.error('Error fetching activity:', speedError || segmentError);
        return;
      }

      // Combine and sort all records
      const combinedActivity: ActivityItem[] = [];

      speedRecords?.forEach((record: any) => {
        combinedActivity.push({
          id: record.id,
          username: record.profiles?.display_name || record.profiles?.username || 'Unknown',
          type: 'speed_trap',
          location_name: record.speed_traps?.name || 'Unknown Location',
          value: record.speed,
          unit: 'km/h',
          timestamp: formatTimeAgo(record.created_at),
          poi_id: record.speed_traps?.id || '',
        });
      });

      segmentRecords?.forEach((record: any) => {
        combinedActivity.push({
          id: record.id,
          username: record.profiles?.display_name || record.profiles?.username || 'Unknown',
          type: 'segment',
          location_name: record.segments?.name || 'Unknown Location',
          value: record.time_seconds,
          unit: 's',
          timestamp: formatTimeAgo(record.created_at),
          poi_id: record.segments?.id || '',
        });
      });

      // Sort by most recent first (already sorted in queries, but combine them)
      combinedActivity.sort((a, b) => {
        // Extract original timestamps for accurate sorting
        const recordA = speedRecords?.find((r: any) => r.id === a.id) || segmentRecords?.find((r: any) => r.id === a.id);
        const recordB = speedRecords?.find((r: any) => r.id === b.id) || segmentRecords?.find((r: any) => r.id === b.id);
        if (!recordA || !recordB) return 0;
        return new Date(recordB.created_at).getTime() - new Date(recordA.created_at).getTime();
      });

      setActivity(combinedActivity.slice(0, 15));
    } catch (error) {
      console.error('Error fetching activity feed:', error);
    }
  };

  // Fetch trending POIs (most active in last 7 days)
  const fetchTrendingPOIs = async () => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get speed trap record counts
      const { data: speedTrapCounts, error: speedError } = await supabase
        .from('speed_trap_records')
        .select('trap_id, speed_traps(id, name)')
        .gte('created_at', sevenDaysAgo.toISOString());

      // Get segment record counts
      const { data: segmentCounts, error: segmentError } = await supabase
        .from('segment_records')
        .select('segment_id, segments(id, name)')
        .gte('created_at', sevenDaysAgo.toISOString());

      if (speedError || segmentError) {
        console.error('Error fetching trending POIs:', speedError || segmentError);
        return;
      }

      // Count records per POI
      const speedTrapMap = new Map<string, { name: string; count: number }>();
      speedTrapCounts?.forEach((record: any) => {
        const id = record.speed_traps?.id;
        const name = record.speed_traps?.name;
        if (id && name) {
          const current = speedTrapMap.get(id) || { name, count: 0 };
          speedTrapMap.set(id, { name, count: current.count + 1 });
        }
      });

      const segmentMap = new Map<string, { name: string; count: number }>();
      segmentCounts?.forEach((record: any) => {
        const id = record.segments?.id;
        const name = record.segments?.name;
        if (id && name) {
          const current = segmentMap.get(id) || { name, count: 0 };
          segmentMap.set(id, { name, count: current.count + 1 });
        }
      });

      // Combine and sort
      const trending: TrendingPOI[] = [];

      speedTrapMap.forEach((value, key) => {
        trending.push({
          id: key,
          name: value.name,
          type: 'speed_trap',
          record_count: value.count,
        });
      });

      segmentMap.forEach((value, key) => {
        trending.push({
          id: key,
          name: value.name,
          type: 'segment',
          record_count: value.count,
        });
      });

      trending.sort((a, b) => b.record_count - a.record_count);
      setTrendingPOIs(trending.slice(0, 5));
    } catch (error) {
      console.error('Error fetching trending POIs:', error);
    }
  };

  // Fetch top records from last 24 hours
  const fetchTopRecords = async () => {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      // Get top speeds today
      const { data: topSpeedsData, error: speedsError } = await supabase
        .from('speed_trap_records')
        .select('id, speed, profiles(username, display_name), speed_traps(id, name)')
        .gte('created_at', oneDayAgo.toISOString())
        .order('speed', { ascending: false })
        .limit(5);

      // Get top times today
      const { data: topTimesData, error: timesError } = await supabase
        .from('segment_records')
        .select('id, time_seconds, profiles(username, display_name), segments(id, name)')
        .gte('created_at', oneDayAgo.toISOString())
        .order('time_seconds', { ascending: true })
        .limit(5);

      if (speedsError || timesError) {
        console.error('Error fetching top records:', speedsError || timesError);
        return;
      }

      setTopSpeeds(
        topSpeedsData?.map((record: any) => ({
          id: record.id,
          username: record.profiles?.display_name || record.profiles?.username || 'Unknown',
          value: record.speed,
          poi_name: record.speed_traps?.name || 'Unknown',
          type: 'speed' as const,
          poi_id: record.speed_traps?.id || '',
        })) || []
      );

      setTopTimes(
        topTimesData?.map((record: any) => ({
          id: record.id,
          username: record.profiles?.display_name || record.profiles?.username || 'Unknown',
          value: record.time_seconds,
          poi_name: record.segments?.name || 'Unknown',
          type: 'time' as const,
          poi_id: record.segments?.id || '',
        })) || []
      );
    } catch (error) {
      console.error('Error fetching top records:', error);
    }
  };

  // Load all data
  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      fetchActivityFeed(),
      fetchTrendingPOIs(),
      fetchTopRecords(),
    ]);
    setLoading(false);
  };

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Compute nearby drivers from live locations
  const nearbyDrivers = useMemo(() => {
    if (!location || !liveLocations || liveLocations.length === 0) {
      return [];
    }

    return liveLocations
      .map((friend) => {
        const profile = friend.profiles;
        const distance = haversineDistanceKm(
          location.latitude,
          location.longitude,
          friend.latitude,
          friend.longitude
        );

        return {
          id: friend.user_id,
          username: profile?.display_name || profile?.username || 'Friend',
          distance_km: distance,
          current_speed: friend.speed,
          vehicle_name: undefined,
          is_friend: true,
        };
      })
      .sort((a, b) => a.distance_km - b.distance_km) // Sort by distance
      .slice(0, 10); // Show top 10 closest
  }, [location, liveLocations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={16} color="#FFD700" />;
    if (rank === 2) return <Medal size={16} color="#C0C0C0" />;
    if (rank === 3) return <Award size={16} color="#CD7F32" />;
    return <Text style={styles.rankNumber}>{rank}</Text>;
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'speed_trap': return <Target size={18} color={theme.error} />;
      case 'segment': return <Timer size={18} color={theme.warning} />;
    }
  };

  // Leaderboard Modal for Speed Trap
  const renderTrapLeaderboardModal = () => {
    const isCreator = user && selectedTrap && user.id === selectedTrap.created_by;

    const handleDeleteTrap = async () => {
      if (!selectedTrap) return;

      Alert.alert(
        'Delete Speed Trap',
        `Are you sure you want to delete "${selectedTrap.name}"? This will also delete all records.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteSpeedTrap(selectedTrap.id);
                setSelectedTrap(null);
              } catch (error) {
                Alert.alert('Error', 'Failed to delete speed trap');
              }
            },
          },
        ]
      );
    };

    return (
      <Modal visible={!!selectedTrap} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedTrap(null)}>
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedTrap(null)} style={styles.modalClose}>
              <X size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <View style={styles.modalTitleContainer}>
              <View style={[styles.modalIcon, { backgroundColor: theme.error + '20' }]}>
                <Target size={24} color={theme.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedTrap?.name}</Text>
                <Text style={styles.modalSubtitle}>Speed Trap · Top Speed Wins</Text>
              </View>
              {isCreator && (
                <TouchableOpacity onPress={handleDeleteTrap} style={styles.deleteButton}>
                  <Trash2 size={20} color={theme.error} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        
        {selectedTrap?.description && (
          <Text style={styles.modalDescription}>{selectedTrap.description}</Text>
        )}

        {/* Map showing speed trap location */}
        {selectedTrap && (
          <View style={styles.modalMap}>
            <MapView
              style={styles.map}
              provider={PROVIDER_DEFAULT}
              mapType={mapType}
              initialRegion={{
                latitude: selectedTrap.latitude,
                longitude: selectedTrap.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              customMapStyle={mapStyle}
              userInterfaceStyle="dark"
              scrollEnabled={true}
              zoomEnabled={true}
              pitchEnabled={false}
              rotateEnabled={true}
            >
              <Marker
                coordinate={{
                  latitude: selectedTrap.latitude,
                  longitude: selectedTrap.longitude,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.mapMarker}>
                  <Target size={24} color={theme.error} />
                </View>
              </Marker>
              <Circle
                center={{
                  latitude: selectedTrap.latitude,
                  longitude: selectedTrap.longitude,
                }}
                radius={50}
                strokeColor={theme.error + '80'}
                fillColor={theme.error + '20'}
                strokeWidth={2}
              />
            </MapView>
          </View>
        )}

        <Text style={styles.leaderboardHeader}>Leaderboard</Text>
        
        <ScrollView style={styles.modalContent}>
          {selectedTrap?.leaderboard.map((entry, index) => (
            <View key={`${entry.user_id}-${index}`} style={[styles.leaderboardRow, index === 0 && styles.leaderboardRowFirst]}>
              <View style={styles.leaderboardRank}>
                {getRankIcon(entry.rank)}
              </View>
              <View style={styles.leaderboardUser}>
                <Text style={styles.leaderboardUsername}>{entry.username}</Text>
                {entry.vehicle_name && (
                  <Text style={styles.leaderboardVehicle}>{entry.vehicle_name}</Text>
                )}
              </View>
              <View style={styles.leaderboardValue}>
                <Text style={styles.leaderboardValueText}>{Number(entry.value).toFixed(2)}</Text>
                <Text style={styles.leaderboardUnit}>km/h</Text>
              </View>
            </View>
          ))}
          
          {(!selectedTrap?.leaderboard || selectedTrap.leaderboard.length === 0) && (
            <View style={styles.emptyLeaderboard}>
              <Trophy size={40} color={theme.textSecondary} />
              <Text style={styles.emptyLeaderboardText}>No records yet</Text>
              <Text style={styles.emptyLeaderboardSubtext}>Be the first to set a record!</Text>
            </View>
          )}

          {selectedTrap && selectedTrap.leaderboard && selectedTrap.leaderboard.length > 0 && (
            <TouchableOpacity
              style={styles.viewFullButton}
              onPress={() => {
                const trapId = selectedTrap.id;
                const trapName = selectedTrap.name;
                setSelectedTrap(null);
                setTimeout(() => {
                  router.push({
                    pathname: '/speed-trap-leaderboard',
                    params: { trapId, trapName },
                  });
                }, 100);
              }}
            >
              <Trophy size={20} color={theme.textPrimary} />
              <Text style={styles.viewFullButtonText}>View Full Leaderboard</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
    );
  };

  // Leaderboard Modal for Segment
  const renderSegmentLeaderboardModal = () => {
    const isCreator = user && selectedSegment && user.id === selectedSegment.created_by;

    const handleDeleteSegment = async () => {
      if (!selectedSegment) return;

      Alert.alert(
        'Delete Segment',
        `Are you sure you want to delete "${selectedSegment.name}"? This will also delete all records.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteSegment(selectedSegment.id);
                setSelectedSegment(null);
              } catch (error) {
                Alert.alert('Error', 'Failed to delete segment');
              }
            },
          },
        ]
      );
    };

    return (
      <Modal visible={!!selectedSegment} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedSegment(null)}>
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedSegment(null)} style={styles.modalClose}>
              <X size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <View style={styles.modalTitleContainer}>
              <View style={[styles.modalIcon, { backgroundColor: theme.warning + '20' }]}>
                <Flag size={24} color={theme.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedSegment?.name}</Text>
                <Text style={styles.modalSubtitle}>
                  Segment · {selectedSegment ? (selectedSegment.distance_meters / 1000).toFixed(1) : 0} km · Fastest Time Wins
                </Text>
              </View>
              {isCreator && (
                <TouchableOpacity onPress={handleDeleteSegment} style={styles.deleteButton}>
                  <Trash2 size={20} color={theme.error} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        
        {selectedSegment?.description && (
          <Text style={styles.modalDescription}>{selectedSegment.description}</Text>
        )}

        {/* Map showing segment route */}
        {selectedSegment && (
          <View style={styles.modalMap}>
            <MapView
              style={styles.map}
              provider={PROVIDER_DEFAULT}
              mapType={mapType}
              initialRegion={{
                latitude: (selectedSegment.start_lat + selectedSegment.end_lat) / 2,
                longitude: (selectedSegment.start_lon + selectedSegment.end_lon) / 2,
                latitudeDelta: Math.abs(selectedSegment.end_lat - selectedSegment.start_lat) * 1.5 || 0.05,
                longitudeDelta: Math.abs(selectedSegment.end_lon - selectedSegment.start_lon) * 1.5 || 0.05,
              }}
              customMapStyle={mapStyle}
              userInterfaceStyle="dark"
              scrollEnabled={true}
              zoomEnabled={true}
              pitchEnabled={false}
              rotateEnabled={true}
            >
              {/* Start Gate */}
              <Marker
                coordinate={{
                  latitude: selectedSegment.start_lat,
                  longitude: selectedSegment.start_lon,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.mapStartMarker}>
                  <Text style={styles.mapMarkerText}>START</Text>
                </View>
              </Marker>

              {/* Checkpoints */}
              {selectedSegment.checkpoints?.map((checkpoint, index) => (
                <Marker
                  key={`checkpoint-${index}`}
                  coordinate={{
                    latitude: checkpoint.latitude,
                    longitude: checkpoint.longitude,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.mapCheckpointMarker}>
                    <Text style={styles.mapCheckpointText}>{checkpoint.order}</Text>
                  </View>
                </Marker>
              ))}

              {/* End Gate */}
              <Marker
                coordinate={{
                  latitude: selectedSegment.end_lat,
                  longitude: selectedSegment.end_lon,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.mapEndMarker}>
                  <Text style={styles.mapMarkerText}>END</Text>
                </View>
              </Marker>

              {/* Route line - priority: ghost waypoints > planned route > checkpoint path */}
              {selectedSegment.ghost?.waypoints && selectedSegment.ghost.waypoints.length > 0 ? (
                // Actual driven route (record holder's path)
                <Polyline
                  coordinates={selectedSegment.ghost.waypoints.map(wp => ({
                    latitude: wp.latitude,
                    longitude: wp.longitude,
                  }))}
                  strokeColor={theme.primary}
                  strokeWidth={3}
                />
              ) : selectedSegment.route_polyline && selectedSegment.route_polyline.length > 0 ? (
                // Planned route (from Google Maps when created)
                <Polyline
                  coordinates={selectedSegment.route_polyline}
                  strokeColor={theme.primary}
                  strokeWidth={3}
                />
              ) : (
                // Fallback: straight lines through checkpoints
                <Polyline
                  coordinates={[
                    { latitude: selectedSegment.start_lat, longitude: selectedSegment.start_lon },
                    ...(selectedSegment.checkpoints || []).map(cp => ({
                      latitude: cp.latitude,
                      longitude: cp.longitude,
                    })),
                    { latitude: selectedSegment.end_lat, longitude: selectedSegment.end_lon },
                  ]}
                  strokeColor={theme.warning}
                  strokeWidth={4}
                  lineDashPattern={[10, 5]}
                />
              )}

              {/* Start circle */}
              <Circle
                center={{
                  latitude: selectedSegment.start_lat,
                  longitude: selectedSegment.start_lon,
                }}
                radius={50}
                strokeColor={theme.success + '80'}
                fillColor={theme.success + '20'}
                strokeWidth={2}
              />

              {/* Checkpoint circles */}
              {selectedSegment.checkpoints?.map((checkpoint, index) => (
                <Circle
                  key={`circle-${index}`}
                  center={{
                    latitude: checkpoint.latitude,
                    longitude: checkpoint.longitude,
                  }}
                  radius={checkpoint.radius_meters || 30}
                  strokeColor={theme.warning + '80'}
                  fillColor={theme.warning + '20'}
                  strokeWidth={2}
                />
              ))}

              {/* End circle */}
              <Circle
                center={{
                  latitude: selectedSegment.end_lat,
                  longitude: selectedSegment.end_lon,
                }}
                radius={50}
                strokeColor={theme.error + '80'}
                fillColor={theme.error + '20'}
                strokeWidth={2}
              />
            </MapView>
          </View>
        )}

        <Text style={styles.leaderboardHeader}>Leaderboard</Text>
        
        <ScrollView style={styles.modalContent}>
          {selectedSegment?.leaderboard.map((entry, index) => (
            <View key={`${entry.user_id}-${index}`} style={[styles.leaderboardRow, index === 0 && styles.leaderboardRowFirst]}>
              <View style={styles.leaderboardRank}>
                {getRankIcon(entry.rank)}
              </View>
              <View style={styles.leaderboardUser}>
                <Text style={styles.leaderboardUsername}>{entry.username}</Text>
                {entry.vehicle_name && (
                  <Text style={styles.leaderboardVehicle}>{entry.vehicle_name}</Text>
                )}
              </View>
              <View style={styles.leaderboardValue}>
                <Text style={styles.leaderboardValueText}>{entry.value.toFixed(1)}</Text>
                <Text style={styles.leaderboardUnit}>sec</Text>
              </View>
            </View>
          ))}
          
          {(!selectedSegment?.leaderboard || selectedSegment.leaderboard.length === 0) && (
            <View style={styles.emptyLeaderboard}>
              <Trophy size={40} color={theme.textSecondary} />
              <Text style={styles.emptyLeaderboardText}>No records yet</Text>
              <Text style={styles.emptyLeaderboardSubtext}>Be the first to set a record!</Text>
            </View>
          )}

          {selectedSegment && selectedSegment.leaderboard && selectedSegment.leaderboard.length > 0 && (
            <TouchableOpacity
              style={styles.viewFullButton}
              onPress={() => {
                const segmentId = selectedSegment.id;
                const segmentName = selectedSegment.name;
                setSelectedSegment(null);
                setTimeout(() => {
                  router.push({
                    pathname: '/segment-leaderboard',
                    params: { segmentId, segmentName },
                  });
                }, 100);
              }}
            >
              <Trophy size={20} color={theme.textPrimary} />
              <Text style={styles.viewFullButtonText}>View Full Leaderboard</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
    );
  };

  // Nearby Drivers Section
  const renderNearbySection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <MapPin size={20} color={theme.success} />
        <Text style={styles.sectionTitle}>Nearby Drivers</Text>
        <Text style={styles.sectionCount}>{nearbyDrivers.length}</Text>
      </View>

      {nearbyDrivers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No drivers nearby</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nearbyScroll}>
          {nearbyDrivers.map((driver) => (
            <TouchableOpacity key={driver.id} style={styles.nearbyCard} activeOpacity={0.7}>
              <View style={styles.nearbyAvatar}>
                <Users size={20} color={theme.textSecondary} />
                {driver.current_speed > 0 && <View style={styles.liveIndicator} />}
              </View>
              <Text style={styles.nearbyName} numberOfLines={1}>{driver.username}</Text>
              <Text style={styles.nearbyDistance}>{formatDistance(driver.distance_km)}</Text>
              {driver.current_speed > 0 && (
                <View style={styles.nearbySpeed}>
                  <Zap size={10} color={theme.success} />
                  <Text style={styles.nearbySpeedText}>{driver.current_speed} km/h</Text>
                </View>
              )}
              {!driver.is_friend && (
                <TouchableOpacity style={styles.addFriendMini}>
                  <UserPlus size={14} color={theme.primary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  // Trending POIs Section
  const renderTrendingPOIsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <TrendingUp size={20} color={theme.warning} />
        <Text style={styles.sectionTitle}>Trending Challenges</Text>
      </View>

      {trendingPOIs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No trending challenges this week</Text>
        </View>
      ) : (
        <View style={styles.poiList}>
          {trendingPOIs.map((poi) => {
            const poiData = poi.type === 'speed_trap'
              ? speedTraps.find(t => t.id === poi.id)
              : segments.find(s => s.id === poi.id);

            return (
              <TouchableOpacity
                key={poi.id}
                style={styles.poiCard}
                onPress={() => {
                  if (poi.type === 'speed_trap') {
                    const trap = speedTraps.find(t => t.id === poi.id);
                    if (trap) setSelectedTrap(trap);
                  } else {
                    const segment = segments.find(s => s.id === poi.id);
                    if (segment) setSelectedSegment(segment);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.poiIcon, {
                  backgroundColor: poi.type === 'speed_trap' ? theme.error + '20' : theme.warning + '20'
                }]}>
                  {poi.type === 'speed_trap' ? (
                    <Target size={20} color={theme.error} />
                  ) : (
                    <Flag size={20} color={theme.warning} />
                  )}
                </View>
                <View style={styles.poiInfo}>
                  <Text style={styles.poiName}>{poi.name}</Text>
                  <Text style={styles.poiMeta}>
                    {poi.record_count} record{poi.record_count !== 1 ? 's' : ''} this week
                  </Text>
                </View>
                <ChevronRight size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  // Recent Top Records Section
  const renderTopRecordsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Trophy size={20} color={theme.primary} />
        <Text style={styles.sectionTitle}>Top Records Today</Text>
      </View>

      {topSpeeds.length === 0 && topTimes.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No records set today</Text>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {/* Fastest Speeds Today */}
          {topSpeeds.length > 0 && (
            <View>
              <Text style={styles.subsectionTitle}>⚡ Fastest Speeds Today</Text>
              <View style={styles.recordsList}>
                {topSpeeds.map((record, index) => (
                  <TouchableOpacity
                    key={record.id}
                    style={styles.recordRow}
                    onPress={() => {
                      const trap = speedTraps.find(t => t.id === record.poi_id);
                      if (trap) setSelectedTrap(trap);
                    }}
                  >
                    <View style={styles.recordRank}>
                      {index === 0 ? <Crown size={16} color="#FFD700" /> :
                       index === 1 ? <Medal size={16} color="#C0C0C0" /> :
                       index === 2 ? <Award size={16} color="#CD7F32" /> :
                       <Text style={styles.rankNumber}>{index + 1}</Text>}
                    </View>
                    <View style={styles.recordInfo}>
                      <Text style={styles.recordUsername}>{record.username}</Text>
                      <Text style={styles.recordPOI}>{record.poi_name}</Text>
                    </View>
                    <View style={styles.recordValue}>
                      <Text style={styles.recordValueText}>{record.value.toFixed(1)}</Text>
                      <Text style={styles.recordUnit}>km/h</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Fastest Times Today */}
          {topTimes.length > 0 && (
            <View>
              <Text style={styles.subsectionTitle}>⏱️ Fastest Times Today</Text>
              <View style={styles.recordsList}>
                {topTimes.map((record, index) => (
                  <TouchableOpacity
                    key={record.id}
                    style={styles.recordRow}
                    onPress={() => {
                      const segment = segments.find(s => s.id === record.poi_id);
                      if (segment) setSelectedSegment(segment);
                    }}
                  >
                    <View style={styles.recordRank}>
                      {index === 0 ? <Crown size={16} color="#FFD700" /> :
                       index === 1 ? <Medal size={16} color="#C0C0C0" /> :
                       index === 2 ? <Award size={16} color="#CD7F32" /> :
                       <Text style={styles.rankNumber}>{index + 1}</Text>}
                    </View>
                    <View style={styles.recordInfo}>
                      <Text style={styles.recordUsername}>{record.username}</Text>
                      <Text style={styles.recordPOI}>{record.poi_name}</Text>
                    </View>
                    <View style={styles.recordValue}>
                      <Text style={styles.recordValueText}>{record.value.toFixed(1)}</Text>
                      <Text style={styles.recordUnit}>sec</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );


  // Find Friends Section
  const renderFindFriendsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <UserPlus size={20} color={theme.primary} />
        <Text style={styles.sectionTitle}>Find Friends</Text>
      </View>
      
      <View style={styles.searchContainer}>
        <Search size={20} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by username..."
          placeholderTextColor={theme.textSecondary}
        />
      </View>
      
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickAction}>
          <View style={[styles.quickActionIcon, { backgroundColor: theme.primary + '20' }]}>
            <Users size={20} color={theme.primary} />
          </View>
          <Text style={styles.quickActionText}>Invite Contacts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction}>
          <View style={[styles.quickActionIcon, { backgroundColor: theme.warning + '20' }]}>
            <Search size={20} color={theme.warning} />
          </View>
          <Text style={styles.quickActionText}>Scan QR Code</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Activity Feed Section
  const renderActivitySection = () => {
    const INITIAL_COUNT = 5;
    const EXPANDED_COUNT = 20;
    const displayedActivity = activityExpanded
      ? activity.slice(0, EXPANDED_COUNT)
      : activity.slice(0, INITIAL_COUNT);
    const hasMoreActivity = activity.length > INITIAL_COUNT;
    const hasEvenMore = activity.length > EXPANDED_COUNT;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Activity size={20} color={theme.primary} />
          <Text style={styles.sectionTitle}>Activity</Text>
        </View>

        {activity.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No recent activity</Text>
          </View>
        ) : (
          <>
            <View style={styles.activityCard}>
              {displayedActivity.map((item, index) => (
                <View key={item.id} style={[styles.activityRow, index === displayedActivity.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.activityIcon}>
                    {getActivityIcon(item.type)}
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityUser}>{item.username}</Text>
                    <Text style={styles.activityTitle}>
                      {item.type === 'speed_trap' ? 'Hit ' : 'Completed '}
                      <Text style={styles.activityHighlight}>{item.value.toFixed(item.type === 'speed_trap' ? 1 : 1)}{item.unit}</Text>
                      {' at '}
                      <Text style={styles.activityLocation}>{item.location_name}</Text>
                    </Text>
                  </View>
                  <Text style={styles.activityTime}>{item.timestamp}</Text>
                </View>
              ))}
            </View>

            {hasMoreActivity && (
              <>
                <TouchableOpacity
                  style={styles.seeAllButton}
                  onPress={() => setActivityExpanded(!activityExpanded)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.seeAllButtonText}>
                    {activityExpanded
                      ? 'Show Less'
                      : `See More Activity (${Math.min(activity.length, EXPANDED_COUNT)}${hasEvenMore ? '+' : ''})`}
                  </Text>
                  <ChevronRight
                    size={20}
                    color={theme.primary}
                    style={activityExpanded ? { transform: [{ rotate: '270deg' }] } : { transform: [{ rotate: '90deg' }] }}
                  />
                </TouchableOpacity>
                {activityExpanded && hasEvenMore && (
                  <Text style={styles.activityNote}>
                    Showing recent 20 activities. Check Stats for full history.
                  </Text>
                )}
              </>
            )}
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Social</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Convoy Section */}
        <View style={styles.section}>
          <ConvoyPanel />
        </View>

        {/* Crew Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Users size={20} color={theme.warning} />
            <Text style={styles.sectionTitle}>My Crew</Text>
          </View>
          <CrewSection />
        </View>

        {/* Tournaments */}
        <View style={styles.section}>
          <TournamentsRow />
        </View>

        {/* Season Leaderboard */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => router.push('/season-leaderboard')}
            activeOpacity={0.7}
          >
            <Trophy size={20} color={theme.warning} />
            <Text style={styles.sectionTitle}>Season Leaderboard</Text>
            <ChevronRight size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Regional Leaderboard */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => router.push('/regional-leaderboard')}
            activeOpacity={0.7}
          >
            <MapPin size={20} color={theme.success} />
            <Text style={styles.sectionTitle}>Regional Leaderboard</Text>
            <ChevronRight size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Routes */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => router.push('/routes')}
            activeOpacity={0.7}
          >
            <Route size={20} color={theme.success} />
            <Text style={styles.sectionTitle}>Community Routes</Text>
            <ChevronRight size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Goals */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => router.push('/goals')}
            activeOpacity={0.7}
          >
            <Target size={20} color={theme.primary} />
            <Text style={styles.sectionTitle}>My Goals</Text>
            <ChevronRight size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Rivals */}
        <View style={styles.section}>
          <RivalsRow />
        </View>

        {/* Challenges */}
        <ChallengesRow />

        {renderNearbySection()}
        {renderTrendingPOIsSection()}
        {renderTopRecordsSection()}
        {renderActivitySection()}
        {renderFindFriendsSection()}

        <View style={{ height: 40 }} />
      </ScrollView>

      {renderTrapLeaderboardModal()}
      {renderSegmentLeaderboardModal()}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowPOICreator(true)}
        activeOpacity={0.8}
      >
        <Plus size={28} color={theme.textPrimary} />
      </TouchableOpacity>

      {/* POI Creator Modal */}
      <POICreator
        visible={showPOICreator}
        onClose={() => setShowPOICreator(false)}
        initialLocation={location.latitude && location.longitude ? {
          latitude: location.latitude,
          longitude: location.longitude
        } : undefined}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.surface },
  headerTitle: { fontSize: 28, fontWeight: '700', color: theme.textPrimary },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 100 },

  // Sections
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary, flex: 1 },
  sectionCount: { fontSize: 14, fontWeight: '600', color: theme.primary, backgroundColor: theme.primary + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },

  // Nearby Drivers
  nearbyScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  nearbyCard: { width: 100, backgroundColor: theme.surface, borderRadius: 16, padding: 12, marginRight: 10, alignItems: 'center' },
  nearbyAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  liveIndicator: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: theme.success, borderWidth: 2, borderColor: theme.surface },
  nearbyName: { fontSize: 13, fontWeight: '600', color: theme.textPrimary, marginBottom: 2 },
  nearbyDistance: { fontSize: 11, color: theme.textSecondary, marginBottom: 4 },
  nearbySpeed: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  nearbySpeedText: { fontSize: 10, color: theme.success, fontWeight: '600' },
  addFriendMini: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: theme.primary + '20', alignItems: 'center', justifyContent: 'center' },
  emptyCard: { backgroundColor: theme.surface, borderRadius: 12, padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 14, color: theme.textSecondary },

  // POI List (Speed Traps & Segments)
  poiList: { gap: 8 },
  poiCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 12, padding: 14, gap: 12 },
  poiIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  poiInfo: { flex: 1 },
  poiName: { fontSize: 16, fontWeight: '600', color: theme.textPrimary },
  poiMeta: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },

  // Find Friends
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 14, gap: 10 },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: theme.textPrimary },
  quickActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  quickAction: { flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 14, alignItems: 'center', gap: 8 },
  quickActionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  quickActionText: { fontSize: 13, fontWeight: '500', color: theme.textPrimary },

  // Activity
  activityCard: { backgroundColor: theme.surface, borderRadius: 16, overflow: 'hidden' },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderBottomWidth: 1, borderBottomColor: theme.background, gap: 12 },
  activityIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' },
  activityContent: { flex: 1 },
  activityUser: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  activityTitle: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  activityHighlight: { color: theme.primary, fontWeight: '600' },
  activityLocation: { color: theme.textPrimary, fontWeight: '500' },
  activityTime: { fontSize: 11, color: theme.textSecondary },
  seeAllButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.surface, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  seeAllButtonText: { fontSize: 14, fontWeight: '600', color: theme.primary },
  activityNote: { fontSize: 12, color: theme.textSecondary, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },

  // Top Records
  subsectionTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  recordsList: { backgroundColor: theme.surface, borderRadius: 12, overflow: 'hidden' },
  recordRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: theme.background },
  recordRank: { width: 32, alignItems: 'center' },
  recordInfo: { flex: 1, marginLeft: 12 },
  recordUsername: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  recordPOI: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  recordValue: { alignItems: 'flex-end' },
  recordValueText: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  recordUnit: { fontSize: 10, color: theme.textSecondary },

  // Modal
  modalContainer: { flex: 1, backgroundColor: theme.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.surface, gap: 12 },
  modalClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  modalTitleContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  modalSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  deleteButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.error + '20', alignItems: 'center', justifyContent: 'center' },
  modalDescription: { fontSize: 14, color: theme.textSecondary, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, marginHorizontal: 16, marginTop: 16, borderRadius: 12 },
  modalContent: { flex: 1, padding: 16 },
  
  leaderboardHeader: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  leaderboardRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 2, borderRadius: 8 },
  leaderboardRowFirst: { backgroundColor: theme.warning + '15', borderWidth: 1, borderColor: theme.warning + '30' },
  leaderboardRank: { width: 32, alignItems: 'center' },
  rankNumber: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  leaderboardUser: { flex: 1, marginLeft: 12 },
  leaderboardUsername: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  leaderboardVehicle: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  leaderboardValue: { alignItems: 'flex-end' },
  leaderboardValueText: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
  leaderboardUnit: { fontSize: 11, color: theme.textSecondary },
  
  emptyLeaderboard: { alignItems: 'center', paddingVertical: 40 },
  emptyLeaderboardText: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginTop: 12 },
  emptyLeaderboardSubtext: { fontSize: 14, color: theme.textSecondary, marginTop: 4 },

  viewFullButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 12, marginTop: 16 },
  viewFullButtonText: { fontSize: 16, fontWeight: '600', color: theme.textPrimary },

  // Floating Action Button - Above tab bar
  fab: {
    position: 'absolute',
    bottom: 20, // Just above tab bar with margin
    left: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  // Map styles
  modalMap: {
    height: 200,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.surface,
  },
  map: {
    flex: 1,
  },
  mapMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.error + '40',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.error,
  },
  mapStartMarker: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.success,
    borderWidth: 2,
    borderColor: theme.textPrimary,
  },
  mapEndMarker: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.error,
    borderWidth: 2,
    borderColor: theme.textPrimary,
  },
  mapMarkerText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  mapCheckpointMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.warning,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.textPrimary,
  },
  mapCheckpointText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textPrimary,
  },
});

