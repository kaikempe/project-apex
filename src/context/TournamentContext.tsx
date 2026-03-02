import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { supabase } from '../services/supabase';
import { tournamentService, Tournament } from '../services/TournamentService';
import { useAuth } from './AuthContext';
import { useXP } from './XPContext';

interface TournamentContextType {
  activeTournaments: Tournament[];
  upcomingTournaments: Tournament[];
  myTournaments: Tournament[];
  activeCount: number;
  loading: boolean;
  joinTournament: (id: string) => Promise<boolean>;
  claimReward: (id: string) => Promise<number>;
  refresh: () => Promise<void>;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { awardXP } = useXP();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await tournamentService.getTournaments(user.id);
      setTournaments(data);
    } catch (e) {
      console.error('TournamentContext load error:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    load();

    const channel = supabase
      .channel(`tournament_participants:user:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_participants',
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

  const joinTournament = useCallback(
    async (id: string): Promise<boolean> => {
      if (!user) return false;
      const ok = await tournamentService.joinTournament(id, user.id);
      if (ok) await load();
      return ok;
    },
    [user, load]
  );

  const claimReward = useCallback(
    async (id: string): Promise<number> => {
      if (!user) return 0;
      const xp = await tournamentService.claimReward(id, user.id);
      if (xp > 0) {
        awardXP({ type: 'custom', amount: xp }).catch(() => {});
        await load();
      }
      return xp;
    },
    [user, awardXP, load]
  );

  const activeTournaments = tournaments.filter(t => t.status === 'active');
  const upcomingTournaments = tournaments.filter(t => t.status === 'upcoming');
  const myTournaments = tournaments.filter(t => !!t.my_entry);
  const activeCount = activeTournaments.filter(t => !!t.my_entry).length;

  const value: TournamentContextType = {
    activeTournaments,
    upcomingTournaments,
    myTournaments,
    activeCount,
    loading,
    joinTournament,
    claimReward,
    refresh: load,
  };

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  );
};

export const useTournament = () => {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournament must be used within TournamentProvider');
  return ctx;
};
