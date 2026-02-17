import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { SprintState, SprintResult, SprintType } from '../types/sprint';
import { useAudio } from '../context/AudioContext';
import { AudioPriority } from '../services/AudioQueue';
import { Zap, Trophy, RotateCcw } from 'lucide-react-native';

interface SprintOverlayProps {
  state: SprintState;
  elapsedTime: number;
  topSpeed: number;
  lastResult: SprintResult | null;
  sprintType: SprintType;
  onReset: () => void;
}

export const SprintOverlay: React.FC<SprintOverlayProps> = ({
  state,
  elapsedTime,
  topSpeed,
  lastResult,
  sprintType,
  onReset,
}) => {
  const { announce } = useAudio();
  
  // Announce result when completed
  useEffect(() => {
    if (state === 'COMPLETED' && lastResult) {
      const timeStr = lastResult.time.toFixed(2);
      announce(
        `${sprintType} complete. ${timeStr} seconds.`,
        AudioPriority.SEGMENT_RESULT
      );
    }
  }, [state, lastResult, sprintType, announce]);
  
  // Format time display (e.g., "4.523")
  const formatTime = (seconds: number): string => {
    return seconds.toFixed(3);
  };
  
  // Format time for large display (splits into whole and decimal)
  const formatTimeParts = (seconds: number): { whole: string; decimal: string } => {
    const [whole, decimal] = seconds.toFixed(3).split('.');
    return { whole, decimal: `.${decimal}` };
  };
  
  // Get target speed label
  const targetLabel = sprintType === '0-100' ? '0-100 km/h' : '100-200 km/h';
  
  // Don't render if IDLE
  if (state === 'IDLE') {
    return null;
  }
  
  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={[
        styles.card,
        state === 'READY' && styles.cardReady,
        state === 'RUNNING' && styles.cardRunning,
        state === 'COMPLETED' && styles.cardCompleted,
      ]}>
        {/* Header */}
        <View style={styles.header}>
          <Zap 
            size={20} 
            color={state === 'COMPLETED' ? Colors.success : Colors.primary} 
          />
          <Text style={styles.headerText}>{targetLabel}</Text>
          {state === 'COMPLETED' && (
            <TouchableOpacity onPress={onReset} style={styles.resetButton}>
              <RotateCcw size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        
        {/* State-specific content */}
        {state === 'READY' && (
          <View style={styles.readyContent}>
            <Text style={styles.readyText}>READY</Text>
            <Text style={styles.readySubtext}>Launch when ready</Text>
          </View>
        )}
        
        {state === 'RUNNING' && (
          <View style={styles.runningContent}>
            <View style={styles.timeContainer}>
              <Text style={styles.timeWhole}>
                {formatTimeParts(elapsedTime).whole}
              </Text>
              <Text style={styles.timeDecimal}>
                {formatTimeParts(elapsedTime).decimal}
              </Text>
              <Text style={styles.timeUnit}>s</Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.statLabel}>Top:</Text>
              <Text style={styles.statValue}>{Math.round(topSpeed)} km/h</Text>
            </View>
          </View>
        )}
        
        {state === 'COMPLETED' && lastResult && (
          <View style={styles.completedContent}>
            <View style={styles.resultHeader}>
              <Trophy size={24} color={Colors.success} />
            </View>
            <View style={styles.timeContainer}>
              <Text style={[styles.timeWhole, styles.timeCompleted]}>
                {formatTimeParts(lastResult.time).whole}
              </Text>
              <Text style={[styles.timeDecimal, styles.timeCompleted]}>
                {formatTimeParts(lastResult.time).decimal}
              </Text>
              <Text style={[styles.timeUnit, styles.timeCompleted]}>s</Text>
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Top Speed</Text>
                <Text style={styles.statValue}>{Math.round(lastResult.topSpeed)} km/h</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    padding: 16,
    minWidth: 200,
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  cardReady: {
    borderColor: Colors.warning,
  },
  cardRunning: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.5,
  },
  cardCompleted: {
    borderColor: Colors.success,
    shadowColor: Colors.success,
    shadowOpacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  headerText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
  resetButton: {
    position: 'absolute',
    right: 0,
    padding: 4,
  },
  
  // Ready state
  readyContent: {
    alignItems: 'center',
  },
  readyText: {
    color: Colors.warning,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 4,
  },
  readySubtext: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  
  // Running state
  runningContent: {
    alignItems: 'center',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  timeWhole: {
    color: Colors.primary,
    fontSize: 56,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timeDecimal: {
    color: Colors.primary,
    fontSize: 32,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  timeUnit: {
    color: Colors.textSecondary,
    fontSize: 20,
    fontWeight: '500',
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  
  // Completed state
  completedContent: {
    alignItems: 'center',
  },
  resultHeader: {
    marginBottom: 8,
  },
  timeCompleted: {
    color: Colors.success,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
});
