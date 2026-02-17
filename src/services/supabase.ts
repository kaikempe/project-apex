import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Your Supabase project credentials
// Replace these with your actual values from:
// Supabase Dashboard → Settings → API
const SUPABASE_URL = 'https://winfnhoqojxpysmdhhvo.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_Y3cA13xgf2uDXzUBHWFnSA_ZH6carN5';

// Secure storage adapter for auth persistence
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('SecureStore getItem error:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('SecureStore setItem error:', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('SecureStore removeItem error:', error);
    }
  },
};

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ============================================
// DATABASE HELPER FUNCTIONS
// ============================================

// Profile helpers
export const profileService = {
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  async updateProfile(userId: string, updates: Record<string, any>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    return { data, error };
  },

  async getProfileByUsername(username: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();
    return { data, error };
  },
};

// Vehicle helpers
export const vehicleService = {
  async getVehicles(userId: string) {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async createVehicle(vehicle: {
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
  }) {
    const { data, error } = await supabase
      .from('vehicles')
      .insert(vehicle)
      .select()
      .single();
    return { data, error };
  },

  async updateVehicle(vehicleId: string, updates: Record<string, any>) {
    const { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', vehicleId)
      .select()
      .single();
    return { data, error };
  },

  async deleteVehicle(vehicleId: string) {
    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', vehicleId);
    return { error };
  },

  async setActiveVehicle(userId: string, vehicleId: string) {
    // First, set all vehicles to inactive
    await supabase
      .from('vehicles')
      .update({ is_active: false })
      .eq('owner_id', userId);

    // Then set the selected one to active
    const { data, error } = await supabase
      .from('vehicles')
      .update({ is_active: true })
      .eq('id', vehicleId)
      .select()
      .single();
    return { data, error };
  },
};

// Sprint results helpers
export const sprintService = {
  async saveSprint(sprint: {
    user_id: string;
    vehicle_id?: string;
    sprint_type: '0-100' | '100-200';
    time_seconds: number;
    top_speed?: number;
    start_speed?: number;
    end_speed?: number;
    latitude?: number;
    longitude?: number;
  }) {
    const { data, error } = await supabase
      .from('sprint_results')
      .insert(sprint)
      .select()
      .single();
    return { data, error };
  },

  async getUserSprints(userId: string, limit = 50) {
    const { data, error } = await supabase
      .from('sprint_results')
      .select('*, vehicles(name, make, model)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data, error };
  },

  async getLeaderboard(sprintType: '0-100' | '100-200', limit = 100) {
    const { data, error } = await supabase
      .from('sprint_results')
      .select('*, profiles(display_name, username, avatar_url), vehicles(name, make, model)')
      .eq('sprint_type', sprintType)
      .order('time_seconds', { ascending: true })
      .limit(limit);
    return { data, error };
  },

  async getUserBest(userId: string, sprintType: '0-100' | '100-200') {
    const { data, error } = await supabase
      .from('sprint_results')
      .select('*')
      .eq('user_id', userId)
      .eq('sprint_type', sprintType)
      .order('time_seconds', { ascending: true })
      .limit(1)
      .single();
    return { data, error };
  },
};

// Live session helpers
export const liveSessionService = {
  async updateLocation(
    userId: string,
    vehicleId: string | null,
    latitude: number,
    longitude: number,
    speed: number,
    heading: number
  ) {
    const { data, error } = await supabase
      .from('live_sessions')
      .upsert({
        user_id: userId,
        vehicle_id: vehicleId,
        latitude,
        longitude,
        speed,
        heading,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();
    return { data, error };
  },

  async endSession(userId: string) {
    const { error } = await supabase
      .from('live_sessions')
      .delete()
      .eq('user_id', userId);
    return { error };
  },

  async getNearbyFriends(userId: string, latitude: number, longitude: number, radiusKm = 5) {
    // This is a simplified version - for production, use PostGIS for proper geo queries
    const latDelta = radiusKm / 111; // ~111km per degree of latitude
    const lonDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));

    const { data, error } = await supabase
      .from('live_sessions')
      .select('*, profiles(display_name, username, avatar_url)')
      .neq('user_id', userId)
      .gte('latitude', latitude - latDelta)
      .lte('latitude', latitude + latDelta)
      .gte('longitude', longitude - lonDelta)
      .lte('longitude', longitude + lonDelta)
      .gte('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Active in last 5 min

    return { data, error };
  },
};

// Friendship helpers
export const friendshipService = {
  async sendRequest(userId: string, friendId: string) {
    const { data, error } = await supabase
      .from('friendships')
      .insert({ user_id: userId, friend_id: friendId, status: 'pending' })
      .select()
      .single();
    return { data, error };
  },

  async acceptRequest(friendshipId: string) {
    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)
      .select()
      .single();
    return { data, error };
  },

  async getFriends(userId: string) {
    const { data, error } = await supabase
      .from('friendships')
      .select('*, profiles!friendships_friend_id_fkey(id, display_name, username, avatar_url)')
      .eq('user_id', userId)
      .eq('status', 'accepted');
    return { data, error };
  },

  async getPendingRequests(userId: string) {
    const { data, error } = await supabase
      .from('friendships')
      .select('*, profiles!friendships_user_id_fkey(id, display_name, username, avatar_url)')
      .eq('friend_id', userId)
      .eq('status', 'pending');
    return { data, error };
  },
};
