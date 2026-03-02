/**
 * Tournament Service
 *
 * Weekend competitive events. Players join, compete with their best result
 * during the active window, and earn XP prizes on the leaderboard.
 *
 * Result comparison:
 *   sprint_0_100 / sprint_100_200 → lower is better (time in seconds)
 *   top_speed                      → higher is better (km/h)
 *   most_distance                  → higher is better (km)
 */

import { supabase } from './supabase';
import { profileService } from './supabase';

export type TournamentType   = 'sprint_0_100' | 'sprint_100_200' | 'top_speed' | 'most_distance';
export type TournamentStatus = 'upcoming' | 'active' | 'completed';

export interface Tournament {
  id: string;
  name: string;
  description: string | null;
  type: TournamentType;
  status: TournamentStatus;
  start_at: string;
  end_at: string;
  prize_xp_1st: number;
  prize_xp_2nd: number;
  prize_xp_3rd: number;
  prize_xp_participation: number;
  min_level: number;
  created_at: string;
  // Enriched
  participant_count?: number;
  my_entry?: TournamentParticipant | null;
}

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string;
  best_result: number | null;
  rank: number | null;
  xp_awarded: number;
  reward_claimed: boolean;
  joined_at: string;
  updated_at: string;
}

export interface TournamentLeaderboardEntry {
  userId: string;
  displayName: string;
  username: string;
  level: number;
  bestResult: number | null;
  rank: number;
  xpAwarded: number;
}

export const TOURNAMENT_TYPE_LABELS: Record<TournamentType, string> = {
  sprint_0_100:   '0–100 Sprint',
  sprint_100_200: '100–200 Sprint',
  top_speed:      'Top Speed',
  most_distance:  'Most Distance',
};

export const TOURNAMENT_TYPE_UNITS: Record<TournamentType, string> = {
  sprint_0_100:   's',
  sprint_100_200: 's',
  top_speed:      'km/h',
  most_distance:  'km',
};

export const TOURNAMENT_TYPE_EMOJI: Record<TournamentType, string> = {
  sprint_0_100:   '🏁',
  sprint_100_200: '⚡',
  top_speed:      '🚀',
  most_distance:  '🛣️',
};

/** True if a new result beats the stored one (accounting for type direction). */
export function isNewResultBetter(
  type: TournamentType,
  newResult: number,
  existing: number | null
): boolean {
  if (existing === null) return true;
  if (type === 'sprint_0_100' || type === 'sprint_100_200') {
    return newResult < existing; // lower time = better
  }
  return newResult > existing; // higher speed/distance = better
}

export function formatResult(type: TournamentType, value: number | null): string {
  if (value === null) return '—';
  if (type === 'sprint_0_100' || type === 'sprint_100_200') {
    return `${value.toFixed(3)}s`;
  }
  if (type === 'top_speed') {
    return `${Math.round(value)} km/h`;
  }
  return `${value.toFixed(1)} km`;
}

export function timeUntil(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h remaining`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h remaining`;
}

export function timeUntilStart(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return 'Starting soon';
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `Starts in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Starts in ${days}d ${hours % 24}h`;
}

// ─── Service class ────────────────────────────────────────────────────────────

class TournamentServiceClass {

  // ── Fetch ────────────────────────────────────────────────────────────────────

  async getTournaments(userId: string): Promise<Tournament[]> {
    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('start_at', { ascending: true });

    if (error || !tournaments) return [];

    // Fetch participant counts and own entries in parallel
    const ids = tournaments.map(t => t.id);

    const [countsResult, myEntriesResult] = await Promise.all([
      supabase
        .from('tournament_participants')
        .select('tournament_id')
        .in('tournament_id', ids),
      supabase
        .from('tournament_participants')
        .select('*')
        .in('tournament_id', ids)
        .eq('user_id', userId),
    ]);

    // Build count map
    const countMap = new Map<string, number>();
    for (const row of (countsResult.data ?? [])) {
      countMap.set(row.tournament_id, (countMap.get(row.tournament_id) ?? 0) + 1);
    }

    // Build my entry map
    const myEntryMap = new Map<string, TournamentParticipant>();
    for (const row of (myEntriesResult.data ?? []) as TournamentParticipant[]) {
      myEntryMap.set(row.tournament_id, row);
    }

    return tournaments.map(t => ({
      ...t,
      participant_count: countMap.get(t.id) ?? 0,
      my_entry: myEntryMap.get(t.id) ?? null,
    })) as Tournament[];
  }

  async getTournament(tournamentId: string, userId: string): Promise<Tournament | null> {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (error || !data) return null;

    const { data: myEntry } = await supabase
      .from('tournament_participants')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId)
      .maybeSingle();

    const { count } = await supabase
      .from('tournament_participants')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId);

    return {
      ...data,
      participant_count: count ?? 0,
      my_entry: myEntry ?? null,
    } as Tournament;
  }

  // ── Join ─────────────────────────────────────────────────────────────────────

  async joinTournament(tournamentId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('tournament_participants')
      .insert({ tournament_id: tournamentId, user_id: userId });

    return !error;
  }

  // ── Submit result ─────────────────────────────────────────────────────────────

  /**
   * Submit a result for all active tournaments of the matching type.
   * Only updates if the new result is better than the stored one.
   * Returns tournament IDs that were updated (for UI notifications).
   */
  async submitResult(
    userId: string,
    type: TournamentType,
    result: number
  ): Promise<string[]> {
    try {
      // Find active tournaments of this type where user is a participant
      const now = new Date().toISOString();
      const { data: participants } = await supabase
        .from('tournament_participants')
        .select('id, tournament_id, best_result, tournaments:tournament_id(type, status, start_at, end_at)')
        .eq('user_id', userId);

      if (!participants) return [];

      const updated: string[] = [];

      for (const p of participants as any[]) {
        const t = p.tournaments;
        if (!t) continue;
        if (t.type !== type) continue;
        if (t.status !== 'active') continue;
        if (new Date(t.start_at) > new Date(now)) continue;
        if (new Date(t.end_at) < new Date(now)) continue;

        if (!isNewResultBetter(type, result, p.best_result)) continue;

        await supabase
          .from('tournament_participants')
          .update({ best_result: result, updated_at: now })
          .eq('id', p.id);

        updated.push(p.tournament_id);
      }

      return updated;
    } catch (err) {
      console.error('TournamentService.submitResult:', err);
      return [];
    }
  }

  // ── Leaderboard ───────────────────────────────────────────────────────────────

  async getLeaderboard(
    tournamentId: string,
    type: TournamentType,
    limit = 100
  ): Promise<TournamentLeaderboardEntry[]> {
    // For sprints: ascending (lower time), for speed/distance: descending
    const ascending = type === 'sprint_0_100' || type === 'sprint_100_200';

    const { data, error } = await supabase
      .from('tournament_participants')
      .select(`
        user_id,
        best_result,
        xp_awarded,
        profiles:user_id (display_name, username, level)
      `)
      .eq('tournament_id', tournamentId)
      .not('best_result', 'is', null)
      .order('best_result', { ascending })
      .limit(limit);

    if (error || !data) return [];

    return (data as any[]).map((row, i) => ({
      userId: row.user_id,
      displayName: row.profiles?.display_name || row.profiles?.username || 'Driver',
      username: row.profiles?.username || '',
      level: row.profiles?.level || 1,
      bestResult: row.best_result,
      rank: i + 1,
      xpAwarded: row.xp_awarded ?? 0,
    }));
  }

  // ── Reward claiming ───────────────────────────────────────────────────────────

  async claimReward(tournamentId: string, userId: string): Promise<number> {
    const { data } = await supabase
      .from('tournament_participants')
      .select('xp_awarded, reward_claimed')
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId)
      .single();

    if (!data || data.reward_claimed || !data.xp_awarded) return 0;

    await supabase
      .from('tournament_participants')
      .update({ reward_claimed: true })
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId);

    return data.xp_awarded;
  }

  // ── Admin: finalize ───────────────────────────────────────────────────────────

  /**
   * Finalize a completed tournament: assign ranks and XP rewards.
   * Normally run by an admin/scheduled function, but exposed here for testing.
   */
  async finalizeTournament(tournamentId: string): Promise<void> {
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('type, prize_xp_1st, prize_xp_2nd, prize_xp_3rd, prize_xp_participation')
      .eq('id', tournamentId)
      .single();

    if (!tournament) return;

    const ascending =
      tournament.type === 'sprint_0_100' || tournament.type === 'sprint_100_200';

    const { data: participants } = await supabase
      .from('tournament_participants')
      .select('id, user_id, best_result')
      .eq('tournament_id', tournamentId)
      .not('best_result', 'is', null)
      .order('best_result', { ascending });

    if (!participants) return;

    const prizes = [
      tournament.prize_xp_1st,
      tournament.prize_xp_2nd,
      tournament.prize_xp_3rd,
    ];

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const rank = i + 1;
      const xp = prizes[i] ?? tournament.prize_xp_participation;

      await supabase
        .from('tournament_participants')
        .update({ rank, xp_awarded: xp })
        .eq('id', p.id);

      await profileService.addXP(p.user_id, xp);
    }

    await supabase
      .from('tournaments')
      .update({ status: 'completed' })
      .eq('id', tournamentId);
  }

  // ── My history ────────────────────────────────────────────────────────────────

  async getMyHistory(userId: string): Promise<(TournamentParticipant & { tournament: Tournament })[]> {
    const { data } = await supabase
      .from('tournament_participants')
      .select(`
        *,
        tournaments:tournament_id (*)
      `)
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });

    return ((data ?? []) as any[]).map(row => ({
      ...row,
      tournament: row.tournaments,
    }));
  }
}

export const tournamentService = new TournamentServiceClass();
