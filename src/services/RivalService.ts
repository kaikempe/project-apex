/**
 * Rival Service
 *
 * Up to 3 rivals per user. Tracks head-to-head stats across sprints,
 * XP, and total distance.
 */

import { supabase } from './supabase';
import { notificationService } from './NotificationService';

export interface Rival {
  id: string;
  user_id: string;
  rival_id: string;
  created_at: string;
  // Joined profile of the rival
  rival_profile: {
    id: string;
    username: string;
    display_name: string | null;
    level: number;
    total_xp: number;
    avatar_url: string | null;
  };
}

export interface RivalHeadToHead {
  rivalId: string;
  // Sprint best times (seconds; lower is better)
  my_sprint_0_100: number | null;
  rival_sprint_0_100: number | null;
  my_sprint_100_200: number | null;
  rival_sprint_100_200: number | null;
  // Total XP
  my_xp: number;
  rival_xp: number;
  // Total distance (km)
  my_distance: number;
  rival_distance: number;
  // Derived win counts (per category: sprint0100, sprint100200, xp, distance)
  myWins: number;
  rivalWins: number;
}

class RivalServiceClass {

  async getMyRivals(userId: string): Promise<Rival[]> {
    const { data, error } = await supabase
      .from('rivals')
      .select(`
        id,
        user_id,
        rival_id,
        created_at,
        rival_profile:profiles!rivals_rival_id_fkey (
          id, username, display_name, level, total_xp, avatar_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data as unknown as Rival[];
  }

  async addRival(userId: string, rivalId: string): Promise<boolean> {
    // Enforce max 3 rivals
    const { count } = await supabase
      .from('rivals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if ((count ?? 0) >= 3) return false;

    const { error } = await supabase
      .from('rivals')
      .insert({ user_id: userId, rival_id: rivalId });

    return !error;
  }

  async removeRival(userId: string, rivalId: string): Promise<void> {
    await supabase
      .from('rivals')
      .delete()
      .eq('user_id', userId)
      .eq('rival_id', rivalId);
  }

  async getRivalStats(userId: string, rivalId: string): Promise<RivalHeadToHead> {
    // Fetch both profiles (specs_json has best_times and total_distance)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, total_xp')
      .in('id', [userId, rivalId]);

    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('user_id, specs_json, is_active')
      .in('user_id', [userId, rivalId])
      .eq('is_active', true);

    const myProfile = profiles?.find(p => p.id === userId);
    const rivalProfile = profiles?.find(p => p.id === rivalId);
    const myVehicle = vehicles?.find(v => v.user_id === userId);
    const rivalVehicle = vehicles?.find(v => v.user_id === rivalId);

    const mySpecs = myVehicle?.specs_json ?? {};
    const rivalSpecs = rivalVehicle?.specs_json ?? {};

    const myBests = mySpecs.best_times ?? {};
    const rivalBests = rivalSpecs.best_times ?? {};

    const my0100   = myBests['0-100']   ?? null;
    const rival0100  = rivalBests['0-100']  ?? null;
    const my100200 = myBests['100-200'] ?? null;
    const rival100200 = rivalBests['100-200'] ?? null;

    const myXP    = myProfile?.total_xp ?? 0;
    const rivalXP = rivalProfile?.total_xp ?? 0;

    const myDist    = mySpecs.total_distance ?? 0;
    const rivalDist = rivalSpecs.total_distance ?? 0;

    // Count wins (4 categories)
    let myWins = 0;
    let rivalWins = 0;

    // Sprint 0-100: lower is better
    if (my0100 !== null && rival0100 !== null) {
      if (my0100 < rival0100) myWins++;
      else if (rival0100 < my0100) rivalWins++;
    }
    // Sprint 100-200: lower is better
    if (my100200 !== null && rival100200 !== null) {
      if (my100200 < rival100200) myWins++;
      else if (rival100200 < my100200) rivalWins++;
    }
    // XP: higher is better
    if (myXP > rivalXP) myWins++;
    else if (rivalXP > myXP) rivalWins++;
    // Distance: higher is better
    if (myDist > rivalDist) myWins++;
    else if (rivalDist > myDist) rivalWins++;

    return {
      rivalId,
      my_sprint_0_100: my0100,
      rival_sprint_0_100: rival0100,
      my_sprint_100_200: my100200,
      rival_sprint_100_200: rival100200,
      my_xp: myXP,
      rival_xp: rivalXP,
      my_distance: myDist,
      rival_distance: rivalDist,
      myWins,
      rivalWins,
    };
  }

  async notifyRivalBeaten(
    toUserId: string,
    beaterUserId: string,
    beaterName: string,
    category: string
  ): Promise<void> {
    await notificationService.createNotification(
      toUserId,
      'rival_record_beaten',
      'Rival Beat Your Record! 🏁',
      `${beaterName} just beat your ${category} personal best`,
      { beater_user_id: beaterUserId, category }
    );
  }
}

export const rivalService = new RivalServiceClass();
