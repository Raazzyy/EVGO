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
import { useGetStations } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { StationCard } from '@/components/StationCard';
import { MapViewWrapper } from '@/components/MapViewWrapper';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_MIN = 130;
const SHEET_MAX = SCREEN_HEIGHT * 0.55;

type FilterStatus = 'all' | 'free' | 'occupied' | 'offline';

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const sheetAnim = useRef(new Animated.Value(SHEET_MIN)).current;

  const { data: stations = [], isLoading } = useGetStations(
    filter !== 'all' ? { status: filter } : {}
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return stations;
    const q = search.toLowerCase();
    return stations.filter(
      (s) => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)
    );
  }, [stations, search]);

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
  const bottomPad = Platform.OS === 'web' ? 34 + 84 : insets.bottom + 60;

  return (
    <View style={styles.container}>
      {/* Map (platform-split: native = MapView, web = placeholder) */}
      <MapViewWrapper
        stations={markers}
        onStationPress={(id) => router.push(`/station/${id}`)}
      />

      {/* Search bar */}
      <View style={[styles.searchBar, { top: topOffset + 12 }]}>
        <View style={[styles.searchInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchText, { color: colors.text }]}
            placeholder="Search stations…"
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

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterScroll, { top: topOffset + 68 }]}
        contentContainerStyle={styles.filterRow}
      >
        {(['all', 'free', 'occupied', 'offline'] as FilterStatus[]).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.filterPill,
              {
                backgroundColor: filter === f ? colors.primary : colors.card,
                borderColor: filter === f ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.filterText, { color: filter === f ? '#fff' : colors.mutedForeground }]}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bottom sheet */}
      <Animated.View
        style={[styles.sheet, { backgroundColor: colors.card, height: sheetAnim }]}
      >
        <TouchableOpacity onPress={toggleSheet} style={styles.sheetHandle}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            {isLoading ? 'Loading…' : `${filtered.length} station${filtered.length !== 1 ? 's' : ''}`}
            {filter !== 'all' ? ` · ${filter}` : ''}
          </Text>
          <Feather
            name={sheetExpanded ? 'chevron-down' : 'chevron-up'}
            size={18}
            color={colors.mutedForeground}
          />
        </TouchableOpacity>

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((s) => (
            <StationCard
              key={s.id}
              station={s}
              onPress={() => router.push(`/station/${s.id}`)}
            />
          ))}
          {filtered.length === 0 && !isLoading && (
            <View style={styles.emptyState}>
              <Feather name="map-pin" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No stations found
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  searchText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
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
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  filterText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    gap: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -18,
  },
  sheetTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  sheetScroll: { flex: 1 },
  sheetContent: { padding: 16, gap: 10 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
});
