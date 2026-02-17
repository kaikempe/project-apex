import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, vehicleService } from '../services/supabase';
import { useAuth } from './AuthContext';
import { useAudio } from './AudioContext';
import { AudioPriority } from '../services/AudioQueue';

// Vehicle type matching Supabase schema
export interface Vehicle {
  id: string;
  owner_id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  horsepower?: number;
  torque_nm?: number;
  weight_kg?: number;
  drivetrain?: string;
  engine_type?: string;
  image_url?: string;
  bt_mac?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// For creating/updating vehicles (without server-generated fields)
export interface VehicleInput {
  name: string;
  make?: string;
  model?: string;
  year?: number;
  horsepower?: number;
  torque_nm?: number;
  weight_kg?: number;
  drivetrain?: string;
  engine_type?: string;
  image_url?: string;
  bt_mac?: string;
}

interface VehicleContextType {
  vehicles: Vehicle[];
  activeVehicle: Vehicle | null;
  isLoading: boolean;
  isSessionActive: boolean;
  error: string | null;
  
  // CRUD operations
  addVehicle: (vehicle: VehicleInput) => Promise<Vehicle | null>;
  updateVehicle: (id: string, updates: Partial<VehicleInput>) => Promise<boolean>;
  deleteVehicle: (id: string) => Promise<boolean>;
  setActiveVehicle: (id: string) => Promise<void>;
  
  // Session control
  startSession: () => void;
  endSession: () => void;
  
  // Refresh from server
  refreshVehicles: () => Promise<void>;
}

const VehicleContext = createContext<VehicleContextType | undefined>(undefined);

// Key for tracking if migration has been done
const MIGRATION_KEY = 'apex_vehicles_migrated';
const OLD_STORAGE_KEY = 'apex_vehicles';

export const VehicleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { announce } = useAudio();
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeVehicle, setActiveVehicleState] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnnouncedVehicleId, setLastAnnouncedVehicleId] = useState<string | null>(null);

  // Fetch vehicles from Supabase
  const fetchVehicles = useCallback(async () => {
    if (!user) {
      setVehicles([]);
      setActiveVehicleState(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await vehicleService.getVehicles(user.id);
      
      if (fetchError) {
        console.error('Error fetching vehicles:', fetchError);
        setError('Failed to load vehicles');
        return;
      }
      
      const vehicleList = data || [];
      setVehicles(vehicleList);
      
      // Set active vehicle
      const active = vehicleList.find(v => v.is_active);
      setActiveVehicleState(active || null);
      
      console.log(`🚗 Loaded ${vehicleList.length} vehicles from Supabase`);
    } catch (err) {
      console.error('Vehicle fetch error:', err);
      setError('Failed to load vehicles');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Migrate vehicles from AsyncStorage to Supabase (one-time)
  const migrateFromAsyncStorage = useCallback(async () => {
    if (!user) return;
    
    try {
      // Check if already migrated
      const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
      if (migrated === user.id) {
        console.log('🔄 Vehicles already migrated for this user');
        return;
      }
      
      // Get old vehicles from AsyncStorage
      const oldData = await AsyncStorage.getItem(OLD_STORAGE_KEY);
      if (!oldData) {
        // No old data to migrate
        await AsyncStorage.setItem(MIGRATION_KEY, user.id);
        return;
      }
      
      const oldVehicles = JSON.parse(oldData);
      if (!Array.isArray(oldVehicles) || oldVehicles.length === 0) {
        await AsyncStorage.setItem(MIGRATION_KEY, user.id);
        return;
      }
      
      console.log(`🔄 Migrating ${oldVehicles.length} vehicles to Supabase...`);
      
      // Upload each vehicle to Supabase
      for (const oldVehicle of oldVehicles) {
        const { error: insertError } = await supabase
          .from('vehicles')
          .insert({
            owner_id: user.id,
            name: oldVehicle.name || 'Unnamed Vehicle',
            make: oldVehicle.make,
            model: oldVehicle.model,
            year: oldVehicle.year,
            horsepower: oldVehicle.horsepower || oldVehicle.hp,
            torque_nm: oldVehicle.torqueNm || oldVehicle.torque_nm,
            weight_kg: oldVehicle.weightKg || oldVehicle.weight_kg,
            drivetrain: oldVehicle.drivetrain,
            engine_type: oldVehicle.engineType || oldVehicle.engine_type,
            image_url: oldVehicle.imageUri || oldVehicle.image_url,
            bt_mac: oldVehicle.btMac || oldVehicle.bt_mac,
            is_active: oldVehicle.isActive || false,
          });
        
        if (insertError) {
          console.error('Error migrating vehicle:', insertError);
        }
      }
      
      // Mark as migrated
      await AsyncStorage.setItem(MIGRATION_KEY, user.id);
      
      console.log('✅ Vehicle migration complete');
    } catch (err) {
      console.error('Migration error:', err);
    }
  }, [user]);

  // Initial load and migration
  useEffect(() => {
    const init = async () => {
      if (isAuthenticated && user) {
        await migrateFromAsyncStorage();
        await fetchVehicles();
      } else {
        setVehicles([]);
        setActiveVehicleState(null);
        setIsLoading(false);
      }
    };
    
    init();
  }, [isAuthenticated, user, migrateFromAsyncStorage, fetchVehicles]);

  // Announce active vehicle change
  useEffect(() => {
    if (activeVehicle && activeVehicle.id !== lastAnnouncedVehicleId && isSessionActive) {
      announce(`${activeVehicle.name} selected`, AudioPriority.SYSTEM);
      setLastAnnouncedVehicleId(activeVehicle.id);
    }
  }, [activeVehicle, isSessionActive, lastAnnouncedVehicleId, announce]);

  // Add a new vehicle
  const addVehicle = async (input: VehicleInput): Promise<Vehicle | null> => {
    if (!user) {
      setError('Not authenticated');
      return null;
    }
    
    try {
      setError(null);
      
      const { data, error: insertError } = await vehicleService.createVehicle({
        owner_id: user.id,
        name: input.name,
        make: input.make,
        model: input.model,
        year: input.year,
        horsepower: input.horsepower,
        torque_nm: input.torque_nm,
        weight_kg: input.weight_kg,
        drivetrain: input.drivetrain,
        engine_type: input.engine_type,
        image_url: input.image_url,
        bt_mac: input.bt_mac,
      });
      
      if (insertError) {
        console.error('Error adding vehicle:', insertError);
        setError('Failed to add vehicle');
        return null;
      }
      
      console.log('🚗 Vehicle added:', data.name);
      
      // Refresh list
      await fetchVehicles();
      
      return data;
    } catch (err) {
      console.error('Add vehicle error:', err);
      setError('Failed to add vehicle');
      return null;
    }
  };

  // Update a vehicle
  const updateVehicle = async (id: string, updates: Partial<VehicleInput>): Promise<boolean> => {
    if (!user) {
      setError('Not authenticated');
      return false;
    }
    
    try {
      setError(null);
      
      const { error: updateError } = await vehicleService.updateVehicle(id, updates);
      
      if (updateError) {
        console.error('Error updating vehicle:', updateError);
        setError('Failed to update vehicle');
        return false;
      }
      
      console.log('🚗 Vehicle updated');
      
      // Refresh list
      await fetchVehicles();
      
      return true;
    } catch (err) {
      console.error('Update vehicle error:', err);
      setError('Failed to update vehicle');
      return false;
    }
  };

  // Delete a vehicle
  const deleteVehicle = async (id: string): Promise<boolean> => {
    if (!user) {
      setError('Not authenticated');
      return false;
    }
    
    try {
      setError(null);
      
      const { error: deleteError } = await vehicleService.deleteVehicle(id);
      
      if (deleteError) {
        console.error('Error deleting vehicle:', deleteError);
        setError('Failed to delete vehicle');
        return false;
      }
      
      console.log('🚗 Vehicle deleted');
      
      // Refresh list
      await fetchVehicles();
      
      return true;
    } catch (err) {
      console.error('Delete vehicle error:', err);
      setError('Failed to delete vehicle');
      return false;
    }
  };

  // Set active vehicle
  const setActiveVehicle = async (id: string): Promise<void> => {
    if (!user) return;
    
    try {
      const { error: setActiveError } = await vehicleService.setActiveVehicle(user.id, id);
      
      if (setActiveError) {
        console.error('Error setting active vehicle:', setActiveError);
        return;
      }
      
      // Refresh to get updated list
      await fetchVehicles();
    } catch (err) {
      console.error('Set active vehicle error:', err);
    }
  };

  // Session control
  const startSession = () => {
    if (activeVehicle) {
      setIsSessionActive(true);
      announce('Apex Online. Connect power.', AudioPriority.SYSTEM);
      console.log('🟢 Session started');
    } else {
      announce('No vehicle selected. Go to Garage to select a vehicle.', AudioPriority.SYSTEM);
    }
  };

  const endSession = () => {
    setIsSessionActive(false);
    announce('Session ended.', AudioPriority.SYSTEM);
    console.log('🔴 Session ended');
  };

  // Refresh from server
  const refreshVehicles = async () => {
    await fetchVehicles();
  };

  const value: VehicleContextType = {
    vehicles,
    activeVehicle,
    isLoading,
    isSessionActive,
    error,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    setActiveVehicle,
    startSession,
    endSession,
    refreshVehicles,
  };

  return (
    <VehicleContext.Provider value={value}>
      {children}
    </VehicleContext.Provider>
  );
};

export const useVehicle = () => {
  const context = useContext(VehicleContext);
  if (context === undefined) {
    throw new Error('useVehicle must be used within a VehicleProvider');
  }
  return context;
};
