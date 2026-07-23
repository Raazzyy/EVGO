import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import Animated, { FadeInDown } from 'react-native-reanimated';

const API = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : '/api';

function useFavorites(userId: string | undefined) {
  return useQuery({
    queryKey: ['favorites', userId],
    queryFn: async () => {
      const r = await fetch(`${API}/favorites?user_id=${encodeURIComponent(userId ?? '')}`);
      if (!r.ok) throw new Error('Fetch failed');
      return r.json() as Promise<any[]>;
    },
    enabled: !!userId,
  });
}

function useRemoveFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, stationId }: { userId: string; stationId: number }) => {
      const r = await fetch(`${API}/favorites/${stationId}?user_id=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      if (!r.ok && r.status !== 204) throw new Error('Delete failed');
    },
    onSuccess: (_d, { userId }) => {
      qc.invalidateQueries({ queryKey: ['favorites', userId] });
    },
  });
}

export default function FavoritesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId } = useApp();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { data: stations = [], isLoading, refetch } = useFavorites(userId ?? undefined);
  const removeMutation = useRemoveFavorite();

  const handleRemove = useCallback((stationId: number, name: string) => {
    Alert.alert(
      'Удалить из избранного?',
      `«${name}» будет убрана из вашего списка.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => removeMutation.mutate({ userId: userId!, stationId }),
        },
      ],
    );
  }, [userId, removeMutation]);

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.8}
        onPress={() => router.push(`/station/${item.id}`)}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
          <Feather name="zap" size={20} color={colors.primary} />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.cardAddr, { color: colors.mutedForeground }]} numberOfLines={1}>{item.address}</Text>
          <View style={styles.cardMeta}>
            <View style={[styles.statusDot, { backgroundColor: item.status === 'free' ? '#22C55E' : item.status === 'occupied' ? '#F59E0B' : '#94A3B8' }]} />
            <Text style={[styles.cardMetaText, { color: colors.mutedForeground }]}>
              {item.status === 'free' ? 'Свободна' : item.status === 'occupied' ? 'Занята' : 'Оффлайн'}
            </Text>
            <Text style={[styles.cardMetaText, { color: colors.mutedForeground }]}>·</Text>
            <Text style={[styles.cardMetaText, { color: colors.mutedForeground }]}>{item.power_kw} кВт</Text>
            <Text style={[styles.cardMetaText, { color: colors.mutedForeground }]}>·</Text>
            <Text style={[styles.cardMetaText, { color: colors.primary }]}>
              {item.price_per_kwh?.toLocaleString('ru-RU')} сум/кВт·ч
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => handleRemove(item.id, item.name)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.heartBtn}
        >
          <Feather name="heart" size={20} color="#EF4444" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Избранные станции</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : stations.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted }]}>
            <Feather name="heart" size={32} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Нет избранных станций</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Нажмите ♡ на странице станции, чтобы добавить её сюда
          </Text>
        </View>
      ) : (
        <FlatList
          data={stations}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  emptyDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardContent: { flex: 1, gap: 3 },
  cardName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  cardAddr: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  cardMetaText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  heartBtn: { padding: 4 },
});
