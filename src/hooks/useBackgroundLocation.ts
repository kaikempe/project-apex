import { useState, useEffect, useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import BackgroundLocationService from '../services/BackgroundLocationService';

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

interface UseBackgroundLocationReturn {
  isEnabled: boolean;
  isRunning: boolean;
  hasPermission: boolean;
  isLoading: boolean;
  isSupported: boolean;
  toggleEnabled: () => Promise<void>;
  startTracking: () => Promise<boolean>;
  stopTracking: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
}

export const useBackgroundLocation = (): UseBackgroundLocationReturn => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Background location is not supported in Expo Go
  const isSupported = !isExpoGo;

  // Load initial state
  useEffect(() => {
    const loadState = async () => {
      // If not supported (Expo Go), skip loading
      if (!isSupported) {
        setIsLoading(false);
        return;
      }
      
      try {
        const [enabled, running, permission] = await Promise.all([
          BackgroundLocationService.isEnabled(),
          BackgroundLocationService.isRunning(),
          BackgroundLocationService.hasPermissions(),
        ]);

        setIsEnabled(enabled);
        setIsRunning(running);
        setHasPermission(permission);
      } catch (error) {
        console.error('Failed to load background location state:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadState();
  }, [isSupported]);

  // Request permission with user-friendly prompts
  const requestPermission = useCallback(async (): Promise<boolean> => {
    // Not supported in Expo Go
    if (!isSupported) {
      Alert.alert(
        'Development Build Required',
        'Background location tracking requires a development build. It\'s not available in Expo Go.\n\nRun "npx expo run:ios" or "npx expo run:android" to create a development build.',
        [{ text: 'OK' }]
      );
      return false;
    }
    
    try {
      // Check current status
      const currentPermission = await BackgroundLocationService.hasPermissions();
      
      if (currentPermission) {
        setHasPermission(true);
        return true;
      }

      // Show explanation first
      return new Promise((resolve) => {
        Alert.alert(
          'Background Location',
          'Apex needs location access to track your drives even when the app is in the background.\n\nThis allows you to:\n• Record complete drive routes\n• Track speed throughout your drive\n• Get notified when approaching speed traps',
          [
            {
              text: 'Not Now',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: 'Enable',
              onPress: async () => {
                const granted = await BackgroundLocationService.requestPermissions();
                setHasPermission(granted);
                
                if (!granted) {
                  // Offer to open settings
                  Alert.alert(
                    'Permission Required',
                    'Please enable "Always" location access in Settings to use background tracking.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Open Settings', 
                        onPress: () => Linking.openSettings(),
                      },
                    ]
                  );
                }
                
                resolve(granted);
              },
            },
          ]
        );
      });
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  }, [isSupported]);

  // Toggle enabled state
  const toggleEnabled = useCallback(async () => {
    // Not supported in Expo Go
    if (!isSupported) {
      Alert.alert(
        'Development Build Required',
        'Background location tracking requires a development build. It\'s not available in Expo Go.\n\nTo enable this feature:\n1. Run "npx expo run:ios" or "npx expo run:android"\n2. This will create a development build with native permissions',
        [{ text: 'OK' }]
      );
      return;
    }
    
    const newEnabled = !isEnabled;

    if (newEnabled) {
      // Request permission first
      const hasPerms = await requestPermission();
      
      if (!hasPerms) {
        return; // Don't enable if no permission
      }

      // Enable and optionally start
      await BackgroundLocationService.setEnabled(true);
      setIsEnabled(true);

      // Ask if they want to start now
      Alert.alert(
        'Background Tracking Enabled',
        'Start tracking now?',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Start Now',
            onPress: async () => {
              const started = await BackgroundLocationService.start();
              setIsRunning(started);
            },
          },
        ]
      );
    } else {
      // Disable and stop
      await BackgroundLocationService.setEnabled(false);
      await BackgroundLocationService.stop();
      setIsEnabled(false);
      setIsRunning(false);
    }
  }, [isEnabled, isSupported, requestPermission]);

  // Start tracking
  const startTracking = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false;
    }
    
    // Check if enabled
    if (!isEnabled) {
      Alert.alert(
        'Background Tracking Disabled',
        'Enable background tracking in Profile settings first.',
        [{ text: 'OK' }]
      );
      return false;
    }

    const started = await BackgroundLocationService.start();
    setIsRunning(started);
    return started;
  }, [isEnabled, isSupported]);

  // Stop tracking
  const stopTracking = useCallback(async () => {
    if (!isSupported) {
      return;
    }
    
    await BackgroundLocationService.stop();
    setIsRunning(false);
  }, [isSupported]);

  return {
    isEnabled,
    isRunning,
    hasPermission,
    isLoading,
    isSupported,
    toggleEnabled,
    startTracking,
    stopTracking,
    requestPermission,
  };
};

export default useBackgroundLocation;
