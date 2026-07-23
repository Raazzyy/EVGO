import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import { useGetRoute } from '@workspace/api-client-react';
import { MapViewWrapper } from '@/components/MapViewWrapper';

function formatTime(totalMin: number) {
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

function arrivalTime(totalMin: number) {
  const d = new Date(Date.now() + totalMin * 60_000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function NavigateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeRouteId, setActiveRouteId } = useApp();

  const { data: route, isLoading } = useGetRoute(activeRouteId ?? 0, {
    query: { enabled: !!activeRouteId, refetchInterval: 30_000 },
  });

  const topPad = Platform.OS === 'web' ? 20 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // Build semantic waypoints for the map
  const routePoints = useMemo(() => {
    if (!route) return undefined;
    const stops: any[] = (route as any).stops ?? [];
    return [
      { lat: (route as any).origin_lat, lng: (route as any).origin_lng, label: (route as any).origin?.split(',')[0] ?? 'Начало', type: 'origin' as const },
      ...stops.filter((s: any) => s.lat && s.lng).map((s: any) => ({
        lat: s.lat, lng: s.lng, label: s.station_name, type: 'stop' as const,
      })),
      { lat: (route as any).dest_lat, lng: (route as any).dest_lng, label: (route as any).destination?.split(',')[0] ?? 'Конец', type: 'dest' as const },
    ];
  }, [route]);

  // Road polyline from Yandex Router (already returned by backend)
  const polylineCoords = useMemo(() => {
    const p = (route as any)?.polyline;
    return Array.isArray(p) && p.length >= 2 ? (p as Array<[number, number]>) : undefined;
  }, [route]);

  // Map Google maneuver string → Feather icon name
  function maneuverIcon(maneuver: string): string {
    if (!maneuver || maneuver === 'straight' || maneuver === 'merge' || maneuver === 'keep-right' || maneuver === 'keep-left') return 'arrow-up';
    if (maneuver.includes('left')) return 'corner-down-left';
    if (maneuver.includes('right')) return 'corner-down-right';
    if (maneuver.startsWith('uturn')) return 'rotate-cw';
    if (maneuver === 'ferry' || maneuver === 'ferry-train') return 'anchor';
    return 'arrow-up';
  }

  // Real turn-by-turn steps from Google Directions; fallback to stop-list if not available
  const steps = useMemo(() => {
    if (!route) return [];
    const googleSteps: any[] = (route as any).google_steps ?? [];
    if (googleSteps.length > 0) {
      return googleSteps.map((s: any) => ({
        instruction: s.instruction,
        street: s.distance_m >= 1000
          ? `${(s.distance_m / 1000).toFixed(1)} км`
          : `${s.distance_m} м`,
        icon: maneuverIcon(s.maneuver),
      }));
    }
    // Fallback: derive from charging stops
    const stops: any[] = (route as any).stops ?? [];
    const dest = (route as any).destination ?? 'пункт назначения';
    if (stops.length === 0) {
      return [{ instruction: 'Следуйте до пункта назначения', street: dest, icon: 'arrow-up' }];
    }
    return [
      { instruction: 'Следуйте до зарядной станции', street: stops[0].station_name, icon: 'arrow-up' },
      ...stops.slice(0, -1).map((s: any, i: number) => ({
        instruction: 'После зарядки следуйте далее',
        street: stops[i + 1].station_name,
        icon: 'arrow-up',
      })),
      { instruction: 'Следуйте до пункта назначения', street: dest, icon: 'navigation' },
    ];
  }, [route]);

  const [currentStepIdx, setCurrentStepIdx] = useState(0); // Stage B: advance via GPS
  const step = steps[currentStepIdx] ?? steps[0];

  function handleEnd() {
    setActiveRouteId(null);
    router.back();
  }

  // ── Loading state ─────────────────────────────────────────────────────
  if (isLoading || !route) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <MapViewWrapper stations={[]} onStationPress={() => {}} />
        <View style={[styles.topOverlay, { paddingTop: topPad + 16 }]}>
          <View style={[styles.instructionCard, { backgroundColor: colors.card }]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.action, { color: colors.text, marginLeft: 12 }]}>Загрузка маршрута…</Text>
          </View>
        </View>
      </View>
    );
  }

  const distKm = Math.round((route as any).total_distance_km ?? 0);
  const timeMin = (route as any).total_time_min ?? 0;
  const eta = arrivalTime(timeMin);

  return (
    <View style={styles.container}>
      {/* Full-screen map with real route polyline */}
      <MapViewWrapper
        stations={[]}
        onStationPress={() => {}}
        routePoints={routePoints}
        polylineCoords={polylineCoords}
      />

      {/* Top instruction card */}
      <View style={[styles.topOverlay, { paddingTop: topPad + 16 }]}>
        <View style={[styles.instructionCard, { backgroundColor: colors.card }]}>
          <View style={[styles.directionIcon, { backgroundColor: colors.primary }]}>
            <Feather name={step?.icon as any} size={24} color="#FFFFFF" />
          </View>
          <View style={styles.instructionText}>
            <Text style={[styles.action, { color: colors.text }]}>{step?.instruction}</Text>
            <Text style={[styles.street, { color: colors.mutedForeground }]} numberOfLines={1}>
              {step?.street}
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom stats + end button */}
      <View style={[styles.bottomBar, { backgroundColor: colors.card, paddingBottom: bottomPad + 16 }]}>
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.text }]}>{eta}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>прибытие</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatTime(timeMin)}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>в пути</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.text }]}>{distKm} км</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>расстояние</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.endButton, { borderColor: '#EF4444' }]}
          onPress={handleEnd}
        >
          <Text style={[styles.endButtonText, { color: '#EF4444' }]}>Завершить</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 16, zIndex: 10,
  },
  instructionCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderRadius: 16, gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 5,
  },
  directionIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  instructionText: { flex: 1 },
  action: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  street: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 2 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 24, paddingHorizontal: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 10,
  },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 24,
  },
  statCol: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 4, textTransform: 'uppercase' },
  statDivider: { width: 1, height: 32 },
  endButton: {
    borderWidth: 1, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  endButtonText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
