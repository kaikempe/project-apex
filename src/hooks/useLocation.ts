import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

interface LocationData {
  speed: number;          // Speed in km/h
  latitude: number;
  longitude: number;
  heading: number | null; // Direction in degrees
  accuracy: number;       // GPS accuracy in meters
}

export const useLocation = () => {
  const [location, setLocation] = useState<LocationData>({
    speed: 0,
    latitude: 0,
    longitude: 0,
    heading: null,
    accuracy: 0,
  });
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    const startLocationTracking = async () => {
      try {
        // Request foreground permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== 'granted') {
          setError('Location permission denied');
          setPermissionGranted(false);
          return;
        }

        setPermissionGranted(true);
        setError(null);

        // Start high-accuracy polling at 1Hz
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,        // Update every 1 second (1Hz)
            distanceInterval: 0,       // Update on any movement
          },
          (loc) => {
            // Convert m/s to km/h
            const speedKmh = (loc.coords.speed || 0) * 3.6;
            
            setLocation({
              speed: Math.max(0, speedKmh), // Never show negative speed
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading,
              accuracy: loc.coords.accuracy || 0,
            });
          }
        );
      } catch (err) {
        setError('Failed to start location tracking');
        console.error('Location error:', err);
      }
    };

    startLocationTracking();

    // Cleanup on unmount
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  return { location, permissionGranted, error };
};