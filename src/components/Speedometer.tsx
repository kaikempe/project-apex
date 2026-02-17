import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface SpeedometerProps {
  speed: number;
  unit?: 'km/h' | 'mph';
}

export const Speedometer: React.FC<SpeedometerProps> = ({ 
  speed, 
  unit = 'km/h' 
}) => {
  const displaySpeed = Math.round(speed);
  
  // Color based on speed
  const getSpeedColor = () => {
    if (speed < 30) return Colors.textPrimary;
    if (speed < 60) return Colors.primary;
    if (speed < 100) return Colors.warning;
    return Colors.error;
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.speed, { color: getSpeedColor() }]}>
        {displaySpeed}
      </Text>
      <Text style={styles.unit}>{unit}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 85, // Just above DriveSessionHUD (which is at bottom: 15)
    right: 16,
    alignItems: 'flex-end',
    zIndex: 10,
    backgroundColor: Colors.background + 'E0',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  speed: {
    fontSize: 36, // Smaller
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    lineHeight: 40,
  },
  unit: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: -2,
  },
});

export default Speedometer;
