import { StyleSheet, View, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Speedometer } from '@/src/components/Speedometer';
import { MapHUD } from '@/src/components/MapHUD';
import { DeltaTimer } from '@/src/components/DeltaTimer';
import { SprintModeSelector, SprintMode } from '@/src/components/SprintModeSelector';
import { SprintTimerHUD } from '@/src/components/SprintTimerHUD';
import { DriveSessionHUD, DriveStats } from '@/src/components/DriveSessionHUD';
import { POIDetailSheet } from '@/src/components/POIDetailSheet';
import { PhotoSpotDetailSheet } from '@/src/components/PhotoSpotDetailSheet';
import { PhotoMode } from '@/src/components/PhotoMode';
import { QuickPOICreator } from '@/src/components/QuickPOICreator';
import { PostDriveSummary } from '@/src/components/PostDriveSummary';
import { XPNotification } from '@/src/components/XPNotification';
import { LevelUpAnimation } from '@/src/components/LevelUpAnimation';
import { DailyRewardModal } from '@/src/components/DailyRewardModal';
import { WeatherWidget } from '@/src/components/WeatherWidget';
import { MapSettingsMenu } from '@/src/components/MapSettingsMenu';
import { PTTButton } from '@/src/components/PTTButton';
import { Colors } from '@/src/theme/colors';
import { useLocation } from '@/src/hooks/useLocation';
import { useSprintTimer, SprintResultData } from '@/src/hooks/useSprintTimer';
import { useDeepLink } from '@/src/hooks/useDeepLink';
import { useVehicle } from '@/src/context/VehicleContext';
import { useAudio } from '@/src/context/AudioContext';
import { useAuth } from '@/src/context/AuthContext';
import { usePOI, SpeedTrap, Segment, CarMeet } from '@/src/context/POIContext';
import { useFriends } from '@/src/context/FriendsContext';
import { useConvoy } from '@/src/context/ConvoyContext';
import { useAchievements } from '@/src/context/AchievementsContext';
import { useXP } from '@/src/context/XPContext';
import { useChallenge } from '@/src/context/ChallengeContext';
import { useRivals } from '@/src/context/RivalContext';
import { rivalService } from '@/src/services/RivalService';
import { regionalLeaderboardService } from '@/src/services/RegionalLeaderboardService';
import { referralService } from '@/src/services/ReferralService';
import { tournamentService } from '@/src/services/TournamentService';
import { useDailyChallenges } from '@/src/context/DailyChallengesContext';
import { XPBar } from '@/src/components/XPBar';
import { AudioPriority } from '@/src/services/AudioQueue';
import { segmentDetection } from '@/src/services/SegmentDetection';
import { speedTrapDetection } from '@/src/services/SpeedTrapDetection';
import { xpService } from '@/src/services/XPService';
import { dailyRewardsService } from '@/src/services/DailyRewardsService';
import { supabase } from '@/src/services/supabase';
import { photoSpotsService, PhotoSpot } from '@/src/services/PhotoSpotsService';
import { weatherService } from '@/src/services/WeatherService';
import { haversineDistance } from '@/src/utils/distance';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Zap, Target, Flag, Gauge, Flame, Camera, Map } from 'lucide-react-native';
import { zIndex } from '@/src/theme/zIndex';
import { useTheme } from '@/src/context/ThemeContext';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const { location, permissionGranted } = useLocation();
  const { activeVehicle, isSessionActive, startSession, endSession } = useVehicle();
  const { announce } = useAudio();
  const { updateStats } = useAchievements();
  const { awardXP } = useXP();
  const { updateStats: updateChallengeStats, challenges } = useDailyChallenges();
  const { onSprintComplete: submitSprintChallenge } = useChallenge();
  const { rivals, rivalStats } = useRivals();

  // POI context
  const {
    speedTraps,
    segments,
    carMeets,
    showSpeedTraps,
    showSegments,
    showCarMeets,
    addSpeedTrapRecord,
    addSegmentRecord,
  } = usePOI();

  // Friends context
  const {
    liveLocations,
    updateMyLocation,
    clearMyLocation,
  } = useFriends();

  // Convoy context
  const {
    activeConvoy,
    members: convoyMembers,
    updateMyLocation: updateConvoyLocation,
    whoIsTalking,
    isTransmitting,
    startPTT,
    stopPTT,
  } = useConvoy();

  // User profile state for location sharing preferences
  const [shareLocation, setShareLocation] = useState(true); // Share with friends on map
  const [shareLocationConvoy, setShareLocationConvoy] = useState(true); // Share with convoy members
  const [locationPrefLoading, setLocationPrefLoading] = useState(true);

  // Selected POI state
  const [selectedPOI, setSelectedPOI] = useState<SpeedTrap | Segment | CarMeet | null>(null);
  const [selectedPOIType, setSelectedPOIType] = useState<'speed_trap' | 'segment' | 'car_meet' | null>(null);

  // Photo spots state
  const [photoSpots, setPhotoSpots] = useState<PhotoSpot[]>([]);
  const [selectedPhotoSpot, setSelectedPhotoSpot] = useState<PhotoSpot | null>(null);
  const [showPhotoSpots, setShowPhotoSpots] = useState(true);

  // Photo mode state
  const [showPhotoMode, setShowPhotoMode] = useState(false);

  // Map settings menu state
  const [showMapSettings, setShowMapSettings] = useState(false);

  // Drive session pause state
  const [isDrivePaused, setIsDrivePaused] = useState(false);
  
  // Segment state
  const [deltaTime, setDeltaTime] = useState<number | null>(null);
  const [activeSegmentName, setActiveSegmentName] = useState<string | null>(null);

  // Quick POI creation state
  const [segmentCreationState, setSegmentCreationState] = useState<{
    isCreating: boolean;
    startPoint: { latitude: number; longitude: number } | null;
    checkpoints: Array<{ latitude: number; longitude: number; order: number }>;
    endPoint: { latitude: number; longitude: number } | null;
  } | null>(null);

  // POI creation handlers (exposed from QuickPOICreator)
  const [poiHandlers, setPOIHandlers] = useState<{
    createSpeedTrap: () => void;
    createSegment: () => void;
  } | null>(null);

  // Sprint state
  const [selectedSprintMode, setSelectedSprintMode] = useState<SprintMode | null>(null);

  // ──────────────────────────────────────────────────
  // Session tracking for Post-Drive Summary
  // ──────────────────────────────────────────────────
  const [sessionXPGains, setSessionXPGains] = useState<Array<{ source: string; amount: number; icon: React.ReactNode }>>([]);
  const [sessionAchievements, setSessionAchievements] = useState<string[]>([]);
  const [sessionStartStats, setSessionStartStats] = useState<{ level: number; xp: number; totalXP: number } | null>(null);
  const [showPostDriveSummary, setShowPostDriveSummary] = useState(false);
  const [postDriveSummaryData, setPostDriveSummaryData] = useState<any>(null);
  const sessionTopSpeedRef = useRef(0);
  const sessionDurationRef = useRef(0);
  const locationRef = useRef(location);

  // Daily Reward Modal state
  const [showDailyRewardModal, setShowDailyRewardModal] = useState(false);
  const [dailyRewardData, setDailyRewardData] = useState<{
    xpAwarded: number;
    consecutiveDays: number;
    isMilestone: boolean;
    milestoneReward?: { type: 'badge' | 'frame' | 'title'; name: string };
    nextMilestone: number | null;
  } | null>(null);

  // XP Notification state
  const [showXPNotification, setShowXPNotification] = useState(false);
  const [xpNotificationAmount, setXPNotificationAmount] = useState(0);

  // Level-up animation state
  const [showLevelUpAnimation, setShowLevelUpAnimation] = useState(false);
  const [levelUpData, setLevelUpData] = useState<{ newLevel: number; rewards: string[] } | null>(null);

  // ──────────────────────────────────────────────────
  // Route + speed data collection + LIVE DISTANCE
  // ──────────────────────────────────────────────────
  const routeDataRef = useRef<{ lat: number; lon: number; timestamp: number }[]>([]);
  const speedDataRef = useRef<{ speed: number; timestamp: number }[]>([]);
  const lastRecordedRef = useRef<number>(0);
  const [liveDistance, setLiveDistance] = useState(0); // meters
  const liveDistanceRef = useRef(0);

  // Keep locationRef in sync for use in async callbacks
  useEffect(() => { locationRef.current = location; }, [location]);

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
      const segmentDist = haversineDistance(prev.lat, prev.lon, currentLat, currentLon);
      
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

    // Publish live location to friends (only if sharing is enabled and preference is loaded)
    if (shareLocation && !locationPrefLoading) {
      updateMyLocation(
        currentLat,
        currentLon,
        location.speed,
        location.heading || 0,
        true // is_driving
      );
    }

    // Update convoy location if in an active convoy AND sharing is enabled
    if (activeConvoy && shareLocationConvoy && !locationPrefLoading) {
      updateConvoyLocation(
        currentLat,
        currentLon,
        location.speed,
        location.heading || 0
      );
    }
  }, [location, isSessionActive, isDrivePaused, permissionGranted, updateMyLocation, shareLocation, shareLocationConvoy, locationPrefLoading, activeConvoy, updateConvoyLocation]);

  // Clear route/speed/distance data when session starts/ends
  useEffect(() => {
    if (isSessionActive) {
      routeDataRef.current = [];
      speedDataRef.current = [];
      lastRecordedRef.current = 0;
      liveDistanceRef.current = 0;
      setLiveDistance(0);
      sessionTopSpeedRef.current = 0;
      sessionDurationRef.current = 0;

      // Update regional location (fire-and-forget, rate-limited in service)
      if (user && location.latitude && location.longitude) {
        regionalLeaderboardService
          .updateUserLocation(user.id, location.latitude, location.longitude)
          .catch(() => {});
      }

      // Track session start stats for post-drive summary
      if (profile) {
        setSessionStartStats({
          level: profile.level || 1,
          xp: profile.xp || 0,
          totalXP: profile.total_xp || 0,
        });
      }

      // Reset session tracking
      setSessionXPGains([]);
      setSessionAchievements([]);
    } else {
      // Session ended - clear live location immediately
      clearMyLocation();
    }
  }, [isSessionActive, clearMyLocation, profile]);

  // Fetch user's location sharing preference and subscribe to changes
  useEffect(() => {
    if (!user) {
      setLocationPrefLoading(false);
      return;
    }

    const fetchLocationPreference = async () => {
      setLocationPrefLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('share_location, share_location_convoy')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          const sharePref = data.share_location ?? true;
          const shareConvoyPref = data.share_location_convoy ?? true;
          setShareLocation(sharePref);
          setShareLocationConvoy(shareConvoyPref);
        }
      } catch (error) {
        console.error('Failed to fetch location preference:', error);
        Alert.alert('Error', 'Failed to load location sharing preference');
      } finally {
        setLocationPrefLoading(false);
      }
    };

    fetchLocationPreference();

    // Subscribe to realtime updates for this user's profile
    const channel = supabase
      .channel('profile-location-sharing')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const newShareLocation = payload.new.share_location ?? true;
          const newShareLocationConvoy = payload.new.share_location_convoy ?? true;
          setShareLocation(newShareLocation);
          setShareLocationConvoy(newShareLocationConvoy);

          // Note: clearMyLocation() is already called from profile.tsx toggle
          // This just prevents future location updates from being published
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, clearMyLocation]);

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

    // Store stats for post-drive summary
    sessionTopSpeedRef.current = stats.topSpeed;
    sessionDurationRef.current = stats.duration;

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

      // Snapshot weather conditions (uses 10-min in-memory cache — no extra API call if widget is visible)
      let weatherCondition: string | undefined;
      let weatherTemp: number | undefined;
      const loc = locationRef.current;
      if (loc?.latitude && loc?.longitude) {
        const wx = await weatherService.getCurrentWeather(loc.latitude, loc.longitude).catch(() => null);
        if (wx) {
          weatherCondition = wx.condition;
          weatherTemp = wx.temperature;
        }
      }

      driveHistory.push({
        duration: stats.duration,
        top_speed: stats.topSpeed,
        distance: finalDistance,
        start_time: stats.startTime,
        end_time: stats.endTime,
        vehicle_name: activeVehicle.name,
        route: routeDataRef.current,
        speed_data: speedDataRef.current,
        weather_condition: weatherCondition,
        weather_temp: weatherTemp,
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

      // Update achievement stats
      updateStats({
        totalDrives: 1,
        totalDistance: finalDistance,
        totalDuration: stats.duration,
        topSpeed: stats.topSpeed,
      });

      // Update daily challenge stats
      updateChallengeStats({
        drivesCompleted: 1,
        distanceDriven: finalDistance,
        topSpeed: stats.topSpeed,
      });
    } catch (error) {
      console.error('❌ Failed to save drive stats:', error);
      Alert.alert('Error', 'Failed to save drive');
    }
  }, [activeVehicle, updateStats, updateChallengeStats]);

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
    } catch (error) {
      console.error('❌ Failed to save sprint result:', error);
      Alert.alert('Error', 'Failed to save sprint result');
    }
  }, [activeVehicle, announce]);

  // Sprint completion handler
  const handleSprintComplete = useCallback((result: SprintResultData) => {
    saveSprintResult(result);
    // Auto-submit to any active 1v1 sprint challenges
    submitSprintChallenge(result.mode, result.time).catch(() => {});
    // Submit to active sprint tournaments (only 0-100 and 100-200 have tournament types)
    if (user) {
      const sprintTournamentType =
        result.mode.id === '0-100' ? 'sprint_0_100' :
        result.mode.id === '100-200' ? 'sprint_100_200' :
        null;
      if (sprintTournamentType) {
        tournamentService.submitResult(user.id, sprintTournamentType, result.time).catch(() => {});
      }
      // Notify rivals whose record was beaten
      const sprintKey = result.mode.id === '0-100' ? 'my_sprint_0_100' : 'my_sprint_100_200';
      const rivalSprintKey = result.mode.id === '0-100' ? 'rival_sprint_0_100' : 'rival_sprint_100_200';
      const myName = profile?.display_name || profile?.username || 'A rival';
      const category = result.mode.id === '0-100' ? '0–100 km/h' : '100–200 km/h';
      rivals.forEach(rival => {
        const stats = rivalStats.get(rival.rival_id);
        const rivalBest = stats ? (stats as any)[rivalSprintKey] : null;
        if (rivalBest !== null && rivalBest !== undefined && result.time < rivalBest) {
          rivalService.notifyRivalBeaten(rival.rival_id, user.id, myName, category).catch(() => {});
        }
      });
    }
  }, [saveSprintResult, submitSprintChallenge, user, rivals, rivalStats, profile]);

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
    stopSprint();
    setSelectedSprintMode(null);
  }, [stopSprint]);

  // Handle sprint mode change
  const handleSprintModeChange = useCallback((mode: SprintMode | null) => {
    setSelectedSprintMode(mode);
    resetSprint();
    if (mode) {
      announce(`Sprint mode: ${mode.label}`, AudioPriority.SYSTEM);
    }
  }, [resetSprint, announce]);

  // End sprint when drive ends from pause menu - show summary first
  const handleEndSession = useCallback(async () => {
    if (!profile || !sessionStartStats || !user) {
      // Fallback: end session immediately if no tracking data
      stopSprint();
      setSelectedSprintMode(null);
      speedTrapDetection.resetSession();
      segmentDetection.resetSession();
      clearMyLocation();
      if (activeVehicle) {
        await awardXP({ type: 'drive_complete', amount: 0 }, activeVehicle.id);
      }
      endSession();
      return;
    }

    // Award drive completion XP first
    const driveXP = xpService.getXPForActivity({ type: 'drive_complete', amount: 0 });
    if (activeVehicle) {
      await awardXP({ type: 'drive_complete', amount: 0 }, activeVehicle.id);
    }

    // Track this XP gain
    const updatedGains = [
      ...sessionXPGains,
      {
        source: 'Drive Complete',
        amount: driveXP,
        icon: <Flag size={16} color={Colors.primary} />,
      },
    ];

    // Check for daily drive reward
    try {
      const distanceKm = liveDistanceRef.current / 1000; // Convert meters to km
      const durationSeconds = sessionDurationRef.current;

      const dailyReward = await dailyRewardsService.awardDailyReward(user.id, {
        distance_km: distanceKm,
        duration_seconds: durationSeconds,
      });

      if (dailyReward) {
        // Add daily reward to XP gains
        updatedGains.push({
          source: `Daily Drive Bonus (${dailyReward.consecutiveDays} day streak)`,
          amount: dailyReward.xpAwarded,
          icon: <Flame size={16} color="#FF6B35" />,
        });

        // Award XP to profile
        if (activeVehicle) {
          await awardXP({ type: 'custom', amount: dailyReward.xpAwarded }, activeVehicle.id);
        }

        // Store reward data for modal
        const status = await dailyRewardsService.checkDailyRewardStatus(user.id);
        setDailyRewardData({
          xpAwarded: dailyReward.xpAwarded,
          consecutiveDays: dailyReward.consecutiveDays,
          isMilestone: dailyReward.isMilestone,
          milestoneReward: dailyReward.milestoneReward,
          nextMilestone: status.nextMilestone,
        });
      }
    } catch (error) {
      console.error('Error checking daily reward:', error);
      // Continue with drive summary even if daily reward fails
    }

    // Calculate total XP gained
    const totalXPGained = updatedGains.reduce((sum, gain) => sum + gain.amount, 0);

    // Submit top-speed and distance to active tournaments (fire-and-forget)
    if (user) {
      const distKm = liveDistanceRef.current / 1000;
      const topSpeedKmh = sessionTopSpeedRef.current;
      if (topSpeedKmh > 0) {
        tournamentService.submitResult(user.id, 'top_speed', topSpeedKmh).catch(() => {});
      }
      if (distKm > 0) {
        tournamentService.submitResult(user.id, 'most_distance', distKm).catch(() => {});
      }
    }

    // Complete pending referral if this user was referred (fire-and-forget)
    if (user) {
      referralService.checkAndCompleteReferral(user.id).catch(() => {});
    }

    // Get updated profile data
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for XP to be awarded
    const levelAfter = profile.level || 1;
    const totalXPAfter = (sessionStartStats.totalXP || 0) + totalXPGained;

    // Check if leveled up
    const leveledUp = levelAfter > sessionStartStats.level;

    // Get current challenges for progress display
    const challengeProgress = challenges.map(c => ({
      name: c.title,
      progress: c.progress,
      requirement: c.requirement,
    }));
    const challengesCompleted = challenges.filter(c => c.completed).length;

    // Prepare summary data
    setPostDriveSummaryData({
      distance: liveDistanceRef.current,
      duration: sessionDurationRef.current,
      topSpeed: sessionTopSpeedRef.current,
      xpBreakdown: updatedGains,
      totalXPGained,
      levelBefore: sessionStartStats.level,
      levelAfter,
      xpBefore: sessionStartStats.totalXP,
      xpAfter: totalXPAfter,
      achievementsUnlocked: sessionAchievements,
      challengesCompleted,
      challengeProgress,
    });

    // Show level-up animation if leveled up
    if (leveledUp) {
      const rewards = xpService.getUserRewardsAtLevel(levelAfter);
      setLevelUpData({
        newLevel: levelAfter,
        rewards: rewards.map(r => r.reward),
      });
      setShowLevelUpAnimation(true);
    } else {
      // No level-up, show summary directly
      setShowPostDriveSummary(true);
    }
  }, [
    profile,
    sessionStartStats,
    sessionXPGains,
    sessionAchievements,
    activeVehicle,
    awardXP,
    stopSprint,
    clearMyLocation,
    challenges,
  ]);

  // Actually end session when summary modal closes
  const handleCloseSummary = useCallback(() => {
    setShowPostDriveSummary(false);

    // Show daily reward modal if reward was earned
    if (dailyRewardData) {
      setShowDailyRewardModal(true);
    } else {
      // No daily reward, end session immediately
      stopSprint();
      setSelectedSprintMode(null);
      speedTrapDetection.resetSession();
      segmentDetection.resetSession();
      clearMyLocation();
      endSession();
    }
  }, [stopSprint, endSession, clearMyLocation, dailyRewardData]);

  // Handle daily reward modal close
  const handleCloseDailyReward = useCallback(() => {
    setShowDailyRewardModal(false);
    setDailyRewardData(null);

    // Now actually end the session
    stopSprint();
    setSelectedSprintMode(null);
    speedTrapDetection.resetSession();
    segmentDetection.resetSession();
    clearMyLocation();
    endSession();
  }, [stopSprint, endSession, clearMyLocation]);

  // Show XP notification
  const showXPGainNotification = useCallback((amount: number) => {
    setXPNotificationAmount(amount);
    setShowXPNotification(true);
  }, []);

  const hideXPNotification = useCallback(() => {
    setShowXPNotification(false);
  }, []);

  // Handle level-up animation completion
  const handleLevelUpComplete = useCallback(() => {
    setShowLevelUpAnimation(false);
    setLevelUpData(null);
    // Show post-drive summary after level-up animation
    setShowPostDriveSummary(true);
  }, []);

  // Segment detection
  useEffect(() => {
    if (!isSessionActive || !permissionGranted) return;

    // Convert POI segments to SegmentDetection format
    const detectionSegments = segments.map(seg => ({
      id: seg.id,
      name: seg.name,
      startGate: {
        latitude: seg.start_lat,
        longitude: seg.start_lon,
        radius_meters: 50,
      },
      endGate: {
        latitude: seg.end_lat,
        longitude: seg.end_lon,
        radius_meters: 50,
      },
      distance_meters: seg.distance_meters,
      leaderboard: seg.leaderboard.map(entry => ({
        user_id: entry.user_id,
        user_name: entry.username,
        time_seconds: entry.value,
        avg_speed_kmh: 0,
        top_speed_kmh: 0,
        date: entry.date,
        rank: entry.rank,
      })),
      ghost: seg.ghost ? {
        user_name: seg.ghost.user_name,
        time_seconds: seg.ghost.time_seconds,
        waypoints: seg.ghost.waypoints,
      } : undefined,
      checkpoints: (seg as any).checkpoints || [], // Include checkpoints from POI data
    }));

    segmentDetection.updateNearbySegments(
      { latitude: location.latitude, longitude: location.longitude },
      detectionSegments
    );

    const result = segmentDetection.checkSegmentTrigger(
      { latitude: location.latitude, longitude: location.longitude },
      location.speed,
      Date.now()
    );

    if (result.event === 'entered' && result.segment) {
      setActiveSegmentName(result.segment.name);
      const checkpointCount = result.segment.checkpoints?.length || 0;
      announce(
        `Entering segment: ${result.segment.name}${checkpointCount > 0 ? `. ${checkpointCount} checkpoint${checkpointCount !== 1 ? 's' : ''} required` : ''}`,
        AudioPriority.SEGMENT_APPROACH
      );
    } else if ((result as any).event === 'checkpoint_passed') {
      const cpResult = result as any;
      announce(
        `Checkpoint ${cpResult.checkpointNumber} of ${cpResult.totalCheckpoints}`,
        AudioPriority.SYSTEM
      );
    } else if ((result as any).event === 'invalid') {
      setActiveSegmentName(null);
      setDeltaTime(null);
      announce(
        `Segment invalid. You missed checkpoints!`,
        AudioPriority.SYSTEM
      );
    } else if (result.event === 'completed' && result.segment && result.time) {
      const isNewPB = result.deltaTime && result.deltaTime < 0;

      // Get waypoints from the completed run
      const waypoints = segmentDetection.getActiveRunWaypoints();

      // Save to database with waypoints
      addSegmentRecord(
        result.segment.id,
        result.time,
        activeVehicle?.name,
        waypoints
      );

      // Update achievement stats
      updateStats({ segmentsCompleted: 1 });

      // Update daily challenge stats
      updateChallengeStats({ segmentsCompleted: 1 });

      // Award XP for segment completion
      if (activeVehicle) {
        const segmentXP = xpService.getXPForActivity({ type: 'segment_complete', amount: 0 });
        awardXP({ type: 'segment_complete', amount: 0 }, activeVehicle.id);

        // Show XP notification
        showXPGainNotification(segmentXP);

        // Track XP gain for post-drive summary
        setSessionXPGains(prev => [
          ...prev,
          {
            source: `Segment: ${result.segment?.name || 'Unknown'}`,
            amount: segmentXP,
            icon: <Target size={16} color={Colors.primary} />,
          },
        ]);
      }

      announce(
        `${isNewPB ? 'New personal best!' : 'Segment complete.'} ${result.time.toFixed(1)} seconds${result.deltaTime ? `. ${result.deltaTime > 0 ? '+' : ''}${result.deltaTime.toFixed(1)} vs ghost.` : ''}`,
        AudioPriority.SEGMENT_RESULT
      );

      setActiveSegmentName(null);
      setDeltaTime(null);
    }

    if (result.event === null) {
      const delta = segmentDetection.getGhostDelta(Date.now());
      if (delta !== null) {
        setDeltaTime(delta);
      }
    }
  }, [location, isSessionActive, permissionGranted, segments, activeVehicle, announce, addSegmentRecord, awardXP, updateStats, updateChallengeStats]);

  // Speed trap detection
  useEffect(() => {
    if (!isSessionActive || !location || !permissionGranted) return;

    speedTrapDetection.updateNearbyTraps(
      { latitude: location.latitude, longitude: location.longitude },
      speedTraps
    );

    const trigger = speedTrapDetection.checkTrapTrigger(
      { latitude: location.latitude, longitude: location.longitude },
      location.speed,
      speedTraps
    );

    if (trigger) {
      if (trigger.shouldAnnounce) {
        announce(
          `Speed trap ahead: ${trigger.trap.name}`,
          AudioPriority.SEGMENT_APPROACH
        );
      }

      if (trigger.shouldRecord) {
        // Save to database
        addSpeedTrapRecord(
          trigger.trap.id,
          location.speed,
          activeVehicle?.name
        );

        // Update achievement stats
        updateStats({
          speedTrapsRecorded: 1,
          topSpeed: location.speed,
        });

        // Update daily challenge stats
        updateChallengeStats({ speedTrapsRecorded: 1 });

        // Award XP for speed trap record
        if (activeVehicle) {
          const trapXP = xpService.getXPForActivity({ type: 'speed_trap_record', amount: 0 });
          awardXP({ type: 'speed_trap_record', amount: 0 }, activeVehicle.id);

          // Show XP notification
          showXPGainNotification(trapXP);

          // Track XP gain for post-drive summary
          setSessionXPGains(prev => [
            ...prev,
            {
              source: `Speed Trap: ${trigger.trap.name}`,
              amount: trapXP,
              icon: <Gauge size={16} color={Colors.primary} />,
            },
          ]);
        }

        announce(
          `Speed recorded: ${Math.round(location.speed)} kilometers per hour at ${trigger.trap.name}`,
          AudioPriority.SEGMENT_RESULT
        );
      }
    }
  }, [location, isSessionActive, permissionGranted, speedTraps, activeVehicle, announce, addSpeedTrapRecord, awardXP, updateStats, updateChallengeStats]);

  // Fetch nearby photo spots
  useEffect(() => {
    if (!permissionGranted || !user) return;

    const fetchNearbyPhotoSpots = async () => {
      try {
        const { data, error } = await photoSpotsService.getNearbySpots(
          location.latitude,
          location.longitude,
          50, // 50km radius
          user.id
        );

        if (error) {
          console.error('Failed to fetch photo spots:', error);
          return;
        }

        setPhotoSpots(data);
      } catch (error) {
        console.error('Error fetching photo spots:', error);
      }
    };

    // Fetch immediately
    fetchNearbyPhotoSpots();

    // Refresh every 30 seconds when location changes significantly
    const interval = setInterval(fetchNearbyPhotoSpots, 30000);

    return () => clearInterval(interval);
  }, [location.latitude, location.longitude, permissionGranted, user]);

  // Photo spot press handler
  const handlePhotoSpotPress = useCallback((spot: PhotoSpot) => {
    setSelectedPhotoSpot(spot);
  }, []);

  const handleClosePhotoSpot = useCallback(() => {
    setSelectedPhotoSpot(null);
  }, []);

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
        isSessionActive={isSessionActive}
        speedTraps={speedTraps}
        segments={segments}
        carMeets={carMeets}
        photoSpots={photoSpots}
        friendsLiveLocations={liveLocations.filter(loc => loc.profiles !== undefined) as any}
        convoyMembersLocations={
          activeConvoy
            ? convoyMembers
                .filter(m => m.user_id !== user?.id && m.location) // Exclude self, only with location
                .map(m => ({
                  user_id: m.user_id,
                  latitude: m.location!.latitude,
                  longitude: m.location!.longitude,
                  speed: m.location!.speed,
                  heading: m.location!.heading,
                  profile: m.profile,
                }))
            : []
        }
        showSpeedTraps={showSpeedTraps}
        showSegments={showSegments}
        showCarMeets={showCarMeets}
        showPhotoSpots={showPhotoSpots}
        onSpeedTrapPress={handleSpeedTrapPress}
        onSegmentPress={handleSegmentPress}
        onCarMeetPress={handleCarMeetPress}
        onPhotoSpotPress={handlePhotoSpotPress}
        segmentCreationState={segmentCreationState}
      />

      {/* Compact XP Bar (top left) - Hidden when sprint timer is active */}
      {profile && !selectedSprintMode && sprintState === 'IDLE' && (
        <View style={[styles.xpBarContainer, { top: insets.top + 10, backgroundColor: theme.surface + 'CC' }]}>
          <XPBar
            level={profile.level || 1}
            totalXP={profile.total_xp || 0}
            compact
          />
        </View>
      )}

      {/* Map Settings Button (top right) */}
      <TouchableOpacity
        style={[
          styles.mapSettingsButton,
          {
            top: insets.top + 10,
            backgroundColor: theme.surfaceGlass,
            borderColor: theme.borderLight,
          },
        ]}
        onPress={() => setShowMapSettings(true)}
        activeOpacity={0.8}
      >
        <Map size={20} color={theme.textPrimary} />
      </TouchableOpacity>

      {/* Compact Weather Widget (below Map Settings button) */}
      {location.latitude !== 0 && (
        <View style={[styles.weatherContainer, { top: insets.top + 64 }]}>
          <WeatherWidget
            latitude={location.latitude}
            longitude={location.longitude}
            compact
          />
        </View>
      )}

      {/* Map Settings Menu */}
      <MapSettingsMenu
        visible={showMapSettings}
        onClose={() => setShowMapSettings(false)}
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
          onCreateSpeedTrap={poiHandlers?.createSpeedTrap}
          onCreateSegment={poiHandlers?.createSegment}
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

      {/* Photo Spot Detail Sheet */}
      <PhotoSpotDetailSheet
        spot={selectedPhotoSpot}
        visible={selectedPhotoSpot !== null}
        onClose={handleClosePhotoSpot}
      />

      {/* Photo Mode */}
      <PhotoMode
        visible={showPhotoMode}
        onClose={() => setShowPhotoMode(false)}
        speed={location.speed}
        location={{ latitude: location.latitude, longitude: location.longitude }}
        vehicleName={activeVehicle?.name}
      />

      {/* Photo Mode Button - Floating action button during active drives */}
      {isSessionActive && !isDrivePaused && !selectedSprintMode && (
        <TouchableOpacity
          style={[styles.photoModeButton, { bottom: insets.bottom + 180, backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => setShowPhotoMode(true)}
          activeOpacity={0.8}
        >
          <Camera size={24} color={theme.primary} />
        </TouchableOpacity>
      )}

      {/* Quick POI Creator - Simple buttons for creating POIs during drives */}
      <QuickPOICreator
        currentLocation={location ? { latitude: location.latitude, longitude: location.longitude } : null}
        isSessionActive={isSessionActive && !isDrivePaused && !selectedSprintMode}
        onSegmentStateChange={setSegmentCreationState}
        hideButtons={true}
        onExposeHandlers={setPOIHandlers}
      />

      {/* Post-Drive Summary Modal */}
      {postDriveSummaryData && (
        <PostDriveSummary
          visible={showPostDriveSummary}
          onClose={handleCloseSummary}
          {...postDriveSummaryData}
        />
      )}

      {/* XP Gain Notification */}
      <XPNotification
        xpAmount={xpNotificationAmount}
        visible={showXPNotification}
        onHide={hideXPNotification}
      />

      {/* Level-Up Animation */}
      {levelUpData && (
        <LevelUpAnimation
          visible={showLevelUpAnimation}
          newLevel={levelUpData.newLevel}
          rewards={levelUpData.rewards}
          onComplete={handleLevelUpComplete}
        />
      )}

      {/* Daily Reward Modal */}
      {dailyRewardData && (
        <DailyRewardModal
          visible={showDailyRewardModal}
          onClose={handleCloseDailyReward}
          xpAwarded={dailyRewardData.xpAwarded}
          consecutiveDays={dailyRewardData.consecutiveDays}
          isMilestone={dailyRewardData.isMilestone}
          milestoneReward={dailyRewardData.milestoneReward}
          nextMilestone={dailyRewardData.nextMilestone}
        />
      )}

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

      {/* Floating PTT button — visible when in an active convoy */}
      {activeConvoy && (
        <View style={[styles.pttFloating, { bottom: insets.bottom + 180 }]}>
          <PTTButton
            onPressIn={startPTT}
            onPressOut={stopPTT}
            isTransmitting={isTransmitting}
            whoIsTalking={whoIsTalking}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  pttFloating: {
    position: 'absolute',
    right: 20,
    zIndex: 50,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 60,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  permissionMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  xpBarContainer: {
    position: 'absolute',
    // top is set dynamically with safe area insets
    left: 16,
    right: 80, // Make room for weather widget
    zIndex: zIndex.XP_BAR,
    backgroundColor: '#000000' + 'CC',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  photoModeButton: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: zIndex.FLOATING_BUTTONS,
  },
  weatherContainer: {
    position: 'absolute',
    right: 16,
    zIndex: zIndex.WEATHER_WIDGET,
  },
  mapSettingsButton: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: zIndex.FLOATING_BUTTONS,
  },
});
