import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Platform,
  Modal, FlatList,
} from 'react-native';
import * as Location from 'expo-location';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { apiOrigin } from '@/lib/apiBase';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useGetVehicles, useGetRoutes,
  useCreateRoute, useDeleteRoute,
  getGetRoutesQueryKey,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import { GradientButton } from '@/components/GradientButton';
import { MapViewWrapper, MapApi } from '@/components/MapViewWrapper';
import { PromoCountdown } from '@/components/PromoCountdown';
import { formatAmount, formatMoney } from '@/lib/format';

const API_BASE = apiOrigin()
  ? apiOrigin()
  : '';

interface Suggestion {
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}: ${message}`);
  else Alert.alert(title, message);
}

function formatTime(totalMin: number) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

function formatHHMM(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Eco-route approximation: same stops, ~12% longer drive time, ~20% more charging
function buildEcoVariant(fast: any): any {
  if (!fast) return null;
  const totalChargeMins = (fast.stops ?? []).reduce((s: number, st: any) => s + st.charge_time_min, 0);
  const driveTimeMins = fast.total_time_min - totalChargeMins;
  const ecoStops = (fast.stops ?? []).map((s: any) => ({
    ...s,
    departure_battery_pct: Math.min(95, s.departure_battery_pct + 10),
    charge_time_min: Math.round(s.charge_time_min * 1.2),
  }));
  const ecoChargeTime = ecoStops.reduce((s: number, st: any) => s + st.charge_time_min, 0);
  const ecoDriveTime  = Math.round(driveTimeMins * (0.9 / 0.85));
  return {
    ...fast,
    total_time_min: ecoDriveTime + ecoChargeTime,
    total_distance_km: parseFloat((fast.total_distance_km * 0.97).toFixed(1)),
    stops: ecoStops,
    final_battery_pct: Math.min(50, (fast.final_battery_pct ?? 15) + 8),
  };
}

// Cycling stop colors (operator-like gradient palette)
const STOP_GRADS: [string, string][] = [
  ['#2563EB', '#7C3AED'],
  ['#10B981', '#059669'],
  ['#F59E0B', '#D97706'],
  ['#EF4444', '#DC2626'],
  ['#8B5CF6', '#4F46E5'],
];

function buildRoutePoints(result: any, originLabel: string, destLabel: string) {
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

// ── Component ─────────────────────────────────────────────────────────────

export default function NewRouteScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const qc      = useQueryClient();
  const { selectedVehicleId, setSelectedVehicleId, setActiveRouteId } = useApp();
  const [carPickerVisible, setCarPickerVisible] = useState(false);
  const [pendingVehicleId, setPendingVehicleId] = useState<number | null>(null);
  const mapRef  = useRef<MapApi>(null);

  const params = useLocalSearchParams<{
    stationId?: string; stationName?: string; lat?: string; lng?: string;
  }>();

  const prefilledName = params.stationName ? decodeURIComponent(params.stationName) : '';
  const prefilledLat  = params.lat  ? parseFloat(params.lat)  : null;
  const prefilledLng  = params.lng  ? parseFloat(params.lng)  : null;

  const [origin, setOrigin]           = useState('Определяю местоположение…');
  const [destination, setDestination] = useState(prefilledName);
  const [batteryPct, setBatteryPct]   = useState('85');
  const [originCoords, setOriginCoords] = useState({ lat: 41.2995, lng: 69.2401 });
  const [locating, setLocating]       = useState(true);
  const [routeResult, setRouteResult] = useState<any>(null);
  const [showMap, setShowMap]         = useState(false);
  const [routeMode, setRouteMode]     = useState<'fast' | 'eco'>('fast');

  // Autocomplete state
  const [focusedField, setFocusedField] = useState<'origin' | 'dest' | null>(null);
  const [suggestions, setSuggestions]   = useState<Suggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  // Geocoded destination coords — null if user typed manually without picking a suggestion
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(
    prefilledLat != null && prefilledLng != null ? { lat: prefilledLat, lng: prefilledLng } : null,
  );
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: vehicles = [] }        = useGetVehicles();
  const { data: existingRoutes = [] }  = useGetRoutes();
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];

  const deleteRoute = useDeleteRoute();
  const createRoute = useCreateRoute({
    mutation: {
      // Телефон ходит в API по Wi-Fi к компьютеру — связь моргает. Сетевой сбой
      // (у ошибки нет HTTP-статуса) повторяем автоматически пару раз; ошибки
      // сервера/валидации (4xx/5xx) не повторяем — они не пройдут и с ретраем.
      retry: (count: number, err: any) => !err?.status && count < 2,
      retryDelay: 700,
      onSuccess: (res) => {
        qc.invalidateQueries({ queryKey: getGetRoutesQueryKey() });
        setRouteResult(res);
        setShowMap(true);
        setRouteMode('fast');
        setActiveRouteId(res.id);
      },
      onError: (err: any) => {
        // Разные причины — разные подсказки, чтобы не винить адреса зря.
        const status = err?.status as number | undefined;
        if (status === 401) {
          showAlert('Сессия истекла', 'Войдите снова, чтобы построить маршрут.');
        } else if (!status) {
          showAlert(
            'Нет связи с сервером',
            'Проверьте, что телефон и компьютер в одной сети Wi-Fi, и попробуйте ещё раз.',
          );
        } else if (status >= 500) {
          showAlert('Сервер занят', 'Не удалось построить маршрут. Попробуйте ещё раз через пару секунд.');
        } else {
          showAlert(
            'Маршрут не построился',
            'Проверьте адреса. Если они верны — выберите точку рядом.',
          );
        }
      },
    },
  });

  const ecoResult   = useMemo(() => buildEcoVariant(routeResult), [routeResult]);
  const activeResult = routeMode === 'fast' ? routeResult : ecoResult;

  const routePoints = useMemo(() => {
    if (!routeResult) return undefined;
    return buildRoutePoints(routeResult, origin, destination);
  }, [routeResult, origin, destination]);

  // GPS + reverse geocode on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setOrigin('Ташкент, Узбекистан'); setLocating(false); return; }

        // 8-second timeout; on failure try cached position, then Tashkent
        let loc: Location.LocationObject | null = null;
        try {
          loc = await Promise.race<Location.LocationObject>([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('gps_timeout')), 8_000)),
          ]);
        } catch {
          loc = await Location.getLastKnownPositionAsync().catch(() => null);
        }
        if (!loc) { setOrigin('Ташкент, Узбекистан'); setLocating(false); return; }
        const { latitude: lat, longitude: lng } = loc.coords;
        setOriginCoords({ lat, lng });
        const base   = apiOrigin();
        const r = await fetch(`${base}/api/geocode/reverse?lat=${lat}&lng=${lng}`);
        if (r.ok) { const { address } = await r.json(); setOrigin(address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`); }
        else setOrigin(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      } catch { setOrigin('Ташкент, Узбекистан'); }
      finally  { setLocating(false); }
    })();
  }, []);

  // ── Autocomplete helpers ─────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); return; }
    setSuggestLoading(true);
    try {
      const params = new URLSearchParams({ q: q.trim() });
      params.set('lat', String(originCoords.lat));
      params.set('lng', String(originCoords.lng));
      const res = await fetch(`${API_BASE}/api/geocode/suggest?${params}`);
      const json = await res.json();
      setSuggestions(Array.isArray(json) ? json : []);
    } catch { setSuggestions([]); }
    finally { setSuggestLoading(false); }
  }, [originCoords]);

  const scheduleSearch = useCallback((text: string) => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => fetchSuggestions(text), 350);
  }, [fetchSuggestions]);

  const handleOriginChange = (text: string) => {
    setOrigin(text);
    scheduleSearch(text);
  };

  const handleDestChange = (text: string) => {
    setDestination(text);
    setDestCoords(null); // invalidate geocoded coords when user edits manually
    scheduleSearch(text);
  };

  const handleSelectSuggestion = (s: Suggestion) => {
    if (focusedField === 'origin') {
      setOrigin(s.title);
      setOriginCoords({ lat: s.lat, lng: s.lng });
    } else {
      setDestination(s.title);
      setDestCoords({ lat: s.lat, lng: s.lng });
    }
    setSuggestions([]);
    setFocusedField(null);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
  };

  const clearSuggestions = () => {
    setSuggestions([]);
    setFocusedField(null);
  };

  // ── Route planning ───────────────────────────────────────────────────────
  async function handlePlanRoute() {
    if (!destination.trim()) { showAlert('Пункт назначения', 'Введите конечную точку.'); return; }
    const pct = parseFloat(batteryPct);
    if (isNaN(pct) || pct < 0 || pct > 100) { showAlert('Неверный заряд', 'Введите заряд от 0 до 100%.'); return; }

    // Resolve destination coords: use geocoded coords if available,
    // otherwise try to geocode the typed text on the spot
    let resolvedDest = destCoords;
    if (!resolvedDest) {
      try {
        const params = new URLSearchParams({ q: destination.trim() });
        params.set('lat', String(originCoords.lat));
        params.set('lng', String(originCoords.lng));
        const res  = await fetch(`${API_BASE}/api/geocode/suggest?${params}`);
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          resolvedDest = { lat: json[0].lat, lng: json[0].lng };
          setDestCoords(resolvedDest);
          setDestination(json[0].title);
        }
      } catch { /* fall through to Tashkent default */ }
    }
    if (!resolvedDest) {
      showAlert('Адрес не найден', 'Выберите адрес из списка подсказок или введите более точный запрос.');
      return;
    }

    const active = (existingRoutes as any[]).filter((r) => r.status === 'active');
    await Promise.all(active.map((r) => deleteRoute.mutateAsync({ id: r.id })));
    createRoute.mutate({
      data: {
        origin, destination,
        origin_lat: originCoords.lat, origin_lng: originCoords.lng,
        dest_lat: resolvedDest.lat,
        dest_lng: resolvedDest.lng,
        vehicle_id: selectedVehicleId ?? null,
        initial_battery_pct: pct,
      },
    });
  }

  function handleSwap() {
    const tmp = origin; setOrigin(destination); setDestination(tmp);
  }

  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 84;
  const topPad    = Platform.OS === 'web' ? 67  : insets.top;
  const isPending = createRoute.isPending || deleteRoute.isPending;

  // ── Derived timeline values ──────────────────────────────────────────────
  const startTime   = useMemo(() => new Date(), [routeResult]);
  const arrivalTime = useMemo(() => {
    if (!activeResult) return new Date();
    return new Date(startTime.getTime() + activeResult.total_time_min * 60_000);
  }, [activeResult, startTime]);

  const totalChargeMins = useMemo(() =>
    (activeResult?.stops ?? []).reduce((s: number, st: any) => s + st.charge_time_min, 0),
  [activeResult]);

  const totalSavings = useMemo(() => {
    const stops = activeResult?.stops ?? [];
    return stops.reduce((total: number, stop: any) => {
      if (!stop.is_promoted || !stop.discount_pct || !stop.price_per_kwh) return total;
      const newPricePerKwh  = stop.price_per_kwh as number;
      const origPricePerKwh = Math.round(newPricePerKwh / (1 - stop.discount_pct / 100));
      const energyKwh = (stop.connector_power_kw ?? 50) * stop.charge_time_min / 60;
      return total + Math.round((origPricePerKwh - newPricePerKwh) * energyKwh);
    }, 0);
  }, [activeResult]);

  const rangeKm = Math.round(((parseFloat(batteryPct) || 0) / 100) * (selectedVehicle?.range_km ?? 450));
  const speedKmPerMin = routeMode === 'eco' ? 0.85 : 0.9;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Назад" style={styles.iconBtn}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {routeResult ? 'Навигация' : 'Маршрут'}
        </Text>
        {routeResult ? (
          <TouchableOpacity style={styles.iconBtn} onPress={() => { setRouteResult(null); setShowMap(false); }}>
            <Feather name="refresh-ccw" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : <View style={styles.iconBtn} />}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Origin / Destination ────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={{ zIndex: 30 }}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {/* Origin row */}
            <View style={styles.inputRow}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <TextInput
                style={[styles.inputText, { color: colors.text }]}
                value={origin}
                onChangeText={handleOriginChange}
                onFocus={() => setFocusedField('origin')}
                onBlur={() => setTimeout(clearSuggestions, 150)}
                placeholder={locating ? 'Определяю местоположение…' : 'Начальная точка'}
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="next"
              />
              {focusedField === 'origin' && suggestLoading && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 4 }} />
              )}
            </View>
            <View style={[styles.connector, { borderColor: colors.border }]} />
            <TouchableOpacity
              onPress={handleSwap}
              style={[styles.swapBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
            >
              <Feather name="code" size={14} color={colors.mutedForeground} style={{ transform: [{ rotate: '90deg' }] }} />
            </TouchableOpacity>
            {/* Destination row */}
            <View style={styles.inputRow}>
              <View style={[styles.dot, { backgroundColor: '#7C3AED' }]} />
              <TextInput
                style={[styles.inputText, { color: colors.text }]}
                value={destination}
                onChangeText={handleDestChange}
                onFocus={() => setFocusedField('dest')}
                onBlur={() => setTimeout(clearSuggestions, 150)}
                placeholder="Конечная точка"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="done"
              />
              {focusedField === 'dest' && suggestLoading && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 4 }} />
              )}
              {/* Green tick when destination has geocoded coords */}
              {!!destCoords && !suggestLoading && (
                <Feather name="check-circle" size={16} color="#10B981" style={{ marginRight: 4 }} />
              )}
            </View>
          </View>

          {/* ── Autocomplete dropdown ──────────────────────────────────── */}
          {suggestions.length > 0 && focusedField !== null && (
            <View style={[styles.suggestBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {suggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.75}
                  onPress={() => handleSelectSuggestion(s)}
                  style={[
                    styles.suggestRow,
                    i < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={[styles.suggestIcon, { backgroundColor: colors.muted }]}>
                    <Feather name="map-pin" size={13} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.suggestTitle, { color: colors.text }]} numberOfLines={1}>
                      {s.title}
                    </Text>
                    {!!s.subtitle && (
                      <Text style={[styles.suggestSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {s.subtitle}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>

        {/* ── Car card ────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(60).springify()}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {/* Car row — tap opens inline picker */}
            <TouchableOpacity
              onPress={() => { setPendingVehicleId(selectedVehicle?.id ?? null); setCarPickerVisible(true); }}
              activeOpacity={0.8}
              style={styles.carRow}
            >
              <View style={[styles.carIcon, { backgroundColor: colors.muted }]}>
                <Feather name="truck" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.carLabel, { color: colors.mutedForeground }]}>Мой автомобиль</Text>
                <Text style={[styles.carName, { color: colors.text }]}>
                  {selectedVehicle?.name ?? 'Выберите автомобиль'}
                </Text>
                <Text style={[styles.carSub, { color: colors.mutedForeground }]}>
                  {batteryPct}% · {rangeKm} км запаса
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>

            {/* Battery input — standalone, NOT wrapped in car-press handler */}
            {!routeResult && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.paramRow}>
                  <Text style={[styles.paramLabel, { color: colors.mutedForeground }]}>Заряд батареи</Text>
                  <View style={styles.batteryInputRow}>
                    <TextInput
                      style={[styles.batteryInput, { color: colors.text, borderColor: colors.border }]}
                      value={batteryPct} onChangeText={setBatteryPct}
                      keyboardType="numeric" maxLength={3}
                    />
                    <Text style={[styles.pctLabel, { color: colors.mutedForeground }]}>%</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </Animated.View>

        {/* ── Car picker modal ─────────────────────────────────────────── */}
        <Modal
          visible={carPickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setCarPickerVisible(false)}
        >
          <TouchableOpacity
            style={styles.pickerBackdrop}
            activeOpacity={1}
            onPress={() => setCarPickerVisible(false)}
          />
          <View style={[styles.pickerSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.pickerHandle, { backgroundColor: colors.mutedForeground }]} />
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Выберите автомобиль</Text>

            <FlatList
              data={vehicles}
              keyExtractor={(v) => String(v.id)}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => {
                const isSelected = item.id === pendingVehicleId;
                return (
                  <TouchableOpacity
                    onPress={() => setPendingVehicleId(item.id)}
                    activeOpacity={0.8}
                    style={[
                      styles.pickerItem,
                      { borderColor: colors.border },
                      // Выбранный пункт — сплошной синий: читается и в светлой,
                      // и в тёмной теме (раньше был светлый фон + белый текст = невидимо).
                      isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  >
                    <View style={[styles.pickerItemIcon, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : colors.muted }]}>
                      <Feather name="truck" size={18} color={isSelected ? '#fff' : colors.mutedForeground} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pickerItemName, { color: isSelected ? '#fff' : colors.text }]}>{item.name}</Text>
                      <Text style={[styles.pickerItemSub, { color: isSelected ? 'rgba(255,255,255,0.85)' : colors.mutedForeground }]}>
                        {item.battery_kwh} кВт·ч · {item.range_km} км · {item.connector_type}
                      </Text>
                    </View>
                    {isSelected && <Feather name="check-circle" size={20} color="#fff" />}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}
            />

            <View style={[styles.pickerFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                disabled={!pendingVehicleId}
                onPress={() => {
                  if (pendingVehicleId) setSelectedVehicleId(pendingVehicleId);
                  setCarPickerVisible(false);
                }}
                activeOpacity={0.85}
                style={[styles.pickerConfirmWrap, { opacity: pendingVehicleId ? 1 : 0.4 }]}
              >
                <LinearGradient
                  colors={['#2563EB', '#7C3AED']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.pickerConfirmBtn}
                >
                  <Feather name="check" size={18} color="#fff" />
                  <Text style={styles.pickerConfirmText}>Выбрать автомобиль</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── Insufficient charge / no stations warning ─────────────── */}
        {routeResult?.insufficient_charge && (
          <Animated.View entering={FadeInDown.delay(50).springify()}>
            <View style={[styles.warnCard, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
              <Feather name="alert-triangle" size={20} color="#92400E" />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.warnTitle}>Недостаточно заряда</Text>
                <Text style={styles.warnText}>
                  {routeResult.message ?? 'Зарядитесь перед выездом или выберите более близкий пункт назначения.'}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {routeResult?.no_stations_along_route && !routeResult?.insufficient_charge && (
          <Animated.View entering={FadeInDown.delay(50).springify()}>
            <View style={[styles.warnCard, { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' }]}>
              <Feather name="map-pin" size={20} color="#C2410C" />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.warnTitle, { color: '#C2410C' }]}>Зарядных станций не найдено</Text>
                <Text style={styles.warnText}>
                  По этому маршруту нет доступных станций. Заряда может не хватить — зарядитесь перед выездом.
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {routeResult?.arrival_below_threshold && !routeResult?.insufficient_charge && !routeResult?.no_stations_along_route && (
          <Animated.View entering={FadeInDown.delay(50).springify()}>
            <View style={[styles.warnCard, { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' }]}>
              <Feather name="battery" size={20} color="#D97706" />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.warnTitle, { color: '#D97706' }]}>Низкий заряд при прибытии</Text>
                <Text style={styles.warnText}>
                  Вы доберётесь, но заряда останется менее 20%. Рекомендуем зарядиться по пути.
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Route result ────────────────────────────────────────────── */}
        {routeResult && activeResult && (
          <Animated.View entering={FadeInDown.delay(80).springify()} style={{ gap: 16 }}>

            {/* Route mode switcher */}
            <View style={styles.modeRow}>
              {(['fast', 'eco'] as const).map((m) => {
                const r = m === 'fast' ? routeResult : ecoResult;
                const isActive = routeMode === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setRouteMode(m)}
                    activeOpacity={0.8}
                    style={[styles.modeCard, { backgroundColor: isActive ? 'transparent' : colors.card, borderColor: isActive ? 'transparent' : colors.border }]}
                  >
                    {isActive && (
                      <LinearGradient
                        colors={m === 'fast' ? ['#EEF2FF', '#F5F3FF'] : ['#ECFDF5', '#F0FDF4']}
                        style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
                      />
                    )}
                    <View style={styles.modeCardInner}>
                      <View style={styles.modeIconRow}>
                        <View style={[styles.modeIcon, { backgroundColor: isActive ? (m === 'fast' ? '#EEF2FF' : '#ECFDF5') : colors.muted }]}>
                          <Feather
                            name={m === 'fast' ? 'zap' : 'wind'}
                            size={14}
                            color={isActive ? (m === 'fast' ? colors.primary : '#10B981') : colors.mutedForeground}
                          />
                        </View>
                        <Text style={[styles.modeTitle, { color: isActive ? (m === 'fast' ? colors.primary : '#10B981') : colors.mutedForeground }]}>
                          {m === 'fast' ? 'Быстрый маршрут' : 'Эко маршрут'}
                        </Text>
                      </View>
                      <Text style={[styles.modeStats, { color: colors.mutedForeground }]}>
                        {formatTime(r.total_time_min)} · {Math.round(r.total_distance_km)} км
                      </Text>
                    </View>
                    {isActive && (
                      <View style={[styles.modeCheckDot, { backgroundColor: m === 'fast' ? colors.primary : '#10B981' }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Summary stats strip */}
            {(() => {
              const finalBatt = activeResult.final_battery_pct ?? 15;
              const battColor = finalBatt >= 40 ? '#10B981' : finalBatt >= 20 ? '#F59E0B' : '#EF4444';
              return (
                <View style={[styles.statsRow, { backgroundColor: colors.card }]}>
                  {[
                    { value: `${Math.round(activeResult.total_distance_km)}`, unit: 'км', color: colors.text },
                    { value: formatTime(activeResult.total_time_min - totalChargeMins), unit: 'в пути', color: colors.text },
                    { value: formatTime(totalChargeMins), unit: 'на зарядки', color: colors.text },
                    { value: `${finalBatt}%`, unit: 'прибытие', color: battColor },
                  ].map((s, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <View style={[styles.statsDivider, { backgroundColor: colors.border }]} />}
                      <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                        <Text style={[styles.statUnit, { color: colors.mutedForeground }]}>{s.unit}</Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>
              );
            })()}

            {/* Mini-map */}
            {showMap && routePoints && (
              <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.mapContainer}>
                <MapViewWrapper
                  ref={mapRef}
                  stations={[]}
                  onStationPress={() => {}}
                  routePoints={routePoints}
                  polylineCoords={routeResult?.polyline ?? undefined}
                />
              </Animated.View>
            )}

            {/* ── Total savings banner ───────────────────────────────── */}
            {totalSavings > 0 && (
              <Animated.View entering={FadeInDown.delay(60).springify()}>
                <LinearGradient
                  colors={['#ECFDF5', '#D1FAE5']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.savingsBanner}
                >
                  <View style={styles.savingsIconCircle}>
                    <Feather name="tag" size={16} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.savingsTitle}>Экономия с EVGO</Text>
                    <Text style={styles.savingsAmount}>
                      ~{formatMoney(totalSavings)}
                    </Text>
                    <Text style={styles.savingsSub}>по сравнению с обычным маршрутом</Text>
                  </View>
                  <Feather name="smile" size={18} color="#10B981" />
                </LinearGradient>
              </Animated.View>
            )}

            {/* Trip plan timeline */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>План поездки</Text>
            <View style={[styles.timelineCard, { backgroundColor: colors.card }]}>
              {/* START */}
              <TLNode
                dot={<View style={[styles.tlDotBlue, { backgroundColor: colors.primary }]} />}
                title={origin}
                subtitle={`Старт · ${batteryPct}%`}
                time={formatHHMM(startTime)}
                colors={colors}
                showLine={activeResult.stops?.length > 0 || true}
              />

              {/* STOPS */}
              {(activeResult.stops ?? []).map((stop: any, i: number) => {
                const [g1, g2] = STOP_GRADS[i % STOP_GRADS.length];
                const segDriveMin = Math.round(stop.distance_from_prev_km / speedKmPerMin);
                // Promo savings for this stop
                const promo = (stop.is_promoted && stop.discount_pct > 0 && stop.price_per_kwh)
                  ? (() => {
                      const newP  = stop.price_per_kwh as number;
                      const oldP  = Math.round(newP / (1 - stop.discount_pct / 100));
                      const kwh   = (stop.connector_power_kw ?? 50) * stop.charge_time_min / 60;
                      return { oldPrice: oldP, newPrice: newP, discountPct: stop.discount_pct,
                               savingsSum: Math.round((oldP - newP) * kwh), endsAt: stop.promo_ends_at };
                    })()
                  : undefined;
                return (
                  <React.Fragment key={i}>
                    {/* Segment between nodes */}
                    <TLSegment
                      text={`${stop.distance_from_prev_km} км · ${formatTime(segDriveMin)}`}
                      colors={colors}
                    />
                    {/* Stop node */}
                    <TLNode
                      dot={
                        <LinearGradient colors={[g1, g2]} style={styles.tlDotGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                          <Feather name="zap" size={11} color="#fff" />
                        </LinearGradient>
                      }
                      title={stop.station_name}
                      subtitle={`${stop.connector_type ?? 'CCS2'} · ${stop.connector_power_kw ?? stop.power_kw ?? '—'} кВт`}
                      detail={`${stop.arrival_battery_pct}% → ${stop.departure_battery_pct}% · ${stop.charge_time_min} мин`}
                      time={stop.eta}
                      colors={colors}
                      showLine
                      promo={promo}
                    />
                  </React.Fragment>
                );
              })}

              {/* Final segment (last stop → destination) */}
              {(() => {
                const stops = activeResult.stops ?? [];
                if (stops.length === 0) return null;
                const usedKm = stops.reduce((s: number, st: any) => s + st.distance_from_prev_km, 0);
                const lastKm = parseFloat(Math.max(0, activeResult.total_distance_km - usedKm).toFixed(1));
                const lastMin = Math.round(lastKm / speedKmPerMin);
                return (
                  <TLSegment
                    text={`${lastKm} км · ${formatTime(lastMin)}`}
                    colors={colors}
                  />
                );
              })()}

              {/* ARRIVAL */}
              {(() => {
                const finalBatt = activeResult.final_battery_pct ?? 15;
                const battColor = finalBatt >= 40 ? '#10B981' : finalBatt >= 20 ? '#F59E0B' : '#EF4444';
                const battEmoji = finalBatt >= 40 ? '✅' : finalBatt >= 20 ? '⚡' : '⚠️';
                return (
                  <TLNode
                    dot={<View style={[styles.tlDotPurple, { backgroundColor: '#7C3AED' }]} />}
                    title={destination}
                    subtitle={`${battEmoji} Прибытие · `}
                    subtitleBold={`${finalBatt}%`}
                    subtitleBoldColor={battColor}
                    time={formatHHMM(arrivalTime)}
                    colors={colors}
                    showLine={false}
                  />
                );
              })()}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { bottom: bottomPad - 72, backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {isPending ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              {deleteRoute.isPending ? 'Очищаем старый маршрут...' : 'Строим маршрут...'}
            </Text>
          </View>
        ) : routeResult ? (
          <View style={styles.footerTwoBtn}>
            <TouchableOpacity
              onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Назад"
              activeOpacity={0.8}
              style={[styles.saveBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.saveBtnText, { color: colors.text }]}>Сохранить маршрут</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/navigate' as any)}
              activeOpacity={0.85}
              style={styles.goWrap}
            >
              <LinearGradient
                colors={['#2563EB', '#7C3AED']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.goBtn}
              >
                <Text style={styles.goBtnText}>Поехали</Text>
                <Feather name="navigation" size={16} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <GradientButton label="Построить маршрут" onPress={handlePlanRoute} />
        )}
      </View>
    </View>
  );
}

// ── Timeline sub-components ───────────────────────────────────────────────

interface TLNodeProps {
  dot: React.ReactNode;
  title: string;
  subtitle: string;
  subtitleBold?: string;
  subtitleBoldColor?: string;
  detail?: string;
  time: string;
  colors: any;
  showLine: boolean;
  promo?: { oldPrice: number; newPrice: number; discountPct: number; savingsSum: number; endsAt?: string | null };
}

function TLNode({ dot, title, subtitle, subtitleBold, subtitleBoldColor, detail, time, colors, showLine, promo }: TLNodeProps) {
  return (
    <View style={styles.tlRow}>
      {/* Left: dot + vertical line */}
      <View style={styles.tlLeft}>
        <View style={styles.tlDotWrap}>{dot}</View>
        {showLine && <View style={[styles.tlLine, { backgroundColor: colors.border }]} />}
      </View>
      {/* Right: content */}
      <View style={[styles.tlContent, { paddingBottom: showLine ? 18 : 0 }]}>
        <View style={styles.tlContentRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.tlTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
            <Text style={[styles.tlSubtitle, { color: colors.mutedForeground }]}>
              {subtitle}{subtitleBold
                ? <Text style={{ fontWeight: '700', color: subtitleBoldColor ?? colors.text }}>{subtitleBold}</Text>
                : null}
            </Text>
            {detail && <Text style={[styles.tlDetail, { color: colors.primary }]}>{detail}</Text>}
            {/* Promo pricing inline */}
            {promo && (
              <View style={styles.tlPromoWrap}>
                <View style={styles.tlPromoPrice}>
                  <Text style={[styles.tlOldPriceText, { color: colors.mutedForeground }]}>
                    {formatAmount(promo.oldPrice)}
                  </Text>
                  <Text style={[styles.tlNewPriceText, { color: '#10B981' }]}>
                    {formatAmount(promo.newPrice)}
                  </Text>
                  <View style={styles.tlDiscBadge}>
                    <Text style={styles.tlDiscText}>-{promo.discountPct}%</Text>
                  </View>
                </View>
                <View style={styles.tlSavingsRow}>
                  <Feather name="trending-down" size={10} color="#10B981" />
                  <Text style={styles.tlSavingsText}>
                    Вы экономите {formatMoney(promo.savingsSum)}
                  </Text>
                  {promo.endsAt && <PromoCountdown endsAt={promo.endsAt} compact />}
                </View>
              </View>
            )}
          </View>
          <Text style={[styles.tlTime, { color: colors.mutedForeground }]}>{time}</Text>
        </View>
      </View>
    </View>
  );
}

interface TLSegmentProps { text: string; colors: any; }
function TLSegment({ text, colors }: TLSegmentProps) {
  return (
    <View style={styles.tlRow}>
      <View style={styles.tlLeft}>
        <View style={styles.tlLineOnly}>
          <View style={[styles.tlLine, { backgroundColor: colors.border }]} />
        </View>
      </View>
      <View style={styles.tlSegContent}>
        <Text style={[styles.tlSegText, { color: colors.mutedForeground }]}>{text}</Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  iconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, gap: 16 },

  // Cards
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

  // Car card
  carRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  carIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  carLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', marginBottom: 1 },
  carName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  carSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  divider: { height: 1, marginVertical: 12 },
  paramRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paramLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  batteryInputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  batteryInput: {
    width: 52, textAlign: 'center', fontSize: 15, fontFamily: 'Inter_600SemiBold',
    borderWidth: 1, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8,
  },
  pctLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },

  // Mode switcher
  modeRow: { flexDirection: 'row', gap: 10 },
  modeCard: {
    flex: 1, borderRadius: 14, borderWidth: 1.5, padding: 12, overflow: 'hidden', position: 'relative',
  },
  modeCardInner: { gap: 6 },
  modeIconRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  modeIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modeTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', flexShrink: 1 },
  modeStats: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  modeCheckDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4 },

  // Stats row
  statsRow: {
    flexDirection: 'row', borderRadius: 16, paddingVertical: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  statUnit: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  statsDivider: { width: 1, height: '100%' },

  // Map
  mapContainer: {
    height: 200, borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
  },

  // Timeline card
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  timelineCard: {
    borderRadius: 20, paddingTop: 16, paddingBottom: 8, paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
  },
  tlRow: { flexDirection: 'row' },
  tlLeft: { width: 32, alignItems: 'center' },
  tlDotWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  tlDotBlue: { width: 14, height: 14, borderRadius: 7 },
  tlDotPurple: { width: 14, height: 14, borderRadius: 7 },
  tlDotGrad: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2,
  },
  tlLine: { width: 2, flex: 1, minHeight: 12, borderRadius: 1 },
  tlLineOnly: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  tlContent: { flex: 1, paddingLeft: 8, paddingTop: 4 },
  tlContentRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  tlTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  tlSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  tlDetail: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 1 },
  tlTime: { fontSize: 13, fontFamily: 'Inter_600SemiBold', flexShrink: 0, paddingTop: 3 },
  tlSegContent: { flex: 1, paddingLeft: 8, paddingTop: 5, paddingBottom: 5 },
  // Promo within TLNode
  tlPromoWrap: { marginTop: 6, gap: 4 },
  tlPromoPrice: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tlOldPriceText: { fontSize: 11, fontFamily: 'Inter_400Regular', textDecorationLine: 'line-through' },
  tlNewPriceText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  tlDiscBadge: { backgroundColor: '#FEF2F2', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 },
  tlDiscText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#EF4444' },
  tlSavingsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tlSavingsText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#10B981' },
  // Savings banner
  savingsBanner: {
    borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
  },
  savingsIconCircle: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#10B981',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  savingsTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#065F46' },
  savingsAmount: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#10B981' },
  savingsSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#059669' },
  // Insufficient-charge warning
  warnCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 16, borderWidth: 1.5, padding: 14,
  },
  warnTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#92400E' },
  warnText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#92400E', lineHeight: 17 },
  tlSegText: { fontSize: 11, fontFamily: 'Inter_400Regular' },

  // Footer
  footer: {
    position: 'absolute', left: 16, right: 16,
    borderTopWidth: 0, backgroundColor: 'transparent',
  },
  footerTwoBtn: { flexDirection: 'row', gap: 10 },
  saveBtn: {
    flex: 1, paddingVertical: 15, borderRadius: 14, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  goWrap: { flex: 1.2, borderRadius: 14, overflow: 'hidden' },
  goBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 15,
  },
  goBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  loadingText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  // Car picker modal
  pickerBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 24,
  },
  pickerHandle: {
    width: 36, height: 4, borderRadius: 2, opacity: 0.3,
    alignSelf: 'center', marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 18, fontFamily: 'Inter_700Bold',
    textAlign: 'center', marginBottom: 4, paddingHorizontal: 16,
  },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1.5,
  },
  pickerItemIcon: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  pickerItemName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  pickerItemSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  pickerFooter: {
    borderTopWidth: 1, padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  pickerConfirmWrap: { borderRadius: 16, overflow: 'hidden' },
  pickerConfirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  pickerConfirmText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },

  // Autocomplete dropdown
  suggestBox: {
    marginTop: 4,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  suggestIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  suggestTitle: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  suggestSub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
});
