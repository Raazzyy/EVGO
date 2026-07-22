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

interface MenuItem {
  icon: string;
  label: string;
  desc: string;
  onPress?: () => void;
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userId, userMembership } = useApp();

  const { data: user, isLoading } = useGetUser({ id: userId });
  const { data: sessions = [] } = useGetSessions({ user_id: userId });

  const completedSessions = sessions.filter((s) => s.status === 'completed');
  const totalEnergy = completedSessions.reduce((acc, s) => acc + (s.energy_kwh ?? 0), 0);
  const totalCost = completedSessions.reduce((acc, s) => acc + (s.cost ?? 0), 0);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const menuItems: MenuItem[] = [
    { icon: 'activity', label: 'Session History', desc: `${completedSessions.length} sessions` },
    { icon: 'map-pin', label: 'Favorite Stations', desc: 'Saved locations' },
    { icon: 'cpu', label: 'My Vehicles', desc: 'Manage your EVs' },
    { icon: 'headphones', label: 'Support', desc: 'Get help' },
    { icon: 'settings', label: 'Settings', desc: 'Preferences' },
  ];

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header gradient */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: topPad + 16 }]}
      >
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name ?? 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name ?? 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
          {userMembership === 'premium' && (
            <View style={styles.premiumBadge}>
              <Feather name="star" size={12} color="#F59E0B" />
              <Text style={styles.premiumText}>Premium</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Stats */}
      <View style={[styles.statsRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {user?.total_sessions ?? completedSessions.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Sessions</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {(user?.total_energy_kwh ?? totalEnergy).toFixed(0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>kWh</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {(user?.co2_saved_kg ?? 0).toFixed(0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>kg CO₂</Text>
        </View>
      </View>

      {/* Total spend card */}
      <View style={[styles.spendCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View>
          <Text style={[styles.spendLabel, { color: colors.mutedForeground }]}>Total Spent</Text>
          <Text style={[styles.spendValue, { color: colors.text }]}>
            {Math.round(user?.total_spent ?? totalCost).toLocaleString()} sum
          </Text>
        </View>
        <View style={[styles.spendIcon, { backgroundColor: colors.primary + '1A' }]}>
          <Feather name="credit-card" size={22} color={colors.primary} />
        </View>
      </View>

      {/* Menu */}
      <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
              <Feather name={item.icon as 'activity'} size={18} color={colors.primary} />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
              <Text style={[styles.menuDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Version */}
      <Text style={[styles.version, { color: colors.mutedForeground }]}>
        EV Charge · v1.0.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 24,
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
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
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
    borderRadius: 12,
  },
  premiumText: {
    color: '#FDE68A',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  statDivider: { width: 1, height: 40, alignSelf: 'center' },
  spendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 16,
    marginBottom: 0,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  spendLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  spendValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  spendIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCard: {
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
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
  menuDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  version: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
  },
});
