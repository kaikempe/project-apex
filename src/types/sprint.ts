// Sprint timer types

export type SprintType = '0-100' | '100-200';

export type SprintState = 
  | 'IDLE'       // Not tracking, moving or not ready
  | 'READY'      // Stationary, waiting for launch
  | 'RUNNING'    // Timer active, accelerating
  | 'COMPLETED'; // Just finished, showing result

export interface SprintResult {
  type: SprintType;
  time: number;           // Time in seconds (e.g., 4.523)
  startTime: number;      // Unix timestamp when started
  endTime: number;        // Unix timestamp when finished
  startSpeed: number;     // Speed when timer started (should be ~0)
  endSpeed: number;       // Speed when timer stopped (should be ~100)
  topSpeed: number;       // Max speed during sprint
  date: Date;
}

export interface SprintSettings {
  type: SprintType;
  targetSpeed: number;        // 100 or 200 km/h
  readyThreshold: number;     // Max speed to be considered "ready" (e.g., 3 km/h)
  launchAcceleration: number; // Min acceleration to trigger start (km/h per second)
  autoReset: boolean;         // Auto-reset after showing result
  autoResetDelay: number;     // Delay before auto-reset (ms)
}

export const DEFAULT_SPRINT_SETTINGS: SprintSettings = {
  type: '0-100',
  targetSpeed: 100,
  readyThreshold: 3,          // Consider "stopped" if under 3 km/h
  launchAcceleration: 5,      // 5 km/h/s acceleration to trigger
  autoReset: true,
  autoResetDelay: 5000,       // Show result for 5 seconds
};

export const SPRINT_100_200_SETTINGS: SprintSettings = {
  type: '100-200',
  targetSpeed: 200,
  readyThreshold: 95,         // Ready when between 95-105 km/h
  launchAcceleration: 3,      // Lower threshold since already moving
  autoReset: true,
  autoResetDelay: 5000,
};
