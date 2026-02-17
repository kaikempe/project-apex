import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
} from 'lucide-react-native';
import { Colors } from '@/src/theme/colors';
import { useAuth } from '@/src/context/AuthContext';
import { usePOI, SpeedTrap, Segment, LeaderboardEntry } from '@/src/context/POIContext';

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
  type: 'speed_trap' | 'segment' | 'drive';
  location_name: string;
  value: number;
  unit: string;
  timestamp: string;
}

// Mock data
const MOCK_NEARBY: NearbyDriver[] = [
  { id: '1', username: 'SpeedKing', distance_km: 0.5, current_speed: 45, vehicle_name: 'BMW M3', is_friend: true },
  { id: '2', username: 'NightRider', distance_km: 1.2, current_speed: 0, vehicle_name: 'Audi RS6', is_friend: false },
  { id: '3', username: 'DriftMaster', distance_km: 2.8, current_speed: 62, vehicle_name: 'Nissan GT-R', is_friend: true },
];

const MOCK_ACTIVITY: ActivityItem[] = [
  { id: '1', username: 'SpeedKing', type: 'speed_trap', location_name: 'Highway Zone', value: 267, unit: 'km/h', timestamp: '5 min ago' },
  { id: '2', username: 'DriftMaster', type: 'segment', location_name: 'Mountain Pass', value: 43.2, unit: 's', timestamp: '20 min ago' },
  { id: '3', username: 'NightRider', type: 'speed_trap', location_name: 'Airport Road', value: 245, unit: 'km/h', timestamp: '1 hour ago' },
  { id: '4', username: 'FastFurious', type: 'segment', location_name: 'Coastal Sprint', value: 71.5, unit: 's', timestamp: '2 hours ago' },
];

export default function SocialScreen() {
  const { user } = useAuth();
  const { speedTraps, segments } = usePOI();
  
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrap, setSelectedTrap] = useState<SpeedTrap | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  
  const [nearbyDrivers] = useState<NearbyDriver[]>(MOCK_NEARBY);
  const [activity] = useState<ActivityItem[]>(MOCK_ACTIVITY);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={16} color="#FFD700" />;
    if (rank === 2) return <Medal size={16} color="#C0C0C0" />;
    if (rank === 3) return <Award size={16} color="#CD7F32" />;
    return <Text style={styles.rankNumber}>{rank}</Text>;
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'speed_trap': return <Target size={18} color={Colors.error} />;
      case 'segment': return <Timer size={18} color={Colors.warning} />;
      case 'drive': return <Car size={18} color={Colors.primary} />;
    }
  };

  // Leaderboard Modal for Speed Trap
  const renderTrapLeaderboardModal = () => (
    <Modal visible={!!selectedTrap} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedTrap(null)}>
      <SafeAreaView style={styles.modalContainer} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setSelectedTrap(null)} style={styles.modalClose}>
            <X size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.modalTitleContainer}>
            <View style={[styles.modalIcon, { backgroundColor: Colors.error + '20' }]}>
              <Target size={24} color={Colors.error} />
            </View>
            <View>
              <Text style={styles.modalTitle}>{selectedTrap?.name}</Text>
              <Text style={styles.modalSubtitle}>Speed Trap · Top Speed Wins</Text>
            </View>
          </View>
        </View>
        
        {selectedTrap?.description && (
          <Text style={styles.modalDescription}>{selectedTrap.description}</Text>
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
                <Text style={styles.leaderboardValueText}>{entry.value}</Text>
                <Text style={styles.leaderboardUnit}>km/h</Text>
              </View>
            </View>
          ))}
          
          {(!selectedTrap?.leaderboard || selectedTrap.leaderboard.length === 0) && (
            <View style={styles.emptyLeaderboard}>
              <Trophy size={40} color={Colors.textSecondary} />
              <Text style={styles.emptyLeaderboardText}>No records yet</Text>
              <Text style={styles.emptyLeaderboardSubtext}>Be the first to set a record!</Text>
            </View>
          )}
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  // Leaderboard Modal for Segment
  const renderSegmentLeaderboardModal = () => (
    <Modal visible={!!selectedSegment} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedSegment(null)}>
      <SafeAreaView style={styles.modalContainer} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setSelectedSegment(null)} style={styles.modalClose}>
            <X size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.modalTitleContainer}>
            <View style={[styles.modalIcon, { backgroundColor: Colors.warning + '20' }]}>
              <Flag size={24} color={Colors.warning} />
            </View>
            <View>
              <Text style={styles.modalTitle}>{selectedSegment?.name}</Text>
              <Text style={styles.modalSubtitle}>
                Segment · {selectedSegment ? (selectedSegment.distance_meters / 1000).toFixed(1) : 0} km · Fastest Time Wins
              </Text>
            </View>
          </View>
        </View>
        
        {selectedSegment?.description && (
          <Text style={styles.modalDescription}>{selectedSegment.description}</Text>
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
              <Trophy size={40} color={Colors.textSecondary} />
              <Text style={styles.emptyLeaderboardText}>No records yet</Text>
              <Text style={styles.emptyLeaderboardSubtext}>Be the first to set a record!</Text>
            </View>
          )}
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  // Nearby Drivers Section
  const renderNearbySection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <MapPin size={20} color={Colors.success} />
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
                <Users size={20} color={Colors.textSecondary} />
                {driver.current_speed > 0 && <View style={styles.liveIndicator} />}
              </View>
              <Text style={styles.nearbyName} numberOfLines={1}>{driver.username}</Text>
              <Text style={styles.nearbyDistance}>{driver.distance_km} km away</Text>
              {driver.current_speed > 0 && (
                <View style={styles.nearbySpeed}>
                  <Zap size={10} color={Colors.success} />
                  <Text style={styles.nearbySpeedText}>{driver.current_speed} km/h</Text>
                </View>
              )}
              {!driver.is_friend && (
                <TouchableOpacity style={styles.addFriendMini}>
                  <UserPlus size={14} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  // Speed Traps Section
  const renderSpeedTrapsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Target size={20} color={Colors.error} />
        <Text style={styles.sectionTitle}>Speed Traps</Text>
        <Text style={styles.sectionCount}>{speedTraps.length}</Text>
      </View>
      
      <View style={styles.poiList}>
        {speedTraps.map((trap) => (
          <TouchableOpacity
            key={trap.id}
            style={styles.poiCard}
            onPress={() => setSelectedTrap(trap)}
            activeOpacity={0.7}
          >
            <View style={[styles.poiIcon, { backgroundColor: Colors.error + '20' }]}>
              <Target size={20} color={Colors.error} />
            </View>
            <View style={styles.poiInfo}>
              <Text style={styles.poiName}>{trap.name}</Text>
              <Text style={styles.poiMeta}>
                {trap.leaderboard.length > 0 
                  ? `Record: ${trap.leaderboard[0].value} km/h by ${trap.leaderboard[0].username}`
                  : 'No records yet'}
              </Text>
            </View>
            <ChevronRight size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Segments Section
  const renderSegmentsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Flag size={20} color={Colors.warning} />
        <Text style={styles.sectionTitle}>Segments</Text>
        <Text style={styles.sectionCount}>{segments.length}</Text>
      </View>
      
      <View style={styles.poiList}>
        {segments.map((segment) => (
          <TouchableOpacity
            key={segment.id}
            style={styles.poiCard}
            onPress={() => setSelectedSegment(segment)}
            activeOpacity={0.7}
          >
            <View style={[styles.poiIcon, { backgroundColor: Colors.warning + '20' }]}>
              <Timer size={20} color={Colors.warning} />
            </View>
            <View style={styles.poiInfo}>
              <Text style={styles.poiName}>{segment.name}</Text>
              <Text style={styles.poiMeta}>
                {(segment.distance_meters / 1000).toFixed(1)} km · {segment.leaderboard.length > 0 
                  ? `Record: ${segment.leaderboard[0].value.toFixed(1)}s by ${segment.leaderboard[0].username}`
                  : 'No records yet'}
              </Text>
            </View>
            <ChevronRight size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Find Friends Section
  const renderFindFriendsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <UserPlus size={20} color={Colors.primary} />
        <Text style={styles.sectionTitle}>Find Friends</Text>
      </View>
      
      <View style={styles.searchContainer}>
        <Search size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by username..."
          placeholderTextColor={Colors.textSecondary}
        />
      </View>
      
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickAction}>
          <View style={[styles.quickActionIcon, { backgroundColor: Colors.primary + '20' }]}>
            <Users size={20} color={Colors.primary} />
          </View>
          <Text style={styles.quickActionText}>Invite Contacts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction}>
          <View style={[styles.quickActionIcon, { backgroundColor: Colors.warning + '20' }]}>
            <Search size={20} color={Colors.warning} />
          </View>
          <Text style={styles.quickActionText}>Scan QR Code</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Activity Feed Section
  const renderActivitySection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Activity size={20} color={Colors.primary} />
        <Text style={styles.sectionTitle}>Activity</Text>
      </View>
      
      <View style={styles.activityCard}>
        {activity.map((item, index) => (
          <View key={item.id} style={[styles.activityRow, index === activity.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={styles.activityIcon}>
              {getActivityIcon(item.type)}
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityUser}>{item.username}</Text>
              <Text style={styles.activityTitle}>
                {item.type === 'speed_trap' ? 'Hit ' : 'Completed '}
                <Text style={styles.activityHighlight}>{item.value}{item.unit}</Text>
                {' at '}
                <Text style={styles.activityLocation}>{item.location_name}</Text>
              </Text>
            </View>
            <Text style={styles.activityTime}>{item.timestamp}</Text>
          </View>
        ))}
      </View>
    </View>
  );

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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {renderNearbySection()}
        {renderSpeedTrapsSection()}
        {renderSegmentsSection()}
        {renderFindFriendsSection()}
        {renderActivitySection()}
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {renderTrapLeaderboardModal()}
      {renderSegmentLeaderboardModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.secondary },
  headerTitle: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 100 },

  // Sections
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  sectionCount: { fontSize: 14, fontWeight: '600', color: Colors.primary, backgroundColor: Colors.primary + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },

  // Nearby Drivers
  nearbyScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  nearbyCard: { width: 100, backgroundColor: Colors.secondary, borderRadius: 16, padding: 12, marginRight: 10, alignItems: 'center' },
  nearbyAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  liveIndicator: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.success, borderWidth: 2, borderColor: Colors.secondary },
  nearbyName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  nearbyDistance: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4 },
  nearbySpeed: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  nearbySpeedText: { fontSize: 10, color: Colors.success, fontWeight: '600' },
  addFriendMini: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary + '20', alignItems: 'center', justifyContent: 'center' },
  emptyCard: { backgroundColor: Colors.secondary, borderRadius: 12, padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 14, color: Colors.textSecondary },

  // POI List (Speed Traps & Segments)
  poiList: { gap: 8 },
  poiCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.secondary, borderRadius: 12, padding: 14, gap: 12 },
  poiIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  poiInfo: { flex: 1 },
  poiName: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  poiMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  // Find Friends
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.secondary, borderRadius: 12, paddingHorizontal: 14, gap: 10 },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: Colors.textPrimary },
  quickActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  quickAction: { flex: 1, backgroundColor: Colors.secondary, borderRadius: 12, padding: 14, alignItems: 'center', gap: 8 },
  quickActionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  quickActionText: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary },

  // Activity
  activityCard: { backgroundColor: Colors.secondary, borderRadius: 16, overflow: 'hidden' },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.background, gap: 12 },
  activityIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  activityContent: { flex: 1 },
  activityUser: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  activityTitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  activityHighlight: { color: Colors.primary, fontWeight: '600' },
  activityLocation: { color: Colors.textPrimary, fontWeight: '500' },
  activityTime: { fontSize: 11, color: Colors.textSecondary },

  // Modal
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.secondary, gap: 12 },
  modalClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center' },
  modalTitleContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  modalSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  modalDescription: { fontSize: 14, color: Colors.textSecondary, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.secondary, marginHorizontal: 16, marginTop: 16, borderRadius: 12 },
  modalContent: { flex: 1, padding: 16 },
  
  leaderboardHeader: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  leaderboardRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.secondary, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 2, borderRadius: 8 },
  leaderboardRowFirst: { backgroundColor: Colors.warning + '15', borderWidth: 1, borderColor: Colors.warning + '30' },
  leaderboardRank: { width: 32, alignItems: 'center' },
  rankNumber: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  leaderboardUser: { flex: 1, marginLeft: 12 },
  leaderboardUsername: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  leaderboardVehicle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  leaderboardValue: { alignItems: 'flex-end' },
  leaderboardValueText: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  leaderboardUnit: { fontSize: 11, color: Colors.textSecondary },
  
  emptyLeaderboard: { alignItems: 'center', paddingVertical: 40 },
  emptyLeaderboardText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginTop: 12 },
  emptyLeaderboardSubtext: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
});
