/**
 * Notification Service
 *
 * Manages push notifications and in-app notification center.
 * Handles notification tokens, creating notifications, and preferences.
 */

import { supabase } from './supabase';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type NotificationType =
  | 'friend_request_received'
  | 'friend_request_accepted'
  | 'achievement_unlocked'
  | 'level_up'
  | 'daily_streak_reminder'
  | 'convoy_invite'
  | 'challenge_completed'
  | 'milestone_reached'
  | 'rival_record_beaten'
  | 'tournament_ended'
  | 'system';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  friend_requests: boolean;
  achievements: boolean;
  level_ups: boolean;
  daily_reminders: boolean;
  convoy_invites: boolean;
  challenges: boolean;
  push_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationServiceClass {
  /**
   * Request notification permissions and register device token
   */
  async registerForPushNotifications(userId: string): Promise<string | null> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission denied');
        return null;
      }

      // Get push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'your-expo-project-id', // TODO: Replace with actual project ID
      });

      const token = tokenData.data;

      // Save token to database
      await this.saveDeviceToken(userId, token);

      return token;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  /**
   * Save device token to database
   */
  async saveDeviceToken(userId: string, token: string): Promise<void> {
    const deviceType = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

    const { error } = await supabase
      .from('notification_tokens')
      .upsert({
        user_id: userId,
        token,
        device_type: deviceType,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error saving device token:', error);
    }
  }

  /**
   * Remove device token (on logout)
   */
  async removeDeviceToken(userId: string, token: string): Promise<void> {
    const { error } = await supabase
      .from('notification_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', token);

    if (error) {
      console.error('Error removing device token:', error);
    }
  }

  /**
   * Create notification for user
   */
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data: Record<string, any> = {}
  ): Promise<string | null> {
    try {
      const { data: result, error } = await supabase.rpc('create_notification', {
        p_user_id: userId,
        p_type: type,
        p_title: title,
        p_body: body,
        p_data: data,
      });

      if (error) throw error;
      return result as string;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }

  /**
   * Get user's notifications
   */
  async getNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('get_unread_count', {
        p_user_id: userId,
      });

      if (error) throw error;
      return (data as number) || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId,
      });

      if (error) throw error;
      return data as boolean;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('mark_all_notifications_read', {
        p_user_id: userId,
      });

      if (error) throw error;
      return (data as number) || 0;
    } catch (error) {
      console.error('Error marking all as read:', error);
      return 0;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('Error deleting notification:', error);
      return false;
    }

    return true;
  }

  /**
   * Get user's notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences | null> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching preferences:', error);
      return null;
    }

    return data;
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<boolean> {
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error updating preferences:', error);
      return false;
    }

    return true;
  }

  /**
   * Subscribe to new notifications
   */
  subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
    return supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload.new as Notification);
        }
      )
      .subscribe();
  }

  /**
   * Send local notification (when app is open)
   */
  async sendLocalNotification(title: string, body: string, data?: Record<string, any>): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null, // Show immediately
    });
  }

  /**
   * Helper: Create friend request notification
   */
  async notifyFriendRequest(userId: string, fromUserId: string, fromUsername: string): Promise<void> {
    await this.createNotification(
      userId,
      'friend_request_received',
      'New Friend Request',
      `${fromUsername} wants to be your friend`,
      { from_user_id: fromUserId }
    );
  }

  /**
   * Helper: Create friend request accepted notification
   */
  async notifyFriendRequestAccepted(userId: string, acceptedByUserId: string, acceptedByUsername: string): Promise<void> {
    await this.createNotification(
      userId,
      'friend_request_accepted',
      'Friend Request Accepted',
      `${acceptedByUsername} accepted your friend request`,
      { accepted_by_user_id: acceptedByUserId }
    );
  }

  /**
   * Helper: Create achievement unlocked notification
   */
  async notifyAchievementUnlocked(userId: string, achievementName: string, achievementId: string): Promise<void> {
    await this.createNotification(
      userId,
      'achievement_unlocked',
      'Achievement Unlocked! 🏆',
      achievementName,
      { achievement_id: achievementId }
    );
  }

  /**
   * Helper: Create level up notification
   */
  async notifyLevelUp(userId: string, newLevel: number): Promise<void> {
    await this.createNotification(
      userId,
      'level_up',
      'Level Up! 🎉',
      `You reached Level ${newLevel}!`,
      { level: newLevel }
    );
  }

  /**
   * Helper: Create daily streak reminder
   */
  async notifyDailyStreakReminder(userId: string, streakDays: number): Promise<void> {
    await this.createNotification(
      userId,
      'daily_streak_reminder',
      'Keep Your Streak! 🔥',
      `Don't lose your ${streakDays}-day streak! Drive today.`,
      { streak_days: streakDays }
    );
  }

  /**
   * Helper: Create convoy invite notification
   */
  async notifyConvoyInvite(userId: string, convoyName: string, invitedByUsername: string, convoyId: string): Promise<void> {
    await this.createNotification(
      userId,
      'convoy_invite',
      'Convoy Invite',
      `${invitedByUsername} invited you to join ${convoyName}`,
      { convoy_id: convoyId }
    );
  }
}

export const notificationService = new NotificationServiceClass();
