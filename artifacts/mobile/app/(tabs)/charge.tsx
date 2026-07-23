import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetSessions,
  useGetSession,
  useStopSession,
  getGetSessionsQueryKey,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import { CircularProgress } from '@/components/CircularProgress';
import { GradientButton } from '@/components/GradientButton';
import { LinearGradient } from 'expo-linear-gradient';

function formatDuration(startedAt: string) {
  const diffMs = Date.now() - new Date(startedAt).getTime();
  const totalSec = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `00:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ChargeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { userId } = useApp();
  const [tick, setTick] = useState(0);

  const { data: sessions = [] } = useGetSessions({ status: 'active', user_id: userId });
  const activeSession = sessions[0] ?? null;

  // Poll session every 5 s to get server-computed progress_pct
  const { data: sessionDetail } = useGetSession(activeSession?.id ?? 0, {
    query: { enabled: !!activeSession, refetchInterval: 5_000 },
  });

  const stopMutation = useStopSession({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetSessionsQueryKey() });
      },
    },
  });

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  function handleStop() {
    if (!activeSession) return;
    if (Platform.OS === 'web') {
      if (window.confirm('Завершить зарядку сейчас?')) {
        stopMutation.mutate({ id: activeSession.id });
      }
      return;
    }
    Alert.alert('Остановить сессию', 'Вы уверены, что хотите завершить зарядку?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Остановить', style: 'destructive', onPress: () => stopMutation.mutate({ id: activeSession.id }) },
    ]);
  }

  const stationPrice = (activeSession?.station as { price_per_kwh?: number } | null)?.price_per_kwh ?? 2450;
  const stationPower = (activeSession?.station as { power_kw?: number } | null)?.power_kw ?? 150;

  // Simulate a realistic 28-minute session (ticks up live with 1s interval)
  const SIM_DURATION_S = 28 * 60; // 28 min in seconds
  const simElapsedS = Math.min(tick, SIM_DURATION_S);
  const simElapsedH = simElapsedS / 3600;

  const liveEnergyKwh = parseFloat((simElapsedH * stationPower).toFixed(1));
  const liveCost = Math.round(liveEnergyKwh * stationPrice);
  // Prefer server-computed progress_pct for the ring; fallback to local simulation
  const batteryPct = (sessionDetail as any)?.progress_pct ?? Math.min(95, 45 + (simElapsedS / SIM_DURATION_S) * 30);
  const CAR_BATTERY_KWH = 77.4; // IONIQ 5 battery
  const timeToEighty = Math.max(
    -99,
    Math.round(((0.8 * CAR_BATTERY_KWH - liveEnergyKwh) / stationPower) * 60)
  );

  // Format simulated HH:MM:SS
  const simH = Math.floor(simElapsedS / 3600);
  const simM = Math.floor((simElapsedS % 3600) / 60);
  const simS = simElapsedS % 60;
  const simTime = `${String(simH).padStart(2, '0')}:${String(simM).padStart(2, '0')}:${String(simS).padStart(2, '0')}`;

  if (!activeSession) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={[styles.headerEmpty, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Зарядка</Text>
        </View>
        <ScrollView contentContainerStyle={[styles.emptyContent, { paddingBottom: bottomPad + 100 }]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Feather name="zap" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Нет активной сессии</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Найдите ближайшую станцию и нажмите «Зарядиться», чтобы начать.
          </Text>
          <GradientButton
            label="Найти станцию"
            onPress={() => router.push('/')}
            style={{ marginTop: 8 }}
            icon={<Feather name="map-pin" size={16} color="#fff" />}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>Зарядка</Text>
        <View style={[styles.activePill, { backgroundColor: '#10B9811A' }]}>
          <Text style={[styles.activePillText, { color: '#10B981' }]}>Сессия активна</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.activeContent, { paddingBottom: bottomPad + 100 }]} showsVerticalScrollIndicator={false}>
        {/* Progress ring */}
        <View style={[styles.progressCard, { backgroundColor: colors.card, shadowColor: '#000' }]}>
          <CircularProgress
            progress={batteryPct}
            size={180}
            strokeWidth={14}
            subLabel="Заряжено"
            icon={<Feather name="zap" size={24} color={colors.primary} />}
          />
        </View>

        {/* Stats row */}
        <View style={[styles.statsGrid, { backgroundColor: colors.card, shadowColor: '#000' }]}>
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stationPower} кВт</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Мощность</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: colors.text }]}>{liveEnergyKwh.toFixed(1)} кВт·ч</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Энергия</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: colors.text }]}>{simTime}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Время</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: timeToEighty < 0 ? '#10B981' : colors.text }]}>
              {timeToEighty < 0 ? `+${Math.abs(timeToEighty)}` : `~${timeToEighty}`} мин
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>До 80%</Text>
          </View>
        </View>

        {/* Cost card */}
        <View style={[styles.costCard, { backgroundColor: colors.card, shadowColor: '#000' }]}>
          <Text style={[styles.costValue, { color: colors.text }]}>
            {liveCost.toLocaleString('ru-RU')} сум
          </Text>
          <Text style={[styles.costRate, { color: colors.mutedForeground }]}>
            {stationPrice.toLocaleString('ru-RU')} сум/кВт·ч
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={handleStop}
            disabled={stopMutation.isPending}
            activeOpacity={0.8}
            style={{ borderRadius: 16, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={['#F472B6', '#EF4444']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[styles.stopBtn, { opacity: stopMutation.isPending ? 0.6 : 1 }]}
            >
              <Text style={styles.stopText}>
                {stopMutation.isPending ? 'Остановка...' : 'Остановить сессию'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.detailsLink} onPress={() => router.push(`/payment/${activeSession.id}`)}>
            <Text style={[styles.detailsText, { color: colors.primary }]}>Детали сессии</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerEmpty: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  activePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activePillText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  emptyContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  emptyDesc: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  activeContent: { padding: 16, gap: 16 },
  progressCard: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  statsGrid: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  statBlock: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  costCard: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  costValue: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  costRate: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  actions: {
    marginTop: 8,
    gap: 16,
  },
  statDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 4,
  },
  stopBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
  },
  stopText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  detailsLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailsText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
});
