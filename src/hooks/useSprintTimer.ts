import { useState, useEffect, useRef, useCallback } from 'react';
import { SprintMode } from '../components/SprintModeSelector';

export type SprintState = 'IDLE' | 'READY' | 'RUNNING' | 'COMPLETED';

export interface SprintResultData {
  mode: SprintMode;
  time: number;
  topSpeed: number;
  startTimestamp: number;
  endTimestamp: number;
  date: Date;
}

interface UseSprintTimerProps {
  mode: SprintMode | null;
  currentSpeed: number;
  isEnabled: boolean;
  onComplete?: (result: SprintResultData) => void;
}

interface UseSprintTimerReturn {
  state: SprintState;
  elapsedTime: number;
  topSpeed: number;
  result: number | null;
  reset: () => void;
  stop: () => void;
}

export const useSprintTimer = ({
  mode,
  currentSpeed,
  isEnabled,
  onComplete,
}: UseSprintTimerProps): UseSprintTimerReturn => {
  const [state, setState] = useState<SprintState>('IDLE');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [topSpeed, setTopSpeed] = useState(0);
  const [result, setResult] = useState<number | null>(null);

  // High-resolution timing refs
  const startTimeRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastSpeedRef = useRef(0);
  const topSpeedRef = useRef(0);

  // Reset everything
  const reset = useCallback(() => {
    setState('IDLE');
    setElapsedTime(0);
    setTopSpeed(0);
    setResult(null);
    startTimeRef.current = null;
    topSpeedRef.current = 0;
    lastSpeedRef.current = currentSpeed;
    
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, [currentSpeed]);

  // Stop/abort the timer
  const stop = useCallback(() => {
    reset();
  }, [reset]);

  // High-resolution timer loop
  const updateTimer = useCallback(() => {
    if (startTimeRef.current && state === 'RUNNING') {
      const now = performance.now();
      const elapsed = (now - startTimeRef.current) / 1000;
      setElapsedTime(elapsed);
      frameRef.current = requestAnimationFrame(updateTimer);
    }
  }, [state]);

  // Start the timer
  const startTimer = useCallback(() => {
    startTimeRef.current = performance.now();
    topSpeedRef.current = currentSpeed;
    setState('RUNNING');
    console.log(`🚀 Sprint started at ${currentSpeed.toFixed(1)} km/h`);
    frameRef.current = requestAnimationFrame(updateTimer);
  }, [currentSpeed, updateTimer]);

  // Complete the timer
  const completeTimer = useCallback(() => {
    if (!startTimeRef.current || !mode) return;

    const endTime = performance.now();
    const finalTime = (endTime - startTimeRef.current) / 1000;

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    setResult(finalTime);
    setElapsedTime(finalTime);
    setState('COMPLETED');

    console.log(`🏁 Sprint completed: ${finalTime.toFixed(3)}s, Top: ${topSpeedRef.current.toFixed(0)} km/h`);

    // Call completion callback
    if (onComplete) {
      onComplete({
        mode,
        time: finalTime,
        topSpeed: topSpeedRef.current,
        startTimestamp: startTimeRef.current,
        endTimestamp: endTime,
        date: new Date(),
      });
    }
  }, [mode, onComplete]);

  // Handle state transitions based on speed
  useEffect(() => {
    if (!mode || !isEnabled) {
      if (state !== 'IDLE' && state !== 'COMPLETED') {
        reset();
      }
      return;
    }

    const prevSpeed = lastSpeedRef.current;
    lastSpeedRef.current = currentSpeed;

    // Update top speed during run
    if (state === 'RUNNING' && currentSpeed > topSpeedRef.current) {
      topSpeedRef.current = currentSpeed;
      setTopSpeed(currentSpeed);
    }

    switch (state) {
      case 'IDLE':
      case 'COMPLETED':
        // Check if we're in the ready zone
        if (mode.startSpeed === 0) {
          // Standing start: ready when nearly stopped
          if (currentSpeed < 5) {
            setState('READY');
            console.log('⏳ Sprint READY (standing start)');
          }
        } else {
          // Rolling start: ready when at or approaching start speed
          if (currentSpeed >= mode.startSpeed - 10 && currentSpeed <= mode.startSpeed + 15) {
            setState('READY');
            console.log(`⏳ Sprint READY (rolling from ${mode.startSpeed} km/h)`);
          }
        }
        break;

      case 'READY':
        if (mode.startSpeed === 0) {
          // Standing start: trigger when accelerating from near-stop
          if (prevSpeed < 5 && currentSpeed >= 5) {
            startTimer();
          }
          // Exit ready state if driving away
          if (currentSpeed > 20) {
            setState('IDLE');
          }
        } else {
          // Rolling start: trigger when crossing start threshold going up
          if (prevSpeed < mode.startSpeed && currentSpeed >= mode.startSpeed) {
            startTimer();
          }
          // Exit ready if going too slow or too fast past window
          if (currentSpeed < mode.startSpeed - 20 || currentSpeed > mode.startSpeed + 30) {
            setState('IDLE');
          }
        }
        break;

      case 'RUNNING':
        // Check if target reached
        if (currentSpeed >= mode.endSpeed) {
          completeTimer();
        }
        // Abort if slowing down significantly (failed attempt)
        if (mode.startSpeed === 0 && currentSpeed < 3) {
          console.log('❌ Sprint aborted (came to stop)');
          reset();
        }
        break;
    }
  }, [mode, currentSpeed, isEnabled, state, startTimer, completeTimer, reset]);

  // Auto-reset after showing result
  useEffect(() => {
    if (state === 'COMPLETED') {
      const timer = setTimeout(() => {
        if (mode) {
          setState('IDLE'); // Go back to idle, will transition to ready if conditions met
          setResult(null);
        }
      }, 8000); // Show result for 8 seconds

      return () => clearTimeout(timer);
    }
  }, [state, mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return {
    state,
    elapsedTime,
    topSpeed,
    result,
    reset,
    stop,
  };
};
