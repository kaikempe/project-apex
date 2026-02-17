import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { X, Trophy, Zap } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { SprintMode } from './SprintModeSelector';

export type SprintTimerState = 'READY' | 'RUNNING' | 'COMPLETED' | 'IDLE';

interface SprintTimerHUDProps {
  mode: SprintMode | null;
  state: SprintTimerState;
  currentSpeed: number;
  elapsedTime: number;
  result: number | null;
  topSpeed: number;
  onStop: () => void;
  onReset: () => void;
}

export const SprintTimerHUD: React.FC<SprintTimerHUDProps> = ({
  mode,
  state,
  currentSpeed,
  elapsedTime,
  result,
  topSpeed,
  onStop,
  onReset,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for READY state
  useEffect(() => {
    if (state === 'READY') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state]);

  // Flash animation for COMPLETED
  useEffect(() => {
    if (state === 'COMPLETED') {
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [state]);

  // Format time display
  const formatTime = (seconds: number): string => {
    if (seconds < 10) {
      return seconds.toFixed(3);
    } else if (seconds < 60) {
      return seconds.toFixed(2);
    } else {
      const mins = Math.floor(seconds / 60);
      const secs = (seconds % 60).toFixed(1);
      return `${mins}:${secs.padStart(4, '0')}`;
    }
  };

  const handleClose = () => {
    console.log('❌ Sprint close button pressed');
    onStop();
  };

  // Don't render if no mode selected
  if (!mode) return null;

  // READY state - top banner
  if (state === 'READY' || state === 'IDLE') {
    const isInRange = mode.startSpeed > 0 
      ? currentSpeed >= mode.startSpeed - 5 && currentSpeed <= mode.startSpeed + 10
      : currentSpeed < 5;

    return (
      <View style={styles.bannerWrapper}>
        <Animated.View
          style={[
            styles.readyBanner,
            { transform: [{ scale: pulseAnim }] },
            isInRange && styles.readyBannerActive,
          ]}
        >
          <Zap size={18} color={isInRange ? Colors.success : Colors.primary} />
          <Text style={[styles.readyText, isInRange && styles.readyTextActive]}>
            {mode.label}
          </Text>
          <Text style={styles.readyDivider}>•</Text>
          <Text style={[styles.readyHint, isInRange && styles.readyHintActive]}>
            {mode.startSpeed > 0
              ? isInRange
                ? 'Accelerate now!'
                : `Reach ${Math.round(mode.startSpeed)} km/h`
              : isInRange
                ? 'Launch when ready'
                : 'Come to a stop'}
          </Text>
        </Animated.View>
        
        {/* Separate close button for better touch */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          activeOpacity={0.6}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <X size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  }

  // RUNNING state - live timer
  if (state === 'RUNNING') {
    const progress = mode.endSpeed > mode.startSpeed
      ? Math.min(100, ((currentSpeed - mode.startSpeed) / (mode.endSpeed - mode.startSpeed)) * 100)
      : 0;

    return (
      <View style={styles.runningContainer}>
        {/* Timer display */}
        <View style={styles.timerBox}>
          <Text style={styles.timerLabel}>{mode.label}</Text>
          <Text style={styles.timerValue}>{formatTime(elapsedTime)}</Text>
          <Text style={styles.timerSpeed}>{Math.round(currentSpeed)} km/h</Text>
          
          {/* Progress bar */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        {/* Stop button - big and easy to tap */}
        <TouchableOpacity
          style={styles.stopButton}
          onPress={handleClose}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
    );
  }

  // COMPLETED state - result display
  if (state === 'COMPLETED' && result !== null) {
    const flashStyle = {
      backgroundColor: flashAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [Colors.secondary, Colors.success],
      }),
    };

    return (
      <Animated.View style={[styles.resultContainer, flashStyle]}>
        <View style={styles.resultHeader}>
          <Trophy size={22} color={Colors.success} />
          <Text style={styles.resultLabel}>{mode.label}</Text>
        </View>
        
        <Text style={styles.resultTime}>{formatTime(result)}</Text>
        <Text style={styles.resultUnit}>seconds</Text>
        
        <View style={styles.resultStats}>
          <View style={styles.resultStat}>
            <Text style={styles.resultStatValue}>{Math.round(topSpeed)}</Text>
            <Text style={styles.resultStatLabel}>Top km/h</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.resultDismiss}
          onPress={onReset}
          activeOpacity={0.6}
        >
          <Text style={styles.resultDismissText}>Tap to dismiss</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  // Banner wrapper with close button
  bannerWrapper: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1000,
  },
  readyBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondary + 'E6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    gap: 8,
  },
  readyBannerActive: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '20',
  },
  readyText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  readyTextActive: {
    color: Colors.success,
  },
  readyDivider: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  readyHint: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  readyHintActive: {
    color: Colors.success,
    fontWeight: '600',
  },
  
  // Close button - separate for better touch
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: Colors.textSecondary + '40',
  },

  // RUNNING timer
  runningContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    zIndex: 1000,
  },
  timerBox: {
    flex: 1,
    backgroundColor: Colors.background + 'F5',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.success,
  },
  timerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.success,
    marginBottom: 4,
  },
  timerValue: {
    fontSize: 52,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  timerSpeed: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.secondary,
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: 2,
  },
  stopButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.error + '30',
    borderWidth: 2,
    borderColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // COMPLETED result
  resultContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: Colors.secondary,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.success,
    zIndex: 1000,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.success,
  },
  resultTime: {
    fontSize: 60,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
  },
  resultUnit: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: -4,
  },
  resultStats: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 24,
  },
  resultStat: {
    alignItems: 'center',
  },
  resultStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  resultStatLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  resultDismiss: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: Colors.background + '80',
    borderRadius: 8,
  },
  resultDismissText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
