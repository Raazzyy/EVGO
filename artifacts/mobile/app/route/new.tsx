import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Platform,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, SlideInRight } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetVehicles, useGetRoutes,
  useCreateRoute, useDeleteRoute,
  getGetRoutesQueryKey,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import { GradientButton } from '@/components/GradientButton';
import { MapViewWrapper, MapApi } from '@/components/MapViewWrapper';
import { LinearGradient } from 'expo-linear-gradient';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}: ${message}`);
  else Alert.alert(title, message);
}

// Build route points for the map polyline from API response
function buildRoutePoints(
  result: any,
  originLabel: string,
  destLabel: string,
): Array<{ lat: number; lng: number; label: string; type: 'origin' | 'stop' | 'dest' }> {
  const points: Array<{ lat: number; lng: number; label: string; type: 'origin' | 'stop' | 'dest' }> = [];

  points.push({ lat: result.origin_lat, lng: result.origin_lng, label: originLabel, type: 'origin' });

  for (const stop of result.stops ?? []) {
    if (stop.lat != null && stop.lng != null) {
      points.push({ lat: stop.lat, lng: stop.lng, label: stop.station_name, type: 'stop' });
    }
  }

  points.push({ lat: result.dest_lat, lng: result.dest_lng, label: destLabel, type: 'dest' });

  return points;
}

export default function NewRouteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { selectedVehicleId } = useApp();
  const mapRef = useRef<MapApi>(null);

  const params = useLocalSearchParams<{
    stationId?: string; stationName?: string; lat?: string; lng?: string;
  }>();

  const prefilledName = params.stationName ? decodeURIComponent(params.stationName) : '';
  const prefilledLat = params.lat ? parseFloat(params.lat) : null;
  const prefilledLng = params.lng ? parseFloat(params.lng) : null;

  const [origin, setOrigin] = useState('Ташкент, Узбекистан');
  const [destination, setDestination] = useState(prefilledName);
  const [batteryPct, setBatteryPct] = useState('85');
  const [originCoords] = useState({ lat: 41.2995, lng: 69.2401 });
  const [routeResult, setRouteResult] = useState<any>(null);
  const [showMap, setShowMap] = useState(false);

  const { data: vehicles = [] } = useGetVehicles();
  const { data: existingRoutes = [] } = useGetRoutes();
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];

  const deleteRoute = useDeleteRoute();

  const createRoute = useCreateRoute({
    mutation: {
      onSuccess: (res) => {
        qc.invalidateQueries({ queryKey: getGetRoutesQueryKey() });
        setRouteResult(res);
        setShowMap(true);
      },
      onError: () => showAlert('Ошибка', 'Не удалось построить маршрут. Попробуйте ещё раз.'),
    },
  });

  // Build polyline points from result
  const routePoints = useMemo(() => {
    if (!routeResult) return undefined;
    return buildRoutePoints(routeResult, origin, destination);
  }, [routeResult, origin, destination]);

  // Switch to map view when route is ready
  useEffect(() => {
    if (showMap && mapRef.current) {
      // map will fit bounds via routePoints effect in MapViewWrapper
    }
  }, [showMap, routePoints]);

  async function handlePlanRoute() {
    if (!destination.trim()) { showAlert('Пункт назначения', 'Введите конечную точку.'); return; }
    const pct = parseFloat(batteryPct);
    if (isNaN(pct) || pct < 0 || pct > 100) { showAlert('Неверный заряд', 'Введите заряд от 0 до 100%.'); return; }

    // Delete all existing active routes first → one route at a time
    const activeRoutes = (existingRoutes as any[]).filter((r) => r.status === 'active');
    await Promise.all(activeRoutes.map((r) => deleteRoute.mutateAsync({ id: r.id })));

    createRoute.mutate({
      data: {
        origin, destination,
        origin_lat: originCoords.lat, origin_lng: originCoords.lng,
        dest_lat: prefilledLat ?? 39.6542,
        dest_lng: prefilledLng ?? 66.9597,
        vehicle_id: selectedVehicleId ?? null,
        initial_battery_pct: pct,
      },
    });
  }

  function handleSwap() {
    const tmp = origin;
    setOrigin(destination);
    setDestination(tmp);
  }

  function formatTime(totalMin: number) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
  }

  const bottomPad = Platform.OS === 'web' ? 84 + 16 : insets.bottom;
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const isPending = createRoute.isPending || deleteRoute.isPending;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Маршрут</Text>
        {routeResult ? (
          <TouchableOpacity style={styles.iconBtn} onPress={() => { setRouteResult(null); setShowMap(false); }}>
            <Feather name="refresh-ccw" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Origin / Destination card */}
        <Animated.View entering={FadeInDown.delay(0).springify()}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.inputRow}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <TextInput
                style={[styles.inputText, { color: colors.text }]}
                value={origin}
                onChangeText={setOrigin}
                placeholder="Начальная точка"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={[styles.connector, { borderColor: colors.border }]} />
            <TouchableOpacity
              onPress={handleSwap}
              style={[styles.swapBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
            >
              <Feather name="code" size={14} color={colors.mutedForeground} style={{ transform: [{ rotate: '90deg' }] }} />
            </TouchableOpacity>
            <View style={styles.inputRow}>
              <View style={[styles.dot, { backgroundColor: '#7C3AED' }]} />
              <TextInput
                style={[styles.inputText, { color: colors.text }]}
                value={destination}
                onChangeText={setDestination}
                placeholder="Конечная точка"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>
        </Animated.View>

        {/* Car card */}
        <Animated.View entering={FadeInDown.delay(60).springify()}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.carRow}>
              <View style={[styles.carIcon, { backgroundColor: colors.muted }]}>
                <Feather name="truck" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.carName, { color: colors.text }]}>
                  {selectedVehicle?.name ?? 'Выберите автомобиль'}
                </Text>
                <Text style={[styles.carSub, { color: colors.mutedForeground }]}>
                  {batteryPct}% · {selectedVehicle?.range_km ?? 410} км запаса
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.paramRow}>
              <Text style={[styles.paramLabel, { color: colors.mutedForeground }]}>Заряд батареи</Text>
              <View style={styles.batteryInputRow}>
                <TextInput
                  style={[styles.batteryInput, { color: colors.text, borderColor: colors.border }]}
                  value={batteryPct}
                  onChangeText={setBatteryPct}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <Text style={[styles.pctLabel, { color: colors.mutedForeground }]}>%</Text>
              </View>
            </View>

            {routeResult && (
              <Animated.View entering={FadeInDown.springify()} style={styles.paramRow}>
                <Text style={[styles.paramLabel, { color: colors.mutedForeground }]}>Маршрут</Text>
                <Text style={[styles.paramValue, { color: colors.text }]}>
                  {Math.round(routeResult.total_distance_km)} км · ~{formatTime(routeResult.total_time_min)}
                </Text>
              </Animated.View>
            )}
          </View>
        </Animated.View>

        {/* Route result */}
        {routeResult && (
          <Animated.View entering={FadeInDown.delay(80).springify()}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Маршрут</Text>

            {/* Leaflet mini-map */}
            {showMap && routePoints && (
              <Animated.View entering={FadeInUp.delay(120).springify()} style={styles.mapContainer}>
                <MapViewWrapper
                  ref={mapRef}
                  stations={[]}
                  onStationPress={() => {}}
                  routePoints={routePoints}
                />
              </Animated.View>
            )}

            {/* Summary pill */}
            <View style={[styles.summaryPill, { backgroundColor: colors.card }]}>
              <View style={styles.summaryItem}>
                <Feather name="map" size={16} color={colors.primary} />
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {Math.round(routeResult.total_distance_km)} км
                </Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Feather name="clock" size={16} color={colors.primary} />
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {formatTime(routeResult.total_time_min)}
                </Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Feather name="zap" size={16} color={colors.primary} />
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {routeResult.stops?.length ?? 0} остановок
                </Text>
              </View>
            </View>

            {/* Stops */}
            {routeResult.stops?.length === 0 ? (
              <Animated.View entering={FadeInDown.springify()} style={[styles.noStopsCard, { backgroundColor: colors.card }]}>
                <Feather name="check-circle" size={28} color="#10B981" />
                <Text style={[styles.noStopsTitle, { color: colors.text }]}>Зарядка не нужна</Text>
                <Text style={[styles.noStopsSub, { color: colors.mutedForeground }]}>
                  Заряда хватит на весь маршрут
                </Text>
              </Animated.View>
            ) : (
              <View style={styles.stopsContainer}>
                {(routeResult.stops ?? []).map((stop: any, i: number) => (
                  <Animated.View
                    key={i}
                    entering={SlideInRight.delay(i * 80).springify()}
                    style={[styles.stopCard, { backgroundColor: colors.card }]}
                  >
                    <LinearGradient
                      colors={['#2563EB', '#7C3AED']}
                      style={styles.stopBadge}
                    >
                      <Text style={styles.stopBadgeText}>{i + 1}</Text>
                    </LinearGradient>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[styles.stopName, { color: colors.text }]}>{stop.station_name}</Text>
                      <Text style={[styles.stopDetails, { color: colors.mutedForeground }]}>
                        {stop.arrival_battery_pct}% → {stop.departure_battery_pct}% · {stop.charge_time_min} мин зарядки
                      </Text>
                    </View>
                    <Feather name="zap" size={16} color="#10B981" />
                  </Animated.View>
                ))}
              </View>
            )}
          </Animated.View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border, bottom: bottomPad }]}>
        {isPending ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              {deleteRoute.isPending ? 'Очищаем старый маршрут...' : 'Строим маршрут...'}
            </Text>
          </View>
        ) : routeResult ? (
          <GradientButton
            label="Поехали"
            onPress={() => router.back()}
            icon={<Feather name="navigation" size={18} color="#fff" />}
          />
        ) : (
          <GradientButton label="Построить маршрут" onPress={handlePlanRoute} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, gap: 16 },
  card: {
    borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  inputText: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  connector: { borderLeftWidth: 1.5, borderStyle: 'dashed', height: 20, marginLeft: 4, marginVertical: 2 },
  swapBtn: {
    position: 'absolute', right: 16, top: '50%',
    width: 28, height: 28, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  carRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  carIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  carName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  carSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  divider: { height: 1, marginVertical: 12 },
  paramRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paramLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  paramValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  batteryInputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  batteryInput: {
    width: 52, textAlign: 'center', fontSize: 15, fontFamily: 'Inter_600SemiBold',
    borderWidth: 1, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8,
  },
  pctLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  mapContainer: {
    height: 220, borderRadius: 20, overflow: 'hidden', marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
  },
  summaryPill: {
    flexDirection: 'row', borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 6 },
  summaryValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  summaryDivider: { width: 1, height: '100%' },
  noStopsCard: {
    borderRadius: 16, padding: 28, alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
  },
  noStopsTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  noStopsSub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  stopsContainer: { gap: 10 },
  stopCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
  },
  stopBadge: {
    width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  stopBadgeText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
  stopName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  stopDetails: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  footer: {
    position: 'absolute', left: 16, right: 16,
    backgroundColor: 'transparent', paddingVertical: 0,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  loadingText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
