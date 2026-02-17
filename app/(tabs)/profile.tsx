import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  User,
  Bell,
  Volume2,
  MapPin,
  LogOut,
  Car,
  Timer,
  Route,
  Plus,
  Check,
  X,
  Camera,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  Target,
  Users,
  Map,
  Flag,
  Play,
  Square,
} from 'lucide-react-native';
import { Colors } from '@/src/theme/colors';
import { useAuth } from '@/src/context/AuthContext';
import { useVehicle, Vehicle, VehicleInput } from '@/src/context/VehicleContext';
import { usePOI } from '@/src/context/POIContext';
import { useBackgroundLocation } from '@/src/hooks/useBackgroundLocation';
import { supabase } from '@/src/services/supabase';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const {
    vehicles,
    activeVehicle,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    setActiveVehicle,
  } = useVehicle();
  const {
    showSpeedTraps,
    showSegments,
    showCarMeets,
    setShowSpeedTraps,
    setShowSegments,
    setShowCarMeets,
  } = usePOI();
  const {
    isEnabled: backgroundEnabled,
    isRunning: backgroundRunning,
    isLoading: backgroundLoading,
    isSupported: backgroundSupported,
    toggleEnabled: toggleBackgroundEnabled,
    startTracking,
    stopTracking,
  } = useBackgroundLocation();
  
  // Settings state
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  // User totals
  const [totalDrives, setTotalDrives] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0); // meters

  // Compute total drives + distance from all vehicles' specs_json
  const computeTotals = useCallback(async () => {
    if (!user) return;
    try {
      const { data: vehicleData, error } = await supabase
        .from('vehicles')
        .select('specs_json')
        .eq('owner_id', user.id);

      if (error || !vehicleData) return;

      let drives = 0;
      let distance = 0;

      vehicleData.forEach((v: any) => {
        const specs = v.specs_json || {};
        // Use stored totals if available, otherwise count from history
        if (specs.total_drives !== undefined) {
          drives += specs.total_drives;
        } else {
          drives += (specs.drive_history || []).length;
        }
        if (specs.total_distance !== undefined) {
          distance += specs.total_distance;
        } else {
          // Fallback: sum from drive_history entries
          (specs.drive_history || []).forEach((d: any) => {
            distance += d.distance || 0;
          });
        }
      });

      setTotalDrives(drives);
      setTotalDistance(distance);
    } catch (err) {
      console.error('Failed to compute totals:', err);
    }
  }, [user]);

  useEffect(() => {
    computeTotals();
  }, [computeTotals, vehicles]); // Re-run when vehicles change
  
  // Garage state
  const [garageExpanded, setGarageExpanded] = useState(true);
  const [mapSettingsExpanded, setMapSettingsExpanded] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<VehicleInput>({
    name: '', make: '', model: '', year: undefined,
    horsepower: undefined, torque_nm: undefined, weight_kg: undefined,
    drivetrain: '', engine_type: '', image_url: '',
  });

  const resetForm = () => {
    setFormData({
      name: '', make: '', model: '', year: undefined,
      horsepower: undefined, torque_nm: undefined, weight_kg: undefined,
      drivetrain: '', engine_type: '', image_url: '',
    });
  };

  const openAddModal = () => {
    resetForm();
    setEditingVehicle(null);
    setShowAddModal(true);
  };

  const openEditModal = (vehicle: Vehicle) => {
    setFormData({
      name: vehicle.name,
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year,
      horsepower: vehicle.horsepower,
      torque_nm: vehicle.torque_nm,
      weight_kg: vehicle.weight_kg,
      drivetrain: vehicle.drivetrain || '',
      engine_type: vehicle.engine_type || '',
      image_url: vehicle.image_url || '',
    });
    setEditingVehicle(vehicle);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingVehicle(null);
    resetForm();
  };

  const pickImage = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera permission is required.');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Photo library permission is required.');
          return;
        }
      }

      const result = await (useCamera
        ? ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.7 })
        : ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.7 }));

      if (!result.canceled && result.assets[0]) {
        setFormData(prev => ({ ...prev, image_url: result.assets[0].uri }));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const showImageOptions = () => {
    Alert.alert('Add Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: () => pickImage(true) },
      { text: 'Choose from Library', onPress: () => pickImage(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Vehicle name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingVehicle) {
        await updateVehicle(editingVehicle.id, formData);
      } else {
        await addVehicle(formData);
      }
      closeModal();
    } catch (error) {
      Alert.alert('Error', 'Failed to save vehicle');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (vehicle: Vehicle) => {
    Alert.alert('Delete Vehicle', `Delete "${vehicle.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteVehicle(vehicle.id) },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const renderVehicleCard = (vehicle: Vehicle) => {
    const isActive = activeVehicle?.id === vehicle.id;
    return (
      <TouchableOpacity
        key={vehicle.id}
        style={[styles.vehicleCard, isActive && styles.vehicleCardActive]}
        onPress={() => setActiveVehicle(vehicle.id)}
        onLongPress={() => openEditModal(vehicle)}
        activeOpacity={0.7}
      >
        {vehicle.image_url ? (
          <Image source={{ uri: vehicle.image_url }} style={styles.vehicleThumb} />
        ) : (
          <View style={styles.vehicleThumbPlaceholder}>
            <Car size={24} color={Colors.textSecondary} />
          </View>
        )}
        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleName}>{vehicle.name}</Text>
          {(vehicle.make || vehicle.model) && (
            <Text style={styles.vehicleMeta}>
              {[vehicle.make, vehicle.model].filter(Boolean).join(' ')}
            </Text>
          )}
        </View>
        {isActive && (
          <View style={styles.activeIndicator}>
            <Check size={16} color={Colors.success} />
          </View>
        )}
        <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(vehicle)}>
          <Pencil size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderModal = () => (
    <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
      <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeModal} style={styles.modalHeaderBtn}>
              <X size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</Text>
            <TouchableOpacity onPress={handleSave} style={styles.modalHeaderBtn} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={Colors.primary} /> : <Check size={24} color={Colors.primary} />}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={styles.imagePicker} onPress={showImageOptions}>
              {formData.image_url ? (
                <Image source={{ uri: formData.image_url }} style={styles.pickedImage} />
              ) : (
                <View style={styles.imagePickerPlaceholder}>
                  <Camera size={32} color={Colors.textSecondary} />
                  <Text style={styles.imagePickerText}>Add Photo</Text>
                </View>
              )}
              <View style={styles.imagePickerOverlay}>
                <Camera size={20} color={Colors.textPrimary} />
              </View>
            </TouchableOpacity>

            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Basic Info</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                  placeholder="e.g., My BMW M3"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Make</Text>
                  <TextInput style={styles.input} value={formData.make} onChangeText={(text) => setFormData(prev => ({ ...prev, make: text }))} placeholder="BMW" placeholderTextColor={Colors.textSecondary} />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Model</Text>
                  <TextInput style={styles.input} value={formData.model} onChangeText={(text) => setFormData(prev => ({ ...prev, model: text }))} placeholder="M3" placeholderTextColor={Colors.textSecondary} />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Year</Text>
                <TextInput style={styles.input} value={formData.year?.toString() || ''} onChangeText={(text) => setFormData(prev => ({ ...prev, year: text ? parseInt(text) : undefined }))} placeholder="2023" placeholderTextColor={Colors.textSecondary} keyboardType="number-pad" maxLength={4} />
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Performance</Text>
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Horsepower</Text>
                  <TextInput style={styles.input} value={formData.horsepower?.toString() || ''} onChangeText={(text) => setFormData(prev => ({ ...prev, horsepower: text ? parseInt(text) : undefined }))} placeholder="450" placeholderTextColor={Colors.textSecondary} keyboardType="number-pad" />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Torque (Nm)</Text>
                  <TextInput style={styles.input} value={formData.torque_nm?.toString() || ''} onChangeText={(text) => setFormData(prev => ({ ...prev, torque_nm: text ? parseInt(text) : undefined }))} placeholder="550" placeholderTextColor={Colors.textSecondary} keyboardType="number-pad" />
                </View>
              </View>
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Weight (kg)</Text>
                  <TextInput style={styles.input} value={formData.weight_kg?.toString() || ''} onChangeText={(text) => setFormData(prev => ({ ...prev, weight_kg: text ? parseInt(text) : undefined }))} placeholder="1650" placeholderTextColor={Colors.textSecondary} keyboardType="number-pad" />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Drivetrain</Text>
                  <TextInput style={styles.input} value={formData.drivetrain} onChangeText={(text) => setFormData(prev => ({ ...prev, drivetrain: text }))} placeholder="AWD" placeholderTextColor={Colors.textSecondary} />
                </View>
              </View>
            </View>

            {editingVehicle && (
              <TouchableOpacity style={styles.deleteButton} onPress={() => { closeModal(); handleDelete(editingVehicle); }}>
                <Trash2 size={20} color={Colors.error} />
                <Text style={styles.deleteButtonText}>Delete Vehicle</Text>
              </TouchableOpacity>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <User size={40} color={Colors.textSecondary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.email?.split('@')[0] || 'Driver'}</Text>
            <Text style={styles.profileEmail}>{user?.email || 'Not signed in'}</Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Car size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{vehicles.length}</Text>
            <Text style={styles.statLabel}>Vehicles</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Timer size={20} color={Colors.warning} />
            <Text style={styles.statValue}>{totalDrives}</Text>
            <Text style={styles.statLabel}>Drives</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Route size={20} color={Colors.success} />
            <Text style={styles.statValue}>
              {totalDistance < 1000
                ? `${Math.round(totalDistance)}m`
                : `${(totalDistance / 1000).toFixed(1)}km`}
            </Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
        </View>

        {/* My Vehicles */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.sectionHeader} onPress={() => setGarageExpanded(!garageExpanded)}>
            <Car size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>My Vehicles</Text>
            <View style={styles.sectionHeaderRight}>
              <TouchableOpacity onPress={openAddModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Plus size={22} color={Colors.primary} />
              </TouchableOpacity>
              {garageExpanded ? <ChevronUp size={20} color={Colors.textSecondary} /> : <ChevronDown size={20} color={Colors.textSecondary} />}
            </View>
          </TouchableOpacity>
          
          {garageExpanded && (
            <View style={styles.vehiclesList}>
              {vehicles.length === 0 ? (
                <TouchableOpacity style={styles.emptyVehicle} onPress={openAddModal}>
                  <Plus size={24} color={Colors.textSecondary} />
                  <Text style={styles.emptyVehicleText}>Add your first vehicle</Text>
                </TouchableOpacity>
              ) : (
                vehicles.map(renderVehicleCard)
              )}
            </View>
          )}
        </View>

        {/* Map Display Settings */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.sectionHeader} onPress={() => setMapSettingsExpanded(!mapSettingsExpanded)}>
            <Map size={20} color={Colors.warning} />
            <Text style={styles.sectionTitle}>Map Display</Text>
            <View style={styles.sectionHeaderRight}>
              {mapSettingsExpanded ? <ChevronUp size={20} color={Colors.textSecondary} /> : <ChevronDown size={20} color={Colors.textSecondary} />}
            </View>
          </TouchableOpacity>
          
          {mapSettingsExpanded && (
            <View style={styles.settingsCard}>
              <View style={styles.settingRow}>
                <View style={[styles.settingIconBox, { backgroundColor: Colors.error + '20' }]}>
                  <Target size={18} color={Colors.error} />
                </View>
                <Text style={styles.settingLabel}>Speed Traps</Text>
                <Switch value={showSpeedTraps} onValueChange={setShowSpeedTraps} trackColor={{ false: Colors.background, true: Colors.primary }} thumbColor={Colors.textPrimary} />
              </View>
              <View style={styles.settingRow}>
                <View style={[styles.settingIconBox, { backgroundColor: Colors.warning + '20' }]}>
                  <Flag size={18} color={Colors.warning} />
                </View>
                <Text style={styles.settingLabel}>Segments</Text>
                <Switch value={showSegments} onValueChange={setShowSegments} trackColor={{ false: Colors.background, true: Colors.primary }} thumbColor={Colors.textPrimary} />
              </View>
              <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.settingIconBox, { backgroundColor: Colors.primary + '20' }]}>
                  <Users size={18} color={Colors.primary} />
                </View>
                <Text style={styles.settingLabel}>Car Meets</Text>
                <Switch value={showCarMeets} onValueChange={setShowCarMeets} trackColor={{ false: Colors.background, true: Colors.primary }} thumbColor={Colors.textPrimary} />
              </View>
            </View>
          )}
        </View>

        {/* General Settings */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderStatic}>
            <Text style={styles.sectionTitleSmall}>GENERAL</Text>
          </View>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <Volume2 size={20} color={Colors.primary} />
              <Text style={styles.settingLabel}>Voice Announcements</Text>
              <Switch value={voiceEnabled} onValueChange={setVoiceEnabled} trackColor={{ false: Colors.background, true: Colors.primary }} thumbColor={Colors.textPrimary} />
            </View>
            <View style={styles.settingRow}>
              <Bell size={20} color={Colors.warning} />
              <Text style={styles.settingLabel}>Notifications</Text>
              <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} trackColor={{ false: Colors.background, true: Colors.primary }} thumbColor={Colors.textPrimary} />
            </View>
            <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
              <MapPin size={20} color={backgroundSupported ? Colors.success : Colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, !backgroundSupported && { color: Colors.textSecondary }]}>
                  Background Tracking
                </Text>
                {!backgroundSupported ? (
                  <Text style={styles.settingUnsupported}>Requires development build</Text>
                ) : backgroundEnabled ? (
                  <Text style={[styles.settingStatus, backgroundRunning ? styles.settingStatusActive : styles.settingStatusInactive]}>
                    {backgroundRunning ? '● Recording' : '○ Paused'}
                  </Text>
                ) : null}
              </View>
              {backgroundLoading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Switch 
                  value={backgroundEnabled} 
                  onValueChange={toggleBackgroundEnabled} 
                  trackColor={{ false: Colors.background, true: Colors.primary }} 
                  thumbColor={Colors.textPrimary}
                  disabled={!backgroundSupported}
                />
              )}
            </View>
            
            {/* Start/Stop Background Tracking */}
            {backgroundEnabled && backgroundSupported && (
              <TouchableOpacity
                style={[styles.trackingButton, backgroundRunning ? styles.trackingButtonStop : styles.trackingButtonStart]}
                onPress={backgroundRunning ? stopTracking : startTracking}
              >
                {backgroundRunning ? (
                  <>
                    <Square size={18} color={Colors.error} fill={Colors.error} />
                    <Text style={[styles.trackingButtonText, { color: Colors.error }]}>Stop Tracking</Text>
                  </>
                ) : (
                  <>
                    <Play size={18} color={Colors.success} fill={Colors.success} />
                    <Text style={[styles.trackingButtonText, { color: Colors.success }]}>Start Tracking</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color={Colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Apex v1.0.0</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {renderModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1 },
  
  profileHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  profileEmail: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },

  statsContainer: { flexDirection: 'row', backgroundColor: Colors.secondary, marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 20 },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontSize: 11, color: Colors.textSecondary },
  statDivider: { width: 1, backgroundColor: Colors.background, marginVertical: 4 },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  sectionHeaderStatic: { paddingHorizontal: 16, paddingBottom: 8 },
  sectionHeaderRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary },
  sectionTitleSmall: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 0.5 },

  vehiclesList: { paddingHorizontal: 16 },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.secondary, borderRadius: 12, padding: 12, marginBottom: 8, gap: 12 },
  vehicleCardActive: { borderWidth: 2, borderColor: Colors.primary },
  vehicleThumb: { width: 60, height: 45, borderRadius: 8, backgroundColor: Colors.background },
  vehicleThumbPlaceholder: { width: 60, height: 45, borderRadius: 8, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  vehicleInfo: { flex: 1 },
  vehicleName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  vehicleMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  activeIndicator: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.success + '20', alignItems: 'center', justifyContent: 'center' },
  editBtn: { padding: 8 },
  emptyVehicle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.secondary, borderRadius: 12, padding: 20, borderWidth: 2, borderColor: Colors.primary + '30', borderStyle: 'dashed' },
  emptyVehicleText: { fontSize: 14, color: Colors.textSecondary },

  settingsCard: { backgroundColor: Colors.secondary, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.background },
  settingIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { flex: 1, fontSize: 15, color: Colors.textPrimary },
  settingStatus: { fontSize: 12, marginTop: 2 },
  settingStatusActive: { color: Colors.success },
  settingStatusInactive: { color: Colors.textSecondary },
  settingUnsupported: { fontSize: 11, color: Colors.warning, marginTop: 2 },
  
  trackingButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: -4, marginBottom: 8, paddingVertical: 12, borderRadius: 10 },
  trackingButtonStart: { backgroundColor: Colors.success + '15', borderWidth: 1, borderColor: Colors.success + '30' },
  trackingButtonStop: { backgroundColor: Colors.error + '15', borderWidth: 1, borderColor: Colors.error + '30' },
  trackingButtonText: { fontSize: 14, fontWeight: '600' },

  signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginHorizontal: 16, backgroundColor: Colors.error + '15', borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: Colors.error + '30' },
  signOutText: { fontSize: 15, fontWeight: '600', color: Colors.error },

  versionContainer: { alignItems: 'center', paddingVertical: 20 },
  versionText: { fontSize: 12, color: Colors.textSecondary },

  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.secondary },
  modalHeaderBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  modalContent: { flex: 1, padding: 16 },
  imagePicker: { height: 160, backgroundColor: Colors.secondary, borderRadius: 16, marginBottom: 24, overflow: 'hidden' },
  pickedImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePickerPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  imagePickerText: { fontSize: 14, color: Colors.textSecondary },
  imagePickerOverlay: { position: 'absolute', bottom: 12, right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  formSection: { marginBottom: 24 },
  formSectionTitle: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.secondary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: Colors.textPrimary },
  inputRow: { flexDirection: 'row', gap: 12 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.error + '15', borderWidth: 1, borderColor: Colors.error + '50', borderRadius: 12, paddingVertical: 14, marginTop: 12 },
  deleteButtonText: { fontSize: 15, fontWeight: '600', color: Colors.error },
});
