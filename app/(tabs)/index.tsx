import { StyleSheet, View } from 'react-native';
import { Speedometer } from '@/src/components/Speedometer';
import { MapHUD } from '@/src/components/MapHUD';
import { DeltaTimer } from '@/src/components/DeltaTimer';
import { SprintModeSelector, SprintMode } from '@/src/components/SprintModeSelector';
import { SprintTimerHUD } from '@/src/components/SprintTimerHUD';
import { DriveSessionHUD, DriveStats } from '@/src/components/DriveSessionHUD';
import { POIDetailSheet } from '@/src/components/POIDetailSheet';
import { Colors } from '@/src/theme/colors';
import { useLocation } from '@/src/hooks/useLocation';
import { useSprintTimer, SprintResultData } from '@/src/hooks/useSprintTimer';
import { useDeepLink } from '@/src/hooks/useDeepLink';
import { useVehicle } from '@/src/context/VehicleContext';
import { useAudio } from '@/src/context/AudioContext';
import { usePOI, SpeedTrap, Segment, CarMeet } from '@/src/context/POIContext';
import { AudioPriority } from '@/src/services/AudioQueue';
import { segmentDetection } from '@/src/services/SegmentDetection';
import { supabase } from '@/src/services/supabase';
import { useEffect, useState, useCallback, useRef } from 'react';

// ──────────────────────────────────────────────────
// Haversine formula: distance between two GPS points in meters
// ──────────────────────────────────────────────────
function haversineMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Mock segments for demo
const MOCK_SEGMENTS = [
  {
    id: 'seg_1',
    name: 'Highway Sprint',
    startGate: { latitude: 37.7749, longitude: -122.4194, radius_meters: 50 },
    endGate: { latitude: 37.7849, longitude: -122.4294, radius_meters: 50 },
    distance_meters: 1500,
    leaderboard: [],
    ghost: {
      user_name: 'FastDriver',
      time_seconds: 45.2,
      waypoints: [],
    },
  },
];

export default function HomeScreen() {
  const { location, permissionGranted } = useLocation();
  const { activeVehicle, isSessionActive, startSession, endSession } = useVehicle();
  const { announce } = useAudio();
  
  // POI context
  const {
    speedTraps,
    segments,
    carMeets,
    showSpeedTraps,
    showSegments,
    showCarMeets,
  } = usePOI();
  
  // Selected POI state
  const [selectedPOI, setSelectedPOI] = useState<SpeedTrap | Segment | CarMeet | null>(null);
  const [selectedPOIType, setSelectedPOIType] = useState<'speed_trap' | 'segment' | 'car_meet' | null>(null);
  
  // Drive session pause state
  const [isDrivePaused, setIsDrivePaused] = useState(false);
  
  // Segment state
  const [deltaTime, setDeltaTime] = useState<number | null>(null);
  const [activeSegmentName, setActiveSegmentName] = useState<string | null>(null);
  
  // Sprint state
  const [selectedSprintMode, setSelectedSprintMode] = useState<SprintMode | null>(null);

  // ──────────────────────────────────────────────────
  // Route + speed data collection + LIVE DISTANCE
  // ──────────────────────────────────────────────────
  const routeDataRef = useRef<{ lat: number; lon: number; timestamp: number }[]>([]);
  const speedDataRef = useRef<{ speed: number; timestamp: number }[]>([]);
  const lastRecordedRef = useRef<number>(0);
  const [liveDistance, setLiveDistance] = useState(0); // meters
  const liveDistanceRef = useRef(0);

  // Record GPS points at ~1 Hz and accumulate distance
  useEffect(() => {
    if (!isSessionActive || isDrivePaused || !permissionGranted) return;

    const now = Date.now();
    // Throttle to ~1 point per second
    if (now - lastRecordedRef.current < 900) return;
    lastRecordedRef.current = now;

    const currentLat = location.latitude;
    const currentLon = location.longitude;

    // Calculate distance from previous point
    if (routeDataRef.current.length > 0) {
      const prev = routeDataRef.current[routeDataRef.current.length - 1];
      const segmentDist = haversineMeters(prev.lat, prev.lon, currentLat, currentLon);
      
      // Filter out GPS noise: only count if > 2m and < 500m (no teleportation)
      if (segmentDist > 2 && segmentDist < 500) {
        liveDistanceRef.current += segmentDist;
        setLiveDistance(liveDistanceRef.current);
      }
    }

    routeDataRef.current.push({
      lat: currentLat,
      lon: currentLon,
      timestamp: now,
    });

    speedDataRef.current.push({
      speed: location.speed,
      timestamp: now,
    });
  }, [location, isSessionActive, isDrivePaused, permissionGranted]);

  // Clear route/speed/distance data when session starts
  useEffect(() => {
    if (isSessionActive) {
      routeDataRef.current = [];
      speedDataRef.current = [];
      lastRecordedRef.current = 0;
      liveDistanceRef.current = 0;
      setLiveDistance(0);
    }
  }, [isSessionActive]);

  // Deep link handler
  useDeepLink();

  // POI press handlers
  const handleSpeedTrapPress = useCallback((trap: SpeedTrap) => {
    setSelectedPOI(trap);
    setSelectedPOIType('speed_trap');
  }, []);

  const handleSegmentPress = useCallback((segment: Segment) => {
    setSelectedPOI(segment);
    setSelectedPOIType('segment');
  }, []);

  const handleCarMeetPress = useCallback((meet: CarMeet) => {
    setSelectedPOI(meet);
    setSelectedPOIType('car_meet');
  }, []);

  const handleClosePOI = useCallback(() => {
    setSelectedPOI(null);
    setSelectedPOIType(null);
  }, []);

  // Save drive stats — includes route, speed data, and calculated distance
  const handleSaveDriveStats = useCallback(async (stats: DriveStats) => {
    if (!activeVehicle) return;

    try {
      const { data: vehicle, error: fetchError } = await supabase
        .from('vehicles')
        .select('specs_json')
        .eq('id', activeVehicle.id)
        .single();

      if (fetchError) throw fetchError;

      const specs = vehicle?.specs_json || {};
      const driveHistory = specs.drive_history || [];

      // Use the real calculated distance
      const finalDistance = Math.round(liveDistanceRef.current);

      driveHistory.push({
        duration: stats.duration,
        top_speed: stats.topSpeed,
        distance: finalDistance,
        start_time: stats.startTime,
        end_time: stats.endTime,
        vehicle_name: activeVehicle.name,
        route: routeDataRef.current,
        speed_data: speedDataRef.current,
      });

      if (driveHistory.length > 100) {
        driveHistory.shift();
      }

      // Update per-vehicle totals
      const totalDistance = (specs.total_distance || 0) + finalDistance;
      const totalDrives = (specs.total_drives || 0) + 1;

      const { error: updateError } = await supabase
        .from('vehicles')
        .update({
          specs_json: {
            ...specs,
            drive_history: driveHistory,
            total_distance: totalDistance,
            total_drives: totalDrives,
          },
        })
        .eq('id', activeVehicle.id);

      if (updateError) throw updateError;

      console.log(`✅ Drive saved: ${finalDistance}m distance, vehicle totals: ${totalDrives} drives / ${totalDistance}m`);
    } catch (error) {
      console.error('❌ Failed to save drive stats:', error);
    }
  }, [activeVehicle]);

  // Save sprint result to vehicle
  const saveSprintResult = useCallback(async (result: SprintResultData) => {
    if (!activeVehicle) return;

    try {
      const { data: vehicle, error: fetchError } = await supabase
        .from('vehicles')
        .select('specs_json')
        .eq('id', activeVehicle.id)
        .single();

      if (fetchError) throw fetchError;

      const specs = vehicle?.specs_json || {};
      const sprintHistory = specs.sprint_history || [];

      sprintHistory.push({
        mode_id: result.mode.id,
        mode_label: result.mode.label,
        time: result.time,
        top_speed: result.topSpeed,
        date: result.date.toISOString(),
      });

      if (sprintHistory.length > 50) {
        sprintHistory.shift();
      }

      const bestTimes = specs.best_times || {};
      const currentBest = bestTimes[result.mode.id];
      if (!currentBest || result.time < currentBest) {
        bestTimes[result.mode.id] = result.time;
        announce(
          `New personal best! ${result.time.toFixed(2)} seconds.`,
          AudioPriority.SEGMENT_RESULT
        );
      } else {
        const diff = result.time - currentBest;
        announce(
          `${result.time.toFixed(2)} seconds. ${diff.toFixed(2)} slower than best.`,
          AudioPriority.SEGMENT_RESULT
        );
      }

      const { error: updateError } = await supabase
        .from('vehicles')
        .update({
          specs_json: {
            ...specs,
            sprint_history: sprintHistory,
            best_times: bestTimes,
          },
        })
        .eq('id', activeVehicle.id);

      if (updateError) throw updateError;

      console.log('✅ Sprint result saved to vehicle');
    } catch (error) {
      console.error('❌ Failed to save sprint result:', error);
    }
  }, [activeVehicle, announce]);

  // Sprint completion handler
  const handleSprintComplete = useCallback((result: SprintResultData) => {
    console.log('🏁 Sprint result:', result);
    saveSprintResult(result);
  }, [saveSprintResult]);

  // Sprint timer hook
  const {
    state: sprintState,
    elapsedTime: sprintTime,
    topSpeed: sprintTopSpeed,
    result: sprintResult,
    reset: resetSprint,
    stop: stopSprint,
  } = useSprintTimer({
    mode: selectedSprintMode,
    currentSpeed: location.speed,
    isEnabled: isSessionActive && selectedSprintMode !== null,
    onComplete: handleSprintComplete,
  });

  // Stop sprint AND clear mode
  const handleStopSprint = useCallback(() => {
    console.log('🛑 Stopping sprint and clearing mode');
    stopSprint();
    setSelectedSprintMode(null);
  }, [stopSprint]);

  // Handle sprint mode change
  const handleSprintModeChange = (mode: SprintMode | null) => {
    setSelectedSprintMode(mode);
    resetSprint();
    if (mode) {
      announce(`Sprint mode: ${mode.label}`, AudioPriority.SYSTEM);
    }
  };

  // End sprint when drive ends from pause menu
  const handleEndSession = useCallback(() => {
    console.log('🏁 Ending drive session — cleaning up sprint');
    stopSprint();
    setSelectedSprintMode(null);
    endSession();
  }, [stopSprint, endSession]);

  // Segment detection
  useEffect(() => {
    if (!isSessionActive || !permissionGranted) return;

    segmentDetection.updateNearbySegments(
      { latitude: location.latitude, longitude: location.longitude },
      MOCK_SEGMENTS
    );

    const result = segmentDetection.checkSegmentTrigger(
      { latitude: location.latitude, longitude: location.longitude },
      location.speed,
      Date.now()
    );

    if (result.event === 'entered' && result.segment) {
      setActiveSegmentName(result.segment.name);
      announce(`Entering segment: ${result.segment.name}`, AudioPriority.SEGMENT_APPROACH);
    } else if (result.event === 'completed' && result.segment && result.time) {
      setActiveSegmentName(null);
      setDeltaTime(null);

      const isNewPB = result.deltaTime && result.deltaTime < 0;
      const rankText = isNewPB ? 'New personal best!' : 'Segment complete.';
      
      announce(
        `${rankText} ${result.time.toFixed(1)} seconds. ${
          result.deltaTime
            ? `${result.deltaTime < 0 ? '' : '+'}${result.deltaTime.toFixed(1)} seconds vs ghost.`
            : ''
        }`,
        AudioPriority.SEGMENT_RESULT
      );
    }

    if (result.event === null) {
      const delta = segmentDetection.getGhostDelta(Date.now());
      if (delta !== null) {
        setDeltaTime(delta);
      }
    }
  }, [location, isSessionActive, permissionGranted, announce]);

  if (!permissionGranted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionMessage}>
          <Speedometer speed={0} unit="km/h" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map HUD with POI markers */}
      <MapHUD
        userLatitude={location.latitude}
        userLongitude={location.longitude}
        userHeading={location.heading || 0}
        userSpeed={location.speed}
        speedTraps={speedTraps}
        segments={segments}
        carMeets={carMeets}
        showSpeedTraps={showSpeedTraps}
        showSegments={showSegments}
        showCarMeets={showCarMeets}
        onSpeedTrapPress={handleSpeedTrapPress}
        onSegmentPress={handleSegmentPress}
        onCarMeetPress={handleCarMeetPress}
      />

      {/* Sprint Timer HUD (top of screen) */}
      <SprintTimerHUD
        mode={selectedSprintMode}
        state={sprintState}
        currentSpeed={location.speed}
        elapsedTime={sprintTime}
        result={sprintResult}
        topSpeed={sprintTopSpeed}
        onStop={handleStopSprint}
        onReset={resetSprint}
      />

      {/* Sprint Mode Selector Button - hidden when paused */}
      {isSessionActive && !isDrivePaused && (
        <SprintModeSelector
          selectedMode={selectedSprintMode}
          onSelectMode={handleSprintModeChange}
          isSprintActive={sprintState === 'RUNNING'}
        />
      )}

      {/* Delta Timer Overlay (for segments) */}
      {activeSegmentName && (
        <DeltaTimer deltaSeconds={deltaTime} segmentName={activeSegmentName} />
      )}

      {/* POI Detail Sheet */}
      <POIDetailSheet
        poi={selectedPOI}
        poiType={selectedPOIType}
        onClose={handleClosePOI}
      />

      {/* Speedometer HUD */}
      <Speedometer speed={location.speed} unit="km/h" />

      {/* Drive Session HUD — now receives live distance */}
      <DriveSessionHUD
        isSessionActive={isSessionActive}
        activeVehicle={activeVehicle}
        currentSpeed={location.speed}
        gpsAccuracy={location.accuracy}
        liveDistance={liveDistance}
        onStartSession={startSession}
        onEndSession={handleEndSession}
        onSaveDriveStats={handleSaveDriveStats}
        onPauseChange={setIsDrivePaused}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  permissionMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
