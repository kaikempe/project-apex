import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useVehicle } from '../context/VehicleContext';
import { useAudio } from '../context/AudioContext';
import { AudioPriority } from '../services/AudioQueue';

export interface FriendLocation {
  userId: string;
  displayName: string;
  username: string | null;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  vehicleName: string | null;
  isGhost: boolean;
  distance: number;
  updatedAt: string;
}

interface UseLiveTrackingOptions {
  nearbyRadius?: number;
  updateInterval?: number;
  staleThreshold?: number;
}

export const useLiveTracking = (
  userLocation: { latitude: number; longitude: number; speed: number; heading: number } | null,
  options: UseLiveTrackingOptions = {}
) => {
  const { user } = useAuth();
  const { activeVehicle, isSessionActive } = useVehicle();
  const { announce } = useAudio();

  const {
    nearbyRadius = 5,
    updateInterval = 2000,
    staleThreshold = 60000,
  } = options;

  const [friendLocations, setFriendLocations] = useState<FriendLocation[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use refs to avoid dependency issues
  const announcedFriendsRef = useRef<Set<string>>(new Set());
  const lastUpdateRef = useRef<number>(0);
  const userLocationRef = useRef(userLocation);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isSubscribedRef = useRef(false);
  const activeVehicleRef = useRef(activeVehicle);

  // Keep refs updated without triggering effects
  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  useEffect(() => {
    activeVehicleRef.current = activeVehicle;
  }, [activeVehicle]);

  // Calculate distance between two coordinates
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Fetch friends' locations
  const fetchFriendLocations = useCallback(async () => {
    if (!user || !userLocationRef.current) return;

    try {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .eq('status', 'accepted')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      if (!friendships || friendships.length === 0) {
        setFriendLocations([]);
        return;
      }

      const friendIds = friendships.map((f) =>
        f.user_id === user.id ? f.friend_id : f.user_id
      );

      const { data: sessions } = await supabase
        .from('live_sessions')
        .select(`
          user_id,
          latitude,
          longitude,
          speed,
          heading,
          is_ghost,
          updated_at,
          profiles:user_id (display_name, username),
          vehicles:vehicle_id (name)
        `)
        .in('user_id', friendIds)
        .gte('updated_at', new Date(Date.now() - staleThreshold).toISOString());

      if (!sessions) {
        setFriendLocations([]);
        return;
      }

      const currentLoc = userLocationRef.current;
      const locations: FriendLocation[] = sessions.map((session: any) => {
        const distance = calculateDistance(
          currentLoc!.latitude,
          currentLoc!.longitude,
          session.latitude,
          session.longitude
        );

        return {
          userId: session.user_id,
          displayName: session.profiles?.display_name || 'Unknown',
          username: session.profiles?.username || null,
          latitude: session.latitude,
          longitude: session.longitude,
          speed: session.speed,
          heading: session.heading,
          vehicleName: session.vehicles?.name || null,
          isGhost: session.is_ghost,
          distance,
          updatedAt: session.updated_at,
        };
      });

      locations.sort((a, b) => a.distance - b.distance);
      setFriendLocations(locations);

      // Announce nearby friends
      locations.forEach((friend) => {
        if (
          friend.distance <= nearbyRadius &&
          !announcedFriendsRef.current.has(friend.userId)
        ) {
          announce(
            `${friend.displayName} nearby. ${friend.distance.toFixed(1)} kilometers.`,
            AudioPriority.FRIEND_NEARBY
          );
          announcedFriendsRef.current.add(friend.userId);
        } else if (
          friend.distance > nearbyRadius * 1.5 &&
          announcedFriendsRef.current.has(friend.userId)
        ) {
          announcedFriendsRef.current.delete(friend.userId);
        }
      });
    } catch (err) {
      console.error('Error fetching friend locations:', err);
    }
  }, [user?.id, staleThreshold, nearbyRadius]); // Minimal stable deps

  // Update user's location to Supabase
  const updateMyLocation = useCallback(async () => {
    if (!user || !userLocationRef.current || !isSessionActive) return;

    const now = Date.now();
    if (now - lastUpdateRef.current < updateInterval) return;
    lastUpdateRef.current = now;

    try {
      const loc = userLocationRef.current;
      const vehicle = activeVehicleRef.current;
      await supabase
        .from('live_sessions')
        .upsert(
          {
            user_id: user.id,
            vehicle_id: vehicle?.id || null,
            latitude: loc.latitude,
            longitude: loc.longitude,
            speed: loc.speed,
            heading: loc.heading,
            is_ghost: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
    } catch (err) {
      console.error('Location update error:', err);
    }
  }, [user?.id, isSessionActive, updateInterval]);

  // End session
  const endLiveSession = useCallback(async () => {
    if (!user) return;
    try {
      await supabase.from('live_sessions').delete().eq('user_id', user.id);
    } catch (err) {
      console.error('Error ending session:', err);
    }
  }, [user?.id]);

  // Main subscription effect - STABLE dependencies only
  useEffect(() => {
    // Guard conditions
    if (!user?.id || !isSessionActive) {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
      setIsTracking(false);
      return;
    }

    // Already subscribed - don't re-subscribe
    if (isSubscribedRef.current && channelRef.current) {
      return;
    }

    console.log('🟢 Live tracking started');
    setIsTracking(true);

    // Initial fetch
    fetchFriendLocations();

    // Create channel with unique name
    const channelName = `live_${user.id.slice(0, 8)}_${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_sessions',
        },
        (payload) => {
          console.log('📡 Realtime update:', payload.eventType);
          fetchFriendLocations();
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true;
        }
      });

    channelRef.current = channel;

    // Backup polling every 5 seconds
    const refreshInterval = setInterval(fetchFriendLocations, 5000);

    return () => {
      console.log('🔴 Live tracking stopped');
      clearInterval(refreshInterval);
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      isSubscribedRef.current = false;
      setIsTracking(false);
    };
  }, [user?.id, isSessionActive]); // ONLY these two deps!

  // Location update effect (separate)
  useEffect(() => {
    if (!isSessionActive || !userLocation) return;
    updateMyLocation();
  }, [userLocation?.latitude, userLocation?.longitude, isSessionActive]);

  // Cleanup on session end
  useEffect(() => {
    if (!isSessionActive) {
      endLiveSession();
      announcedFriendsRef.current.clear();
    }
  }, [isSessionActive]);

  return {
    friendLocations,
    isTracking,
    error,
    nearbyFriends: friendLocations.filter((f) => f.distance <= nearbyRadius),
  };
};
