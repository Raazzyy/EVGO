import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';

const MOCK_NOTIFICATIONS = [
  { id:1, type:'session_ended', title:'Сессия завершена', body:'Зарядка на IONITY Premium успешно завершена.', created_at: new Date(Date.now()-3*60000).toISOString(), read: true },
  { id:2, type:'low_battery', title:'Низкий уровень заряда', body:'Уровень заряда ниже 20%! Найдите ближайшую станцию.', created_at: new Date(Date.now()-86400000).toISOString(), read: true },
  { id:3, type:'discount_nearby', title:'Скидка рядом', body:'IONITY Premium -10% на зарядку до 31 мая.', created_at: new Date(Date.now()-86400000).toISOString(), read: false },
  { id:4, type:'station_available', title:'Станция снова доступна', body:'Kapital Electro снова доступна (свободно 2/4).', created_at: new Date(Date.now()-2*86400000).toISOString(), read: true },
  { id:5, type:'payment', title:'Платёж выполнен', body:'Оплата 54 145 сум прошла успешно.', created_at: new Date(Date.now()-2*86400000).toISOString(), read: true },
];

function getNotificationStyle(type: string) {
  switch (type) {
    case 'session_ended': return { color: '#10B981', icon: 'zap' as const };
    case 'discount_nearby': return { color: '#EC4899', icon: 'percent' as const };
    case 'station_available': return { color: '#2FD08A', icon: 'map-pin' as const };
    case 'low_battery': return { color: '#F59E0B', icon: 'alert-triangle' as const };
    default: return { color: '#14B8A6', icon: 'credit-card' as const };
  }
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 3600000) return 'сейчас';
  if (diff < 86400000 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 172800000 && now.getDate() - date.getDate() === 1) return 'Вчера';
  return `${Math.floor(diff / 86400000)} дн. назад`;
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const topPad = Platform.OS === 'web' ? 20 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: '#F7F8FA' }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: '#FFFFFF' }]}>
        <TouchableOpacity onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Назад" style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Уведомления</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {MOCK_NOTIFICATIONS.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.muted }]}>
              <Feather name="bell" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Нет уведомлений</Text>
          </View>
        ) : (
          MOCK_NOTIFICATIONS.map((item) => {
            const { color, icon } = getNotificationStyle(item.type);
            return (
              <View key={item.id} style={[styles.card, { backgroundColor: '#FFFFFF' }]}>
                <View style={[styles.iconCircle, { backgroundColor: color + '1A' }]}>
                  <Feather name={icon} size={18} color={color} />
                </View>
                <View style={styles.content}>
                  <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.body, { color: colors.mutedForeground }]}>{item.body}</Text>
                </View>
                <View style={styles.rightInfo}>
                  <Text style={[styles.time, { color: colors.mutedForeground }]}>{formatTime(item.created_at)}</Text>
                  {!item.read && <View style={[styles.unreadDot, { backgroundColor: '#2FD08A' }]} />}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  body: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  rightInfo: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  time: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
});
