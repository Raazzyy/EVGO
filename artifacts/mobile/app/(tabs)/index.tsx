import React, { useRef, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Platform, Animated, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetStations, useGetVehicles } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import { StationCard } from '@/components/StationCard';
import { MapViewWrapper, MapApi } from '@/components/MapViewWrapper';
import { FiltersSheet } from '@/components/FiltersSheet';
import { LinearGradient } from 'expo-linear-gradient';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_MIN = 190;
const SHEET_MAX = SCREEN_HEIGHT * 0.65;

type FilterStatus = 'all' | 'my-cars' | 'ac' | 'dc' | 'free';

const STATUS_ORDER: Record<string, number> = { free: 0, occupied: 1, offline: 2 };

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [activeChip, setActiveChip] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const sheetAnim = useRef(new Animated.Value(SHEET_MIN)).current;
  const mapRef = useRef<MapApi>(null);

  const { selectedVehicleId } = useApp();
  const { data: vehicles = [] } = useGetVehicles();
  const defaultVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0];

  const { data: stationsData } = useGetStations(undefined, {
    query: { refetchInterval: 30_000 },
  });

  // Backend puts ALL stations in `nearby`, promoted is a subset
  const allStations = useMemo(() => stationsData?.nearby ?? [], [stationsData]);
  const promotedFromApi = useMemo(() => stationsData?.promoted ?? [], [stationsData]);

  // ── Apply chip filter ────────────────────────────────────────────────────
  function applyFilter<T extends { status: string; connectors?: unknown }>(list: T[]): T[] {
    if (activeChip === 'free') return list.filter(s => s.status === 'free');
    if (activeChip === 'my-cars' && defaultVehicle?.connector_type) {
      return list.filter(s => {
        const conns: any[] = (s.connectors as any[]) ?? [];
        return conns.some(c => c.type === defaultVehicle.connector_type);
      });
    }
    if (activeChip === 'ac') {
      return list.filter(s => {
        const conns: any[] = (s.connectors as any[]) ?? [];
        return conns.some(c => ['Type2', 'Type 2', 'AC'].includes(c.type));
      });
    }
    if (activeChip === 'dc') {
      return list.filter(s => {
        const conns: any[] = (s.connectors as any[]) ?? [];
        return conns.some(c => ['CCS2', 'CHAdeMO', 'GB/T', 'GB-T', 'DC'].includes(c.type));
      });
    }
    return list;
  }

  // ── Filtered + sorted stations (free first) ────────────────────────────
  const filteredStations = useMemo(() => {
    let result = allStations as any[];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)
      );
    }
    result = applyFilter(result);
    // Sort: free → occupied → offline, then by name
    return [...result].sort((a, b) => {
      const diff = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
      return diff !== 0 ? diff : a.name.localeCompare(b.name, 'ru');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allStations, search, activeChip, defaultVehicle]);

  // ── Promoted list (search-filtered, no chip filter for promo block) ────
  const promotedStations = useMemo(() => {
    if (!search.trim()) return promotedFromApi;
    const q = search.toLowerCase();
    return (promotedFromApi as any[]).filter(s =>
      s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)
    );
  }, [promotedFromApi, search]);

  // ── Map markers: use FILTERED stations so chips update the map ─────────
  const markers = useMemo(
    () => filteredStations.map(s => ({
      id: s.id, lat: s.lat, lng: s.lng,
      name: s.name, status: s.status,
      power_kw: s.power_kw, price_per_kwh: s.price_per_kwh,
    })),
    [filteredStations]
  );

  function toggleSheet() {
    const toValue = sheetExpanded ? SHEET_MIN : SHEET_MAX;
    setSheetExpanded(!sheetExpanded);
    Animated.spring(sheetAnim, { toValue, useNativeDriver: false, tension: 65, friction: 11 }).start();
  }

  const topOffset = Platform.OS === 'web' ? 0 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 + 84 : insets.bottom + 100;

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
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                style={StyleSheet.absoluteFill}
                borderRadius={100}
              />
            )}
            <Text style={[styles.segmentText, { color: viewMode === mode ? '#fff' : colors.mutedForeground }]}>
              {mode === 'map' ? 'Карта' : 'Список'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.topRightIcons}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={() => router.push('/notifications')}>
          <Feather name="bell" size={18} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={() => setFiltersVisible(true)}>
          <Feather name="sliders" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── FILTER CHIPS ───────────────────────────────────────────────────────
  const FilterChips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.filterScroll, { top: topOffset + 60 }]}
      contentContainerStyle={styles.filterRow}
    >
      {([
        { id: 'all', label: 'Все' },
        { id: 'free', label: 'Свободные' },
        { id: 'my-cars', label: 'Мои машины' },
        { id: 'ac', label: 'AC' },
        { id: 'dc', label: 'DC' },
      ] as { id: FilterStatus; label: string }[]).map(f => {
        const isActive = activeChip === f.id;
        return (
          <TouchableOpacity
            key={f.id}
            onPress={() => setActiveChip(f.id)}
            style={[
              styles.filterPill,
              { backgroundColor: isActive ? 'transparent' : colors.card, borderColor: isActive ? 'transparent' : colors.border },
            ]}
          >
            {isActive && (
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                style={StyleSheet.absoluteFill}
                borderRadius={20}
              />
            )}
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
              placeholder="Поиск станций…"
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        {FilterChips}
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
        >
          {filteredStations.map(s => (
            <StationCard
              key={s.id}
              station={s}
              onPress={() => router.push(`/station/${s.id}`)}
              onRoute={() => router.push(`/route/new?stationId=${s.id}&stationName=${encodeURIComponent(s.name)}&lat=${s.lat}&lng=${s.lng}` as any)}
            />
          ))}
        </ScrollView>
        <FiltersSheet visible={filtersVisible} onClose={() => setFiltersVisible(false)} onApply={() => {}} />
      </View>
    );
  }

  // ── MAP VIEW ───────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <MapViewWrapper
        ref={mapRef}
        stations={markers}
        onStationPress={id => router.push(`/station/${id}`)}
      />

      {TopBar}
      {FilterChips}

      {/* Bottom sheet */}
      <Animated.View style={[styles.sheet, { backgroundColor: colors.card, height: sheetAnim }]}>
        <TouchableOpacity onPress={toggleSheet} style={styles.sheetHandle} activeOpacity={1}>
          <View style={[styles.handle, { backgroundColor: colors.mutedForeground, opacity: 0.3 }]} />
        </TouchableOpacity>

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={sheetExpanded}
        >
          {sheetExpanded ? (
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
                    {promotedStations.map(s => (
                      <View key={s.id} style={{ width: 280, marginRight: 12 }}>
                        <StationCard
                          station={s}
                          onPress={() => router.push(`/station/${s.id}`)}
                          onRoute={() => router.push(`/route/new?stationId=${s.id}&stationName=${encodeURIComponent(s.name)}&lat=${s.lat}&lng=${s.lng}` as any)}
                          compact={true}
                          discount_pct={(s as any).discount_pct}
                          is_promoted={true}
                          amenities={(s as any).amenities}
                        />
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16, marginBottom: 12 }]}>
                {activeChip === 'free' ? 'Свободные станции' :
                 activeChip === 'ac' ? 'AC станции' :
                 activeChip === 'dc' ? 'DC станции' : 'Рядом с вами'}
              </Text>
              {filteredStations.map(s => (
                <StationCard
                  key={s.id}
                  station={s}
                  onPress={() => router.push(`/station/${s.id}`)}
                  onRoute={() => router.push(`/route/new?stationId=${s.id}&stationName=${encodeURIComponent(s.name)}&lat=${s.lat}&lng=${s.lng}` as any)}
                  discount_pct={(s as any).discount_pct}
                />
              ))}
            </>
          ) : (
            filteredStations[0] && (
              <StationCard
                station={filteredStations[0]}
                onPress={() => router.push(`/station/${filteredStations[0].id}`)}
                onRoute={() => router.push(`/route/new?stationId=${filteredStations[0].id}&stationName=${encodeURIComponent(filteredStations[0].name)}&lat=${filteredStations[0].lat}&lng=${filteredStations[0].lng}` as any)}
              />
            )
          )}
        </ScrollView>
      </Animated.View>

      {/* Map controls — rendered AFTER sheet so they sit on top in DOM order */}
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

      <FiltersSheet visible={filtersVisible} onClose={() => setFiltersVisible(false)} onApply={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    position: 'absolute', left: 16, right: 16, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  logo: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  segmentControl: {
    flexDirection: 'row', borderRadius: 100, padding: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  segmentBtn: {
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 100,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden',
  },
  segmentBtnActive: {},
  segmentText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', position: 'relative', zIndex: 1 },
  topRightIcons: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  filterScroll: { position: 'absolute', left: 0, right: 0, zIndex: 20 },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  filterPill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
    position: 'relative', overflow: 'hidden',
  },
  filterText: { fontSize: 13, fontFamily: 'Inter_500Medium', position: 'relative', zIndex: 1 },
  searchWrap: { paddingHorizontal: 16, marginBottom: 8 },
  searchInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1,
  },
  searchText: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 20,
  },
  sheetHandle: { alignItems: 'center', paddingVertical: 12, width: '100%' },
  handle: { width: 36, height: 4, borderRadius: 2 },
  sheetScroll: { flex: 1 },
  sheetContent: { paddingHorizontal: 16, paddingTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  adBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  promoScroll: { paddingBottom: 4 },
  // Map controls — rendered AFTER sheet so appear on top
  mapControls: {
    position: 'absolute',
    right: 12,
    bottom: SHEET_MIN + 16,
    alignItems: 'center',
    gap: 10,
    zIndex: 30,
  },
  mapBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  zoomGroup: {
    borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  zoomBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  zoomDivider: { height: 1, backgroundColor: '#E2E8F0', width: 44 },
});
