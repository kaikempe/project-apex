import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { poiService } from '../services/supabase';
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

const POIContext = createContext<POIContextType | undefined>(undefined);

export const POIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [speedTraps, setSpeedTraps] = useState<SpeedTrap[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [carMeets, setCarMeets] = useState<CarMeet[]>([]);

  const [showSpeedTraps, setShowSpeedTraps] = useState(true);
  const [showSegments, setShowSegments] = useState(true);
  const [showCarMeets, setShowCarMeets] = useState(true);

  const [isLoading, setIsLoading] = useState(false);

  const refreshPOIs = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all POIs in parallel
      const [trapsResult, segmentsResult, meetsResult] = await Promise.all([
        poiService.getSpeedTraps(),
        poiService.getSegments(),
        poiService.getCarMeets(),
      ]);

      if (trapsResult.error) throw trapsResult.error;
      if (segmentsResult.error) throw segmentsResult.error;
      if (meetsResult.error) throw meetsResult.error;

      // Fetch leaderboards for each POI
      const trapsWithLeaderboards = await Promise.all(
        (trapsResult.data || []).map(async (trap: any) => {
          const { data: records } = await poiService.getSpeedTrapRecords(trap.id, 10);
          const leaderboard = (records || []).map((r: any, idx: number) => ({
            rank: idx + 1,
            user_id: r.user_id,
            username: r.profiles?.display_name || r.profiles?.email?.split('@')[0] || 'Unknown',
            value: r.speed,
            vehicle_name: r.vehicle_name,
            date: r.created_at,
          }));
          return { ...trap, leaderboard };
        })
      );

      const segmentsWithLeaderboards = await Promise.all(
        (segmentsResult.data || []).map(async (segment: any) => {
          const { data: records } = await poiService.getSegmentRecords(segment.id, 10);
          const leaderboard = (records || []).map((r: any, idx: number) => ({
            rank: idx + 1,
            user_id: r.user_id,
            username: r.profiles?.display_name || r.profiles?.email?.split('@')[0] || 'Unknown',
            value: r.time_seconds,
            vehicle_name: r.vehicle_name,
            date: r.created_at,
          }));
          return { ...segment, leaderboard };
        })
      );

      const meetsWithCounts = await Promise.all(
        (meetsResult.data || []).map(async (meet: any) => {
          const { count } = await poiService.getCarMeetAttendeeCount(meet.id);
          return { ...meet, attendees_count: count || 0 };
        })
      );

      setSpeedTraps(trapsWithLeaderboards);
      setSegments(segmentsWithLeaderboards);
      setCarMeets(meetsWithCounts);

      console.log(`🗺️ POIs refreshed: ${trapsWithLeaderboards.length} traps, ${segmentsWithLeaderboards.length} segments, ${meetsWithCounts.length} meets`);
    } catch (error) {
      console.error('Error fetching POIs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addSpeedTrapRecord = useCallback(async (trapId: string, speed: number, vehicleName?: string) => {
    if (!user) return;

    try {
      // Save to database
      await poiService.addSpeedTrapRecord({
        trap_id: trapId,
        user_id: user.id,
        speed,
        vehicle_name: vehicleName,
      });

      // Refresh leaderboard for this trap
      const { data: records } = await poiService.getSpeedTrapRecords(trapId, 10);
      const leaderboard = (records || []).map((r: any, idx: number) => ({
        rank: idx + 1,
        user_id: r.user_id,
        username: r.profiles?.display_name || r.profiles?.email?.split('@')[0] || 'Unknown',
        value: r.speed,
        vehicle_name: r.vehicle_name,
        date: r.created_at,
      }));

      // Update state
      setSpeedTraps(prev => prev.map(trap =>
        trap.id === trapId ? { ...trap, leaderboard } : trap
      ));

      console.log(`🎯 Speed trap record: ${speed} km/h at ${trapId}`);
    } catch (error) {
      console.error('Error adding speed trap record:', error);
    }
  }, [user]);

  const addSegmentRecord = useCallback(async (segmentId: string, time: number, vehicleName?: string) => {
    if (!user) return;

    try {
      // Save to database
      await poiService.addSegmentRecord({
        segment_id: segmentId,
        user_id: user.id,
        time_seconds: time,
        vehicle_name: vehicleName,
      });

      // Refresh leaderboard for this segment
      const { data: records } = await poiService.getSegmentRecords(segmentId, 10);
      const leaderboard = (records || []).map((r: any, idx: number) => ({
        rank: idx + 1,
        user_id: r.user_id,
        username: r.profiles?.display_name || r.profiles?.email?.split('@')[0] || 'Unknown',
        value: r.time_seconds,
        vehicle_name: r.vehicle_name,
        date: r.created_at,
      }));

      // Update state
      setSegments(prev => prev.map(segment =>
        segment.id === segmentId ? { ...segment, leaderboard } : segment
      ));

      console.log(`🏁 Segment record: ${time}s at ${segmentId}`);
    } catch (error) {
      console.error('Error adding segment record:', error);
    }
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
