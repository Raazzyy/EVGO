import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { LinearGradient } from 'expo-linear-gradient';
import { useGetVehicles, useGetStations } from '@workspace/api-client-react';
import { useApp } from '@/contexts/AppContext';

export interface FiltersState {
  connectorTypes: string[];   // e.g. ['CCS2']
  availability: 'all' | 'free' | 'busy';
  amenities: string[];
  minPowerKw: number;
  maxPowerKw: number;
  maxPriceSum: number;
  vehicleId: number | null;
}

const DEFAULT_FILTERS: FiltersState = {
  connectorTypes: [],
  availability: 'all',
  amenities: [],
  minPowerKw: 3,
  maxPowerKw: 350,
  maxPriceSum: 5000,
  vehicleId: null,
};

interface FiltersSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FiltersState) => void;
}

export function FiltersSheet({ visible, onClose, onApply }: FiltersSheetProps) {
  const colors = useColors();
  const { selectedVehicleId, setSelectedVehicleId } = useApp();

  const [filters, setFilters] = useState<FiltersState>({ ...DEFAULT_FILTERS });
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: vehicles = [] } = useGetVehicles();
  const { data: stationsResp } = useGetStations();
  // API returns {promoted, nearby}; use nearby (contains all stations)
  const allStations = (stationsResp?.nearby ?? []) as any[];

  // Compute live count locally by filtering allStations — avoids extra API round-trips
  const computeCount = useCallback(
    (f: FiltersState) => {
      setCounting(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        let result: any[] = [...allStations];
        if (f.availability === 'free') result = result.filter((s) => s.status === 'free');
        if (f.availability === 'busy') result = result.filter((s) => s.status === 'busy');
        if (f.connectorTypes.length > 0) {
          result = result.filter((s) => {
            const conns: any[] = (s as any).connectors ?? [];
            return conns.some((c) => f.connectorTypes.includes(c.type));
          });
        }
        if (f.vehicleId) {
          const vehicle = vehicles.find((v) => v.id === f.vehicleId);
          if (vehicle?.connector_type) {
            result = result.filter((s) => {
              const conns: any[] = (s as any).connectors ?? [];
              return conns.some((c) => c.type === vehicle.connector_type);
            });
          }
        }
        result = result.filter((s) => s.power_kw >= f.minPowerKw && s.power_kw <= f.maxPowerKw);
        result = result.filter((s) => s.price_per_kwh <= f.maxPriceSum);
        setLiveCount(result.length);
        setCounting(false);
      }, 300);
    },
    [allStations, vehicles]
  );

  // Recompute whenever filters change
  useEffect(() => {
    if (visible) computeCount(filters);
  }, [filters, visible, computeCount]);

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setFilters({ ...DEFAULT_FILTERS });
      setLiveCount(allStations.length);
    }
  }, [visible]);

  function patchFilters(patch: Partial<FiltersState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function toggleConnector(type: string) {
    setFilters((prev) => {
      const has = prev.connectorTypes.includes(type);
      return {
        ...prev,
        connectorTypes: has
          ? prev.connectorTypes.filter((t) => t !== type)
          : [...prev.connectorTypes, type],
      };
    });
  }

  function toggleAmenity(a: string) {
    setFilters((prev) => {
      const has = prev.amenities.includes(a);
      return { ...prev, amenities: has ? prev.amenities.filter((x) => x !== a) : [...prev.amenities, a] };
    });
  }

  function selectVehicle(id: number) {
    const vehicle = vehicles.find((v) => v.id === id);
    setFilters((prev) => ({
      ...prev,
      vehicleId: prev.vehicleId === id ? null : id,
      connectorTypes: vehicle && prev.vehicleId !== id ? [vehicle.connector_type] : [],
    }));
  }

  const countLabel = counting ? '...' : (liveCount ?? allStations.length);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Фильтры</Text>
              <View style={styles.headerRight}>
                <TouchableOpacity
                  onPress={() => setFilters({ ...DEFAULT_FILTERS })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.resetText, { color: colors.primary }]}>Сбросить</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Feather name="x" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Мои автомобили */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Мои автомобили</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hScroll}
                >
                  {vehicles.map((car) => {
                    const isActive = filters.vehicleId === car.id;
                    return (
                      <TouchableOpacity
                        key={car.id}
                        onPress={() => selectVehicle(car.id)}
                        style={[
                          styles.carChip,
                          {
                            borderColor: isActive ? colors.primary : colors.border,
                            backgroundColor: isActive ? colors.primary + '15' : colors.card,
                          },
                        ]}
                      >
                        <Feather
                          name="zap"
                          size={14}
                          color={isActive ? colors.primary : colors.mutedForeground}
                        />
                        <Text style={[styles.carChipText, { color: isActive ? colors.primary : colors.text }]}>
                          {car.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[
                      styles.carChip,
                      { borderStyle: 'dashed', borderColor: colors.mutedForeground, backgroundColor: colors.card },
                    ]}
                  >
                    <Feather name="plus" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.carChipText, { color: colors.mutedForeground }]}>
                      Добавить авто
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* Тип зарядки */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Тип зарядки</Text>
                <View style={styles.chipGroup}>
                  {['CCS2', 'CHAdeMO', 'Type 2', 'GB/T'].map((type) => {
                    const isActive = filters.connectorTypes.includes(type);
                    return (
                      <TouchableOpacity key={type} onPress={() => toggleConnector(type)} activeOpacity={0.8}>
                        {isActive ? (
                          <LinearGradient
                            colors={[colors.gradientStart, colors.gradientEnd]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.filterChip, { borderWidth: 0 }]}
                          >
                            <Text style={[styles.filterChipText, { color: '#FFF' }]}>{type}</Text>
                          </LinearGradient>
                        ) : (
                          <View
                            style={[
                              styles.filterChip,
                              { backgroundColor: colors.card, borderColor: colors.border },
                            ]}
                          >
                            <Text style={[styles.filterChipText, { color: colors.text }]}>{type}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Мощность, кВт — visual slider (non-interactive, decorative for MVP) */}
              <View style={styles.section}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Мощность, кВт</Text>
                  <Text style={[styles.rangeValue, { color: colors.primary }]}>
                    {filters.minPowerKw} — {filters.maxPowerKw}+
                  </Text>
                </View>
                <View style={styles.sliderTrackContainer}>
                  <View style={[styles.sliderTrack, { backgroundColor: colors.muted }]} />
                  <LinearGradient
                    colors={[colors.gradientStart, colors.gradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.sliderActiveTrack, { left: '5%', right: '10%' }]}
                  />
                  <View
                    style={[
                      styles.sliderThumb,
                      { left: '5%', borderColor: colors.primary, backgroundColor: colors.card },
                    ]}
                  />
                  <View
                    style={[
                      styles.sliderThumb,
                      { left: '90%', borderColor: colors.primary, backgroundColor: colors.card },
                    ]}
                  />
                </View>
              </View>

              {/* Доступность */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Доступность</Text>
                <View style={[styles.segmentedControl, { backgroundColor: colors.muted }]}>
                  {[
                    { label: 'Все', value: 'all' as const },
                    { label: 'Свободные', value: 'free' as const },
                    { label: 'Занятые', value: 'busy' as const },
                  ].map(({ label, value }) => {
                    const isActive = filters.availability === value;
                    return (
                      <TouchableOpacity
                        key={value}
                        style={[
                          styles.segment,
                          isActive && [styles.segmentActive, { backgroundColor: colors.card }],
                        ]}
                        onPress={() => patchFilters({ availability: value })}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            { color: isActive ? colors.text : colors.mutedForeground },
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Цена, сум/кВт·ч */}
              <View style={styles.section}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Цена, сум/кВт·ч</Text>
                  <Text style={[styles.rangeValue, { color: colors.primary }]}>
                    0 — {filters.maxPriceSum.toLocaleString('ru-RU')}+
                  </Text>
                </View>
                <View style={styles.sliderTrackContainer}>
                  <View style={[styles.sliderTrack, { backgroundColor: colors.muted }]} />
                  <LinearGradient
                    colors={[colors.gradientStart, colors.gradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.sliderActiveTrack, { left: '0%', right: '0%' }]}
                  />
                  <View
                    style={[
                      styles.sliderThumb,
                      { left: '0%', borderColor: colors.primary, backgroundColor: colors.card },
                    ]}
                  />
                  <View
                    style={[
                      styles.sliderThumb,
                      { left: '100%', borderColor: colors.primary, backgroundColor: colors.card },
                    ]}
                  />
                </View>
              </View>

              {/* Удобства */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Удобства</Text>
                <View style={styles.amenityRow}>
                  {[
                    { id: 'cafe', icon: 'coffee', label: 'Кафе' },
                    { id: 'toilet', icon: 'home', label: 'Туалет' },
                    { id: 'shop', icon: 'shopping-bag', label: 'Магазин' },
                    { id: 'wifi', icon: 'wifi', label: 'Wi-Fi' },
                  ].map((item) => {
                    const isActive = filters.amenities.includes(item.id);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => toggleAmenity(item.id)}
                        style={styles.amenityCol}
                      >
                        <View
                          style={[
                            styles.amenityBtn,
                            { backgroundColor: isActive ? colors.primary : colors.muted },
                          ]}
                        >
                          <Feather
                            name={item.icon as any}
                            size={18}
                            color={isActive ? '#FFF' : colors.text}
                          />
                        </View>
                        <Text style={[styles.amenityLabel, { color: colors.mutedForeground }]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Sticky CTA */}
            <View style={[styles.bottomSticky, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => {
                  onApply(filters);
                  onClose();
                }}
                activeOpacity={0.8}
                disabled={counting}
              >
                <LinearGradient
                  colors={[colors.gradientStart, colors.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.applyBtn}
                >
                  {counting ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.applyBtnText}>Показать {countLabel} станций</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  resetText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  closeBtn: { padding: 4 },
  scrollContent: { padding: 20, gap: 24, paddingBottom: 32 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rangeValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  hScroll: { gap: 8, paddingRight: 20 },
  carChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
  },
  carChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  sliderTrackContainer: {
    height: 30,
    justifyContent: 'center',
    position: 'relative',
    marginTop: 4,
  },
  sliderTrack: { height: 4, borderRadius: 2, width: '100%' },
  sliderActiveTrack: { position: 'absolute', height: 4, borderRadius: 2 },
  sliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    marginLeft: -12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  amenityRow: { flexDirection: 'row', gap: 16 },
  amenityCol: { alignItems: 'center', gap: 6 },
  amenityBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amenityLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  bottomSticky: {
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  applyBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  applyBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
