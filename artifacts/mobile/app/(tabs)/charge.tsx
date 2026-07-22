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
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
    Alert.alert('Stop Charging', 'Are you sure you want to stop the session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop',
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

  const liveCost = activeSession
    ? Math.round(
        liveEnergyKwh * ((activeSession.station as { price_per_kwh?: number } | null)?.price_per_kwh ?? 2000)
      )
    : 0;

  // Battery estimate: assume 60kWh battery, 20% start
  const batteryPct = activeSession ? Math.min(95, 20 + (liveEnergyKwh / 60) * 100) : 0;

  if (!activeSession) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Charge</Text>
        </View>
        <ScrollView contentContainerStyle={[styles.emptyContent, { paddingBottom: bottomPad + 100 }]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Feather name="zap" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Active Session</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Find a nearby station and tap "Start Charging" to begin.
          </Text>
          <GradientButton
            label="Find a Station"
            onPress={() => router.push('/')}
            style={{ marginTop: 8 }}
            icon={<Feather name="map-pin" size={16} color="#fff" />}
          />
          <TouchableOpacity
            onPress={() => router.push('/sessions')}
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
          >
            <Feather name="clock" size={16} color={colors.mutedForeground} />
            <Text style={[styles.secondaryText, { color: colors.mutedForeground }]}>View Session History</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  const station = activeSession.station as { name: string; address: string; power_kw: number; price_per_kwh: number } | null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <View style={[styles.activeDot, { backgroundColor: colors.free }]} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>Charging</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.activeContent, { paddingBottom: bottomPad + 100 }]}>
        {/* Progress ring */}
        <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <CircularProgress
            progress={batteryPct}
            size={180}
            strokeWidth={14}
            subLabel="battery"
          />

          {/* Live timer */}
          <Text style={[styles.timer, { color: colors.text }]}>
            {formatDuration(activeSession.started_at)}
          </Text>
          <Text style={[styles.timerLabel, { color: colors.mutedForeground }]}>elapsed</Text>
        </View>

        {/* Station info */}
        {station && (
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CHARGING AT</Text>
            <Text style={[styles.stationName, { color: colors.text }]}>{station.name}</Text>
            <Text style={[styles.stationAddr, { color: colors.mutedForeground }]}>{station.address}</Text>
          </View>
        )}

        {/* Live stats */}
        <View style={[styles.statsGrid, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: colors.text }]}>{liveEnergyKwh.toFixed(2)}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>kWh charged</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: colors.text }]}>{liveCost.toLocaleString()}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>sum (est.)</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {station?.power_kw ?? 50}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>kW power</Text>
          </View>
        </View>

        {/* Stop button */}
        <TouchableOpacity
          onPress={handleStop}
          disabled={stopMutation.isPending}
          style={[styles.stopBtn, { borderColor: colors.destructive, backgroundColor: colors.destructive + '0D' }]}
          activeOpacity={0.8}
        >
          <Feather name="square" size={18} color={colors.destructive} />
          <Text style={[styles.stopText, { color: colors.destructive }]}>
            {stopMutation.isPending ? 'Stopping…' : 'Stop Charging'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    paddingTop: 16,
  },
  headerTitle: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  activeContent: { padding: 20, gap: 14 },
  progressCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  timer: {
    fontSize: 42,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -1,
    marginTop: 8,
  },
  timerLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  infoCard: {
    borderRadius: 16,
    padding: 16,
    gap: 4,
    borderWidth: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  stationName: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  stationAddr: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  statsGrid: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  statBlock: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  statDivider: { width: 1, height: 40, marginHorizontal: 8 },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  stopText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
