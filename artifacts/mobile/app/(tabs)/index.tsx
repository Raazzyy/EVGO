import React, { useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetStations, useGetVehicles } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import { StationCard } from '@/components/StationCard';
import { MapViewWrapper } from '@/components/MapViewWrapper';
import { FiltersSheet } from '@/components/FiltersSheet';
import { LinearGradient } from 'expo-linear-gradient';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_MIN = 180;
const SHEET_MAX = SCREEN_HEIGHT * 0.6;

type FilterStatus = 'all' | 'my-cars' | 'ac' | 'dc' | 'free';

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

  const { selectedVehicleId } = useApp();
  const { data: vehicles = [] } = useGetVehicles();
  const defaultVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0];

  // Poll every 30 seconds while screen is active
  const { data: stations = [], isLoading } = useGetStations(undefined, {
    query: { refetchInterval: 30_000 },
  });

  const filtered = useMemo(() => {
    let result = stations;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)
      );
    }
    if (activeChip === 'free') {
      result = result.filter((s) => s.status === 'free');
    } else if (activeChip === 'my-cars' && defaultVehicle?.connector_type) {
      // Filter by connectors compatible with the user's default vehicle
      result = result.filter((s) => {
        const conns: any[] = (s as any).connectors ?? [];
        return conns.some((c) => c.type === defaultVehicle.connector_type);
      });
    } else if (activeChip === 'ac') {
      result = result.filter((s) => {
        const conns: any[] = (s as any).connectors ?? [];
        return conns.some((c) => ['Type2', 'Type 2', 'AC'].includes(c.type));
      });
    } else if (activeChip === 'dc') {
      result = result.filter((s) => {
        const conns: any[] = (s as any).connectors ?? [];
        return conns.some((c) => ['CCS2', 'CHAdeMO', 'GB/T', 'DC'].includes(c.type));
      });
    }
    return result;
  }, [stations, search, activeChip, defaultVehicle]);

  const promotedStations = useMemo(() => {
    // Real promoted stations from is_promoted field, sorted by discount_pct desc
    return filtered
      .filter((s) => (s as any).is_promoted)
      .sort((a, b) => ((b as any).discount_pct ?? 0) - ((a as any).discount_pct ?? 0));
  }, [filtered]);

  const nearbyStations = useMemo(() => {
    return [...filtered].sort((a, b) => ((a as any).distance_km || 0) - ((b as any).distance_km || 0));
  }, [filtered]);

  const markers = filtered.map((s) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    name: s.name,
    status: s.status,
    power_kw: s.power_kw,
    price_per_kwh: s.price_per_kwh,
  }));

  function toggleSheet() {
    const toValue = sheetExpanded ? SHEET_MIN : SHEET_MAX;
    setSheetExpanded(!sheetExpanded);
    Animated.spring(sheetAnim, {
      toValue,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
  }

  const topOffset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 + 84 : insets.bottom + 100;

  const renderTopBar = () => (
    <View style={[styles.topBar, { top: topOffset + 8 }]}>
      <Text style={[styles.logo, { color: colors.primary }]}>iON</Text>
      
      <View style={[styles.segmentControl, { backgroundColor: colors.card, shadowColor: '#000' }]}>
        <TouchableOpacity
          onPress={() => setViewMode('map')}
          style={[styles.segmentBtn, viewMode === 'map' && styles.segmentBtnActive]}
        >
          {viewMode === 'map' ? (
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              style={StyleSheet.absoluteFill}
              borderRadius={100}
            />
          ) : null}
          <Text style={[styles.segmentText, { color: viewMode === 'map' ? '#fff' : colors.mutedForeground }]}>Карта</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setViewMode('list')}
          style={[styles.segmentBtn, viewMode === 'list' && styles.segmentBtnActive]}
        >
          {viewMode === 'list' ? (
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              style={StyleSheet.absoluteFill}
              borderRadius={100}
            />
          ) : null}
          <Text style={[styles.segmentText, { color: viewMode === 'list' ? '#fff' : colors.mutedForeground }]}>Список</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.topRightIcons}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.muted }]} onPress={() => router.push('/notifications')}>
          <Feather name="bell" size={18} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.muted }]} onPress={() => setFiltersVisible(true)}>
          <Feather name="sliders" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFilterChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.filterScroll, { top: topOffset + 60 }]}
      contentContainerStyle={styles.filterRow}
    >
      {[
        { id: 'all', label: 'Все' },
        { id: 'my-cars', label: 'Мои машины' },
        { id: 'ac', label: 'AC' },
        { id: 'dc', label: 'DC' },
        { id: 'free', label: 'Свободные сейчас' }
      ].map((f) => {
        const isActive = activeChip === f.id;
        return (
          <TouchableOpacity
            key={f.id}
            onPress={() => setActiveChip(f.id as FilterStatus)}
            style={[
              styles.filterPill,
              { backgroundColor: isActive ? 'transparent' : colors.card, borderColor: isActive ? 'transparent' : colors.border }
            ]}
          >
            {isActive && (
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                style={StyleSheet.absoluteFill}
                borderRadius={20}
              />
            )}
            <Text style={[styles.filterText, { color: isActive ? '#fff' : colors.text }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  if (viewMode === 'list') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topOffset }]}>
        {renderTopBar()}
        
        <View style={[styles.searchWrap, { marginTop: 60 }]}>
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

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}>
          {nearbyStations.map((s) => (
             <StationCard
               key={s.id}
               station={s}
               onPress={() => router.push(`/station/${s.id}`)}
               onRoute={() => router.push(`/route/new?dest=${s.id}`)}
             />
          ))}
        </ScrollView>
        <FiltersSheet visible={filtersVisible} onClose={() => setFiltersVisible(false)} onApply={() => {}} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapViewWrapper
        stations={markers}
        onStationPress={(id) => router.push(`/station/${id}`)}
      />

      {renderTopBar()}
      {renderFilterChips()}

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
                    {promotedStations.map((s) => (
                      <View key={s.id} style={{ width: 280, marginRight: 12 }}>
                        <StationCard
                          station={s}
                          onPress={() => router.push(`/station/${s.id}`)}
                          onRoute={() => router.push(`/route/new?dest=${s.id}`)}
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

              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16, marginBottom: 12 }]}>Рядом с вами</Text>
              {nearbyStations.map((s) => (
                <StationCard
                  key={s.id}
                  station={s}
                  onPress={() => router.push(`/station/${s.id}`)}
                  onRoute={() => router.push(`/route/new?dest=${s.id}`)}
                  discount_pct={(s as any).discount_pct}
                />
              ))}
            </>
          ) : (
            // Collapsed: nearest station
            nearbyStations[0] && (
              <StationCard
                station={nearbyStations[0]}
                onPress={() => router.push(`/station/${nearbyStations[0].id}`)}
                onRoute={() => router.push(`/route/new?dest=${nearbyStations[0].id}`)}
              />
            )
          )}
        </ScrollView>
      </Animated.View>

      <FiltersSheet visible={filtersVisible} onClose={() => setFiltersVisible(false)} onApply={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  segmentControl: {
    flexDirection: 'row',
    borderRadius: 100,
    padding: 4,
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  segmentBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  segmentBtnActive: {
    // background handled by absolute gradient
  },
  segmentText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    position: 'relative',
    zIndex: 1,
  },
  topRightIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterScroll: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  filterText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    position: 'relative',
    zIndex: 1,
  },
  searchWrap: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    alignItems: 'center',
    paddingVertical: 12,
    width: '100%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetScroll: { flex: 1 },
  sheetContent: { paddingHorizontal: 16, paddingTop: 4 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  adBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  promoScroll: {
    paddingBottom: 4,
  },
});
