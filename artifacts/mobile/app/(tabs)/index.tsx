import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Pressable, Platform, PanResponder, Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
  FadeInDown, FadeInRight, Layout, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useGetStations, useGetVehicles } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import { StationCard } from '@/components/StationCard';
import { MapViewWrapper, MapApi } from '@/components/MapViewWrapper';
import { FiltersSheet, FiltersState } from '@/components/FiltersSheet';
import { StationQuickView, type QuickViewStation } from '@/components/StationQuickView';
import { HotDealBanner } from '@/components/HotDealBanner';
import { LinearGradient } from 'expo-linear-gradient';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Snap system ────────────────────────────────────────────────────────────
// SHEET_MIN is fixed; SHEET_MID / SHEET_MAX depend on insets.top (computed inside component)
const SHEET_MIN = 190;

const IOS_EASE = Easing.bezier(0.25, 0.46, 0.45, 0.94);
const STATUS_ORDER: Record<string, number> = { free: 0, occupied: 1, offline: 2 };
const COLLAPSED_LIMIT = 15; // stations shown without expanding

// Haversine distance in km
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
type FilterStatus = 'all' | 'my-cars' | 'ac' | 'dc' | 'free';

const DEFAULT_FILTERS: FiltersState = {
  connectorTypes: [], availability: 'all', amenities: [],
  minPowerKw: 3, maxPowerKw: 350, maxPriceSum: 5000, vehicleId: null,
};

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<MapApi>(null);

  // ── Dynamic snap points (depend on safe-area insets) ──────────────────────
  // Leave a ~8% strip of map visible above the fully-open sheet
  const SHEET_MAX = Math.round(SCREEN_HEIGHT * 0.92 - Math.max(insets.top, 20));
  const SHEET_MID = Math.round(SCREEN_HEIGHT * 0.55);
  // Stable ref so PanResponder closures (created once) always see latest values
  const snapsRef  = useRef<[number, number, number]>([SHEET_MIN, SHEET_MID, SHEET_MAX]);
  snapsRef.current = [SHEET_MIN, SHEET_MID, SHEET_MAX]; // refresh every render
  // Stable ref to the latest snapTo callback (updated after functions defined)
  const snapToRef = useRef<(level: 0 | 1 | 2) => void>(() => {});

  // ── State ────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [activeChip, setActiveChip] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  // Drives pointerEvents on map controls (re-render needed when sheet is raised)
  const [sheetAtTop, setSheetAtTop] = useState(false);
  // Active tab inside the bottom sheet
  const [activeTab, setActiveTab] = useState<string>('nearby');

  // Track current snap level as a ref (no re-render needed)
  const snapLevel = useRef<0 | 1 | 2>(0); // 0=min, 1=mid, 2=max

  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [markerPos, setMarkerPos] = useState<{ x: number; y: number } | null>(null);

  // ── Sheet animation ──────────────────────────────────────────────────────
  const sheetHeight = useSharedValue(SHEET_MIN);
  const sheetStyle = useAnimatedStyle(() => ({ height: sheetHeight.value }));

  // Map controls: bottom tracks sheet height; fade out when sheet ≥ mid
  const mapControlsStyle = useAnimatedStyle(() => {
    const h   = sheetHeight.value;
    const mid = SCREEN_HEIGHT * 0.55; // inline constant safe for worklet
    const opacity = interpolate(h, [mid - 40, mid + 40], [1, 0], Extrapolation.CLAMP);
    return { bottom: h + 16, opacity };
  });

  // ── Snap helpers ─────────────────────────────────────────────────────────
  function animateTo(target: number, dur = 350) {
    sheetHeight.value = withTiming(target, { duration: dur, easing: IOS_EASE });
  }
  function snapTo(level: 0 | 1 | 2) {
    snapLevel.current = level;
    setSheetAtTop(level >= 1);
    animateTo(snapsRef.current[level]);
  }
  // Keep ref in sync so panResponder closure always calls the latest snapTo
  snapToRef.current = snapTo;

  // ── Pan gesture (handle zone only) ──────────────────────────────────────
  const gestureStart = useRef(SHEET_MIN);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Claim only clearly vertical gestures
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dy) > 6 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
      onPanResponderGrant: () => {
        gestureStart.current = sheetHeight.value as number;
      },
      onPanResponderMove: (_, gs) => {
        const [minH,, maxH] = snapsRef.current;
        const next = Math.max(minH, Math.min(maxH, gestureStart.current - gs.dy));
        sheetHeight.value = next;
      },
      onPanResponderRelease: (_, gs) => {
        const current = sheetHeight.value as number;
        // Fast flick → jump to extreme snap
        if (gs.vy < -0.5) { snapToRef.current(2); return; }
        if (gs.vy >  0.5) { snapToRef.current(0); return; }
        // Otherwise snap to nearest point
        const snaps = snapsRef.current;
        const nearest = snaps.reduce((p, c) =>
          Math.abs(c - current) < Math.abs(p - current) ? c : p
        );
        snapToRef.current(snaps.indexOf(nearest) as 0 | 1 | 2);
      },
    })
  ).current;

  // Geolocation on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  const { selectedVehicleId } = useApp();
  const { data: vehicles = [] } = useGetVehicles();
  const defaultVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0];

  const { data: stationsData } = useGetStations(undefined, { query: { refetchInterval: 30_000 } });
  const allStations = useMemo(() => (stationsData?.nearby ?? []) as any[], [stationsData]);
  const promotedFromApi = useMemo(() => (stationsData?.promoted ?? []) as any[], [stationsData]);

  const applyChipFilter = useCallback(<T extends { status: string }>(list: T[]): T[] => {
    if (activeChip === 'free') return list.filter(s => s.status === 'free');
    if (activeChip === 'my-cars' && defaultVehicle?.connector_type) {
      return list.filter(s => ((s as any).connectors ?? []).some((c: any) => c.type === defaultVehicle.connector_type));
    }
    if (activeChip === 'ac') return list.filter(s => ((s as any).connectors ?? []).some((c: any) => ['Type2', 'Type 2', 'AC'].includes(c.type)));
    if (activeChip === 'dc') return list.filter(s => ((s as any).connectors ?? []).some((c: any) => ['CCS2', 'CHAdeMO', 'GB/T', 'DC'].includes(c.type)));
    return list;
  }, [activeChip, defaultVehicle]);

  const applySheetFilter = useCallback((list: any[]): any[] => {
    let r = list;
    if (activeFilters.availability === 'free') r = r.filter(s => s.status === 'free');
    if (activeFilters.availability === 'busy') r = r.filter(s => s.status === 'occupied');
    if (activeFilters.connectorTypes.length > 0)
      r = r.filter(s => ((s.connectors ?? []) as any[]).some(c => activeFilters.connectorTypes.includes(c.type)));
    r = r.filter(s => s.power_kw >= activeFilters.minPowerKw && s.power_kw <= activeFilters.maxPowerKw);
    r = r.filter(s => s.price_per_kwh <= activeFilters.maxPriceSum);
    return r;
  }, [activeFilters]);

  const hasActiveFilters = activeFilters.connectorTypes.length > 0 || activeFilters.availability !== 'all'
    || activeFilters.amenities.length > 0 || activeFilters.maxPriceSum < 5000
    || activeFilters.minPowerKw > 3 || activeFilters.maxPowerKw < 350;

  const filteredStations = useMemo(() => {
    let r = allStations;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(s => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q));
    }
    r = applyChipFilter(r);
    r = applySheetFilter(r);

    // Attach distance_km when we have user location
    const withDist = r.map(s => ({
      ...s,
      distance_km: userLocation
        ? haversine(userLocation.lat, userLocation.lng, s.lat, s.lng)
        : (s.distance_km ?? null),
    }));

    // Sort: by distance (nearest first) if location known, else status → name
    return withDist.sort((a, b) => {
      if (userLocation && a.distance_km != null && b.distance_km != null) {
        return a.distance_km - b.distance_km;
      }
      const d = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
      return d !== 0 ? d : a.name.localeCompare(b.name, 'ru');
    });
  }, [allStations, search, applyChipFilter, applySheetFilter, userLocation]);

  const promotedStations = useMemo(() => {
    if (!search.trim()) return promotedFromApi;
    const q = search.toLowerCase();
    return promotedFromApi.filter(s => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q));
  }, [promotedFromApi, search]);

  // ── Sheet tabs — built dynamically from filtered dataset ──────────────────
  const DC_TYPES = ['CCS2', 'CHAdeMO', 'GB/T', 'DC'];
  const AC_TYPES = ['Type2', 'Type 2', 'AC'];

  const sheetTabs = useMemo(() => {
    const tabs: Array<{ id: string; label: string }> = [
      { id: 'nearby',      label: 'Рядом' },
      { id: 'recommended', label: 'Рекомендуем' },
      { id: 'cheap',       label: 'Дешёвые' },
      { id: 'free',        label: 'Свободные' },
    ];

    const typeCounts = new Map<string, number>();
    let hybridCount = 0;

    for (const s of filteredStations) {
      const connectors = (s.connectors ?? []) as any[];
      const types = new Set(connectors.map((c: any) => c.type as string));
      const hasAC = [...types].some(t => AC_TYPES.includes(t));
      const hasDC = [...types].some(t => DC_TYPES.includes(t));
      if (hasAC && hasDC) hybridCount++;
      for (const t of types) typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
    }

    // Connector tabs sorted by popularity
    for (const [type, count] of [...typeCounts.entries()].sort((a, b) => b[1] - a[1])) {
      tabs.push({ id: `connector:${type}`, label: `${type} · ${count}` });
    }

    // Hybrid tab only when matching stations exist
    if (hybridCount > 0) {
      tabs.push({ id: 'hybrid', label: `Гибрид · ${hybridCount}` });
    }

    return tabs;
  }, [filteredStations]);

  // ── Tab-level sort/filter ON TOP of the chip-filtered set ─────────────────
  const tabStations = useMemo(() => {
    const base = filteredStations;
    switch (activeTab) {
      case 'recommended':
        return [...base]
          .filter(s => !!(s as any).is_promoted)
          .sort((a, b) => (Number((b as any).discount_pct) || 0) - (Number((a as any).discount_pct) || 0));
      case 'cheap': {
        const eff = (s: any) => {
          const d = Number(s.discount_pct) || 0;
          return d > 0 ? s.price_per_kwh * (1 - d / 100) : s.price_per_kwh;
        };
        return [...base].sort((a, b) => eff(a) - eff(b));
      }
      case 'nearby':
        return base; // already sorted by distance
      case 'free':
        return base.filter(s => s.status === 'free');
      case 'hybrid':
        return base.filter(s => {
          const types = ((s.connectors ?? []) as any[]).map((c: any) => c.type as string);
          return types.some(t => AC_TYPES.includes(t)) && types.some(t => DC_TYPES.includes(t));
        });
      default:
        if (activeTab.startsWith('connector:')) {
          const type = activeTab.replace('connector:', '');
          return base.filter(s => ((s.connectors ?? []) as any[]).some((c: any) => c.type === type));
        }
        return base;
    }
  }, [filteredStations, activeTab]);

  const markers = useMemo(() => filteredStations.map(s => ({
    id: s.id, lat: s.lat, lng: s.lng, name: s.name, status: s.status,
    power_kw: s.power_kw, price_per_kwh: s.price_per_kwh,
    is_promoted: !!(s as any).is_promoted,
  })), [filteredStations]);

  const handleStationPress = useCallback((id: number) => {
    // Single tap → open station page immediately.
    // The old two-tap flow (1st tap = QuickView, 2nd tap = navigate) was confusing
    // and broke when projectPoint returned null (QuickView invisible → nothing happened).
    router.push(`/station/${id}` as any);
  }, [router]);

  const selectedStation = useMemo<QuickViewStation | null>(() => {
    if (selectedStationId == null) return null;
    return [...allStations, ...promotedFromApi].find(s => s.id === selectedStationId) as QuickViewStation ?? null;
  }, [selectedStationId, allStations, promotedFromApi]);

  const selectedStationRef = useRef(selectedStation);
  selectedStationRef.current = selectedStation;

  const computeMarkerPos = useCallback(async (lat: number, lng: number) => {
    const pos = await mapRef.current?.projectPoint(lat, lng);
    if (pos) setMarkerPos(pos);
  }, []);

  useEffect(() => {
    if (!selectedStation) { setMarkerPos(null); return; }
    computeMarkerPos(selectedStation.lat, selectedStation.lng);
  }, [selectedStation?.id]);

  const handleRegionChange = useCallback(() => {
    const s = selectedStationRef.current;
    if (!s) return;
    mapRef.current?.projectPoint(s.lat, s.lng).then(pos => {
      if (pos) setMarkerPos(pos);
    });
  }, []);

  const topOffset = Platform.OS === 'web' ? 0 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 + 84 : insets.bottom + 100;

  const routeFor = (s: any) =>
    `/route/new?stationId=${s.id}&stationName=${encodeURIComponent(s.name)}&lat=${s.lat}&lng=${s.lng}` as any;

  // Helper: is the sheet at least half-open?
  const isOpen = snapLevel.current >= 1;

  // ── TOP BAR ──────────────────────────────────────────────────────────────
  const TopBar = (
    <View style={[styles.topBar, { top: topOffset + 8 }]}>
      <Text style={[styles.logo, { color: colors.primary }]}>iON</Text>
      <View style={[styles.segmentControl, { backgroundColor: colors.card }]}>
        {(['map', 'list'] as const).map(mode => (
          <TouchableOpacity
            key={mode}
            onPress={() => setViewMode(mode)}
            style={[styles.segmentBtn, viewMode === mode && styles.segmentBtnActive]}
          >
            {viewMode === mode && (
              <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={StyleSheet.absoluteFill} borderRadius={100} />
            )}
            <Text style={[styles.segmentText, { color: viewMode === mode ? '#fff' : colors.mutedForeground }]}>
              {mode === 'map' ? 'Карта' : 'Список'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={() => router.push('/notifications')}>
        <Feather name="bell" size={18} color={colors.text} />
      </TouchableOpacity>
    </View>
  );

  // ── FILTER CHIPS ──────────────────────────────────────────────────────────
  const FilterChips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.filterScroll, { top: topOffset + 60 }]}
      contentContainerStyle={styles.filterRow}
      // keyboardShouldPersistTaps + scrollEnabled fixes touch propagation on iOS Safari
      keyboardShouldPersistTaps="always"
      scrollEventThrottle={16}
    >
      {/* Use Pressable — more reliable than TouchableOpacity on iOS/web */}
      <Pressable
        onPress={() => setFiltersVisible(true)}
        style={({ pressed }) => [
          styles.filterPill,
          {
            backgroundColor: hasActiveFilters ? 'transparent' : colors.card,
            borderColor: hasActiveFilters ? 'transparent' : colors.border,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        {hasActiveFilters && <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={StyleSheet.absoluteFill} borderRadius={20} />}
        <Feather name="sliders" size={14} color={hasActiveFilters ? '#fff' : colors.text} style={{ position: 'relative', zIndex: 1 }} />
        <Text style={[styles.filterText, { color: hasActiveFilters ? '#fff' : colors.text }]}>Фильтры{hasActiveFilters ? ' ●' : ''}</Text>
      </Pressable>
      {([
        { id: 'all', label: 'Все' }, { id: 'free', label: 'Свободные' },
        { id: 'my-cars', label: 'Мои машины' }, { id: 'ac', label: 'AC' }, { id: 'dc', label: 'DC' },
      ] as { id: FilterStatus; label: string }[]).map(f => {
        const isActive = activeChip === f.id;
        return (
          <Pressable
            key={f.id}
            onPress={() => setActiveChip(f.id)}
            style={({ pressed }) => [
              styles.filterPill,
              {
                backgroundColor: isActive ? 'transparent' : colors.card,
                borderColor: isActive ? 'transparent' : colors.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            {isActive && <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={StyleSheet.absoluteFill} borderRadius={20} />}
            <Text style={[styles.filterText, { color: isActive ? '#fff' : colors.text }]}>{f.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topOffset }]}>
        {TopBar}
        <View style={[styles.searchWrap, { marginTop: topOffset + 70 }]}>
          <View style={[styles.searchInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchText, { color: colors.text }]}
              placeholder="Поиск станций…" placeholderTextColor={colors.mutedForeground}
              value={search} onChangeText={setSearch}
            />
            {search ? <TouchableOpacity onPress={() => setSearch('')}><Feather name="x" size={16} color={colors.mutedForeground} /></TouchableOpacity> : null}
          </View>
        </View>
        {FilterChips}
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {filteredStations.map((s, i) => (
            <Animated.View
              key={s.id}
              entering={FadeInDown.delay(i * 35).duration(300).easing(IOS_EASE)}
              layout={Layout.duration(250).easing(IOS_EASE)}
            >
              <StationCard
                station={s}
                onPress={() => router.push(`/station/${s.id}`)}
                onRoute={() => router.push(routeFor(s))}
                discount_pct={(s as any).discount_pct}
                is_promoted={(s as any).is_promoted}
                amenities={(s as any).amenities}
              />
            </Animated.View>
          ))}
        </ScrollView>
        <FiltersSheet visible={filtersVisible} onClose={() => setFiltersVisible(false)} onApply={(f) => setActiveFilters(f)} />
      </View>
    );
  }

  // ── MAP VIEW ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <MapViewWrapper
        ref={mapRef} stations={markers} userLocation={userLocation}
        onStationPress={handleStationPress}
        onMapPress={() => { setSelectedStationId(null); setMarkerPos(null); }}
        onRegionChange={handleRegionChange}
      />
      {TopBar}
      {FilterChips}

      {/* Bottom sheet */}
      <Animated.View style={[styles.sheet, { backgroundColor: colors.card }, sheetStyle]}>

        {/* Handle area — full-width tap + drag zone (min 44px) */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            const next = ((snapLevel.current + 1) % 3) as 0 | 1 | 2;
            snapTo(next);
          }}
          style={styles.handleArea}
          {...panResponder.panHandlers}
        >
          <View style={[styles.handle, { backgroundColor: colors.mutedForeground, opacity: 0.3 }]} />
        </TouchableOpacity>

        {/* ── TAB STRIP ──────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabScroll}
          contentContainerStyle={styles.tabRow}
          keyboardShouldPersistTaps="always"
        >
          {sheetTabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.tab,
                  { borderColor: isActive ? 'transparent' : colors.border, backgroundColor: isActive ? 'transparent' : colors.card },
                ]}
              >
                {isActive && (
                  <LinearGradient
                    colors={[colors.gradientStart, colors.gradientEnd]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                    borderRadius={100}
                  />
                )}
                <Text style={[styles.tabText, { color: isActive ? '#fff' : colors.text }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── CONTENT ────────────────────────────────────────────────────── */}
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {/* Recommended tab only: HotDeal banner + promo slider */}
          {activeTab === 'recommended' && (() => {
            const hot = (promotedStations as any[]).find(s => Number(s.discount_pct) > 0 && s.promo_ends_at);
            return hot ? (
              <HotDealBanner
                station={hot}
                onPress={() => router.push(`/station/${hot.id}`)}
                onRoute={() => router.push(routeFor(hot))}
              />
            ) : null;
          })()}

          {activeTab === 'recommended' && promotedStations.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Рекомендуем</Text>
                <View style={[styles.adBadge, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.adBadgeText, { color: colors.mutedForeground }]}>Реклама</Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.promoScroll}
                snapToInterval={292}
                decelerationRate="fast"
                disableIntervalMomentum
              >
                {promotedStations.map((s, i) => (
                  <Animated.View key={s.id} entering={FadeInRight.delay(i * 50).duration(280).easing(IOS_EASE)} style={styles.promoCard}>
                    <StationCard
                      station={s}
                      onPress={() => router.push(`/station/${s.id}`)}
                      onRoute={() => router.push(routeFor(s))}
                      compact
                      discount_pct={(s as any).discount_pct}
                      is_promoted
                      amenities={(s as any).amenities}
                    />
                  </Animated.View>
                ))}
              </ScrollView>
            </>
          )}

          {/* Empty state */}
          {tabStations.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="map-pin" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Станций нет</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Нет станций с такими фильтрами
              </Text>
              {hasActiveFilters && (
                <TouchableOpacity
                  onPress={() => setActiveFilters(DEFAULT_FILTERS)}
                  style={[styles.resetBtn, { borderColor: colors.primary }]}
                >
                  <Text style={[styles.resetBtnText, { color: colors.primary }]}>Сбросить фильтры</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {tabStations.slice(0, COLLAPSED_LIMIT).map((s, i) => (
                <Animated.View key={s.id} entering={FadeInDown.delay(i * 25).duration(280).easing(IOS_EASE)} layout={Layout.duration(220).easing(IOS_EASE)}>
                  <StationCard
                    station={s}
                    onPress={() => router.push(`/station/${s.id}`)}
                    onRoute={() => router.push(routeFor(s))}
                    discount_pct={(s as any).discount_pct}
                    is_promoted={(s as any).is_promoted}
                    amenities={(s as any).amenities}
                  />
                </Animated.View>
              ))}
              {tabStations.length > COLLAPSED_LIMIT && (
                <TouchableOpacity onPress={() => snapTo(2)} style={styles.showMoreBtn}>
                  <Text style={[styles.showMoreText, { color: colors.primary }]}>
                    + ещё {tabStations.length - COLLAPSED_LIMIT} станций
                  </Text>
                  <Feather name="chevron-up" size={14} color={colors.primary} />
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>

      {/* Map controls — follow sheet height, fade out when sheet is mid or higher */}
      <Animated.View
        style={[styles.mapControls, mapControlsStyle]}
        pointerEvents={sheetAtTop ? 'none' : 'box-none'}
      >
        <TouchableOpacity style={styles.mapBtn} onPress={() => mapRef.current?.locate()} activeOpacity={0.8}>
          <Feather name="navigation" size={18} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.zoomGroup}>
          <TouchableOpacity style={styles.zoomBtn} onPress={() => mapRef.current?.zoomIn()} activeOpacity={0.8}>
            <Feather name="plus" size={20} color="#1E293B" />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity style={styles.zoomBtn} onPress={() => mapRef.current?.zoomOut()} activeOpacity={0.8}>
            <Feather name="minus" size={20} color="#1E293B" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <FiltersSheet visible={filtersVisible} onClose={() => setFiltersVisible(false)} onApply={(f) => setActiveFilters(f)} />

      {selectedStation && (
        <StationQuickView
          station={selectedStation}
          position={markerPos}
          userLocation={userLocation}
          onClose={() => { setSelectedStationId(null); setMarkerPos(null); }}
          onOpenFull={() => {
            setSelectedStationId(null);
            setMarkerPos(null);
            router.push(`/station/${selectedStation.id}`);
          }}
          onNavigate={() => {
            setSelectedStationId(null);
            setMarkerPos(null);
            router.push(routeFor(selectedStation) as any);
          }}
          onCharge={() => {
            setSelectedStationId(null);
            setMarkerPos(null);
            router.push(`/station/${selectedStation.id}`);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { position: 'absolute', left: 16, right: 16, zIndex: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  segmentControl: { flexDirection: 'row', borderRadius: 100, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  segmentBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 100, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  segmentBtnActive: {},
  segmentText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', position: 'relative', zIndex: 1 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  filterScroll: { position: 'absolute', left: 0, right: 0, zIndex: 20 },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1, position: 'relative', overflow: 'hidden' },
  filterText: { fontSize: 13, fontFamily: 'Inter_500Medium', position: 'relative', zIndex: 1 },
  searchWrap: { paddingHorizontal: 16, marginBottom: 8 },
  searchInput: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  searchText: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden', // clips content to rounded corners; prevents promo cards bleeding outside
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 20,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 12, paddingBottom: 8,
    width: '100%',
    minHeight: 44,
  },
  handle: { width: 40, height: 4, borderRadius: 2 },
  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabScroll: { flexGrow: 0 },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  tab: {
    height: 34, paddingHorizontal: 14,
    borderRadius: 100, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', position: 'relative',
  },
  tabText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', position: 'relative', zIndex: 1 },
  // ── Content ───────────────────────────────────────────────────────────────
  sheetScroll: { flex: 1 },
  sheetContent: { paddingHorizontal: 16, paddingTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  adBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  promoScroll: { paddingBottom: 8 },
  promoCard: { width: 280, marginRight: 12 },
  showMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  showMoreText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 4 },
  emptySubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  resetBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  resetBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  // ── Map controls ──────────────────────────────────────────────────────────
  mapControls: { position: 'absolute', right: 12, alignItems: 'center', gap: 10, zIndex: 30 },
  mapBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  zoomGroup: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  zoomBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  zoomDivider: { height: 1, backgroundColor: '#E2E8F0', width: 44 },
});
