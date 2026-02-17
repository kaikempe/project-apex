import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import {
  ChevronLeft,
  Clock,
  Route,
  Trash2,
  Car,
  Zap,
  Play,
  MapPin,
  Pencil,
  Check,
  X,
  ChevronRight,
} from 'lucide-react-native';
import { Colors } from '@/src/theme/colors';
import { supabase } from '@/src/services/supabase';
import { useAuth } from '@/src/context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RoutePoint {
  lat: number;
  lon: number;
  timestamp: number;
}

interface SpeedPoint {
  speed: number;
  timestamp: number;
}

interface VehicleOption {
  id: string;
  name: string;
}

export default function DriveDetailScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [deleting, setDeleting] = useState(false);

  // ──────────────────────────────────────────────────
  // FIX #4: Editable drive name
  // ──────────────────────────────────────────────────
  const [driveName, setDriveName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);

  // ──────────────────────────────────────────────────
  // FIX #5: Vehicle change picker
  // ──────────────────────────────────────────────────
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [currentVehicleId, setCurrentVehicleId] = useState('');
  const [currentVehicleName, setCurrentVehicleName] = useState('');

  // ──────────────────────────────────────────────────
  // FIX #7: Robust route/speed data parsing
  // ──────────────────────────────────────────────────
  const driveData = useMemo(() => {
    try {
      let parsedRoute: RoutePoint[] = [];
      let parsedSpeedData: SpeedPoint[] = [];

      // Parse route — handle string, double-stringified, or already-array
      if (params.route) {
        const routeRaw = params.route as string;
        try {
          const firstParse = JSON.parse(routeRaw);
          // Check if it was double-stringified (string inside string)
          if (typeof firstParse === 'string') {
            parsedRoute = JSON.parse(firstParse) as RoutePoint[];
          } else if (Array.isArray(firstParse)) {
            parsedRoute = firstParse as RoutePoint[];
          }
        } catch {
          parsedRoute = [];
        }
      }

      // Parse speedData — same robust handling
      if (params.speedData) {
        const speedRaw = params.speedData as string;
        try {
          const firstParse = JSON.parse(speedRaw);
          if (typeof firstParse === 'string') {
            parsedSpeedData = JSON.parse(firstParse) as SpeedPoint[];
          } else if (Array.isArray(firstParse)) {
            parsedSpeedData = firstParse as SpeedPoint[];
          }
        } catch {
          parsedSpeedData = [];
        }
      }

      return {
        id: params.id as string,
        vehicleId: params.vehicleId as string,
        vehicleName: params.vehicleName as string,
        date: params.date as string,
        duration: Number(params.duration) || 0,
        topSpeed: Number(params.topSpeed) || 0,
        distance: Number(params.distance) || 0,
        driveName: (params.driveName as string) || '',
        route: parsedRoute,
        speedData: parsedSpeedData,
      };
    } catch {
      return {
        id: '', vehicleId: '', vehicleName: '', date: '', driveName: '',
        duration: 0, topSpeed: 0, distance: 0, route: [], speedData: [],
      };
    }
  }, [params]);

  // Initialize state from parsed data — ONE TIME ONLY
  // Using a ref to prevent re-initialization on every render,
  // which was resetting driveName mid-edit (params → driveData recompute → useEffect reset)
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current) return;
    if (!driveData.id) return; // Wait for valid data
    hasInitialized.current = true;

    setCurrentVehicleId(driveData.vehicleId);
    setCurrentVehicleName(driveData.vehicleName);
    setDriveName(driveData.driveName || generateDefaultName(driveData.date));
  }, [driveData]);

  // Fetch user's vehicles for the picker
  useEffect(() => {
    if (!user) return;
    const fetchVehicles = async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, name')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setVehicles(data);
      }
    };
    fetchVehicles();
  }, [user]);

  const generateDefaultName = (dateString: string): string => {
    try {
      const date = new Date(dateString);
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

  // Calculate map region from route
  const mapRegion = useMemo(() => {
    if (driveData.route.length < 2) return null;
    
    let minLat = driveData.route[0].lat;
    let maxLat = driveData.route[0].lat;
    let minLon = driveData.route[0].lon;
    let maxLon = driveData.route[0].lon;
    
    driveData.route.forEach(point => {
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
      minLon = Math.min(minLon, point.lon);
      maxLon = Math.max(maxLon, point.lon);
    });
    
    const latDelta = (maxLat - minLat) * 1.4 || 0.01;
    const lonDelta = (maxLon - minLon) * 1.4 || 0.01;
    
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(latDelta, 0.005),
      longitudeDelta: Math.max(lonDelta, 0.005),
    };
  }, [driveData.route]);

  // Route coordinates for Polyline
  const routeCoordinates = useMemo(() => {
    return driveData.route.map(p => ({
      latitude: p.lat,
      longitude: p.lon,
    }));
  }, [driveData.route]);

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString([], {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown date';
    }
  };

  // ──────────────────────────────────────────────────
  // FIX #4: Save drive name to Supabase
  // ──────────────────────────────────────────────────
  const handleSaveName = async () => {
    setSavingName(true);
    try {
      const { data: vehicle, error: fetchError } = await supabase
        .from('vehicles')
        .select('specs_json')
        .eq('id', currentVehicleId)
        .single();

      if (fetchError) throw fetchError;

      const specs = vehicle?.specs_json || {};
      const driveHistory = specs.drive_history || [];

      // Find and update the drive by matching end_time
      const updatedHistory = driveHistory.map((drive: any) => {
        if (drive.end_time === driveData.date) {
          return { ...drive, drive_name: driveName };
        }
        return drive;
      });

      const { error: updateError } = await supabase
        .from('vehicles')
        .update({
          specs_json: { ...specs, drive_history: updatedHistory },
        })
        .eq('id', currentVehicleId);

      if (updateError) throw updateError;

      console.log('✅ Drive name updated');
      setIsEditingName(false);
    } catch (error) {
      console.error('❌ Failed to save drive name:', error);
      Alert.alert('Error', 'Failed to save drive name');
    } finally {
      setSavingName(false);
    }
  };

  // ──────────────────────────────────────────────────
  // FIX #5: Change vehicle for this drive
  // ──────────────────────────────────────────────────
  const handleChangeVehicle = async (newVehicle: VehicleOption) => {
    if (newVehicle.id === currentVehicleId) {
      setShowVehiclePicker(false);
      return;
    }

    try {
      // 1. Remove drive from old vehicle
      const { data: oldVehicle, error: oldFetchError } = await supabase
        .from('vehicles')
        .select('specs_json')
        .eq('id', currentVehicleId)
        .single();

      if (oldFetchError) throw oldFetchError;

      const oldSpecs = oldVehicle?.specs_json || {};
      const oldHistory = oldSpecs.drive_history || [];
      let movedDrive: any = null;

      const filteredOldHistory = oldHistory.filter((drive: any) => {
        if (drive.end_time === driveData.date) {
          movedDrive = { ...drive, vehicle_name: newVehicle.name };
          return false;
        }
        return true;
      });

      if (!movedDrive) {
        Alert.alert('Error', 'Could not find drive in current vehicle');
        return;
      }

      // Update old vehicle (remove drive)
      await supabase
        .from('vehicles')
        .update({ specs_json: { ...oldSpecs, drive_history: filteredOldHistory } })
        .eq('id', currentVehicleId);

      // 2. Add drive to new vehicle
      const { data: newVehicleData, error: newFetchError } = await supabase
        .from('vehicles')
        .select('specs_json')
        .eq('id', newVehicle.id)
        .single();

      if (newFetchError) throw newFetchError;

      const newSpecs = newVehicleData?.specs_json || {};
      const newHistory = newSpecs.drive_history || [];
      newHistory.push(movedDrive);

      await supabase
        .from('vehicles')
        .update({ specs_json: { ...newSpecs, drive_history: newHistory } })
        .eq('id', newVehicle.id);

      // 3. Update local state
      setCurrentVehicleId(newVehicle.id);
      setCurrentVehicleName(newVehicle.name);
      setShowVehiclePicker(false);

      console.log('✅ Drive moved to', newVehicle.name);
    } catch (error) {
      console.error('❌ Failed to change vehicle:', error);
      Alert.alert('Error', 'Failed to change vehicle');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Drive',
      'Are you sure you want to delete this drive? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { data: vehicle, error: fetchError } = await supabase
                .from('vehicles')
                .select('specs_json')
                .eq('id', currentVehicleId)
                .single();

              if (fetchError) throw fetchError;

              const specs = vehicle?.specs_json || {};
              const driveHistory = specs.drive_history || [];

              const updatedHistory = driveHistory.filter(
                (drive: any) => drive.end_time !== driveData.date
              );

              const { error: updateError } = await supabase
                .from('vehicles')
                .update({
                  specs_json: {
                    ...specs,
                    drive_history: updatedHistory,
                  },
                })
                .eq('id', currentVehicleId);

              if (updateError) throw updateError;

              console.log('✅ Drive deleted');
              router.back();
            } catch (error) {
              console.error('❌ Failed to delete drive:', error);
              Alert.alert('Error', 'Failed to delete drive');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const SpeedGraph = () => {
    if (driveData.speedData.length < 2) {
      return (
        <View style={styles.graphEmpty}>
          <Text style={styles.graphEmptyText}>Not enough data for graph</Text>
        </View>
      );
    }

    const maxSpeed = Math.max(...driveData.speedData.map(p => p.speed), 10);
    const graphWidth = SCREEN_WIDTH - 80;
    const graphHeight = 150;

    return (
      <View style={styles.graphContainer}>
        <View style={styles.graphYAxis}>
          <Text style={styles.graphYLabel}>{Math.round(maxSpeed)}</Text>
          <Text style={styles.graphYLabel}>{Math.round(maxSpeed / 2)}</Text>
          <Text style={styles.graphYLabel}>0</Text>
        </View>
        
        <View style={[styles.graphArea, { width: graphWidth, height: graphHeight }]}>
          <View style={[styles.gridLine, { top: 0 }]} />
          <View style={[styles.gridLine, { top: graphHeight / 2 }]} />
          <View style={[styles.gridLine, { top: graphHeight - 1 }]} />
          
          <View style={styles.barsContainer}>
            {driveData.speedData.map((point, index) => {
              const barHeight = Math.max(2, (point.speed / maxSpeed) * graphHeight);
              const barWidth = Math.max(2, (graphWidth / driveData.speedData.length) - 1);
              
              return (
                <View
                  key={index}
                  style={[
                    styles.speedBar,
                    {
                      height: barHeight,
                      width: barWidth,
                      backgroundColor: point.speed > driveData.topSpeed * 0.9
                        ? Colors.error
                        : point.speed > driveData.topSpeed * 0.7
                          ? Colors.warning
                          : Colors.primary,
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      {/* ──────────────────────────────────────────── */}
      {/* FIX #3: Hide the system/Expo Router header  */}
      {/* ──────────────────────────────────────────── */}
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Custom header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color={Colors.textPrimary} />
          </TouchableOpacity>

          {/* FIX #4: Editable drive name in header */}
          <View style={styles.headerText}>
            {isEditingName ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  style={styles.nameInput}
                  value={driveName}
                  onChangeText={setDriveName}
                  autoFocus
                  selectTextOnFocus
                  placeholderTextColor={Colors.textSecondary}
                  placeholder="Drive name..."
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                />
                <TouchableOpacity
                  onPress={handleSaveName}
                  disabled={savingName}
                  style={styles.nameEditAction}
                >
                  <Check size={20} color={Colors.success} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setDriveName(driveData.driveName || generateDefaultName(driveData.date));
                    setIsEditingName(false);
                  }}
                  style={styles.nameEditAction}
                >
                  <X size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.nameDisplayRow}
                onPress={() => setIsEditingName(true)}
                activeOpacity={0.6}
              >
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {driveName}
                </Text>
                <Pencil size={14} color={Colors.textSecondary} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            )}
            <Text style={styles.headerDate}>{formatDate(driveData.date)}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Map Card */}
          <View style={styles.mapCard}>
            {driveData.route.length >= 2 && mapRegion ? (
              <MapView
                style={styles.map}
                provider={PROVIDER_DEFAULT}
                initialRegion={mapRegion}
                scrollEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                zoomEnabled={false}
                customMapStyle={darkMapStyle}
                userInterfaceStyle="dark"
              >
                {/* Route line */}
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor={Colors.primary}
                  strokeWidth={4}
                />
                
                {/* Start marker */}
                <Marker
                  coordinate={{
                    latitude: driveData.route[0].lat,
                    longitude: driveData.route[0].lon,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.startMarker}>
                    <Play size={12} color={Colors.textPrimary} fill={Colors.textPrimary} />
                  </View>
                </Marker>
                
                {/* End marker */}
                <Marker
                  coordinate={{
                    latitude: driveData.route[driveData.route.length - 1].lat,
                    longitude: driveData.route[driveData.route.length - 1].lon,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.endMarker}>
                    <MapPin size={12} color={Colors.textPrimary} />
                  </View>
                </Marker>
              </MapView>
            ) : (
              <View style={styles.mapEmpty}>
                <Route size={40} color={Colors.textSecondary} />
                <Text style={styles.mapEmptyText}>No route data</Text>
                <Text style={styles.mapEmptyHint}>
                  Route recording starts with your next drive
                </Text>
              </View>
            )}
            
            <View style={styles.mapStats}>
              <View style={styles.mapStat}>
                <Route size={16} color={Colors.primary} />
                <Text style={styles.mapStatValue}>{formatDistance(driveData.distance)}</Text>
              </View>
              <View style={styles.mapStat}>
                <Clock size={16} color={Colors.primary} />
                <Text style={styles.mapStatValue}>{formatDuration(driveData.duration)}</Text>
              </View>
              <View style={styles.mapStat}>
                <Zap size={16} color={Colors.warning} />
                <Text style={styles.mapStatValue}>{Math.round(driveData.topSpeed)} km/h</Text>
              </View>
            </View>
          </View>

          {/* FIX #5: Vehicle card — tappable to change vehicle */}
          <TouchableOpacity
            style={styles.vehicleCard}
            onPress={() => setShowVehiclePicker(true)}
            activeOpacity={0.7}
          >
            <Car size={20} color={Colors.textSecondary} />
            <Text style={styles.vehicleText}>{currentVehicleName}</Text>
            <ChevronRight size={18} color={Colors.textSecondary} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          {/* Speed Graph */}
          <View style={styles.graphCard}>
            <Text style={styles.sectionTitle}>Speed Graph</Text>
            <SpeedGraph />
            <Text style={styles.graphNote}>
              Speed over time during this drive.
            </Text>
          </View>

          {/* FIX #6: Delete Button — inside scroll with generous bottom padding */}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={deleting}
            activeOpacity={0.7}
          >
            <Trash2 size={20} color={Colors.error} />
            <Text style={styles.deleteText}>
              {deleting ? 'Deleting...' : 'Delete Drive'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ──────────────────────────────────────────── */}
        {/* FIX #5: Vehicle Picker Modal                 */}
        {/* ──────────────────────────────────────────── */}
        <Modal
          visible={showVehiclePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowVehiclePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Change Vehicle</Text>
                <TouchableOpacity onPress={() => setShowVehiclePicker(false)}>
                  <X size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {vehicles.length === 0 ? (
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>No vehicles found</Text>
                </View>
              ) : (
                <FlatList
                  data={vehicles}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.vehiclePickerItem,
                        item.id === currentVehicleId && styles.vehiclePickerItemActive,
                      ]}
                      onPress={() => handleChangeVehicle(item)}
                      activeOpacity={0.7}
                    >
                      <Car
                        size={20}
                        color={item.id === currentVehicleId ? Colors.primary : Colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.vehiclePickerText,
                          item.id === currentVehicleId && styles.vehiclePickerTextActive,
                        ]}
                      >
                        {item.name}
                      </Text>
                      {item.id === currentVehicleId && (
                        <Check size={18} color={Colors.primary} style={{ marginLeft: 'auto' }} />
                      )}
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#373737" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3c3c3c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.secondary,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  headerDate: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // FIX #4: Name editing styles
  nameDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  nameEditAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    flex: 1,
    padding: 16,
  },
  // FIX #6: Very generous bottom padding so delete button is always visible above tab bar
  scrollContent: {
    paddingBottom: 200,
  },

  mapCard: {
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  map: {
    height: 220,
  },
  mapEmpty: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondary,
  },
  mapEmptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  mapEmptyHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    opacity: 0.6,
  },
  mapStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.background,
  },
  mapStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  
  startMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.textPrimary,
  },
  endMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.textPrimary,
  },

  // FIX #5: Vehicle card now tappable with chevron
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  vehicleText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  graphCard: {
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  graphContainer: {
    flexDirection: 'row',
  },
  graphYAxis: {
    width: 30,
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  graphYLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  graphArea: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.textSecondary + '20',
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  speedBar: {
    marginHorizontal: 0.5,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  graphEmpty: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  graphEmptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  graphNote: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },

  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.error + '15',
    borderWidth: 1,
    borderColor: Colors.error + '50',
    borderRadius: 12,
    paddingVertical: 14,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.error,
  },

  // FIX #5: Vehicle Picker Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.secondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  vehiclePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  vehiclePickerItemActive: {
    backgroundColor: Colors.primary + '15',
  },
  vehiclePickerText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  vehiclePickerTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
