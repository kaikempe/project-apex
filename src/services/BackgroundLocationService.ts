import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Task name for background location
export const BACKGROUND_LOCATION_TASK = 'apex-background-location';

// Storage keys
const BACKGROUND_ENABLED_KEY = 'apex_background_tracking_enabled';
const LOCATION_HISTORY_KEY = 'apex_background_locations';

// Location update callback type
type LocationCallback = (location: Location.LocationObject) => void;

// Store callbacks for when location updates
let locationCallbacks: LocationCallback[] = [];

// Register the background task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('❌ Background location error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    
    if (locations && locations.length > 0) {
      const location = locations[0];
      
      console.log('📍 Background location:', {
        lat: location.coords.latitude.toFixed(5),
        lon: location.coords.longitude.toFixed(5),
        speed: ((location.coords.speed || 0) * 3.6).toFixed(0) + ' km/h',
      });

      // Store location for later use
      try {
        const stored = await AsyncStorage.getItem(LOCATION_HISTORY_KEY);
        const history = stored ? JSON.parse(stored) : [];
        
        history.push({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          speed: (location.coords.speed || 0) * 3.6,
          heading: location.coords.heading || 0,
          timestamp: location.timestamp,
        });

        // Keep last 1000 points max
        if (history.length > 1000) {
          history.splice(0, history.length - 1000);
        }

        await AsyncStorage.setItem(LOCATION_HISTORY_KEY, JSON.stringify(history));
      } catch (e) {
        console.error('Failed to store background location:', e);
      }

      // Notify any registered callbacks
      locationCallbacks.forEach(callback => {
        try {
          callback(location);
        } catch (e) {
          console.error('Location callback error:', e);
        }
      });
    }
  }
});

// Background Location Service
export const BackgroundLocationService = {
  /**
   * Check if background location is currently running
   */
  isRunning: async (): Promise<boolean> => {
    return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  },

  /**
   * Check if background tracking is enabled in settings
   */
  isEnabled: async (): Promise<boolean> => {
    const enabled = await AsyncStorage.getItem(BACKGROUND_ENABLED_KEY);
    return enabled === 'true';
  },

  /**
   * Set background tracking enabled/disabled
   */
  setEnabled: async (enabled: boolean): Promise<void> => {
    await AsyncStorage.setItem(BACKGROUND_ENABLED_KEY, enabled ? 'true' : 'false');
    
    if (!enabled) {
      await BackgroundLocationService.stop();
    }
  },

  /**
   * Request necessary permissions for background location
   */
  requestPermissions: async (): Promise<boolean> => {
    // Request foreground permission first
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (foregroundStatus !== 'granted') {
      console.log('❌ Foreground location permission denied');
      return false;
    }

    // Request background permission
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    
    if (backgroundStatus !== 'granted') {
      console.log('❌ Background location permission denied');
      return false;
    }

    console.log('✅ All location permissions granted');
    return true;
  },

  /**
   * Check if we have all required permissions
   */
  hasPermissions: async (): Promise<boolean> => {
    const foreground = await Location.getForegroundPermissionsAsync();
    const background = await Location.getBackgroundPermissionsAsync();
    
    return foreground.status === 'granted' && background.status === 'granted';
  },

  /**
   * Start background location tracking
   */
  start: async (): Promise<boolean> => {
    try {
      // Check permissions
      const hasPerms = await BackgroundLocationService.hasPermissions();
      if (!hasPerms) {
        const granted = await BackgroundLocationService.requestPermissions();
        if (!granted) {
          return false;
        }
      }

      // Check if already running
      const isRunning = await BackgroundLocationService.isRunning();
      if (isRunning) {
        console.log('📍 Background location already running');
        return true;
      }

      // Start background location updates
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000, // Update every 2 seconds
        distanceInterval: 5, // Or every 5 meters
        showsBackgroundLocationIndicator: true, // iOS: Show blue bar
        foregroundService: {
          notificationTitle: 'Apex is tracking',
          notificationBody: 'Your drive is being recorded',
          notificationColor: '#007AFF',
        },
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
      });

      console.log('✅ Background location started');
      return true;
    } catch (error) {
      console.error('❌ Failed to start background location:', error);
      return false;
    }
  },

  /**
   * Stop background location tracking
   */
  stop: async (): Promise<void> => {
    try {
      const isRunning = await BackgroundLocationService.isRunning();
      
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        console.log('🛑 Background location stopped');
      }
    } catch (error) {
      console.error('❌ Failed to stop background location:', error);
    }
  },

  /**
   * Register a callback to receive location updates
   */
  addListener: (callback: LocationCallback): (() => void) => {
    locationCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      locationCallbacks = locationCallbacks.filter(cb => cb !== callback);
    };
  },

  /**
   * Get stored background location history
   */
  getLocationHistory: async (): Promise<any[]> => {
    try {
      const stored = await AsyncStorage.getItem(LOCATION_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  /**
   * Clear stored location history
   */
  clearLocationHistory: async (): Promise<void> => {
    await AsyncStorage.removeItem(LOCATION_HISTORY_KEY);
  },
};

export default BackgroundLocationService;
