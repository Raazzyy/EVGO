import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetUser, useGetSessions } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { formatAmount } from '@/lib/format';

interface MenuItem {
  icon: string;
  label: string;
  desc: string;
  onPress?: () => void;
}

const VERSION = '1.0.0';

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userId, userMembership } = useApp();
  const router = useRouter();

  // @ts-ignore - keeping existing pattern
  const { data: user, isLoading } = useGetUser(userId);
  const { data: sessions = [] } = useGetSessions({ user_id: userId });

  const completedSessions = sessions.filter((s) => s.status === 'completed');
  const totalEnergy = completedSessions.reduce((acc, s) => acc + (s.energy_kwh ?? 0), 0);
  const totalCost = completedSessions.reduce((acc, s) => acc + (s.cost ?? 0), 0);
  const co2Saved = totalEnergy * 0.4;

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const menuItems: MenuItem[] = [
    { icon: 'activity',    label: 'История сессий',    desc: `${completedSessions.length} сессий`,       onPress: () => router.push('/sessions') },
    { icon: 'heart',       label: 'Избранные станции', desc: 'Сохраненные локации',                       onPress: () => router.push('/favorites') },
    { icon: 'cpu',         label: 'Мои автомобили',    desc: 'Управление электромобилями',                onPress: () => router.push('/cars') },
    { icon: 'settings',    label: 'Настройки',         desc: 'Предпочтения приложения',                   onPress: () => router.push('/settings') },
    { icon: 'headphones',  label: 'Поддержка',         desc: 'Служба заботы о клиентах',                  onPress: () => router.push('/support') },
    { icon: 'info',        label: 'О приложении',      desc: `iON Charge v${VERSION}`,                    onPress: () => router.push('/about') },
  ];

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const nameParts = (user?.name ?? 'Akbar').split(' ');
  const initials = nameParts.length > 1 
    ? `${nameParts[0][0]}${nameParts[1][0]}` 
    : (nameParts[0][0] ?? 'A');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: '#F7F8FA' }]}
      contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['#2563EB', '#7C3AED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: topPad + 16 }]}
      >
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={[styles.avatarText, { color: '#2563EB' }]}>
              {initials.toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name ?? 'Akbar Pulatov'}</Text>
            <Text style={styles.userEmail}>{user?.email ?? 'akbar.pulatov@example.com'}</Text>
          </View>
          <View style={styles.premiumBadge}>
            <Feather name="star" size={12} color="#F59E0B" />
            <Text style={styles.premiumText}>iON Premium</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={[styles.statsRow, { backgroundColor: '#FFFFFF' }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {completedSessions.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Сессии</Text>
          <Text style={styles.statSubLabel}>за этот месяц</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatAmount(totalCost)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Потрачено сум</Text>
          <Text style={styles.statSubLabel}>за этот месяц</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {co2Saved.toFixed(0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>кг CO₂ экономия</Text>
          <Text style={styles.statSubLabel}>за этот месяц</Text>
        </View>
      </View>

      <View style={[styles.menuCard, { backgroundColor: '#FFFFFF' }]}>
        {menuItems.map((item, i) => (
          <TouchableOpacity
            key={item.label}
            onPress={item.onPress}
            activeOpacity={0.7}
            style={[
              styles.menuItem,
              i < menuItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.muted }]}>
              <Feather name={item.icon as any} size={18} color={colors.primary} />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
              <Text style={[styles.menuDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.version, { color: colors.mutedForeground }]}>
        iON · v1.0.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  userEmail: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  premiumText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  statSubLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#94A3B8', marginTop: -2 },
  statDivider: { width: 1, height: 40, alignSelf: 'center' },
  menuCard: {
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  menuDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  version: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
  },
});
