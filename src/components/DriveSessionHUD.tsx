import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  Play,
  Pause,
  Square,
  Car,
  Gauge,
  Wifi,
  WifiOff,
  Clock,
  Route,
} from 'lucide-react-native';
import { Colors } from '../theme/colors';

interface DriveSessionHUDProps {
  isSessionActive: boolean;
  activeVehicle: { name: string; id: string } | null;
  currentSpeed: number;
  gpsAccuracy: number | null;
  liveDistance?: number; // meters — passed from index.tsx
  onStartSession: () => void;
  onEndSession: () => void;
  onSaveDriveStats?: (stats: DriveStats) => void;
  onPauseChange?: (isPaused: boolean) => void;
}

export interface DriveStats {
  duration: number;
  topSpeed: number;
  distance: number;
  startTime: string;
  endTime: string;
}

export const DriveSessionHUD: React.FC<DriveSessionHUDProps> = ({
  isSessionActive,
  activeVehicle,
  currentSpeed,
  gpsAccuracy,
  liveDistance = 0,
  onStartSession,
  onEndSession,
  onSaveDriveStats,
  onPauseChange,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [topSpeed, setTopSpeed] = useState(0);
  
  const topSpeedRef = useRef(0);
  const startTimeRef = useRef<string | null>(null);

  useEffect(() => {
    if (isSessionActive && !sessionStartTime) {
      const now = Date.now();
      setSessionStartTime(now);
      startTimeRef.current = new Date(now).toISOString();
      setElapsedTime(0);
      setTopSpeed(0);
      topSpeedRef.current = 0;
      setIsPaused(false);
      onPauseChange?.(false);
    } else if (!isSessionActive && sessionStartTime) {
      if (onSaveDriveStats && elapsedTime > 5) {
        onSaveDriveStats({
          duration: elapsedTime,
          topSpeed: topSpeedRef.current,
          distance: liveDistance,
          startTime: startTimeRef.current || new Date().toISOString(),
          endTime: new Date().toISOString(),
        });
      }
      setSessionStartTime(null);
      startTimeRef.current = null;
      setIsPaused(false);
      onPauseChange?.(false);
    }
  }, [isSessionActive]);

  useEffect(() => {
    if (!isSessionActive || isPaused || !sessionStartTime) return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isSessionActive, isPaused, sessionStartTime]);

  useEffect(() => {
    if (isSessionActive && !isPaused && currentSpeed > topSpeedRef.current) {
      topSpeedRef.current = currentSpeed;
      setTopSpeed(currentSpeed);
    }
  }, [currentSpeed, isSessionActive, isPaused]);

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format distance for display
  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const getGpsStatus = (): { label: string; color: string; icon: React.ReactNode } => {
    if (gpsAccuracy === null || gpsAccuracy === 0) {
      return {
        label: 'No GPS',
        color: Colors.textSecondary,
        icon: <WifiOff size={14} color={Colors.textSecondary} />,
      };
    }
    if (gpsAccuracy <= 5) {
      return {
        label: 'Excellent',
        color: Colors.success,
        icon: <Wifi size={14} color={Colors.success} />,
      };
    }
    if (gpsAccuracy <= 10) {
      return {
        label: 'Good',
        color: Colors.success,
        icon: <Wifi size={14} color={Colors.success} />,
      };
    }
    if (gpsAccuracy <= 20) {
      return {
        label: 'OK',
        color: Colors.warning,
        icon: <Wifi size={14} color={Colors.warning} />,
      };
    }
    if (gpsAccuracy <= 50) {
      return {
        label: 'Poor',
        color: Colors.error,
        icon: <Wifi size={14} color={Colors.error} />,
      };
    }
    return {
      label: 'Bad',
      color: Colors.error,
      icon: <WifiOff size={14} color={Colors.error} />,
    };
  };

  const handlePause = () => {
    setIsPaused(true);
    onPauseChange?.(true);
  };
  const handleContinue = () => {
    setIsPaused(false);
    onPauseChange?.(false);
  };
  const handleEndDrive = () => {
    setIsPaused(false);
    onPauseChange?.(false);
    onEndSession();
  };

  const gps = getGpsStatus();

  // NOT ACTIVE - Show start button
  if (!isSessionActive) {
    return (
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.startButton, !activeVehicle && styles.startButtonDisabled]}
          onPress={onStartSession}
          activeOpacity={0.7}
          disabled={!activeVehicle}
        >
          <Play size={26} color={Colors.textPrimary} fill={Colors.textPrimary} />
          <View style={styles.startButtonText}>
            <Text style={styles.startLabel}>Start Drive</Text>
            {activeVehicle ? (
              <View style={styles.vehicleInfo}>
                <Car size={13} color={Colors.textSecondary} />
                <Text style={styles.vehicleName}>{activeVehicle.name}</Text>
              </View>
            ) : (
              <Text style={styles.noVehicle}>Select a vehicle in Profile</Text>
            )}
          </View>
          <View style={styles.gpsChip}>
            {gps.icon}
            <Text style={[styles.gpsChipText, { color: gps.color }]}>{gps.label}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // PAUSED - Bottom overlay
  if (isPaused) {
    return (
      <View style={styles.pauseContainer}>
        <View style={styles.pauseBar}>
          <View style={styles.pauseInfo}>
            <Text style={styles.pauseLabel}>Paused</Text>
            <View style={styles.pauseStatsRow}>
              <Clock size={14} color={Colors.primary} />
              <Text style={styles.pauseStatText}>{formatTime(elapsedTime)}</Text>
              <Text style={styles.pauseStatDivider}>•</Text>
              <Gauge size={14} color={Colors.success} />
              <Text style={styles.pauseStatText}>{Math.round(topSpeed)} km/h</Text>
              <Text style={styles.pauseStatDivider}>•</Text>
              <Route size={14} color={Colors.primary} />
              <Text style={styles.pauseStatText}>{formatDistance(liveDistance)}</Text>
            </View>
          </View>
          
          <View style={styles.pauseActions}>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleContinue}
              activeOpacity={0.7}
            >
              <Play size={18} color={Colors.textPrimary} fill={Colors.textPrimary} />
              <Text style={styles.continueText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.endButton}
              onPress={handleEndDrive}
              activeOpacity={0.7}
            >
              <Square size={16} color={Colors.textPrimary} fill={Colors.textPrimary} />
              <Text style={styles.endText}>End</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ACTIVE - Show stats bar with distance
  return (
    <View style={styles.bottomContainer}>
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Clock size={14} color={Colors.primary} />
          <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <Gauge size={14} color={Colors.success} />
          <Text style={styles.statValue}>{Math.round(topSpeed)}</Text>
          <Text style={styles.statUnit}>km/h</Text>
        </View>

        <View style={styles.statDivider} />

        {/* Live distance */}
        <View style={styles.statItem}>
          <Route size={14} color={Colors.primary} />
          <Text style={styles.statValue}>{formatDistance(liveDistance)}</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          {gps.icon}
          <Text style={[styles.gpsLabel, { color: gps.color }]}>{gps.label}</Text>
        </View>

        <TouchableOpacity
          style={styles.pauseButton}
          onPress={handlePause}
          activeOpacity={0.7}
        >
          <Pause size={18} color={Colors.warning} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Bottom container - 15px above tab bar
  bottomContainer: {
    position: 'absolute',
    bottom: 15,
    left: 16,
    right: 16,
    zIndex: 100,
  },

  // Start button
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  startButtonDisabled: {
    backgroundColor: Colors.secondary,
    shadowOpacity: 0,
  },
  startButtonText: {
    flex: 1,
  },
  startLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  vehicleName: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  noVehicle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  gpsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background + '80',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gpsChipText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Stats bar (when driving)
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statUnit: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginLeft: -2,
  },
  gpsLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.textSecondary + '30',
  },
  pauseButton: {
    marginLeft: 'auto',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.warning + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.warning + '50',
  },

  // Pause container
  pauseContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: Colors.background + 'F5',
    justifyContent: 'flex-end',
    paddingBottom: 15,
    paddingHorizontal: 16,
    zIndex: 150,
  },
  pauseBar: {
    backgroundColor: Colors.secondary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: Colors.warning,
  },
  pauseInfo: {
    marginBottom: 12,
  },
  pauseLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.warning,
    marginBottom: 4,
  },
  pauseStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pauseStatText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  pauseStatDivider: {
    color: Colors.textSecondary,
    marginHorizontal: 4,
  },
  pauseActions: {
    flexDirection: 'row',
    gap: 10,
  },
  continueButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  continueText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 6,
  },
  endText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
