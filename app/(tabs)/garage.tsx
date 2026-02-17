import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  Plus,
  Car,
  Check,
  X,
  Camera,
  Image as ImageIcon,
  Trash2,
  Pencil,
  Zap,
  Gauge,
  Weight,
  Settings2,
  ChevronRight,
  Route,
  Timer,
} from 'lucide-react-native';
import { Colors } from '@/src/theme/colors';
import { useVehicle, Vehicle, VehicleInput } from '@/src/context/VehicleContext';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/services/supabase';

export default function GarageScreen() {
  const { user } = useAuth();
  const {
    vehicles,
    activeVehicle,
    isLoading,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    setActiveVehicle,
  } = useVehicle();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [saving, setSaving] = useState(false);

  // Per-vehicle stats: { vehicleId: { totalDrives, totalDistance } }
  const [vehicleStats, setVehicleStats] = useState<Record<string, { totalDrives: number; totalDistance: number }>>({});

  // Fetch per-vehicle stats from specs_json
  const fetchVehicleStats = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, specs_json')
        .eq('owner_id', user.id);

      if (error || !data) return;

      const stats: Record<string, { totalDrives: number; totalDistance: number }> = {};
      data.forEach((v: any) => {
        const specs = v.specs_json || {};
        const drives = specs.total_drives !== undefined
          ? specs.total_drives
          : (specs.drive_history || []).length;
        const distance = specs.total_distance !== undefined
          ? specs.total_distance
          : (specs.drive_history || []).reduce((acc: number, d: any) => acc + (d.distance || 0), 0);
        stats[v.id] = { totalDrives: drives, totalDistance: distance };
      });
      setVehicleStats(stats);
    } catch (err) {
      console.error('Failed to fetch vehicle stats:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchVehicleStats();
  }, [fetchVehicleStats, vehicles]); // Refresh when vehicles change

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Form state
  const [formData, setFormData] = useState<VehicleInput>({
    name: '',
    make: '',
    model: '',
    year: undefined,
    horsepower: undefined,
    torque_nm: undefined,
    weight_kg: undefined,
    drivetrain: '',
    engine_type: '',
    image_url: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      make: '',
      model: '',
      year: undefined,
      horsepower: undefined,
      torque_nm: undefined,
      weight_kg: undefined,
      drivetrain: '',
      engine_type: '',
      image_url: '',
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

  // Image picker
  const pickImage = async (useCamera: boolean) => {
    try {
      // Request permission
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera permission is required to take photos.');
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
        ? ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.7,
          })
        : ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.7,
          }));

      if (!result.canceled && result.assets[0]) {
        setFormData(prev => ({ ...prev, image_url: result.assets[0].uri }));
      }
    } catch (error) {
      console.error('Image picker error:', error);
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
        // Update existing
        await updateVehicle(editingVehicle.id, formData);
      } else {
        // Add new
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
    Alert.alert(
      'Delete Vehicle',
      `Are you sure you want to delete "${vehicle.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteVehicle(vehicle.id),
        },
      ]
    );
  };

  const handleSelectVehicle = (vehicle: Vehicle) => {
    setActiveVehicle(vehicle.id);
  };

  const renderVehicleCard = (vehicle: Vehicle) => {
    const isActive = activeVehicle?.id === vehicle.id;

    return (
      <TouchableOpacity
        key={vehicle.id}
        style={[styles.vehicleCard, isActive && styles.vehicleCardActive]}
        onPress={() => handleSelectVehicle(vehicle)}
        activeOpacity={0.7}
      >
        {/* Vehicle Image */}
        <View style={styles.vehicleImageContainer}>
          {vehicle.image_url ? (
            <Image source={{ uri: vehicle.image_url }} style={styles.vehicleImage} />
          ) : (
            <View style={styles.vehicleImagePlaceholder}>
              <Car size={40} color={Colors.textSecondary} />
            </View>
          )}
          {isActive && (
            <View style={styles.activeBadge}>
              <Check size={12} color={Colors.textPrimary} />
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          )}
        </View>

        {/* Vehicle Info */}
        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleName}>{vehicle.name}</Text>
          {(vehicle.make || vehicle.model) && (
            <Text style={styles.vehicleMakeModel}>
              {[vehicle.make, vehicle.model].filter(Boolean).join(' ')}
              {vehicle.year ? ` · ${vehicle.year}` : ''}
            </Text>
          )}

          {/* Specs Row */}
          {(vehicle.horsepower || vehicle.torque_nm || vehicle.weight_kg) && (
            <View style={styles.specsRow}>
              {vehicle.horsepower && (
                <View style={styles.specItem}>
                  <Zap size={12} color={Colors.warning} />
                  <Text style={styles.specText}>{vehicle.horsepower} hp</Text>
                </View>
              )}
              {vehicle.torque_nm && (
                <View style={styles.specItem}>
                  <Gauge size={12} color={Colors.primary} />
                  <Text style={styles.specText}>{vehicle.torque_nm} Nm</Text>
                </View>
              )}
              {vehicle.weight_kg && (
                <View style={styles.specItem}>
                  <Weight size={12} color={Colors.textSecondary} />
                  <Text style={styles.specText}>{vehicle.weight_kg} kg</Text>
                </View>
              )}
            </View>
          )}

          {/* Drive Stats Row */}
          {vehicleStats[vehicle.id] && (vehicleStats[vehicle.id].totalDrives > 0 || vehicleStats[vehicle.id].totalDistance > 0) && (
            <View style={styles.driveStatsRow}>
              <View style={styles.specItem}>
                <Timer size={12} color={Colors.success} />
                <Text style={styles.specText}>
                  {vehicleStats[vehicle.id].totalDrives} drive{vehicleStats[vehicle.id].totalDrives !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.specItem}>
                <Route size={12} color={Colors.success} />
                <Text style={styles.specText}>
                  {formatDistance(vehicleStats[vehicle.id].totalDistance)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Edit Button */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => openEditModal(vehicle)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Pencil size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderModal = () => (
    <Modal
      visible={showAddModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeModal}
    >
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeModal} style={styles.modalHeaderBtn}>
              <X size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              style={styles.modalHeaderBtn}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Check size={24} color={Colors.primary} />
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Image Picker */}
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

            {/* Form Fields */}
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
                  <TextInput
                    style={styles.input}
                    value={formData.make}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, make: text }))}
                    placeholder="e.g., BMW"
                    placeholderTextColor={Colors.textSecondary}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Model</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.model}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, model: text }))}
                    placeholder="e.g., M3"
                    placeholderTextColor={Colors.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Year</Text>
                <TextInput
                  style={styles.input}
                  value={formData.year?.toString() || ''}
                  onChangeText={(text) => setFormData(prev => ({ 
                    ...prev, 
                    year: text ? parseInt(text) : undefined 
                  }))}
                  placeholder="e.g., 2023"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Performance</Text>
              
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Horsepower</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.horsepower?.toString() || ''}
                    onChangeText={(text) => setFormData(prev => ({ 
                      ...prev, 
                      horsepower: text ? parseInt(text) : undefined 
                    }))}
                    placeholder="e.g., 450"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Torque (Nm)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.torque_nm?.toString() || ''}
                    onChangeText={(text) => setFormData(prev => ({ 
                      ...prev, 
                      torque_nm: text ? parseInt(text) : undefined 
                    }))}
                    placeholder="e.g., 550"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Weight (kg)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.weight_kg?.toString() || ''}
                    onChangeText={(text) => setFormData(prev => ({ 
                      ...prev, 
                      weight_kg: text ? parseInt(text) : undefined 
                    }))}
                    placeholder="e.g., 1650"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Drivetrain</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.drivetrain}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, drivetrain: text }))}
                    placeholder="e.g., AWD"
                    placeholderTextColor={Colors.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Engine Type</Text>
                <TextInput
                  style={styles.input}
                  value={formData.engine_type}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, engine_type: text }))}
                  placeholder="e.g., Twin Turbo 3.0L I6"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
            </View>

            {/* Delete Button (only for editing) */}
            {editingVehicle && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  closeModal();
                  handleDelete(editingVehicle);
                }}
              >
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Garage</Text>
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
        <Text style={styles.headerTitle}>Garage</Text>
        <Text style={styles.headerSubtitle}>
          {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {vehicles.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Car size={64} color={Colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No vehicles yet</Text>
            <Text style={styles.emptySubtitle}>
              Add your first vehicle to start{'\n'}tracking your drives
            </Text>
            <TouchableOpacity style={styles.emptyAddButton} onPress={openAddModal}>
              <Plus size={20} color={Colors.textPrimary} />
              <Text style={styles.emptyAddButtonText}>Add Vehicle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {vehicles.map(renderVehicleCard)}
            
            {/* Add Vehicle Button */}
            <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
              <Plus size={24} color={Colors.primary} />
              <Text style={styles.addButtonText}>Add Vehicle</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {renderModal()}
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

  // Vehicle Card
  vehicleCard: {
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  vehicleCardActive: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  vehicleImageContainer: {
    height: 160,
    backgroundColor: Colors.background,
  },
  vehicleImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  vehicleImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.success,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  vehicleInfo: {
    padding: 14,
  },
  vehicleName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  vehicleMakeModel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  specsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  driveStatsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.background,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  specText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  editButton: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Add Button
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.secondary,
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: Colors.primary + '40',
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
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
    marginBottom: 24,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyAddButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.secondary,
  },
  modalHeaderBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },

  // Image Picker
  imagePicker: {
    height: 180,
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
  },
  pickedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePickerPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePickerText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  imagePickerOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Form
  formSection: {
    marginBottom: 24,
  },
  formSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // Delete Button
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
    marginTop: 12,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.error,
  },
});
