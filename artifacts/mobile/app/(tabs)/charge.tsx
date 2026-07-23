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
  useStopSession,
  getGetSessionsQueryKey,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import { CircularProgress } from '@/components/CircularProgress';
import { GradientButton } from '@/components/GradientButton';

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
    Alert.alert('Остановить сессию', 'Вы уверены, что хотите завершить зарядку?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Остановить',
        style: 'destructive',
        onPress: () => stopMutation.mutate({ id: activeSession.id }),
      },
    ]);
  }

  // Compute live energy estimate
  const liveEnergyKwh = activeSession
    ? parseFloat(
        (
          ((Date.now() - new Date(activeSession.started_at).getTime()) / 3600000) *
          ((activeSession.station as { power_kw?: number } | null)?.power_kw ?? 50)
        ).toFixed(2)
      )
    : 0;

  const stationPrice = (activeSession?.station as { price_per_kwh?: number } | null)?.price_per_kwh ?? 2450;
  const stationPower = (activeSession?.station as { power_kw?: number } | null)?.power_kw ?? 50;

  const liveCost = activeSession ? Math.round(liveEnergyKwh * stationPrice) : 0;
  const batteryPct = activeSession ? Math.min(95, 20 + (liveEnergyKwh / 60) * 100) : 0;
  const timeToEighty = activeSession ? Math.max(0, ((0.8 * 60 - liveEnergyKwh) / stationPower) * 60) : 0;

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
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: colors.text }]}>{liveEnergyKwh.toFixed(1)} кВт·ч</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Энергия</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatDuration(activeSession.started_at)}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Время</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: colors.text }]}>~{Math.round(timeToEighty)} мин</Text>
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
            style={[styles.stopBtn, { borderColor: '#EF4444', backgroundColor: '#EF44440D' }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.stopText, { color: '#EF4444' }]}>
              {stopMutation.isPending ? 'Остановка...' : 'Остановить сессию'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.detailsLink} onPress={() => router.push('/sessions')}>
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
  stopBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  stopText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  detailsLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailsText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
});
