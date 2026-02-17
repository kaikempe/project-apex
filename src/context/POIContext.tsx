import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

// Types
export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  value: number;
  vehicle_name?: string;
  date: string;
}

export interface SpeedTrap {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description?: string;
  created_by: string;
  leaderboard: LeaderboardEntry[];
}

export interface Segment {
  id: string;
  name: string;
  start_lat: number;
  start_lon: number;
  end_lat: number;
  end_lon: number;
  distance_meters: number;
  description?: string;
  created_by: string;
  leaderboard: LeaderboardEntry[];
}

export interface CarMeet {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description?: string;
  schedule?: string;
  created_by: string;
  attendees_count: number;
}

interface POIContextType {
  // Data
  speedTraps: SpeedTrap[];
  segments: Segment[];
  carMeets: CarMeet[];
  
  // Visibility settings
  showSpeedTraps: boolean;
  showSegments: boolean;
  showCarMeets: boolean;
  setShowSpeedTraps: (show: boolean) => void;
  setShowSegments: (show: boolean) => void;
  setShowCarMeets: (show: boolean) => void;
  
  // Actions
  refreshPOIs: () => Promise<void>;
  addSpeedTrapRecord: (trapId: string, speed: number, vehicleName?: string) => Promise<void>;
  addSegmentRecord: (segmentId: string, time: number, vehicleName?: string) => Promise<void>;
  
  // Loading
  isLoading: boolean;
}

// Mock data for development
const MOCK_SPEED_TRAPS: SpeedTrap[] = [
  {
    id: 'trap_1',
    name: 'Highway Zone',
    latitude: 40.4168,
    longitude: -3.7038,
    description: 'Long straight on the highway',
    created_by: 'user123',
    leaderboard: [
      { rank: 1, user_id: '1', username: 'SpeedDemon', value: 285, vehicle_name: 'Porsche 911 Turbo', date: '2024-02-10' },
      { rank: 2, user_id: '2', username: 'FastFurious', value: 267, vehicle_name: 'Nissan GT-R', date: '2024-02-09' },
      { rank: 3, user_id: '3', username: 'RoadRunner', value: 254, vehicle_name: 'BMW M5', date: '2024-02-08' },
      { rank: 4, user_id: '4', username: 'TurboKing', value: 248, vehicle_name: 'Audi RS7', date: '2024-02-07' },
      { rank: 5, user_id: '5', username: 'LightningBolt', value: 241, vehicle_name: 'Mercedes AMG GT', date: '2024-02-06' },
    ],
  },
  {
    id: 'trap_2',
    name: 'Industrial Zone',
    latitude: 40.4200,
    longitude: -3.7100,
    description: 'Wide road near the factories',
    created_by: 'user456',
    leaderboard: [
      { rank: 1, user_id: '2', username: 'NightRider', value: 232, vehicle_name: 'Audi RS6', date: '2024-02-11' },
      { rank: 2, user_id: '1', username: 'SpeedDemon', value: 228, vehicle_name: 'Porsche 911', date: '2024-02-10' },
      { rank: 3, user_id: '6', username: 'DriftKing', value: 215, vehicle_name: 'Toyota Supra', date: '2024-02-09' },
    ],
  },
  {
    id: 'trap_3',
    name: 'Airport Road',
    latitude: 40.4050,
    longitude: -3.6900,
    description: 'Smooth asphalt near the airport',
    created_by: 'user789',
    leaderboard: [
      { rank: 1, user_id: '3', username: 'JetSpeed', value: 298, vehicle_name: 'McLaren 720S', date: '2024-02-12' },
      { rank: 2, user_id: '4', username: 'RunwayRacer', value: 276, vehicle_name: 'Lamborghini Huracan', date: '2024-02-11' },
    ],
  },
];

const MOCK_SEGMENTS: Segment[] = [
  {
    id: 'seg_1',
    name: 'Mountain Pass',
    start_lat: 40.4150,
    start_lon: -3.7000,
    end_lat: 40.4250,
    end_lon: -3.6900,
    distance_meters: 1200,
    description: 'Twisty mountain road with hairpins',
    created_by: 'user789',
    leaderboard: [
      { rank: 1, user_id: '1', username: 'TimeAttack', value: 42.5, vehicle_name: 'Porsche GT3', date: '2024-02-10' },
      { rank: 2, user_id: '2', username: 'ApexHunter', value: 43.2, vehicle_name: 'McLaren 720S', date: '2024-02-09' },
      { rank: 3, user_id: '3', username: 'TrackDay', value: 44.1, vehicle_name: 'Ferrari 488', date: '2024-02-08' },
      { rank: 4, user_id: '4', username: 'CornerKing', value: 45.8, vehicle_name: 'BMW M4', date: '2024-02-07' },
    ],
  },
  {
    id: 'seg_2',
    name: 'Coastal Sprint',
    start_lat: 40.4100,
    start_lon: -3.7200,
    end_lat: 40.4000,
    end_lon: -3.7300,
    distance_meters: 2500,
    description: 'Fast coastal road with ocean views',
    created_by: 'user012',
    leaderboard: [
      { rank: 1, user_id: '5', username: 'SeaBreeze', value: 68.3, vehicle_name: 'Porsche 911 Turbo', date: '2024-02-11' },
      { rank: 2, user_id: '6', username: 'CoastRider', value: 71.2, vehicle_name: 'Nissan GT-R', date: '2024-02-10' },
      { rank: 3, user_id: '7', username: 'WaveRunner', value: 73.5, vehicle_name: 'BMW M5', date: '2024-02-09' },
    ],
  },
];

const MOCK_CAR_MEETS: CarMeet[] = [
  {
    id: 'meet_1',
    name: 'Sunday Cars & Coffee',
    latitude: 40.4220,
    longitude: -3.6950,
    description: 'Weekly car meet, all cars welcome! Great coffee and car chat.',
    schedule: 'Sundays 9AM-12PM',
    created_by: 'user111',
    attendees_count: 45,
  },
  {
    id: 'meet_2',
    name: 'JDM Night Meet',
    latitude: 40.4080,
    longitude: -3.7150,
    description: 'Japanese cars only. Show off your builds!',
    schedule: 'Saturdays 8PM',
    created_by: 'user222',
    attendees_count: 28,
  },
  {
    id: 'meet_3',
    name: 'Euro Cars Monthly',
    latitude: 40.4300,
    longitude: -3.7000,
    description: 'European car enthusiasts meetup',
    schedule: 'First Saturday of month',
    created_by: 'user333',
    attendees_count: 62,
  },
];

const POIContext = createContext<POIContextType | undefined>(undefined);

export const POIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  const [speedTraps, setSpeedTraps] = useState<SpeedTrap[]>(MOCK_SPEED_TRAPS);
  const [segments, setSegments] = useState<Segment[]>(MOCK_SEGMENTS);
  const [carMeets, setCarMeets] = useState<CarMeet[]>(MOCK_CAR_MEETS);
  
  const [showSpeedTraps, setShowSpeedTraps] = useState(true);
  const [showSegments, setShowSegments] = useState(true);
  const [showCarMeets, setShowCarMeets] = useState(true);
  
  const [isLoading, setIsLoading] = useState(false);

  const refreshPOIs = useCallback(async () => {
    setIsLoading(true);
    try {
      // TODO: Fetch from Supabase when tables are set up
      // For now, using mock data
      console.log('🗺️ POIs refreshed');
    } catch (error) {
      console.error('Error fetching POIs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addSpeedTrapRecord = useCallback(async (trapId: string, speed: number, vehicleName?: string) => {
    if (!user) return;
    
    // Add record to leaderboard
    setSpeedTraps(prev => prev.map(trap => {
      if (trap.id !== trapId) return trap;
      
      const newEntry: LeaderboardEntry = {
        rank: 0, // Will be calculated
        user_id: user.id,
        username: user.email?.split('@')[0] || 'You',
        value: speed,
        vehicle_name: vehicleName,
        date: new Date().toISOString(),
      };
      
      // Add and sort
      const newLeaderboard = [...trap.leaderboard, newEntry]
        .sort((a, b) => b.value - a.value) // Higher speed = better
        .slice(0, 10) // Keep top 10
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
      
      return { ...trap, leaderboard: newLeaderboard };
    }));
    
    console.log(`🎯 Speed trap record: ${speed} km/h at ${trapId}`);
  }, [user]);

  const addSegmentRecord = useCallback(async (segmentId: string, time: number, vehicleName?: string) => {
    if (!user) return;
    
    setSegments(prev => prev.map(segment => {
      if (segment.id !== segmentId) return segment;
      
      const newEntry: LeaderboardEntry = {
        rank: 0,
        user_id: user.id,
        username: user.email?.split('@')[0] || 'You',
        value: time,
        vehicle_name: vehicleName,
        date: new Date().toISOString(),
      };
      
      const newLeaderboard = [...segment.leaderboard, newEntry]
        .sort((a, b) => a.value - b.value) // Lower time = better
        .slice(0, 10)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
      
      return { ...segment, leaderboard: newLeaderboard };
    }));
    
    console.log(`🏁 Segment record: ${time}s at ${segmentId}`);
  }, [user]);

  useEffect(() => {
    refreshPOIs();
  }, [refreshPOIs]);

  return (
    <POIContext.Provider
      value={{
        speedTraps,
        segments,
        carMeets,
        showSpeedTraps,
        showSegments,
        showCarMeets,
        setShowSpeedTraps,
        setShowSegments,
        setShowCarMeets,
        refreshPOIs,
        addSpeedTrapRecord,
        addSegmentRecord,
        isLoading,
      }}
    >
      {children}
    </POIContext.Provider>
  );
};

export const usePOI = () => {
  const context = useContext(POIContext);
  if (!context) {
    throw new Error('usePOI must be used within POIProvider');
  }
  return context;
};
