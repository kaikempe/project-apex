/**
 * XP & Leveling Service
 *
 * Handles experience points and leveling for:
 * - User profiles (Level 1-100)
 * - Vehicles (Level 1-50)
 *
 * XP is earned from various activities and unlocks rewards at milestones.
 */

export interface XPEvent {
  type: 'drive_complete' | 'segment_complete' | 'speed_trap_record' | 'poi_create' |
        'friend_record_beat' | 'achievement_unlock' | 'daily_challenge' | 'weekly_challenge' | 'custom';
  amount: number;
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface LevelInfo {
  level: number;
  currentXP: number;
  xpForNextLevel: number;
  progress: number; // 0-1
  totalXP: number;
}

export interface LevelReward {
  level: number;
  reward: string;
  type: 'frame' | 'customization' | 'feature' | 'badge';
}

class XPService {
  // XP amounts for different activities
  private readonly XP_AMOUNTS = {
    DRIVE_COMPLETE: 50,
    SEGMENT_COMPLETE: 25,
    SPEED_TRAP_RECORD: 15,
    POI_CREATE: 100,
    FRIEND_RECORD_BEAT: 75,
    DAILY_CHALLENGE: 100,
    WEEKLY_CHALLENGE: 500,

    // Achievement bonuses by tier
    ACHIEVEMENT_BRONZE: 25,
    ACHIEVEMENT_SILVER: 50,
    ACHIEVEMENT_GOLD: 100,
    ACHIEVEMENT_PLATINUM: 250,
  };

  // User profile level caps
  private readonly USER_MAX_LEVEL = 100;
  private readonly VEHICLE_MAX_LEVEL = 50;

  /**
   * Calculate XP required for a specific level
   * Uses exponential scaling: XP = 100 * level^1.5
   */
  private calculateXPForLevel(level: number): number {
    if (level <= 1) return 0;
    return Math.floor(100 * Math.pow(level, 1.5));
  }

  /**
   * Calculate total XP required to reach a level
   */
  private calculateTotalXPForLevel(level: number): number {
    let total = 0;
    for (let i = 1; i < level; i++) {
      total += this.calculateXPForLevel(i + 1);
    }
    return total;
  }

  /**
   * Get XP amount for an activity
   */
  getXPForActivity(event: XPEvent): number {
    switch (event.type) {
      case 'drive_complete':
        return this.XP_AMOUNTS.DRIVE_COMPLETE;
      case 'segment_complete':
        return this.XP_AMOUNTS.SEGMENT_COMPLETE;
      case 'speed_trap_record':
        return this.XP_AMOUNTS.SPEED_TRAP_RECORD;
      case 'poi_create':
        return this.XP_AMOUNTS.POI_CREATE;
      case 'friend_record_beat':
        return this.XP_AMOUNTS.FRIEND_RECORD_BEAT;
      case 'daily_challenge':
        return this.XP_AMOUNTS.DAILY_CHALLENGE;
      case 'weekly_challenge':
        return this.XP_AMOUNTS.WEEKLY_CHALLENGE;
      case 'achievement_unlock':
        switch (event.tier) {
          case 'bronze': return this.XP_AMOUNTS.ACHIEVEMENT_BRONZE;
          case 'silver': return this.XP_AMOUNTS.ACHIEVEMENT_SILVER;
          case 'gold': return this.XP_AMOUNTS.ACHIEVEMENT_GOLD;
          case 'platinum': return this.XP_AMOUNTS.ACHIEVEMENT_PLATINUM;
          default: return 0;
        }
      case 'custom':
        return event.amount ?? 0;
      default:
        return 0;
    }
  }

  /**
   * Calculate level from total XP
   */
  calculateLevel(totalXP: number, maxLevel: number): number {
    let level = 1;
    let xpSoFar = 0;

    while (level < maxLevel) {
      const xpForNext = this.calculateXPForLevel(level + 1);
      if (xpSoFar + xpForNext > totalXP) {
        break;
      }
      xpSoFar += xpForNext;
      level++;
    }

    return level;
  }

  /**
   * Get detailed level information for user profile
   */
  getUserLevelInfo(totalXP: number): LevelInfo {
    const level = this.calculateLevel(totalXP, this.USER_MAX_LEVEL);
    const xpForCurrentLevel = this.calculateTotalXPForLevel(level);
    const xpForNextLevel = this.calculateXPForLevel(level + 1);
    const currentXP = totalXP - xpForCurrentLevel;
    const progress = xpForNextLevel > 0 ? currentXP / xpForNextLevel : 1;

    return {
      level,
      currentXP,
      xpForNextLevel,
      progress: Math.min(progress, 1),
      totalXP,
    };
  }

  /**
   * Get detailed level information for vehicle
   */
  getVehicleLevelInfo(totalXP: number): LevelInfo {
    const level = this.calculateLevel(totalXP, this.VEHICLE_MAX_LEVEL);
    const xpForCurrentLevel = this.calculateTotalXPForLevel(level);
    const xpForNextLevel = this.calculateXPForLevel(level + 1);
    const currentXP = totalXP - xpForCurrentLevel;
    const progress = xpForNextLevel > 0 ? currentXP / xpForNextLevel : 1;

    return {
      level,
      currentXP,
      xpForNextLevel,
      progress: Math.min(progress, 1),
      totalXP,
    };
  }

  /**
   * Add XP and check for level up
   * Returns new total XP and whether a level up occurred
   */
  addXP(
    currentTotalXP: number,
    xpToAdd: number,
    maxLevel: number
  ): { newTotalXP: number; leveledUp: boolean; oldLevel: number; newLevel: number } {
    const oldLevel = this.calculateLevel(currentTotalXP, maxLevel);
    const newTotalXP = currentTotalXP + xpToAdd;
    const newLevel = this.calculateLevel(newTotalXP, maxLevel);

    return {
      newTotalXP,
      leveledUp: newLevel > oldLevel,
      oldLevel,
      newLevel,
    };
  }

  /**
   * Get rewards available at a specific level
   */
  getUserRewardsAtLevel(level: number): LevelReward[] {
    const rewards: LevelReward[] = [];

    // Every 5 levels: Achievement frames
    if (level % 5 === 0 && level > 0) {
      rewards.push({
        level,
        reward: `Achievement Frame ${level / 5}`,
        type: 'frame',
      });
    }

    // Every 10 levels: Profile customization
    if (level % 10 === 0 && level > 0) {
      rewards.push({
        level,
        reward: `Profile Theme ${level / 10}`,
        type: 'customization',
      });
    }

    // Every 25 levels: Special features
    if (level % 25 === 0 && level > 0) {
      rewards.push({
        level,
        reward: 'Exclusive POI Type',
        type: 'feature',
      });
    }

    return rewards;
  }

  /**
   * Get vehicle rewards at a specific level
   */
  getVehicleRewardsAtLevel(level: number): LevelReward[] {
    const rewards: LevelReward[] = [];

    // Every 10 levels: Vehicle badge
    if (level % 10 === 0 && level > 0) {
      rewards.push({
        level,
        reward: `Vehicle Badge Tier ${level / 10}`,
        type: 'badge',
      });
    }

    // Level 25: Advanced stats
    if (level === 25) {
      rewards.push({
        level,
        reward: 'Advanced Stats Tracking',
        type: 'feature',
      });
    }

    // Level 50: Master badge
    if (level === 50) {
      rewards.push({
        level,
        reward: 'Vehicle Master Badge',
        type: 'badge',
      });
    }

    return rewards;
  }

  /**
   * Format XP for display
   */
  formatXP(xp: number): string {
    if (xp >= 1000000) {
      return `${(xp / 1000000).toFixed(1)}M XP`;
    }
    if (xp >= 1000) {
      return `${(xp / 1000).toFixed(1)}K XP`;
    }
    return `${xp} XP`;
  }

  /**
   * Format level with suffix
   */
  formatLevel(level: number): string {
    return `Level ${level}`;
  }

  /**
   * Get level progress as percentage
   */
  getLevelProgressPercentage(levelInfo: LevelInfo): number {
    return Math.round(levelInfo.progress * 100);
  }

  /**
   * Get XP amount for achievement tier
   */
  getAchievementXP(tier: 'bronze' | 'silver' | 'gold' | 'platinum'): number {
    switch (tier) {
      case 'bronze': return this.XP_AMOUNTS.ACHIEVEMENT_BRONZE;
      case 'silver': return this.XP_AMOUNTS.ACHIEVEMENT_SILVER;
      case 'gold': return this.XP_AMOUNTS.ACHIEVEMENT_GOLD;
      case 'platinum': return this.XP_AMOUNTS.ACHIEVEMENT_PLATINUM;
      default: return 0;
    }
  }
}

export const xpService = new XPService();
