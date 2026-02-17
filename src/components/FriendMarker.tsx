import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker, Callout } from 'react-native-maps';
import { Car } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { FriendLocation } from '../hooks/useLiveTracking';

interface FriendMarkerProps {
  friend: FriendLocation;
}

export const FriendMarker: React.FC<FriendMarkerProps> = ({ friend }) => {
  return (
    <Marker
      coordinate={{
        latitude: friend.latitude,
        longitude: friend.longitude,
      }}
      anchor={{ x: 0.5, y: 0.5 }}
      rotation={friend.heading}
      flat={true}
      tracksViewChanges={false}
    >
      {/* Custom marker view */}
      <View style={styles.markerContainer}>
        <View style={[styles.marker, friend.isGhost && styles.markerGhost]}>
          <Car size={16} color={Colors.textPrimary} />
        </View>
        <View style={styles.nameTag}>
          <Text style={styles.nameText} numberOfLines={1}>
            {friend.displayName}
          </Text>
        </View>
      </View>

      {/* Callout (tap for details) */}
      <Callout tooltip>
        <View style={styles.callout}>
          <Text style={styles.calloutName}>{friend.displayName}</Text>
          {friend.username && (
            <Text style={styles.calloutUsername}>@{friend.username}</Text>
          )}
          <View style={styles.calloutStats}>
            <Text style={styles.calloutStat}>
              {Math.round(friend.speed)} km/h
            </Text>
            <Text style={styles.calloutDivider}>•</Text>
            <Text style={styles.calloutStat}>
              {friend.distance < 1
                ? `${Math.round(friend.distance * 1000)}m away`
                : `${friend.distance.toFixed(1)}km away`}
            </Text>
          </View>
          {friend.vehicleName && (
            <Text style={styles.calloutVehicle}>{friend.vehicleName}</Text>
          )}
        </View>
      </Callout>
    </Marker>
  );
};

// Simple car icon marker for better performance
export const FriendMarkerSimple: React.FC<FriendMarkerProps> = ({ friend }) => {
  return (
    <Marker
      coordinate={{
        latitude: friend.latitude,
        longitude: friend.longitude,
      }}
      anchor={{ x: 0.5, y: 0.5 }}
      rotation={friend.heading}
      flat={true}
      tracksViewChanges={false}
      title={friend.displayName}
      description={`${Math.round(friend.speed)} km/h • ${friend.distance.toFixed(1)}km away`}
    >
      <View style={[styles.simpleMarker, friend.isGhost && styles.markerGhost]}>
        <Car size={14} color={Colors.textPrimary} />
      </View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  // Full marker with name tag
  markerContainer: {
    alignItems: 'center',
  },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.textPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  markerGhost: {
    backgroundColor: Colors.warning,
    opacity: 0.8,
  },
  nameTag: {
    marginTop: 4,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 80,
  },
  nameText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },

  // Simple marker
  simpleMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.textPrimary,
  },

  // Callout
  callout: {
    backgroundColor: Colors.secondary,
    padding: 12,
    borderRadius: 10,
    minWidth: 140,
    alignItems: 'center',
  },
  calloutName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  calloutUsername: {
    fontSize: 12,
    color: Colors.primary,
    marginTop: 2,
  },
  calloutStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  calloutStat: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  calloutDivider: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginHorizontal: 6,
  },
  calloutVehicle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
