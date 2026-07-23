import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import { useGetRoute } from '@workspace/api-client-react';
import { MapViewWrapper } from '@/components/MapViewWrapper';

// ── Helpers ───────────────────────────────────────────────────────────────
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatTime(totalMin: number) {
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

function arrivalTime(totalMin: number) {
  const d = new Date(Date.now() + totalMin * 60_000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function maneuverIcon(maneuver: string): string {
  if (!maneuver || maneuver === 'straight' || maneuver === 'merge' ||
      maneuver === 'keep-right' || maneuver === 'keep-left') return 'arrow-up';
  if (maneuver.includes('left')) return 'corner-down-left';
  if (maneuver.includes('right')) return 'corner-down-right';
  if (maneuver.startsWith('uturn')) return 'rotate-cw';
  if (maneuver === 'ferry' || maneuver === 'ferry-train') return 'anchor';
  return 'arrow-up';
}

const STEP_ADVANCE_M  = 40;  // metres → advance to next step
const ANNOUNCE_FAR_M  = 150; // metres → "Через 150 метров, ..."
const ANNOUNCE_NEAR_M = 50;  // metres → imminent repeat

/** Speak text in Russian, cancelling any ongoing utterance first. */
function announce(text: string) {
  if (!text) return;
  Speech.stop();
  Speech.speak(text, { language: 'ru' });
}

// ── Screen ────────────────────────────────────────────────────────────────
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

  // ── Navigation state ───────────────────────────────────────────────────
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [speedKmh, setSpeedKmh] = useState(0);

  // Refs so location callback always reads current values without stale closure
  const stepIdxRef    = useRef(0);
  const googleStepsRef = useRef<any[]>([]);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  // announcedRef[stepIdx] = { far: boolean, near: boolean }
  const announcedRef  = useRef<Record<number, { far: boolean; near: boolean }>>({});

  // Keep refs in sync
  useEffect(() => { stepIdxRef.current = currentStepIdx; }, [currentStepIdx]);
  useEffect(() => {
    googleStepsRef.current = (route as any)?.google_steps ?? [];
  }, [route]);

  // Reset on new route; announce first step
  useEffect(() => {
    setCurrentStepIdx(0);
    stepIdxRef.current = 0;
    announcedRef.current = {};
  }, [activeRouteId]);

  // Announce step 0 as soon as route data arrives (native only)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const gSteps: any[] = (route as any)?.google_steps ?? [];
    if (gSteps.length > 0) {
      announcedRef.current[0] = { far: true, near: true }; // prevent duplicate at 150/50m
      announce(gSteps[0].instruction);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(route as any)?.id]); // fires once per route, not on every refetch

  // ── GPS watch ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS === 'web') return; // expo-location watch works on native
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1_000,   // 1 second
          distanceInterval: 10,  // or 10 metres, whichever comes first
        },
        (loc) => {
          const { latitude: lat, longitude: lng, speed } = loc.coords;

          // Live speed (m/s → km/h; negative/null → 0)
          setSpeedKmh(speed != null && speed >= 0 ? Math.round(speed * 3.6) : 0);

          // Step advance + voice announcement logic
          const idx    = stepIdxRef.current;
          const gSteps = googleStepsRef.current;
          if (idx >= gSteps.length) return;

          const curStep   = gSteps[idx];
          const distToEnd = haversineM(lat, lng, curStep.end_lat, curStep.end_lng);

          // ── Voice announcements ──────────────────────────────────────────
          const announced = announcedRef.current[idx] ?? { far: false, near: false };
          const nextStep  = gSteps[idx + 1];

          // 150 m preview: "Через 150 метров, [следующий манёвр]"
          if (!announced.far && distToEnd < ANNOUNCE_FAR_M && nextStep) {
            announcedRef.current[idx] = { ...announced, far: true };
            announce(`Через 150 метров, ${nextStep.instruction}`);
          }

          // 50 m imminent: повтор следующего манёвра
          if (!announced.near && distToEnd < ANNOUNCE_NEAR_M && distToEnd >= STEP_ADVANCE_M && nextStep) {
            announcedRef.current[idx] = { ...announcedRef.current[idx]!, near: true };
            announce(nextStep.instruction);
          }

          // ── Step advance ─────────────────────────────────────────────────
          if (distToEnd < STEP_ADVANCE_M && idx < gSteps.length - 1) {
            const next = idx + 1;
            stepIdxRef.current = next;
            setCurrentStepIdx(next);
            // Если 50-метровое объявление не успело сработать — озвучиваем сейчас
            if (!announcedRef.current[idx]?.near) {
              announce(gSteps[next].instruction);
            }
            // Инициализируем запись для нового шага (step 0 уже объявлен при загрузке)
            if (!announcedRef.current[next]) {
              announcedRef.current[next] = { far: false, near: false };
            }
          }
        },
      );
    })();

    return () => {
      cancelled = true;
      locationSubRef.current?.remove();
      locationSubRef.current = null;
    };
  }, []); // mount once; refs carry fresh values

  // ── Derived data ───────────────────────────────────────────────────────
  const routePoints = useMemo(() => {
    if (!route) return undefined;
    const stops: any[] = (route as any).stops ?? [];
    return [
      { lat: (route as any).origin_lat, lng: (route as any).origin_lng,
        label: (route as any).origin?.split(',')[0] ?? 'Начало', type: 'origin' as const },
      ...stops.filter((s: any) => s.lat && s.lng).map((s: any) => ({
        lat: s.lat, lng: s.lng, label: s.station_name, type: 'stop' as const,
      })),
      { lat: (route as any).dest_lat, lng: (route as any).dest_lng,
        label: (route as any).destination?.split(',')[0] ?? 'Конец', type: 'dest' as const },
    ];
  }, [route]);

  const polylineCoords = useMemo(() => {
    const p = (route as any)?.polyline;
    return Array.isArray(p) && p.length >= 2 ? (p as Array<[number, number]>) : undefined;
  }, [route]);

  // Turn-by-turn steps
  const steps = useMemo(() => {
    if (!route) return [];
    const gSteps: any[] = (route as any).google_steps ?? [];
    if (gSteps.length > 0) {
      return gSteps.map((s: any) => ({
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
      ...stops.slice(0, -1).map((_s: any, i: number) => ({
        instruction: 'После зарядки следуйте далее',
        street: stops[i + 1].station_name,
        icon: 'arrow-up',
      })),
      { instruction: 'Следуйте до пункта назначения', street: dest, icon: 'navigation' },
    ];
  }, [route]);

  // Remaining distance & time from current step onwards (live)
  const { remDistKm, remTimeMin } = useMemo(() => {
    const gSteps: any[] = (route as any)?.google_steps ?? [];
    if (gSteps.length === 0) {
      return {
        remDistKm: Math.round((route as any)?.total_distance_km ?? 0),
        remTimeMin: (route as any)?.total_time_min ?? 0,
      };
    }
    let distM = 0, durS = 0;
    for (let i = currentStepIdx; i < gSteps.length; i++) {
      distM += gSteps[i].distance_m ?? 0;
      durS += gSteps[i].duration_s ?? 0;
    }
    return {
      remDistKm: Math.round(distM / 1000),
      remTimeMin: Math.round(durS / 60),
    };
  }, [route, currentStepIdx]);

  const step = steps[currentStepIdx] ?? steps[0];

  function handleEnd() {
    locationSubRef.current?.remove();
    locationSubRef.current = null;
    setActiveRouteId(null);
    router.back();
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (isLoading || !route) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <MapViewWrapper stations={[]} onStationPress={() => {}} />
        <View style={[styles.topOverlay, { paddingTop: topPad + 16 }]}>
          <View style={[styles.instructionCard, { backgroundColor: colors.card }]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.action, { color: colors.text, marginLeft: 12 }]}>
              Загрузка маршрута…
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Full-screen map */}
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
            <Text style={[styles.action, { color: colors.text }]} numberOfLines={2}>
              {step?.instruction}
            </Text>
            <Text style={[styles.street, { color: colors.mutedForeground }]} numberOfLines={1}>
              {step?.street}
            </Text>
          </View>
          {/* Step counter badge */}
          {steps.length > 1 && (
            <View style={[styles.stepBadge, { backgroundColor: colors.border }]}>
              <Text style={[styles.stepBadgeText, { color: colors.mutedForeground }]}>
                {currentStepIdx + 1}/{steps.length}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Bottom stats + end button */}
      <View style={[styles.bottomBar, { backgroundColor: colors.card, paddingBottom: bottomPad + 16 }]}>
        <View style={styles.statsRow}>
          {/* Arrival time */}
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.text }]}>{arrivalTime(remTimeMin)}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>прибытие</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          {/* Live speed */}
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.text }]}>{speedKmh}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>км/ч</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          {/* Remaining distance */}
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.text }]}>{remDistKm} км</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>осталось</Text>
          </View>
        </View>

        {/* Remaining time label */}
        <Text style={[styles.remTime, { color: colors.mutedForeground }]}>
          {formatTime(remTimeMin)} в пути
        </Text>

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
    padding: 16, borderRadius: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 5,
  },
  directionIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  instructionText: { flex: 1 },
  action: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  street: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  stepBadge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, flexShrink: 0,
  },
  stepBadgeText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 20, paddingHorizontal: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 10,
  },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  statCol: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', marginTop: 4, textTransform: 'uppercase' },
  statDivider: { width: 1, height: 32 },
  remTime: {
    textAlign: 'center', fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 20,
  },
  endButton: {
    borderWidth: 1, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
  },
  endButtonText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
