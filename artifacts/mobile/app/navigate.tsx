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
import { MapViewWrapper, MapApi } from '@/components/MapViewWrapper';

// ── Pure helpers ──────────────────────────────────────────────────────────

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

/** Minimum distance (metres) from point P to segment AB in lat/lng space. */
function distToSegmentM(
  plat: number, plng: number,
  alat: number, alng: number,
  blat: number, blng: number,
): number {
  const dx = blat - alat, dy = blng - alng;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return haversineM(plat, plng, alat, alng);
  const t = Math.max(0, Math.min(1, ((plat - alat) * dx + (plng - alng) * dy) / lenSq));
  return haversineM(plat, plng, alat + t * dx, alng + t * dy);
}

/** Minimum distance (metres) from point to any segment of the polyline. */
function distToPolylineM(lat: number, lng: number, poly: Array<[number, number]>): number {
  if (poly.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < poly.length - 1; i++) {
    const d = distToSegmentM(lat, lng, poly[i][0], poly[i][1], poly[i + 1][0], poly[i + 1][1]);
    if (d < min) min = d;
  }
  return min;
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

/** Speak text in Russian, cancelling any ongoing utterance first. */
function announce(text: string) {
  if (!text) return;
  Speech.stop();
  Speech.speak(text, { language: 'ru' });
}

// ── Constants ─────────────────────────────────────────────────────────────

const STEP_ADVANCE_M      = 40;  // metres → advance to next step
const ANNOUNCE_FAR_M      = 150; // metres → "Через 150 метров, ..."
const ANNOUNCE_NEAR_M     = 50;  // metres → imminent repeat before step advance
const OFF_ROUTE_M         = 90;  // metres from polyline → "off route"
const OFF_ROUTE_COUNT     = 4;   // consecutive GPS ticks needed to trigger reroute

// ── Screen ────────────────────────────────────────────────────────────────

export default function NavigateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeRouteId, setActiveRouteId } = useApp();

  const { data: route, isLoading } = useGetRoute(activeRouteId ?? 0, {
    query: { enabled: !!activeRouteId, refetchInterval: 30_000 },
  });

  const topPad    = Platform.OS === 'web' ? 20 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // ── Map ref (camera follow) ────────────────────────────────────────────
  const mapRef = useRef<MapApi>(null);

  // ── React state ────────────────────────────────────────────────────────
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [speedKmh,       setSpeedKmh]       = useState(0);
  const [isRerouting,    setIsRerouting]    = useState(false);

  // ── Refs (avoid stale closures inside GPS callback) ────────────────────
  const stepIdxRef      = useRef(0);
  const googleStepsRef  = useRef<any[]>([]);
  const polylineRef     = useRef<Array<[number, number]>>([]);
  const routeRef        = useRef<any>(null);
  const locationSubRef  = useRef<Location.LocationSubscription | null>(null);
  const headingRef      = useRef(0); // last known bearing (degrees, 0=North)
  // announcedRef[stepIdx] = { far, near }
  const announcedRef    = useRef<Record<number, { far: boolean; near: boolean }>>({});
  // off-route detection
  const offRouteCountRef   = useRef(0);
  const isReroutingRef     = useRef(false);
  const lastRerouteTimeRef = useRef(0);          // timestamp ms of last completed reroute
  const REROUTE_COOLDOWN_MS = 30_000;            // min 30 s between reroutes
  // stable handle to the reroute function (updated each render so setters are always fresh)
  const rerouteFnRef = useRef<((lat: number, lng: number) => void) | null>(null);

  // ── Sync refs with latest data ─────────────────────────────────────────
  useEffect(() => { stepIdxRef.current = currentStepIdx; }, [currentStepIdx]);

  useEffect(() => {
    routeRef.current        = route ?? null;
    googleStepsRef.current  = (route as any)?.google_steps ?? [];
    const p                 = (route as any)?.polyline;
    polylineRef.current     = Array.isArray(p) && p.length >= 2 ? p : [];
  }, [route]);

  // ── Reset on new route ─────────────────────────────────────────────────
  useEffect(() => {
    setCurrentStepIdx(0);
    stepIdxRef.current = 0;
    announcedRef.current   = {};
    offRouteCountRef.current = 0;
  }, [activeRouteId]);

  // ── Announce first step when route data arrives ────────────────────────
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const gSteps: any[] = (route as any)?.google_steps ?? [];
    if (gSteps.length > 0) {
      announcedRef.current[0] = { far: true, near: true };
      announce(gSteps[0].instruction);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(route as any)?.id]);

  // ── Reroute function (stored in ref so GPS callback can call it) ────────
  rerouteFnRef.current = async (lat: number, lng: number) => {
    if (isReroutingRef.current) return;
    isReroutingRef.current = true;
    setIsRerouting(true);
    offRouteCountRef.current = 0;

    try {
      const cur = routeRef.current;
      if (!cur) return;

      const domain = (process.env as any).EXPO_PUBLIC_DOMAIN;
      const base   = domain ? `https://${domain}` : '';

      // Best-effort reverse geocode for origin label
      let originLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try {
        const gr = await fetch(`${base}/api/geocode/reverse?lat=${lat}&lng=${lng}`);
        if (gr.ok) {
          const { address } = await gr.json();
          if (address) originLabel = address;
        }
      } catch { /* keep coordinate string */ }

      // Delete old route
      try { await fetch(`${base}/api/routes/${cur.id}`, { method: 'DELETE' }); } catch {}

      // Create new route from current position
      const res = await fetch(`${base}/api/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin:              originLabel,
          destination:         cur.destination,
          origin_lat:          lat,
          origin_lng:          lng,
          dest_lat:            cur.dest_lat,
          dest_lng:            cur.dest_lng,
          initial_battery_pct: cur.initial_battery_pct ?? 80,
          vehicle_id:          cur.vehicle_id ?? null,
        }),
      });

      if (!res.ok) return;
      const newRoute = await res.json();

      // Immediately update refs with new route so GPS callback works
      // before useGetRoute refetches
      routeRef.current       = newRoute;
      googleStepsRef.current = newRoute.google_steps ?? [];
      const np               = newRoute.polyline;
      polylineRef.current    = Array.isArray(np) && np.length >= 2 ? np : [];

      // Reset step state
      setCurrentStepIdx(0);
      stepIdxRef.current     = 0;
      announcedRef.current   = { 0: { far: true, near: true } };

      // Switch React Query to the new route
      setActiveRouteId(newRoute.id);

      // Announce new route
      if (Platform.OS !== 'web') {
        const gSteps: any[] = newRoute.google_steps ?? [];
        announce(gSteps.length > 0
          ? `Маршрут пересчитан. ${gSteps[0].instruction}`
          : 'Маршрут пересчитан.');
      }
    } finally {
      isReroutingRef.current = false;
      setIsRerouting(false);
    }
  };

  // ── GPS watch (mount-once; all mutable state via refs) ─────────────────
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy:         Location.Accuracy.BestForNavigation,
          timeInterval:     1_000,
          distanceInterval: 5,
        },
        (loc) => {
          const { latitude: lat, longitude: lng, speed, heading } = loc.coords;

          // Camera follow — update heading ref and animate
          if (heading != null && heading >= 0) headingRef.current = heading;
          mapRef.current?.followUser(lat, lng, headingRef.current);

          // Live speed
          setSpeedKmh(speed != null && speed >= 0 ? Math.round(speed * 3.6) : 0);

          const idx    = stepIdxRef.current;
          const gSteps = googleStepsRef.current;
          if (idx >= gSteps.length) return;

          const curStep   = gSteps[idx];
          const distToEnd = haversineM(lat, lng, curStep.end_lat, curStep.end_lng);

          // ── Voice announcements ────────────────────────────────────────
          const announced = announcedRef.current[idx] ?? { far: false, near: false };
          const nextStep  = gSteps[idx + 1];

          if (!announced.far && distToEnd < ANNOUNCE_FAR_M && nextStep) {
            announcedRef.current[idx] = { ...announced, far: true };
            announce(`Через 150 метров, ${nextStep.instruction}`);
          }

          if (!announced.near && distToEnd < ANNOUNCE_NEAR_M && distToEnd >= STEP_ADVANCE_M && nextStep) {
            announcedRef.current[idx] = { ...announcedRef.current[idx]!, near: true };
            announce(nextStep.instruction);
          }

          // ── Step advance ───────────────────────────────────────────────
          if (distToEnd < STEP_ADVANCE_M && idx < gSteps.length - 1) {
            const next = idx + 1;
            stepIdxRef.current = next;
            setCurrentStepIdx(next);
            if (!announcedRef.current[idx]?.near) {
              announce(gSteps[next].instruction);
            }
            if (!announcedRef.current[next]) {
              announcedRef.current[next] = { far: false, near: false };
            }
          }

          // ── Off-route detection ────────────────────────────────────────
          const poly = polylineRef.current;
          if (!isReroutingRef.current && poly.length >= 2) {
            const dToRoute = distToPolylineM(lat, lng, poly);
            if (dToRoute > OFF_ROUTE_M) {
              offRouteCountRef.current += 1;
              if (offRouteCountRef.current >= OFF_ROUTE_COUNT) {
                const now = Date.now();
                if (now - lastRerouteTimeRef.current > REROUTE_COOLDOWN_MS) {
                  offRouteCountRef.current = 0;
                  lastRerouteTimeRef.current = now;
                  rerouteFnRef.current?.(lat, lng);
                }
                // if still in cooldown — keep counter capped, don't reset,
                // so we reroute immediately once cooldown expires
              }
            } else {
              offRouteCountRef.current = 0; // back on route — reset streak
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
  }, []);

  // ── Derived display data ───────────────────────────────────────────────
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

  const { remDistKm, remTimeMin } = useMemo(() => {
    const gSteps: any[] = (route as any)?.google_steps ?? [];
    if (gSteps.length === 0) {
      return {
        remDistKm:  Math.round((route as any)?.total_distance_km ?? 0),
        remTimeMin: (route as any)?.total_time_min ?? 0,
      };
    }
    let distM = 0, durS = 0;
    for (let i = currentStepIdx; i < gSteps.length; i++) {
      distM += gSteps[i].distance_m ?? 0;
      durS  += gSteps[i].duration_s ?? 0;
    }
    return { remDistKm: Math.round(distM / 1000), remTimeMin: Math.round(durS / 60) };
  }, [route, currentStepIdx]);

  const step = steps[currentStepIdx] ?? steps[0];

  function handleEnd() {
    locationSubRef.current?.remove();
    locationSubRef.current = null;
    setActiveRouteId(null);
    router.back();
  }

  // ── Loading state ──────────────────────────────────────────────────────
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
      {/* Full-screen map — ref used for camera follow during navigation */}
      <MapViewWrapper
        ref={mapRef}
        stations={[]}
        onStationPress={() => {}}
        routePoints={routePoints}
        polylineCoords={polylineCoords}
      />

      {/* Top: rerouting banner OR turn instruction */}
      <View style={[styles.topOverlay, { paddingTop: topPad + 16 }]}>
        {isRerouting ? (
          <View style={[styles.instructionCard, styles.reroutingCard]}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.reroutingText}>Пересчёт маршрута…</Text>
          </View>
        ) : (
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
            {steps.length > 1 && (
              <View style={[styles.stepBadge, { backgroundColor: colors.border }]}>
                <Text style={[styles.stepBadgeText, { color: colors.mutedForeground }]}>
                  {currentStepIdx + 1}/{steps.length}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Bottom stats */}
      <View style={[styles.bottomBar, { backgroundColor: colors.card, paddingBottom: bottomPad + 16 }]}>
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.text }]}>{arrivalTime(remTimeMin)}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>прибытие</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.text }]}>{speedKmh}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>км/ч</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.text }]}>{remDistKm} км</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>осталось</Text>
          </View>
        </View>

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
  reroutingCard: {
    backgroundColor: '#2563EB', gap: 12, justifyContent: 'center',
  },
  reroutingText: {
    fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF',
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
