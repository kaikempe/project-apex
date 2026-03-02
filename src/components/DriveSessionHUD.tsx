import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { useTheme } from '../context/ThemeContext';

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
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
        color: theme.textSecondary,
        icon: <WifiOff size={14} color={theme.textSecondary} />,
      };
    }
    if (gpsAccuracy <= 5) {
      return {
        label: 'Excellent',
        color: theme.success,
        icon: <Wifi size={14} color={theme.success} />,
      };
    }
    if (gpsAccuracy <= 10) {
      return {
        label: 'Good',
        color: theme.success,
        icon: <Wifi size={14} color={theme.success} />,
      };
    }
    if (gpsAccuracy <= 20) {
      return {
        label: 'OK',
        color: theme.warning,
        icon: <Wifi size={14} color={theme.warning} />,
      };
    }
    if (gpsAccuracy <= 50) {
      return {
        label: 'Poor',
        color: theme.error,
        icon: <Wifi size={14} color={theme.error} />,
      };
    }
    return {
      label: 'Bad',
      color: theme.error,
      icon: <WifiOff size={14} color={theme.error} />,
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
          <Play size={26} color="#FFFFFF" fill="#FFFFFF" />
          <View style={styles.startButtonText}>
            <Text style={styles.startLabel}>Start Drive</Text>
            {activeVehicle ? (
              <View style={styles.vehicleInfo}>
                <Car size={13} color="rgba(255,255,255,0.75)" />
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
              <Clock size={14} color={theme.primary} />
              <Text style={styles.pauseStatText}>{formatTime(elapsedTime)}</Text>
              <Text style={styles.pauseStatDivider}>•</Text>
              <Gauge size={14} color={theme.success} />
              <Text style={styles.pauseStatText}>{Math.round(topSpeed)} km/h</Text>
              <Text style={styles.pauseStatDivider}>•</Text>
              <Route size={14} color={theme.primary} />
              <Text style={styles.pauseStatText}>{formatDistance(liveDistance)}</Text>
            </View>
          </View>
          
          <View style={styles.pauseActions}>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleContinue}
              activeOpacity={0.7}
            >
              <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.continueText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.endButton}
              onPress={handleEndDrive}
              activeOpacity={0.7}
            >
              <Square size={16} color="#FFFFFF" fill="#FFFFFF" />
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
          <Clock size={14} color={theme.primary} />
          <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <Gauge size={14} color={theme.success} />
          <Text style={styles.statValue}>{Math.round(topSpeed)}</Text>
          <Text style={styles.statUnit}>km/h</Text>
        </View>

        <View style={styles.statDivider} />

        {/* Live distance */}
        <View style={styles.statItem}>
          <Route size={14} color={theme.primary} />
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
          <Pause size={18} color={theme.warning} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  // Bottom container - Just above tab bar (touching but not overlapping)
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
    backgroundColor: theme.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 12,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  startButtonDisabled: {
    backgroundColor: theme.secondary,
    shadowOpacity: 0,
  },
  startButtonText: {
    flex: 1,
  },
  startLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  vehicleName: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
  },
  noVehicle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  gpsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
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
    backgroundColor: theme.surface + 'F0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statUnit: {
    fontSize: 10,
    color: theme.textSecondary,
    marginLeft: -2,
  },
  gpsLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: theme.textSecondary + '30',
  },
  pauseButton: {
    marginLeft: 'auto',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.warning + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.warning + '50',
  },

  // Pause container - At bottom, touching tab bar
  pauseContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: theme.background + 'F5',
    justifyContent: 'flex-end',
    paddingBottom: 30,
    paddingHorizontal: 16,
    zIndex: 150,
  },
  pauseBar: {
    backgroundColor: theme.secondary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: theme.warning,
  },
  pauseInfo: {
    marginBottom: 12,
  },
  pauseLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.warning,
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
    color: theme.textPrimary,
  },
  pauseStatDivider: {
    color: theme.textSecondary,
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
    backgroundColor: theme.success,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  continueText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.error,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 6,
  },
  endText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
