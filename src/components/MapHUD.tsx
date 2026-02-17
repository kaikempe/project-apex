import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, Camera } from 'react-native-maps';
import { Colors } from '../theme/colors';
import { Crosshair, Target, Flag, Trophy, Users } from 'lucide-react-native';
import { SpeedTrap, Segment, CarMeet } from '../context/POIContext';

interface Friend {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
}

interface MapHUDProps {
  userLatitude: number;
  userLongitude: number;
  userHeading: number;
  userSpeed: number;
  friends?: Friend[];
  showFriends?: boolean;
  // POI props
  speedTraps?: SpeedTrap[];
  segments?: Segment[];
  carMeets?: CarMeet[];
  showSpeedTraps?: boolean;
  showSegments?: boolean;
  showCarMeets?: boolean;
  onSpeedTrapPress?: (trap: SpeedTrap) => void;
  onSegmentPress?: (segment: Segment) => void;
  onCarMeetPress?: (meet: CarMeet) => void;
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

const HEADING_MIN_SPEED = 8;
const DRAG_STOP_DELAY = 500;
const RETURN_TO_NAV_DELAY = 10000;

export const MapHUD: React.FC<MapHUDProps> = ({
  userLatitude,
  userLongitude,
  userHeading,
  userSpeed,
  friends = [],
  showFriends = true,
  speedTraps = [],
  segments = [],
  carMeets = [],
  showSpeedTraps = true,
  showSegments = true,
  showCarMeets = true,
  onSpeedTrapPress,
  onSegmentPress,
  onCarMeetPress,
}) => {
  const mapRef = useRef<MapView>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [currentBracket, setCurrentBracket] = useState<SpeedBracket>('stationary');
  const [timerActive, setTimerActive] = useState(false);
  
  const returnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dragStopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const navigationIntervalRef = useRef<NodeJS.Timeout | null>(null);
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
    
    lastAltitudeRef.current = altitude;

    if (Platform.OS === 'ios') {
      const camera: Camera = {
        center: { latitude, longitude },
        pitch: 45,
        heading: heading,
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
        pitch: 45,
        heading: heading,
        zoom: zoom,
      };
      
      if (animate) {
        mapRef.current.animateCamera(camera, { duration: 1000 });
      } else {
        mapRef.current.setCamera(camera);
      }
    }
  }, []);

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
    const useHeading = speed >= HEADING_MIN_SPEED;
    const effectiveHeading = useHeading ? heading : lastHeadingRef.current;
    
    setCameraPosition(latitude, longitude, effectiveHeading, bracket, true);
  }, [clearReturnTimer, clearDragStopTimer, setCameraPosition]);

  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;
    if (userLatitude === 0 || userLongitude === 0) return;
    if (initialCenteredRef.current) return;

    const bracket = getSpeedBracket(userSpeed);
    setCurrentBracket(bracket);
    setCameraPosition(userLatitude, userLongitude, 0, bracket, false);
    initialCenteredRef.current = true;
  }, [isMapReady, userLatitude, userLongitude, userSpeed, setCameraPosition]);

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
      
      const useHeading = speed >= HEADING_MIN_SPEED;
      const effectiveHeading = useHeading ? heading : lastHeadingRef.current;
      if (useHeading) lastHeadingRef.current = heading;
      
      setCameraPosition(latitude, longitude, effectiveHeading, newBracket, true);
    };
    
    updateCamera();
    navigationIntervalRef.current = setInterval(updateCamera, 2000);
    
    return () => clearNavigationInterval();
  }, [isMapReady, isUserInteracting, currentBracket, clearNavigationInterval, setCameraPosition]);

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
        customMapStyle={darkMapStyle}
        userInterfaceStyle="dark"
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
        showsBuildings={true}
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

        {/* Friend markers */}
        {showFriends && friends.map((friend) => (
          <Marker
            key={friend.id}
            coordinate={{ latitude: friend.latitude, longitude: friend.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
            rotation={friend.heading}
          >
            <View style={styles.friendMarker}>
              <View style={styles.friendMarkerInner} />
            </View>
          </Marker>
        ))}

        {/* Speed Trap Markers */}
        {showSpeedTraps && speedTraps.map((trap) => (
          <Marker
            key={`trap-${trap.id}`}
            coordinate={{ latitude: trap.latitude, longitude: trap.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => onSpeedTrapPress?.(trap)}
          >
            <View style={styles.trapMarker}>
              <Target size={16} color={Colors.textPrimary} />
            </View>
          </Marker>
        ))}

        {/* Segment Markers & Lines */}
        {showSegments && segments.map((segment) => (
          <React.Fragment key={`segment-${segment.id}`}>
            <Marker
              coordinate={{ latitude: segment.start_lat, longitude: segment.start_lon }}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => onSegmentPress?.(segment)}
            >
              <View style={styles.segmentStartMarker}>
                <Flag size={12} color={Colors.textPrimary} />
              </View>
            </Marker>
            
            <Marker
              coordinate={{ latitude: segment.end_lat, longitude: segment.end_lon }}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => onSegmentPress?.(segment)}
            >
              <View style={styles.segmentEndMarker}>
                <Trophy size={12} color={Colors.textPrimary} />
              </View>
            </Marker>
            
            <Polyline
              coordinates={[
                { latitude: segment.start_lat, longitude: segment.start_lon },
                { latitude: segment.end_lat, longitude: segment.end_lon },
              ]}
              strokeColor={Colors.warning}
              strokeWidth={3}
              lineDashPattern={[10, 6]}
              tappable
              onPress={() => onSegmentPress?.(segment)}
            />
          </React.Fragment>
        ))}

        {/* Car Meet Markers */}
        {showCarMeets && carMeets.map((meet) => (
          <Marker
            key={`meet-${meet.id}`}
            coordinate={{ latitude: meet.latitude, longitude: meet.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => onCarMeetPress?.(meet)}
          >
            <View style={styles.meetMarker}>
              <Users size={14} color={Colors.textPrimary} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Center button */}
      {isUserInteracting && (
        <TouchableOpacity 
          style={styles.recenterButton}
          onPress={handleCenterPress}
          activeOpacity={0.7}
        >
          <Crosshair size={20} color={Colors.textPrimary} />
          <Text style={styles.recenterText}>Center</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#181818" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] },
  { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#373737" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3c3c3c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] },
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  userMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.background,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 10,
  },
  userMarkerInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.textPrimary,
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
    borderBottomColor: Colors.primary,
  },
  friendMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
    shadowColor: Colors.warning,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  friendMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.textPrimary,
  },
  trapMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.textPrimary,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  segmentStartMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.textPrimary,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  segmentEndMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.textPrimary,
    shadowColor: Colors.warning,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  meetMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.textPrimary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  recenterButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  recenterText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
