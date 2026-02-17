import { Audio } from 'expo-av';
import React, { createContext, ReactNode, useContext, useEffect } from 'react';
import { AudioPriority, audioQueue } from '../services/AudioQueue';

interface AudioContextType {
  announce: (message: string, priority: AudioPriority) => void;
  batchAnnounce: (items: Array<{ message: string; priority: AudioPriority }>) => void;
  clearQueue: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize audio session on mount
  useEffect(() => {
    const initAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          allowsRecordingIOS: false,
          interruptionModeIOS: 2,
          interruptionModeAndroid: 1,
        });
        console.log('✅ Audio session initialized with ducking');
      } catch (error) {
        console.error('❌ Failed to initialize audio session:', error);
      }
    };

    initAudio();
  }, []);

  const announce = (message: string, priority: AudioPriority) => {
    audioQueue.announce(message, priority);
  };

  const batchAnnounce = (items: Array<{ message: string; priority: AudioPriority }>) => {
    audioQueue.batchAnnounce(items);
  };

  const clearQueue = () => {
    audioQueue.clearQueue();
  };

  return (
    <AudioContext.Provider value={{ announce, batchAnnounce, clearQueue }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = (): AudioContextType => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }
  return context;
};