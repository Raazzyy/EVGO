import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetUser, useGetSessions } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { formatAmount } from '@/lib/format';
import { PressableScale } from '@/components/PressableScale';

interface MenuItem {
  icon: string;
  label: string;
  desc: string;
  onPress?: () => void;
}

const VERSION = '1.0.0';

// Соцсети EVGO. Хендлы — placeholder'ы, поменять на реальные аккаунты.
const SOCIALS: Array<{ icon: string; url: string; label: string }> = [
  { icon: 'telegram',  url: 'https://t.me/evgo_uz',            label: 'Telegram' },
  { icon: 'instagram', url: 'https://instagram.com/evgo.uz',   label: 'Instagram' },
  { icon: 'youtube',   url: 'https://youtube.com/@evgo',       label: 'YouTube' },
];

function SocialLinks() {
  return (
    <View style={styles.socialRow}>
      {SOCIALS.map((s) => (
        <TouchableOpacity
          key={s.label}
          onPress={() => Linking.openURL(s.url)}
          accessibilityRole="link"
          accessibilityLabel={s.label}
          activeOpacity={0.75}
          style={styles.socialBtn}
        >
          <FontAwesome5 name={s.icon as any} size={18} color="#fff" />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userId, userMembership } = useApp();
  const { user: authUser, isAuthenticated, signOut, signIn } = useAuth();
  const router = useRouter();

  // @ts-ignore - keeping existing pattern
  const { data: user, isLoading } = useGetUser(userId, {
    query: { enabled: isAuthenticated && Boolean(userId) },
  });
  const { data: rawSessions } = useGetSessions(
    { user_id: userId },
    { query: { enabled: isAuthenticated && Boolean(userId) } }
  );

  const sessions = useMemo(() => (Array.isArray(rawSessions) ? (rawSessions as any[]) : []), [rawSessions]);
  const completedSessions = useMemo(() => sessions.filter((s: any) => s.status === 'completed'), [sessions]);
  const totalEnergy = useMemo(() => completedSessions.reduce((acc: number, s: any) => acc + (s.energy_kwh ?? 0), 0), [completedSessions]);
  // cost_tiyin — тийины (1 сум = 100 тийин), приводим к сумам для отображения.
  const totalCost = useMemo(() => completedSessions.reduce((acc: number, s: any) => acc + (s.cost_tiyin ?? 0) / 100, 0), [completedSessions]);
  const co2Saved = totalEnergy * 0.4;

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleDemoSignIn = useCallback(async () => {
    try {
      await signIn(
        { accessToken: 'demo-token-active', refreshToken: 'demo-refresh-token' },
        {
          id: '1',
          name: 'Азиз Рахимов',
          phone: '+998 90 123 45 67',
          email: 'demo@evgo.uz',
          language: 'ru',
          membership_tier: 'premium',
        }
      );
    } catch (e) {
      console.error(e);
    }
  }, [signIn]);

  const menuItems: MenuItem[] = [
    { icon: 'credit-card', label: 'Кошелёк',           desc: 'Баланс и пополнение',                        onPress: () => router.push('/wallet') },
    { icon: 'activity',    label: 'История сессий',    desc: `${completedSessions.length} сессий`,       onPress: () => router.push('/sessions') },
    { icon: 'heart',       label: 'Избранные станции', desc: 'Сохраненные локации',                       onPress: () => router.push('/favorites') },
    { icon: 'cpu',         label: 'Мои автомобили',    desc: 'Управление электромобилями',                onPress: () => router.push('/cars') },
    { icon: 'settings',    label: 'Настройки',         desc: 'Предпочтения приложения',                   onPress: () => router.push('/settings') },
    { icon: 'headphones',  label: 'Поддержка',         desc: 'Служба заботы о клиентах',                  onPress: () => router.push('/support') },
    { icon: 'info',        label: 'О приложении',      desc: `EVGO v${VERSION}`,                    onPress: () => router.push('/about') },
  ];

  if (isLoading && isAuthenticated && !authUser) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ── Не вошёл: приглашение войти + доступное без входа ──────────────────────
  if (!isAuthenticated) {
    const guestMenu: MenuItem[] = [
      { icon: 'headphones', label: 'Поддержка',    desc: 'Служба заботы о клиентах',  onPress: () => router.push('/support') },
      { icon: 'info',       label: 'О приложении', desc: `EVGO v${VERSION}`,          onPress: () => router.push('/about') },
    ];
    const perks: Array<{ icon: string; title: string; desc: string }> = [
      { icon: 'zap',       title: 'Зарядка из приложения', desc: 'Запускайте сессию прямо с телефона' },
      { icon: 'clock',     title: 'История и чеки',        desc: 'Сессии, расходы и экономия CO₂' },
      { icon: 'map',       title: 'Умные маршруты',        desc: 'Остановки под запас хода вашего авто' },
    ];
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingTop: topPad + 16, paddingHorizontal: 16, paddingBottom: bottomPad + 100, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#2563EB', '#7C3AED']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.guestCard}
        >
          <Text style={styles.guestTitle}>Войдите, чтобы открыть профиль</Text>
          <View style={{ gap: 14, marginTop: 4 }}>
            {perks.map((p) => (
              <View key={p.title} style={styles.perkRow}>
                <View style={styles.perkIcon}>
                  <Feather name={p.icon as any} size={16} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.perkTitle}>{p.title}</Text>
                  <Text style={styles.perkDesc}>{p.desc}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={{ gap: 10, marginTop: 8 }}>
            <PressableScale haptic activeScale={0.97} onPress={() => router.push('/(auth)/phone')} style={styles.guestBtn}>
              <Text style={styles.guestBtnText}>Войти по номеру телефона</Text>
            </PressableScale>
            <PressableScale
              haptic
              activeScale={0.97}
              onPress={handleDemoSignIn}
              style={[styles.guestBtn, { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }]}
            >
              <Text style={[styles.guestBtnText, { color: '#fff' }]}>Быстрый демо-вход (1 клик)</Text>
            </PressableScale>
          </View>
        </LinearGradient>

        <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
          {guestMenu.map((item, i) => (
            <PressableScale
              key={item.label}
              onPress={item.onPress}
              haptic activeScale={0.98}
              style={[styles.menuItem, i < guestMenu.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.muted }]}>
                <Feather name={item.icon as any} size={18} color={colors.primary} />
              </View>
              <View style={styles.menuText}>
                <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
                <Text style={[styles.menuDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </PressableScale>
          ))}
        </View>

        <SocialLinks />
        <Text style={[styles.version, { color: colors.mutedForeground }]}>EVGO · v{VERSION}</Text>
      </ScrollView>
    );
  }

  const nameParts = (authUser?.name ?? user?.name ?? 'Пользователь').split(' ');
  const initials = nameParts.length > 1 
    ? `${nameParts[0][0]}${nameParts[1][0]}` 
    : (nameParts[0][0] ?? 'A');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
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
            <Text style={styles.userName}>{authUser?.name ?? user?.name ?? 'Пользователь'}</Text>
            <Text style={styles.userEmail}>{authUser?.email ?? authUser?.phone ?? user?.email ?? ''}</Text>
          </View>
          <View style={styles.premiumBadge}>
            <Feather name="star" size={12} color="#F59E0B" />
            <Text style={styles.premiumText}>EVGO Premium</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={[styles.statsRow, { backgroundColor: colors.card }]}>
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

      <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
        {menuItems.map((item, i) => (
          <PressableScale
            key={item.label}
            onPress={item.onPress}
            haptic
            activeScale={0.98}
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
          </PressableScale>
        ))}
      </View>

      <PressableScale haptic activeScale={0.98} onPress={() => signOut()} style={[styles.signOutBtn, { borderColor: colors.border }]}>
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={[styles.signOutText, { color: colors.destructive }]}>Выйти</Text>
      </PressableScale>

      <SocialLinks />

      <Text style={[styles.version, { color: colors.mutedForeground }]}>
        EVGO · v{VERSION}
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
  // Logged-out
  guestCard: { borderRadius: 24, padding: 22, gap: 8 },
  guestTitle: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold', lineHeight: 28 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  perkIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  perkTitle: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  perkDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  guestBtn: {
    marginTop: 18, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  guestBtnText: { color: '#2563EB', fontSize: 16, fontFamily: 'Inter_700Bold' },
  signOutBtn: {
    marginHorizontal: 16, marginTop: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
  },
  signOutText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 18 },
  socialBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#7C3AED',
    alignItems: 'center', justifyContent: 'center',
  },
});
