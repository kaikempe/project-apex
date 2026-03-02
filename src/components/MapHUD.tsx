import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, Camera } from 'react-native-maps';
import { Crosshair, Target, Flag, Trophy, Users } from 'lucide-react-native';
import { SpeedTrap, Segment, CarMeet } from '../context/POIContext';
import { useMapTheme } from '../context/MapThemeContext';
import { useTheme } from '../context/ThemeContext';
import { PhotoSpot } from '../services/PhotoSpotsService';
import { PhotoSpotMarker } from './PhotoSpotMarker';

interface FriendLocation {
  user_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  is_driving: boolean;
  updated_at: string;
  profiles: {
    id: string;
    username?: string;
    display_name?: string;
    avatar_url?: string;
  };
}

interface SegmentCreationState {
  isCreating: boolean;
  startPoint: { latitude: number; longitude: number } | null;
  checkpoints: Array<{ latitude: number; longitude: number; order: number }>;
  endPoint: { latitude: number; longitude: number } | null;
}

interface ConvoyMemberLocation {
  user_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  profile?: {
    username?: string;
    display_name?: string;
  };
}

interface MapHUDProps {
  userLatitude: number;
  userLongitude: number;
  userHeading: number;
  userSpeed: number;
  isSessionActive?: boolean;
  friendsLiveLocations?: FriendLocation[];
  convoyMembersLocations?: ConvoyMemberLocation[];
  // POI props
  speedTraps?: SpeedTrap[];
  segments?: Segment[];
  carMeets?: CarMeet[];
  photoSpots?: PhotoSpot[];
  showSpeedTraps?: boolean;
  showSegments?: boolean;
  showCarMeets?: boolean;
  showPhotoSpots?: boolean;
  onSpeedTrapPress?: (trap: SpeedTrap) => void;
  onSegmentPress?: (segment: Segment) => void;
  onCarMeetPress?: (meet: CarMeet) => void;
  onPhotoSpotPress?: (spot: PhotoSpot) => void;
  segmentCreationState?: SegmentCreationState | null;
}

type SpeedBracket = 'stationary' | 'city' | 'suburban' | 'highway' | 'racing';

const getSpeedBracket = (speed: number): SpeedBracket => {
  if (speed < 15) return 'stationary';
  if (speed < 45) return 'city';
  if (speed < 75) return 'suburban';
  if (speed < 110) return 'highway';
  return 'racing';
};

const getAltitudeForBracket = (bracket: SpeedBracket): number => {
  switch (bracket) {
    case 'stationary': return 500;
    case 'city':       return 1000;
    case 'suburban':   return 2000;
    case 'highway':    return 4000;
    case 'racing':     return 8000;
  }
};

const getZoomForBracket = (bracket: SpeedBracket): number => {
  switch (bracket) {
    case 'stationary': return 17;
    case 'city':       return 16;
    case 'suburban':   return 15;
    case 'highway':    return 14;
    case 'racing':     return 13;
  }
};

// Calculate distance between two coordinates in meters
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Decode Google Maps polyline format
const decodePolyline = (encoded: string): { latitude: number; longitude: number }[] => {
  const poly = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    poly.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return poly;
};

const HEADING_MIN_SPEED = 8;
const DRAG_STOP_DELAY = 500;
const RETURN_TO_NAV_DELAY = 10000;

export const MapHUD: React.FC<MapHUDProps> = ({
  userLatitude,
  userLongitude,
  userHeading,
  userSpeed,
  isSessionActive = false,
  friendsLiveLocations = [],
  convoyMembersLocations = [],
  speedTraps = [],
  segments = [],
  carMeets = [],
  photoSpots = [],
  showSpeedTraps = true,
  showSegments = true,
  showCarMeets = true,
  showPhotoSpots = true,
  onSpeedTrapPress,
  onSegmentPress,
  onCarMeetPress,
  onPhotoSpotPress,
  segmentCreationState = null,
}) => {
  const mapRef = useRef<MapView>(null);
  const { mapStyle, mapType, settings } = useMapTheme();
  const { isDark, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [currentBracket, setCurrentBracket] = useState<SpeedBracket>('stationary');
  const [timerActive, setTimerActive] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [creationSegmentRoute, setCreationSegmentRoute] = useState<{ latitude: number; longitude: number }[]>([]);
  const compassMode = isSessionActive; // heading-mode during drives, north-up otherwise

  const returnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialCenteredRef = useRef(false);
  const lastHeadingRef = useRef(0);
  const lastAltitudeRef = useRef(500);
  
  const latestGPSRef = useRef({
    latitude: 0,
    longitude: 0,
    heading: 0,
    speed: 0,
  });

  useEffect(() => {
    latestGPSRef.current = {
      latitude: userLatitude,
      longitude: userLongitude,
      heading: userHeading,
      speed: userSpeed,
    };
  }, [userLatitude, userLongitude, userHeading, userSpeed]);


  // Calculate route for segment creation
  useEffect(() => {
    if (!segmentCreationState?.isCreating || !segmentCreationState.startPoint) {
      setCreationSegmentRoute([]);
      return;
    }

    const { startPoint, endPoint, checkpoints } = segmentCreationState;

    // If we only have start point, just show that
    if (!endPoint) {
      setCreationSegmentRoute([startPoint]);
      return;
    }

    // Calculate route using Google Directions API
    const calculateRoute = async () => {
      try {
        // Build waypoints string from checkpoints
        const waypointsParam = checkpoints.length > 0
          ? `&waypoints=${checkpoints.map(cp => `${cp.latitude},${cp.longitude}`).join('|')}`
          : '';

        // Note: You'll need to add your Google Maps API key to environment variables
        const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

        if (!apiKey) {
          console.warn('Google Maps API key not configured, using straight line');
          // Fallback to straight line
          setCreationSegmentRoute([
            startPoint,
            ...checkpoints.map(cp => ({ latitude: cp.latitude, longitude: cp.longitude })),
            endPoint,
          ]);
          return;
        }

        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${startPoint.latitude},${startPoint.longitude}&destination=${endPoint.latitude},${endPoint.longitude}${waypointsParam}&key=${apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.routes.length > 0) {
          const route = data.routes[0];
          const polyline = route.overview_polyline.points;
          const decodedRoute = decodePolyline(polyline);
          setCreationSegmentRoute(decodedRoute);
        } else {
          console.warn('Directions API failed, using straight line:', data.status);
          // Fallback to straight line
          setCreationSegmentRoute([
            startPoint,
            ...checkpoints.map(cp => ({ latitude: cp.latitude, longitude: cp.longitude })),
            endPoint,
          ]);
        }
      } catch (error) {
        console.error('Error calculating route:', error);
        // Fallback to straight line
        setCreationSegmentRoute([
          startPoint,
          ...checkpoints.map(cp => ({ latitude: cp.latitude, longitude: cp.longitude })),
          endPoint,
        ]);
      }
    };

    calculateRoute();
  }, [segmentCreationState]);

  const clearReturnTimer = useCallback(() => {
    if (returnTimerRef.current) {
      clearTimeout(returnTimerRef.current);
      returnTimerRef.current = null;
      setTimerActive(false);
    }
  }, []);

  const clearDragStopTimer = useCallback(() => {
    if (dragStopTimerRef.current) {
      clearTimeout(dragStopTimerRef.current);
      dragStopTimerRef.current = null;
    }
  }, []);

  const clearNavigationInterval = useCallback(() => {
    if (navigationIntervalRef.current) {
      clearInterval(navigationIntervalRef.current);
      navigationIntervalRef.current = null;
    }
  }, []);

  const setCameraPosition = useCallback((
    latitude: number,
    longitude: number,
    heading: number,
    bracket: SpeedBracket,
    animate: boolean = true
  ) => {
    if (!mapRef.current) return;

    const altitude = getAltitudeForBracket(bracket);
    const zoom = getZoomForBracket(bracket);
    const pitch = settings.is3DEnabled ? 45 : 0;
    const effectiveHeading = compassMode ? heading : 0; // Use heading in compass mode, 0 (north) otherwise

    lastAltitudeRef.current = altitude;

    if (Platform.OS === 'ios') {
      const camera: Camera = {
        center: { latitude, longitude },
        pitch: pitch,
        heading: effectiveHeading,
        altitude: altitude,
      };

      if (animate) {
        mapRef.current.animateCamera(camera, { duration: 1000 });
      } else {
        mapRef.current.setCamera(camera);
      }
    } else {
      const camera: Camera = {
        center: { latitude, longitude },
        pitch: pitch,
        heading: effectiveHeading,
        zoom: zoom,
      };

      if (animate) {
        mapRef.current.animateCamera(camera, { duration: 1000 });
      } else {
        mapRef.current.setCamera(camera);
      }
    }
  }, [settings.is3DEnabled, compassMode]);

  const startReturnTimer = useCallback(() => {
    clearReturnTimer();
    setTimerActive(true);
    
    returnTimerRef.current = setTimeout(() => {
      setIsUserInteracting(false);
      setTimerActive(false);
    }, RETURN_TO_NAV_DELAY);
  }, [clearReturnTimer]);

  const handlePanDrag = useCallback(() => {
    if (!isUserInteracting) {
      setIsUserInteracting(true);
    }
    
    clearReturnTimer();
    clearDragStopTimer();
    
    dragStopTimerRef.current = setTimeout(() => {
      startReturnTimer();
    }, DRAG_STOP_DELAY);
    
  }, [isUserInteracting, clearReturnTimer, clearDragStopTimer, startReturnTimer]);

  const handleCenterPress = useCallback(() => {
    clearReturnTimer();
    clearDragStopTimer();
    setIsUserInteracting(false);

    const { latitude, longitude, heading, speed } = latestGPSRef.current;
    const bracket = getSpeedBracket(speed);
    const useHeading = speed >= HEADING_MIN_SPEED && compassMode;
    const effectiveHeading = useHeading ? heading : (compassMode ? lastHeadingRef.current : 0);

    setCameraPosition(latitude, longitude, effectiveHeading, bracket, true);
  }, [clearReturnTimer, clearDragStopTimer, setCameraPosition, compassMode]);

  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;
    if (userLatitude === 0 || userLongitude === 0) return;
    if (initialCenteredRef.current) return;

    const bracket = getSpeedBracket(userSpeed);
    setCurrentBracket(bracket);
    const initialHeading = compassMode && userSpeed >= HEADING_MIN_SPEED ? userHeading : 0;
    setCameraPosition(userLatitude, userLongitude, initialHeading, bracket, false);
    initialCenteredRef.current = true;
  }, [isMapReady, userLatitude, userLongitude, userSpeed, userHeading, compassMode, setCameraPosition]);

  // When a drive session starts, immediately switch to heading mode and unlock pan
  useEffect(() => {
    if (!isSessionActive || !isMapReady || !mapRef.current) return;
    setIsUserInteracting(false);
    const { latitude, longitude, heading, speed } = latestGPSRef.current;
    if (latitude === 0 || longitude === 0) return;
    const bracket = getSpeedBracket(speed);
    const effectiveHeading = speed >= HEADING_MIN_SPEED ? heading : lastHeadingRef.current;
    setCameraPosition(latitude, longitude, effectiveHeading, bracket, true);
  }, [isSessionActive, isMapReady, setCameraPosition]);

  useEffect(() => {
    clearNavigationInterval();

    if (isUserInteracting || !isMapReady) return;

    const updateCamera = () => {
      const { latitude, longitude, heading, speed } = latestGPSRef.current;

      if (latitude === 0 || longitude === 0 || !mapRef.current) return;

      const newBracket = getSpeedBracket(speed);

      if (newBracket !== currentBracket) {
        setCurrentBracket(newBracket);
      }

      const useHeading = speed >= HEADING_MIN_SPEED && compassMode;
      const effectiveHeading = useHeading ? heading : (compassMode ? lastHeadingRef.current : 0);
      if (useHeading) lastHeadingRef.current = heading;

      setCameraPosition(latitude, longitude, effectiveHeading, newBracket, true);
    };

    updateCamera();
    navigationIntervalRef.current = setInterval(updateCamera, 2000);

    return () => clearNavigationInterval();
  }, [isMapReady, isUserInteracting, currentBracket, compassMode, clearNavigationInterval, setCameraPosition]);

  // Auto-adjust camera pitch when toggling 2D/3D mode or compass mode
  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;

    const { latitude, longitude, heading, speed } = latestGPSRef.current;
    if (latitude === 0 || longitude === 0) return;

    const pitch = settings.is3DEnabled ? 45 : 0;
    const useHeading = speed >= HEADING_MIN_SPEED && compassMode;
    const effectiveHeading = useHeading ? heading : (compassMode ? lastHeadingRef.current : 0);

    // Ensure altitude and zoom are set for current bracket
    const altitude = lastAltitudeRef.current || getAltitudeForBracket(currentBracket);
    const zoom = getZoomForBracket(currentBracket);

    if (Platform.OS === 'ios') {
      const camera: Camera = {
        center: { latitude, longitude },
        pitch: pitch,
        heading: effectiveHeading,
        altitude: altitude,
      };
      mapRef.current.animateCamera(camera, { duration: 600 });
    } else {
      const camera: Camera = {
        center: { latitude, longitude },
        pitch: pitch,
        heading: effectiveHeading,
        zoom: zoom,
      };
      mapRef.current.animateCamera(camera, { duration: 600 });
    }
  }, [settings.is3DEnabled, compassMode, isMapReady, currentBracket]);

  useEffect(() => {
    return () => {
      clearReturnTimer();
      clearDragStopTimer();
      clearNavigationInterval();
    };
  }, [clearReturnTimer, clearDragStopTimer, clearNavigationInterval]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        mapType={mapType}
        customMapStyle={mapType === 'standard' ? mapStyle : undefined}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        initialRegion={{
          latitude: userLatitude || 40.416775,
          longitude: userLongitude || -3.703790,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        onMapReady={() => setIsMapReady(true)}
        onPanDrag={handlePanDrag}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsBuildings={settings.is3DEnabled}
        showsTraffic={false}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
      >
        {/* User marker */}
        {userLatitude !== 0 && userLongitude !== 0 && (
          <Marker
            coordinate={{ latitude: userLatitude, longitude: userLongitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
            rotation={userSpeed >= HEADING_MIN_SPEED ? userHeading : lastHeadingRef.current}
          >
            <View style={styles.userMarker}>
              <View style={styles.userMarkerInner} />
              <View style={styles.directionIndicator} />
            </View>
          </Marker>
        )}

        {/* Speed Trap Markers */}
        {showSpeedTraps && speedTraps.map((trap) => (
          <Marker
            key={`trap-${trap.id}`}
            coordinate={{ latitude: trap.latitude, longitude: trap.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => onSpeedTrapPress?.(trap)}
          >
            <View style={styles.trapMarker}>
              <Target size={16} color={theme.textPrimary} />
            </View>
          </Marker>
        ))}

        {/* Segment Markers & Lines */}
        {showSegments && segments.map((segment) => {
          const isSelected = selectedSegmentId === segment.id;

          // Get route coordinates (ghost > route_polyline > straight line)
          const routeCoords = segment.ghost?.waypoints && segment.ghost.waypoints.length > 0
            ? segment.ghost.waypoints.map(wp => ({ latitude: wp.latitude, longitude: wp.longitude }))
            : segment.route_polyline && Array.isArray(segment.route_polyline) && segment.route_polyline.length > 0
            ? segment.route_polyline
            : [
                { latitude: segment.start_lat, longitude: segment.start_lon },
                ...(segment.checkpoints && Array.isArray(segment.checkpoints) ? segment.checkpoints.map(cp => ({ latitude: cp.latitude, longitude: cp.longitude })) : []),
                { latitude: segment.end_lat, longitude: segment.end_lon },
              ];

          return (
            <React.Fragment key={`segment-${segment.id}`}>
              {/* Always show START marker */}
              <Marker
                coordinate={{ latitude: segment.start_lat, longitude: segment.start_lon }}
                anchor={{ x: 0.5, y: 0.5 }}
                onPress={() => {
                  setSelectedSegmentId(isSelected ? null : segment.id);
                  onSegmentPress?.(segment);
                }}
              >
                <View style={styles.segmentStartMarker}>
                  <Flag size={12} color={theme.textPrimary} />
                </View>
              </Marker>

              {/* Only show END marker, route, and checkpoints when selected */}
              {isSelected && (
                <>
                  <Marker
                    coordinate={{ latitude: segment.end_lat, longitude: segment.end_lon }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    onPress={() => {
                      setSelectedSegmentId(null);
                      onSegmentPress?.(segment);
                    }}
                  >
                    <View style={styles.segmentEndMarker}>
                      <Trophy size={12} color={theme.textPrimary} />
                    </View>
                  </Marker>

                  {/* Checkpoint markers */}
                  {segment.checkpoints && Array.isArray(segment.checkpoints) && segment.checkpoints.map((checkpoint, idx) => (
                    <Marker
                      key={`checkpoint-${segment.id}-${idx}`}
                      coordinate={{ latitude: checkpoint.latitude, longitude: checkpoint.longitude }}
                      anchor={{ x: 0.5, y: 0.5 }}
                    >
                      <View style={styles.checkpointMarker}>
                        <Text style={styles.checkpointNumber}>{checkpoint.order || idx + 1}</Text>
                      </View>
                    </Marker>
                  ))}

                  {/* Route polyline */}
                  <Polyline
                    coordinates={routeCoords}
                    strokeColor={theme.primary}
                    strokeWidth={4}
                    tappable
                    onPress={() => {
                      setSelectedSegmentId(null);
                      onSegmentPress?.(segment);
                    }}
                  />
                </>
              )}
            </React.Fragment>
          );
        })}

        {/* In-Progress Segment Creation */}
        {segmentCreationState?.isCreating && segmentCreationState.startPoint && (
          <>
            {/* Start point marker */}
            <Marker
              coordinate={segmentCreationState.startPoint}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.creationStartMarker}>
                <Flag size={14} color={theme.textPrimary} />
              </View>
            </Marker>

            {/* Checkpoint markers */}
            {segmentCreationState.checkpoints.map((checkpoint, idx) => (
              <Marker
                key={`creation-checkpoint-${idx}`}
                coordinate={{ latitude: checkpoint.latitude, longitude: checkpoint.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.creationCheckpointMarker}>
                  <Text style={styles.checkpointNumber}>{checkpoint.order}</Text>
                </View>
              </Marker>
            ))}

            {/* End point marker (if set) */}
            {segmentCreationState.endPoint && (
              <Marker
                coordinate={segmentCreationState.endPoint}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.creationEndMarker}>
                  <Trophy size={14} color={theme.textPrimary} />
                </View>
              </Marker>
            )}

            {/* Blue route line */}
            {creationSegmentRoute.length > 1 && (
              <Polyline
                coordinates={creationSegmentRoute}
                strokeColor={theme.primary}
                strokeWidth={5}
              />
            )}
          </>
        )}

        {/* Car Meet Markers */}
        {showCarMeets && carMeets.map((meet) => (
          <Marker
            key={`meet-${meet.id}`}
            coordinate={{ latitude: meet.latitude, longitude: meet.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => onCarMeetPress?.(meet)}
          >
            <View style={styles.meetMarker}>
              <Users size={14} color={theme.textPrimary} />
            </View>
          </Marker>
        ))}

        {/* Photo Spot Markers */}
        {showPhotoSpots && photoSpots.map((spot) => (
          <Marker
            key={`photo-spot-${spot.id}`}
            coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            onPress={() => onPhotoSpotPress?.(spot)}
            tracksViewChanges={false}
          >
            <View>
              <PhotoSpotMarker
                spot={spot}
                onPress={() => onPhotoSpotPress?.(spot)}
                size="medium"
              />
            </View>
          </Marker>
        ))}

        {/* Friend Live Location Markers */}
        {friendsLiveLocations?.map((friend) => {
          const profile = friend.profiles;
          const displayName = profile?.display_name || profile?.username || 'Friend';

          return (
            <Marker
              key={`friend-${friend.user_id}`}
              coordinate={{ latitude: friend.latitude, longitude: friend.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              rotation={friend.heading}
            >
              <View style={styles.friendMarkerContainer}>
                <View style={styles.friendNameBubble}>
                  <Text style={styles.friendName}>{displayName}</Text>
                  <Text style={styles.friendSpeed}>{Math.round(friend.speed)} km/h</Text>
                </View>
                <View style={styles.friendMarker}>
                  <View style={styles.friendMarkerArrow} />
                </View>
              </View>
            </Marker>
          );
        })}

        {/* Convoy Member Location Markers */}
        {convoyMembersLocations?.map((member) => {
          const displayName = member.profile?.display_name || member.profile?.username || 'Member';

          return (
            <Marker
              key={`convoy-${member.user_id}`}
              coordinate={{ latitude: member.latitude, longitude: member.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              rotation={member.heading}
            >
              <View style={styles.convoyMarkerContainer}>
                <View style={styles.convoyNameBubble}>
                  <Text style={styles.convoyName}>{displayName}</Text>
                  <Text style={styles.convoySpeed}>{Math.round(member.speed)} km/h</Text>
                </View>
                <View style={styles.convoyMarker}>
                  <View style={styles.convoyMarkerArrow} />
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Center button — compact, above speedometer (bottom-right) */}
      {isUserInteracting && (
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={handleCenterPress}
          activeOpacity={0.7}
        >
          <Crosshair size={18} color={theme.textPrimary} />
        </TouchableOpacity>
      )}

    </View>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  userMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.background,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 10,
  },
  userMarkerInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.textPrimary,
  },
  directionIndicator: {
    position: 'absolute',
    top: -4,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: theme.primary,
  },
  friendMarkerContainer: {
    alignItems: 'center',
  },
  friendNameBubble: {
    backgroundColor: theme.success + 'EE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 4,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.success,
  },
  friendName: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  friendSpeed: {
    fontSize: 10,
    color: theme.textPrimary,
    opacity: 0.9,
    marginTop: 2,
  },
  friendMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.textPrimary,
  },
  friendMarkerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: theme.textPrimary,
    transform: [{ rotate: '180deg' }],
  },
  // Convoy member markers (blue theme)
  convoyMarkerContainer: {
    alignItems: 'center',
  },
  convoyNameBubble: {
    backgroundColor: theme.primary + 'EE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 4,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.primary,
  },
  convoyName: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  convoySpeed: {
    fontSize: 10,
    color: theme.textPrimary,
    opacity: 0.9,
    marginTop: 2,
  },
  convoyMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.textPrimary,
  },
  convoyMarkerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: theme.textPrimary,
    transform: [{ rotate: '180deg' }],
  },
  trapMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.textPrimary,
    shadowColor: theme.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  segmentStartMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.textPrimary,
    shadowColor: theme.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  segmentEndMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.warning,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.textPrimary,
    shadowColor: theme.warning,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  meetMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.textPrimary,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  recenterButton: {
    position: 'absolute',
    bottom: 160, // Above speedometer (bottom: 85, ~64px tall, + 11px gap)
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  checkpointMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.warning,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.textPrimary,
    shadowColor: theme.warning,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  checkpointNumber: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  creationStartMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.textPrimary,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  creationCheckpointMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.textPrimary,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 8,
  },
  creationEndMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.textPrimary,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
});
