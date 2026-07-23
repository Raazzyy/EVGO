import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetSessions, useGetSession, useStopSession, getGetSessionsQueryKey,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import { CircularProgress } from '@/components/CircularProgress';
import { GradientButton } from '@/components/GradientButton';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform } from 'react-native';

export default function ChargeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { userId } = useApp();

  const [tick, setTick] = useState(0);
  const [confirmStop, setConfirmStop] = useState(false);

  const { data: sessions = [] } = useGetSessions({ status: 'active', user_id: userId });
  const activeSession = sessions[0] ?? null;

  const { data: sessionDetail } = useGetSession(activeSession?.id ?? 0, {
    query: { enabled: !!activeSession, refetchInterval: 5_000 },
  });

  const stopMutation = useStopSession({
    mutation: {
      onSuccess: () => {
        setConfirmStop(false);
        qc.invalidateQueries({ queryKey: getGetSessionsQueryKey() });
      },
    },
  });

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const stationPrice = (activeSession?.station as any)?.price_per_kwh ?? 2000;
  const stationPower = (activeSession?.station as any)?.power_kw ?? 100;

  const SIM_DURATION_S = 28 * 60;
  const simElapsedS = Math.min(tick, SIM_DURATION_S);
  const liveEnergyKwh = parseFloat(((simElapsedS / 3600) * stationPower).toFixed(1));
  const liveCost = Math.round(liveEnergyKwh * stationPrice);
  const batteryPct = (sessionDetail as any)?.progress_pct ?? Math.min(95, 45 + (simElapsedS / SIM_DURATION_S) * 30);
  const CAR_BATTERY = 77.4;
  const timeToEighty = Math.max(-99, Math.round(((0.8 * CAR_BATTERY - liveEnergyKwh) / stationPower) * 60));

  const simH = Math.floor(simElapsedS / 3600);
  const simM = Math.floor((simElapsedS % 3600) / 60);
  const simS = simElapsedS % 60;
  const simTime = `${String(simH).padStart(2,'0')}:${String(simM).padStart(2,'0')}:${String(simS).padStart(2,'0')}`;

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
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Зарядка</Text>
        <View style={[styles.activePill, { backgroundColor: '#10B9811A' }]}>
          <Text style={[styles.activePillText, { color: '#10B981' }]}>Сессия активна</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.activeContent, { paddingBottom: bottomPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.progressCard, { backgroundColor: colors.card }]}>
          <CircularProgress
            progress={batteryPct}
            size={180}
            strokeWidth={14}
            subLabel="Заряжено"
            icon={<Feather name="zap" size={24} color={colors.primary} />}
          />
        </View>

        <View style={[styles.statsGrid, { backgroundColor: colors.card }]}>
          {[
            { value: `${stationPower} кВт`, label: 'Мощность' },
            { value: `${liveEnergyKwh.toFixed(1)} кВт·ч`, label: 'Энергия' },
            { value: simTime, label: 'Время' },
            {
              value: timeToEighty < 0 ? `+${Math.abs(timeToEighty)} мин` : `~${timeToEighty} мин`,
              label: 'До 80%',
              color: timeToEighty < 0 ? '#10B981' : undefined,
            },
          ].map((item, i, arr) => (
            <React.Fragment key={i}>
              <View style={styles.statBlock}>
                <Text style={[styles.statValue, { color: item.color ?? colors.text }]}>{item.value}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
              </View>
              {i < arr.length - 1 && <View style={[styles.statDivider, { backgroundColor: colors.border }]} />}
            </React.Fragment>
          ))}
        </View>

        <View style={[styles.costCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.costValue, { color: colors.text }]}>
            {liveCost.toLocaleString('ru-RU')} сум
          </Text>
          <Text style={[styles.costRate, { color: colors.mutedForeground }]}>
            {stationPrice.toLocaleString('ru-RU')} сум/кВт·ч
          </Text>
        </View>

        {/* ── Stop section ─────────────────────────────────────────── */}
        {!confirmStop ? (
          <TouchableOpacity
            onPress={() => setConfirmStop(true)}
            activeOpacity={0.8}
            style={{ borderRadius: 16, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={['#F472B6', '#EF4444']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.stopBtn}
            >
              <Text style={styles.stopText}>Остановить сессию</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={[styles.confirmCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <Text style={[styles.confirmTitle, { color: '#DC2626' }]}>Завершить зарядку?</Text>
            <Text style={[styles.confirmSub, { color: '#9CA3AF' }]}>
              Сессия будет остановлена. Итоговая стоимость будет рассчитана.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: '#EF4444', flex: 1 }]}
                onPress={() => stopMutation.mutate({ id: activeSession.id })}
                disabled={stopMutation.isPending}
              >
                <Text style={styles.confirmBtnText}>
                  {stopMutation.isPending ? 'Останавливаем...' : 'Да, остановить'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: '#F3F4F6', flex: 1 }]}
                onPress={() => setConfirmStop(false)}
              >
                <Text style={[styles.confirmBtnText, { color: '#374151' }]}>Отмена</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.detailsLink} onPress={() => router.push(`/payment/${activeSession.id}`)}>
          <Text style={[styles.detailsText, { color: colors.primary }]}>Детали сессии</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerEmpty: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  activePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activePillText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  emptyContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  emptyDesc: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  activeContent: { padding: 16, gap: 16 },
  progressCard: {
    borderRadius: 20, padding: 32, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },
  statsGrid: {
    borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },
  statBlock: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 15, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  statDivider: { width: 1, height: 40, marginHorizontal: 2 },
  costCard: {
    borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },
  costValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  costRate: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  stopBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 16 },
  stopText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  confirmCard: {
    borderRadius: 16, borderWidth: 1.5, padding: 20, gap: 12,
  },
  confirmTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  confirmSub: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  confirmBtns: { flexDirection: 'row', gap: 10 },
  confirmBtn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  detailsLink: { alignItems: 'center', paddingVertical: 8 },
  detailsText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
