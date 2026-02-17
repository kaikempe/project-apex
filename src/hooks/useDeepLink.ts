import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { useAudio } from '../context/AudioContext';
import { useVehicle } from '../context/VehicleContext';
import { AudioPriority } from '../services/AudioQueue';

interface DeepLinkParams {
  bt_id?: string;      // Vehicle UUID from Bluetooth
  action?: string;     // start-drive, end-drive, etc.
}

export const useDeepLink = () => {
  const { allVehicles, setActiveVehicle, startSession } = useVehicle();
  const { announce } = useAudio();

  useEffect(() => {
    // Handle initial URL (app was closed and opened via deep link)
    const handleInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log('📱 App opened with URL:', initialUrl);
        handleDeepLink(initialUrl);
      }
    };

    // Handle URL when app is already open
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('📱 Deep link received:', event.url);
      handleDeepLink(event.url);
    });

    handleInitialURL();

    return () => {
      subscription.remove();
    };
  }, [allVehicles]);

  const handleDeepLink = (url: string) => {
    try {
      const parsed = Linking.parse(url);
      console.log('🔗 Parsed deep link:', parsed);

      const { hostname, path, queryParams } = parsed;

      // apex://start-drive?bt_id=VEHICLE_UUID
      if (hostname === 'start-drive' || path === 'start-drive') {
        handleStartDrive(queryParams as DeepLinkParams);
      }
      // apex://end-drive
      else if (hostname === 'end-drive' || path === 'end-drive') {
        handleEndDrive();
      }
    } catch (error) {
      console.error('❌ Failed to parse deep link:', error);
    }
  };

  const handleStartDrive = (params: DeepLinkParams) => {
    const { bt_id } = params;

    console.log('🚗 Start drive triggered, bt_id:', bt_id);

    // Find vehicle by ID
    if (bt_id) {
      const vehicle = allVehicles.find((v) => v.id === bt_id || v.bt_mac === bt_id);
      
      if (vehicle) {
        // Set as active vehicle
        setActiveVehicle(vehicle);
        
        // Start session
        startSession();
        
        // Voice greeting
        announce(
          `Apex Online. ${vehicle.name} linked. Connect power.`,
          AudioPriority.SYSTEM
        );
        
        console.log(`✅ Session started with ${vehicle.name}`);
        return;
      } else {
        console.warn(`⚠️ Vehicle not found for bt_id: ${bt_id}`);
      }
    }

    // Fallback: No bt_id or vehicle not found - use current active vehicle
    const activeVehicle = allVehicles.find((v) => v.is_active);
    if (activeVehicle) {
      startSession();
      announce(
        `Apex Online. ${activeVehicle.name} linked. Connect power.`,
        AudioPriority.SYSTEM
      );
      console.log(`✅ Session started with active vehicle: ${activeVehicle.name}`);
    } else {
      console.warn('⚠️ No active vehicle found');
      announce(
        'Apex Online. Please select a vehicle in Garage.',
        AudioPriority.SYSTEM
      );
    }
  };

  const handleEndDrive = () => {
    console.log('🏁 End drive triggered');
    announce('Drive session ended. See you next time.', AudioPriority.SYSTEM);
  };
};