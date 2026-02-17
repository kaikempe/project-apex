import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/src/theme/colors';
import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/services/supabase';
import {
  ArrowLeft,
  Search,
  UserPlus,
  UserCheck,
  UserX,
  Users,
  Clock,
  X,
  Check,
} from 'lucide-react-native';

interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  profiles?: Profile;
}

type Tab = 'friends' | 'requests' | 'search';

export default function FriendsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Data
  const [friends, setFriends] = useState<(Friendship & { profile: Profile })[]>([]);
  const [pendingRequests, setPendingRequests] = useState<(Friendship & { profile: Profile })[]>([]);
  const [sentRequests, setSentRequests] = useState<(Friendship & { profile: Profile })[]>([]);
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch all friend data
  const fetchFriendData = useCallback(async () => {
    if (!user) return;
    
    try {
      // Fetch accepted friends (where I'm the sender)
      const { data: friendsAsSender } = await supabase
        .from('friendships')
        .select('*, profiles:friend_id(id, username, display_name, avatar_url)')
        .eq('user_id', user.id)
        .eq('status', 'accepted');
      
      // Fetch accepted friends (where I'm the receiver)
      const { data: friendsAsReceiver } = await supabase
        .from('friendships')
        .select('*, profiles:user_id(id, username, display_name, avatar_url)')
        .eq('friend_id', user.id)
        .eq('status', 'accepted');
      
      // Combine and format friends
      const allFriends = [
        ...(friendsAsSender || []).map(f => ({ ...f, profile: f.profiles })),
        ...(friendsAsReceiver || []).map(f => ({ ...f, profile: f.profiles })),
      ];
      setFriends(allFriends);
      
      // Fetch pending requests I've received
      const { data: received } = await supabase
        .from('friendships')
        .select('*, profiles:user_id(id, username, display_name, avatar_url)')
        .eq('friend_id', user.id)
        .eq('status', 'pending');
      
      setPendingRequests((received || []).map(r => ({ ...r, profile: r.profiles })));
      
      // Fetch requests I've sent
      const { data: sent } = await supabase
        .from('friendships')
        .select('*, profiles:friend_id(id, username, display_name, avatar_url)')
        .eq('user_id', user.id)
        .eq('status', 'pending');
      
      setSentRequests((sent || []).map(s => ({ ...s, profile: s.profiles })));
      
    } catch (error) {
      console.error('Error fetching friend data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchFriendData();
  }, [fetchFriendData]);

  // Pull to refresh
  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchFriendData();
    setIsRefreshing(false);
  };

  // Search for users
  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;
    
    setIsSearching(true);
    
    try {
      // Search by username or display name
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .neq('id', user.id) // Exclude self
        .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
        .limit(20);
      
      if (error) throw error;
      
      setSearchResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Failed to search users');
    } finally {
      setIsSearching(false);
    }
  };

  // Send friend request
  const sendRequest = async (friendId: string) => {
    if (!user) return;
    
    try {
      // Check if friendship already exists
      const { data: existing } = await supabase
        .from('friendships')
        .select('id, status')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`)
        .single();
      
      if (existing) {
        if (existing.status === 'accepted') {
          Alert.alert('Already Friends', 'You are already friends with this user.');
        } else if (existing.status === 'pending') {
          Alert.alert('Request Pending', 'A friend request is already pending.');
        }
        return;
      }
      
      // Send request
      const { error } = await supabase
        .from('friendships')
        .insert({
          user_id: user.id,
          friend_id: friendId,
          status: 'pending',
        });
      
      if (error) throw error;
      
      Alert.alert('Request Sent', 'Friend request sent successfully!');
      await fetchFriendData();
      
    } catch (error: any) {
      console.error('Send request error:', error);
      if (error.code === '23505') {
        Alert.alert('Already Sent', 'You already sent a request to this user.');
      } else {
        Alert.alert('Error', 'Failed to send friend request');
      }
    }
  };

  // Accept friend request
  const acceptRequest = async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);
      
      if (error) throw error;
      
      await fetchFriendData();
    } catch (error) {
      console.error('Accept error:', error);
      Alert.alert('Error', 'Failed to accept request');
    }
  };

  // Decline/cancel friend request
  const declineRequest = async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);
      
      if (error) throw error;
      
      await fetchFriendData();
    } catch (error) {
      console.error('Decline error:', error);
      Alert.alert('Error', 'Failed to decline request');
    }
  };

  // Remove friend
  const removeFriend = async (friendshipId: string, friendName: string) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friendName} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('friendships')
                .delete()
                .eq('id', friendshipId);
              
              if (error) throw error;
              
              await fetchFriendData();
            } catch (error) {
              console.error('Remove error:', error);
              Alert.alert('Error', 'Failed to remove friend');
            }
          },
        },
      ]
    );
  };

  // Check if user is already friend or has pending request
  const getFriendshipStatus = (userId: string): 'none' | 'friend' | 'pending_sent' | 'pending_received' => {
    if (friends.some(f => f.profile?.id === userId)) return 'friend';
    if (sentRequests.some(r => r.profile?.id === userId)) return 'pending_sent';
    if (pendingRequests.some(r => r.profile?.id === userId)) return 'pending_received';
    return 'none';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Friends</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
          onPress={() => setActiveTab('friends')}
        >
          <Users size={18} color={activeTab === 'friends' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
            Friends ({friends.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Clock size={18} color={activeTab === 'requests' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
            Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'search' && styles.tabActive]}
          onPress={() => setActiveTab('search')}
        >
          <Search size={18} color={activeTab === 'search' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>
            Search
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Friends Tab */}
        {activeTab === 'friends' && (
          <>
            {friends.length === 0 ? (
              <View style={styles.emptyState}>
                <Users size={48} color={Colors.textSecondary} />
                <Text style={styles.emptyText}>No friends yet</Text>
                <Text style={styles.emptySubtext}>Search for users to add them</Text>
              </View>
            ) : (
              friends.map((friendship) => (
                <View key={friendship.id} style={styles.userCard}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {friendship.profile?.display_name?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                      {friendship.profile?.display_name || 'Unknown'}
                    </Text>
                    {friendship.profile?.username && (
                      <Text style={styles.userHandle}>@{friendship.profile.username}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeFriend(friendship.id, friendship.profile?.display_name || 'this user')}
                  >
                    <UserX size={20} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          <>
            {/* Incoming Requests */}
            {pendingRequests.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Incoming Requests</Text>
                {pendingRequests.map((request) => (
                  <View key={request.id} style={styles.userCard}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {request.profile?.display_name?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>
                        {request.profile?.display_name || 'Unknown'}
                      </Text>
                      {request.profile?.username && (
                        <Text style={styles.userHandle}>@{request.profile.username}</Text>
                      )}
                    </View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={[styles.requestButton, styles.acceptButton]}
                        onPress={() => acceptRequest(request.id)}
                      >
                        <Check size={18} color={Colors.textPrimary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.requestButton, styles.declineButton]}
                        onPress={() => declineRequest(request.id)}
                      >
                        <X size={18} color={Colors.textPrimary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Sent Requests */}
            {sentRequests.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Sent Requests</Text>
                {sentRequests.map((request) => (
                  <View key={request.id} style={styles.userCard}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {request.profile?.display_name?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>
                        {request.profile?.display_name || 'Unknown'}
                      </Text>
                      {request.profile?.username && (
                        <Text style={styles.userHandle}>@{request.profile.username}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => declineRequest(request.id)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {pendingRequests.length === 0 && sentRequests.length === 0 && (
              <View style={styles.emptyState}>
                <Clock size={48} color={Colors.textSecondary} />
                <Text style={styles.emptyText}>No pending requests</Text>
              </View>
            )}
          </>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <>
            {/* Search Input */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Search size={20} color={Colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by username or name..."
                  placeholderTextColor={Colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                  autoCapitalize="none"
                />
              </View>
              <TouchableOpacity
                style={styles.searchButton}
                onPress={handleSearch}
                disabled={isSearching}
              >
                {isSearching ? (
                  <ActivityIndicator size="small" color={Colors.textPrimary} />
                ) : (
                  <Text style={styles.searchButtonText}>Search</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Search Results */}
            {searchResults.length > 0 ? (
              searchResults.map((profile) => {
                const status = getFriendshipStatus(profile.id);
                
                return (
                  <View key={profile.id} style={styles.userCard}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {profile.display_name?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>
                        {profile.display_name || 'Unknown'}
                      </Text>
                      {profile.username && (
                        <Text style={styles.userHandle}>@{profile.username}</Text>
                      )}
                    </View>
                    
                    {status === 'none' && (
                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => sendRequest(profile.id)}
                      >
                        <UserPlus size={20} color={Colors.primary} />
                      </TouchableOpacity>
                    )}
                    
                    {status === 'friend' && (
                      <View style={styles.statusBadge}>
                        <UserCheck size={16} color={Colors.success} />
                        <Text style={styles.statusText}>Friends</Text>
                      </View>
                    )}
                    
                    {status === 'pending_sent' && (
                      <View style={styles.statusBadge}>
                        <Clock size={16} color={Colors.warning} />
                        <Text style={styles.statusText}>Pending</Text>
                      </View>
                    )}
                    
                    {status === 'pending_received' && (
                      <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: Colors.success }]}
                        onPress={() => {
                          const request = pendingRequests.find(r => r.profile?.id === profile.id);
                          if (request) acceptRequest(request.id);
                        }}
                      >
                        <Check size={20} color={Colors.textPrimary} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            ) : searchQuery && !isSearching ? (
              <View style={styles.emptyState}>
                <Search size={48} color={Colors.textSecondary} />
                <Text style={styles.emptyText}>No users found</Text>
                <Text style={styles.emptySubtext}>Try a different search term</Text>
              </View>
            ) : null}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.secondary,
  },
  tabActive: {
    backgroundColor: Colors.primary + '20',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 12,
    marginTop: 8,
  },

  // User Card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  userHandle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Actions
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.danger + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  requestButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: Colors.success,
  },
  declineButton: {
    backgroundColor: Colors.danger,
  },
  cancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  cancelButtonText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  statusText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  searchButton: {
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
});
