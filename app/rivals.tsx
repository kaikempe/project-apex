import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Swords, X } from 'lucide-react-native';
import { Colors } from '@/src/theme/colors';
import { useRivals } from '@/src/context/RivalContext';
import { useFriends } from '@/src/context/FriendsContext';
import { RivalCard } from '@/src/components/RivalCard';

export default function RivalsScreen() {
  const router = useRouter();
  const { rivals, rivalStats, loading, canAddMore, addRival, removeRival, refresh } = useRivals();
  const { friends } = useFriends();

  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleRemove = useCallback((rivalId: string, name: string) => {
    Alert.alert(
      'Remove Rival',
      `Remove ${name} as a rival?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeRival(rivalId),
        },
      ]
    );
  }, [removeRival]);

  const handleAddRival = useCallback(async (friendId: string) => {
    setAddingId(friendId);
    const ok = await addRival(friendId);
    setAddingId(null);
    if (!ok) {
      Alert.alert('Error', 'Could not add rival. You may already have 3 rivals.');
    } else {
      setShowAddModal(false);
    }
  }, [addRival]);

  // Friends that are not already rivals
  const rivalIds = new Set(rivals.map(r => r.rival_id));
  const availableFriends = friends.filter(f => !rivalIds.has(f.friend_id));

  // Overall W/L summary
  const totalWins   = Array.from(rivalStats.values()).reduce((sum, s) => sum + s.myWins, 0);
  const totalLosses = Array.from(rivalStats.values()).reduce((sum, s) => sum + s.rivalWins, 0);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Swords size={18} color={Colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.headerTitle}>Rivals</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, !canAddMore && styles.addBtnDisabled]}
          onPress={() => canAddMore && setShowAddModal(true)}
          disabled={!canAddMore}
        >
          <Plus size={20} color={canAddMore ? Colors.primary : Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        >
          {rivals.length === 0 ? (
            <View style={styles.emptyState}>
              <Swords size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>No Rivals Yet</Text>
              <Text style={styles.emptySubtitle}>
                Add up to 3 rivals to track head-to-head stats
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => setShowAddModal(true)}
              >
                <Plus size={16} color="#000" style={{ marginRight: 6 }} />
                <Text style={styles.emptyBtnText}>Add a Rival</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* W/L summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Overall Record</Text>
                <View style={styles.summaryScore}>
                  <Text style={[styles.summaryNum, { color: '#30D158' }]}>{totalWins}</Text>
                  <Text style={styles.summarySep}> — </Text>
                  <Text style={[styles.summaryNum, { color: '#FF453A' }]}>{totalLosses}</Text>
                </View>
                <Text style={styles.summarySubLabel}>Wins — Losses</Text>
                <Text style={styles.summaryCaption}>{rivals.length}/3 rivals</Text>
              </View>

              {rivals.map(rival => (
                <RivalCard
                  key={rival.id}
                  rival={rival}
                  stats={rivalStats.get(rival.rival_id) ?? null}
                  onRemove={() =>
                    handleRemove(
                      rival.rival_id,
                      rival.rival_profile.display_name || rival.rival_profile.username
                    )
                  }
                />
              ))}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Add Rival Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add a Rival</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <X size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          {availableFriends.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptySubtitle}>
                {friends.length === 0
                  ? 'Add friends first to challenge them as rivals'
                  : 'All your friends are already rivals'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={availableFriends}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => {
                const name =
                  item.profiles?.display_name || item.profiles?.username || 'Unknown';
                const isAdding = addingId === item.friend_id;
                return (
                  <TouchableOpacity
                    style={styles.friendRow}
                    onPress={() => handleAddRival(item.friend_id)}
                    disabled={isAdding}
                    activeOpacity={0.7}
                  >
                    <View style={styles.friendAvatar}>
                      <Text style={styles.friendAvatarText}>
                        {name.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.friendName}>{name}</Text>
                    {isAdding ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <View style={styles.addRivalBtn}>
                        <Swords size={14} color="#000" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backBtn: { padding: 4 },
  headerCenter: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  addBtn: { padding: 4 },
  addBtnDisabled: { opacity: 0.3 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  emptyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  emptyBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },

  summaryCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
  },
  summaryLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 8 },
  summaryScore: { flexDirection: 'row', alignItems: 'center' },
  summaryNum: { fontSize: 36, fontWeight: '800' },
  summarySep: { color: Colors.textSecondary, fontSize: 24 },
  summarySubLabel: { color: Colors.textSecondary, fontSize: 11, marginTop: 4 },
  summaryCaption: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    backgroundColor: Colors.primary + '22',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },

  // Modal
  modalSafe: { flex: 1, backgroundColor: '#0A0A0A' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },

  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    gap: 12,
  },
  friendAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  friendName: { color: '#FFF', fontSize: 15, fontWeight: '600', flex: 1 },
  addRivalBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    padding: 8,
  },
});
