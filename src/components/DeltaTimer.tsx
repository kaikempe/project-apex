import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Typography } from '../theme/colors';

interface DeltaTimerProps {
  deltaSeconds: number | null;
  segmentName: string;
}

export const DeltaTimer: React.FC<DeltaTimerProps> = ({ deltaSeconds, segmentName }) => {
  if (deltaSeconds === null) return null;

  const isAhead = deltaSeconds < 0;
  const deltaColor = isAhead ? Colors.success : Colors.danger;
  const deltaText = `${isAhead ? '-' : '+'}${Math.abs(deltaSeconds).toFixed(1)}s`;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.segmentName}>{segmentName}</Text>
        <View style={styles.deltaRow}>
          <Text style={styles.vsGhost}>vs Ghost</Text>
          <Text style={[styles.deltaTime, { color: deltaColor }]}>{deltaText}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    zIndex: 20,
  },
  card: {
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  segmentName: {
    ...Typography.segmentTitle,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  deltaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vsGhost: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 14,
  },
  deltaTime: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
  },
});
