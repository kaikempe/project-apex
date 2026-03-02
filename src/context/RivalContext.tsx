import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { supabase } from '../services/supabase';
import { rivalService, Rival, RivalHeadToHead } from '../services/RivalService';
import { useAuth } from './AuthContext';

interface RivalContextType {
  rivals: Rival[];
  rivalStats: Map<string, RivalHeadToHead>;
  loading: boolean;
  canAddMore: boolean;
  addRival: (rivalId: string) => Promise<boolean>;
  removeRival: (rivalId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const RivalContext = createContext<RivalContextType | undefined>(undefined);

export const RivalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [rivals, setRivals] = useState<Rival[]>([]);
  const [rivalStats, setRivalStats] = useState<Map<string, RivalHeadToHead>>(new Map());
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await rivalService.getMyRivals(user.id);
      setRivals(data);

      // Fetch all stats in parallel
      const statsEntries = await Promise.all(
        data.map(r => rivalService.getRivalStats(user.id, r.rival_id))
      );
      const map = new Map<string, RivalHeadToHead>();
      statsEntries.forEach(s => map.set(s.rivalId, s));
      setRivalStats(map);
    } catch (e) {
      console.error('RivalContext load error:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    load();

    const channel = supabase
      .channel(`rivals:user:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rivals',
          filter: `user_id=eq.${user.id}`,
        },
        () => load()
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [user, load]);

  const addRival = useCallback(
    async (rivalId: string): Promise<boolean> => {
      if (!user) return false;
      const ok = await rivalService.addRival(user.id, rivalId);
      if (ok) await load();
      return ok;
    },
    [user, load]
  );

  const removeRival = useCallback(
    async (rivalId: string): Promise<void> => {
      if (!user) return;
      await rivalService.removeRival(user.id, rivalId);
      await load();
    },
    [user, load]
  );

  const value: RivalContextType = {
    rivals,
    rivalStats,
    loading,
    canAddMore: rivals.length < 3,
    addRival,
    removeRival,
    refresh: load,
  };

  return (
    <RivalContext.Provider value={value}>
      {children}
    </RivalContext.Provider>
  );
};

export const useRivals = () => {
  const ctx = useContext(RivalContext);
  if (!ctx) throw new Error('useRivals must be used within RivalProvider');
  return ctx;
};
