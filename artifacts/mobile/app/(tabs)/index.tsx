import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Platform, PanResponder, Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
  FadeInDown, FadeInRight, Layout,
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
import { LinearGradient } from 'expo-linear-gradient';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MIN = 190;
const SHEET_MAX = SCREEN_HEIGHT * 0.65;
const IOS_EASE = Easing.bezier(0.25, 0.46, 0.45, 0.94);
const STATUS_ORDER: Record<string, number> = { free: 0, occupied: 1, offline: 2 };
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

  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [activeChip, setActiveChip] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false); // state not ref → triggers re-renders
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);

  // Sheet animation — smooth iOS timing
  const sheetHeight = useSharedValue(SHEET_MIN);
  const sheetStyle = useAnimatedStyle(() => ({ height: sheetHeight.value }));

  function openSheet() {
    setIsExpanded(true);
    sheetHeight.value = withTiming(SHEET_MAX, { duration: 380, easing: IOS_EASE });
  }
  function closeSheet() {
    setIsExpanded(false);
    sheetHeight.value = withTiming(SHEET_MIN, { duration: 320, easing: IOS_EASE });
  }

  // Swipe gesture
  const gestureStart = useRef(SHEET_MIN);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 6,
      onPanResponderGrant: () => {
        gestureStart.current = sheetHeight.value as number;
      },
      onPanResponderMove: (_, gs) => {
        const next = Math.max(SHEET_MIN, Math.min(SHEET_MAX, gestureStart.current - gs.dy));
        sheetHeight.value = next;
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -50 || sheetHeight.value > (SHEET_MIN + SHEET_MAX) / 2) openSheet();
        else closeSheet();
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
    return [...r].sort((a, b) => {
      const d = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
      return d !== 0 ? d : a.name.localeCompare(b.name, 'ru');
    });
  }, [allStations, search, applyChipFilter, applySheetFilter]);

  const promotedStations = useMemo(() => {
    if (!search.trim()) return promotedFromApi;
    const q = search.toLowerCase();
    return promotedFromApi.filter(s => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q));
  }, [promotedFromApi, search]);

  const markers = useMemo(() => filteredStations.map(s => ({
    id: s.id, lat: s.lat, lng: s.lng, name: s.name, status: s.status,
    power_kw: s.power_kw, price_per_kwh: s.price_per_kwh,
  })), [filteredStations]);

  // Quick view: first tap → open modal, second tap on same pin → full page
  const handleStationPress = useCallback((id: number) => {
    if (selectedStationId === id) {
      setSelectedStationId(null);
      router.push(`/station/${id}`);
    } else {
      setSelectedStationId(id);
    }
  }, [selectedStationId, router]);

  // Find full station data (search both lists so filters don't lose it)
  const selectedStation = useMemo<QuickViewStation | null>(() => {
    if (selectedStationId == null) return null;
    return [...allStations, ...promotedFromApi].find(s => s.id === selectedStationId) as QuickViewStation ?? null;
  }, [selectedStationId, allStations, promotedFromApi]);

  const topOffset = Platform.OS === 'web' ? 0 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 + 84 : insets.bottom + 100;

  const routeFor = (s: any) =>
    `/route/new?stationId=${s.id}&stationName=${encodeURIComponent(s.name)}&lat=${s.lat}&lng=${s.lng}` as any;

  // ── TOP BAR ────────────────────────────────────────────────────────────
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

  // ── FILTER CHIPS (filter icon first) ──────────────────────────────────
  const FilterChips = (
    <ScrollView
      horizontal showsHorizontalScrollIndicator={false}
      style={[styles.filterScroll, { top: topOffset + 60 }]}
      contentContainerStyle={styles.filterRow}
    >
      <TouchableOpacity
        onPress={() => setFiltersVisible(true)}
        style={[styles.filterPill, { backgroundColor: hasActiveFilters ? 'transparent' : colors.card, borderColor: hasActiveFilters ? 'transparent' : colors.border }]}
      >
        {hasActiveFilters && <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={StyleSheet.absoluteFill} borderRadius={20} />}
        <Feather name="sliders" size={14} color={hasActiveFilters ? '#fff' : colors.text} style={{ position: 'relative', zIndex: 1 }} />
        <Text style={[styles.filterText, { color: hasActiveFilters ? '#fff' : colors.text }]}>Фильтры{hasActiveFilters ? ' ●' : ''}</Text>
      </TouchableOpacity>

      {([
        { id: 'all', label: 'Все' }, { id: 'free', label: 'Свободные' },
        { id: 'my-cars', label: 'Мои машины' }, { id: 'ac', label: 'AC' }, { id: 'dc', label: 'DC' },
      ] as { id: FilterStatus; label: string }[]).map(f => {
        const isActive = activeChip === f.id;
        return (
          <TouchableOpacity
            key={f.id}
            onPress={() => setActiveChip(f.id)}
            style={[styles.filterPill, { backgroundColor: isActive ? 'transparent' : colors.card, borderColor: isActive ? 'transparent' : colors.border }]}
          >
            {isActive && <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={StyleSheet.absoluteFill} borderRadius={20} />}
            <Text style={[styles.filterText, { color: isActive ? '#fff' : colors.text }]}>{f.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // ── LIST VIEW ──────────────────────────────────────────────────────────
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
        >
          {filteredStations.map((s, i) => (
            <Animated.View
              key={s.id}
              entering={FadeInDown.delay(i * 35).duration(300).easing(IOS_EASE)}
              layout={Layout.duration(250).easing(IOS_EASE)}
            >
              <StationCard station={s} onPress={() => router.push(`/station/${s.id}`)} onRoute={() => router.push(routeFor(s))} />
            </Animated.View>
          ))}
        </ScrollView>
        <FiltersSheet visible={filtersVisible} onClose={() => setFiltersVisible(false)} onApply={(f) => setActiveFilters(f)} />
      </View>
    );
  }

  // ── MAP VIEW ───────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <MapViewWrapper
        ref={mapRef} stations={markers} userLocation={userLocation}
        onStationPress={handleStationPress}
        onMapPress={() => setSelectedStationId(null)}
      />
      {TopBar}
      {FilterChips}

      {/* Bottom sheet with swipe */}
      <Animated.View style={[styles.sheet, { backgroundColor: colors.card }, sheetStyle]}>
        <View style={styles.handleArea} {...panResponder.panHandlers}>
          <TouchableOpacity onPress={() => isExpanded ? closeSheet() : openSheet()} activeOpacity={1}>
            <View style={[styles.handle, { backgroundColor: colors.mutedForeground, opacity: 0.3 }]} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={isExpanded}
        >
          {isExpanded ? (
            <>
              {promotedStations.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Рекомендуем</Text>
                    <View style={[styles.adBadge, { backgroundColor: colors.muted }]}>
                      <Text style={[styles.adBadgeText, { color: colors.mutedForeground }]}>Реклама</Text>
                    </View>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promoScroll}>
                    {promotedStations.map((s, i) => (
                      <Animated.View key={s.id} entering={FadeInRight.delay(i * 50).duration(280).easing(IOS_EASE)} style={{ width: 280, marginRight: 12 }}>
                        <StationCard station={s} onPress={() => router.push(`/station/${s.id}`)} onRoute={() => router.push(routeFor(s))}
                          compact={true} discount_pct={(s as any).discount_pct} is_promoted={true} amenities={(s as any).amenities} />
                      </Animated.View>
                    ))}
                  </ScrollView>
                </>
              )}
              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16, marginBottom: 12 }]}>
                {activeChip === 'free' ? 'Свободные станции' : activeChip === 'ac' ? 'AC станции' : activeChip === 'dc' ? 'DC станции' : 'Рядом с вами'}
              </Text>
              {filteredStations.map((s, i) => (
                <Animated.View key={s.id} entering={FadeInDown.delay(i * 30).duration(280).easing(IOS_EASE)} layout={Layout.duration(220).easing(IOS_EASE)}>
                  <StationCard station={s} onPress={() => router.push(`/station/${s.id}`)} onRoute={() => router.push(routeFor(s))} discount_pct={(s as any).discount_pct} />
                </Animated.View>
              ))}
            </>
          ) : (
            // Collapsed: show ALL stations in a scroll, not just first one
            filteredStations.length > 0 && (
              <Animated.View entering={FadeInDown.duration(280).easing(IOS_EASE)}>
                <StationCard
                  station={filteredStations[0]}
                  onPress={() => router.push(`/station/${filteredStations[0].id}`)}
                  onRoute={() => router.push(routeFor(filteredStations[0]))}
                />
                {filteredStations.length > 1 && (
                  <TouchableOpacity onPress={openSheet} style={styles.showMoreBtn}>
                    <Text style={[styles.showMoreText, { color: colors.primary }]}>
                      + ещё {filteredStations.length - 1} станций
                    </Text>
                    <Feather name="chevron-up" size={14} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </Animated.View>
            )
          )}
        </ScrollView>
      </Animated.View>

      {/* Map controls — after sheet in DOM */}
      <View style={styles.mapControls} pointerEvents="box-none">
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
      </View>

      <FiltersSheet visible={filtersVisible} onClose={() => setFiltersVisible(false)} onApply={(f) => setActiveFilters(f)} />

      {/* Station quick-view modal — tap pin once to open, tap again or header to open full page */}
      {selectedStation && (
        <StationQuickView
          station={selectedStation}
          userLocation={userLocation}
          onClose={() => setSelectedStationId(null)}
          onOpenFull={() => {
            setSelectedStationId(null);
            router.push(`/station/${selectedStation.id}`);
          }}
          onNavigate={() => {
            setSelectedStationId(null);
            router.push(routeFor(selectedStation) as any);
          }}
          onCharge={() => {
            setSelectedStationId(null);
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
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 20 },
  handleArea: { alignItems: 'center', paddingTop: 12, paddingBottom: 8, width: '100%' },
  handle: { width: 36, height: 4, borderRadius: 2 },
  sheetScroll: { flex: 1 },
  sheetContent: { paddingHorizontal: 16, paddingTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  adBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  promoScroll: { paddingBottom: 4 },
  showMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  showMoreText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  mapControls: { position: 'absolute', right: 12, bottom: SHEET_MIN + 16, alignItems: 'center', gap: 10, zIndex: 30 },
  mapBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  zoomGroup: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  zoomBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  zoomDivider: { height: 1, backgroundColor: '#E2E8F0', width: 44 },
});
