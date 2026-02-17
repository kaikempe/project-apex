import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';
import { Target, Flag, Trophy, Users } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { SpeedTrap, Segment, CarMeet } from '../context/POIContext';

interface POIMarkersProps {
  speedTraps: SpeedTrap[];
  segments: Segment[];
  carMeets: CarMeet[];
  showSpeedTraps: boolean;
  showSegments: boolean;
  showCarMeets: boolean;
  onSpeedTrapPress?: (trap: SpeedTrap) => void;
  onSegmentPress?: (segment: Segment) => void;
  onCarMeetPress?: (meet: CarMeet) => void;
}

export const POIMarkers: React.FC<POIMarkersProps> = ({
  speedTraps,
  segments,
  carMeets,
  showSpeedTraps,
  showSegments,
  showCarMeets,
  onSpeedTrapPress,
  onSegmentPress,
  onCarMeetPress,
}) => {
  return (
    <>
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
          {/* Start marker */}
          <Marker
            coordinate={{ latitude: segment.start_lat, longitude: segment.start_lon }}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => onSegmentPress?.(segment)}
          >
            <View style={styles.segmentStartMarker}>
              <Flag size={12} color={Colors.textPrimary} />
            </View>
          </Marker>
          
          {/* End marker */}
          <Marker
            coordinate={{ latitude: segment.end_lat, longitude: segment.end_lon }}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => onSegmentPress?.(segment)}
          >
            <View style={styles.segmentEndMarker}>
              <Trophy size={12} color={Colors.textPrimary} />
            </View>
          </Marker>
          
          {/* Connecting line */}
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
    </>
  );
};

const styles = StyleSheet.create({
  trapMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.textPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default POIMarkers;
