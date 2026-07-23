import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  Switch, Modal, TextInput, FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import { useGetVehicles, useCreateVehicle, getGetVehiclesQueryKey } from '@workspace/api-client-react';
import { LinearGradient } from 'expo-linear-gradient';

interface SearchResult {
  id?: number;
  name: string;
  make?: string;
  model?: string;
  connector_type: string;
  battery_kwh?: number;
  range_km?: number;
}

export default function CarsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { selectedVehicleId, setSelectedVehicleId, userId } = useApp();

  const { data: apiVehicles = [], isLoading } = useGetVehicles();
  const [showCompatible, setShowCompatible] = useState(true);

  // ── Add Car modal state ─────────────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [noResults, setNoResults] = useState(false);

  const createVehicle = useCreateVehicle({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetVehiclesQueryKey() });
        setModalVisible(false);
        setQuery('');
        setResults([]);
      },
      onError: () => {
        const msg = 'Не удалось добавить автомобиль.';
        if (Platform.OS === 'web') { window.alert(msg); } else { Alert.alert('Ошибка', msg); }
      },
    },
  });

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    setNoResults(false);
    if (text.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const base = (typeof window !== 'undefined' && (window as any).__API_BASE__) || '';
      const res = await fetch(`${base}/api/vehicles/search?q=${encodeURIComponent(text.trim())}`);
      const json = await res.json();
      const list: SearchResult[] = Array.isArray(json) ? json : [];
      setResults(list);
      setNoResults(list.length === 0);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleAddVehicle = useCallback((car: SearchResult) => {
    createVehicle.mutate({
      data: {
        name: car.name,
        connector_type: car.connector_type || 'CCS2',
        battery_kwh: car.battery_kwh ?? 0,
        range_km: car.range_km ?? 0,
        user_id: userId,
      },
    });
  }, [createVehicle, userId]);

  const topPad = Platform.OS === 'web' ? 20 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: '#F7F8FA' }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: '#FFFFFF' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Мои автомобили</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : apiVehicles.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="truck" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Нет автомобилей</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Добавьте свой первый электромобиль, чтобы видеть совместимые станции.
            </Text>
          </View>
        ) : (
          apiVehicles.map((car, index) => {
            const batteryPct = [85, 42, 100][index % 3];
            const rangeKm = Math.round(batteryPct * ((car.range_km ?? 410) / 100));
            const isDefault = car.id === selectedVehicleId || (selectedVehicleId === undefined && index === 0);

            return (
              <TouchableOpacity
                key={car.id}
                activeOpacity={0.85}
                onPress={() => setSelectedVehicleId(car.id)}
                style={[
                  styles.carCard,
                  { backgroundColor: '#FFFFFF', borderColor: isDefault ? colors.primary : 'transparent', borderWidth: isDefault ? 2 : 0 },
                ]}
              >
                <View style={[styles.carIconBox, { backgroundColor: colors.muted }]}>
                  <Feather name="zap" size={26} color={isDefault ? colors.primary : colors.mutedForeground} />
                </View>

                <View style={styles.carInfo}>
                  <Text style={[styles.carName, { color: colors.text }]}>{car.name}</Text>
                  <Text style={[styles.carConnector, { color: colors.mutedForeground }]}>
                    {car.connector_type}{car.battery_kwh ? ` · ${car.battery_kwh} кВт·ч` : ''}
                  </Text>

                  <View style={styles.batteryRow}>
                    <Text style={[styles.batteryText, { color: colors.mutedForeground }]}>
                      {batteryPct}% · {rangeKm} км
                    </Text>
                    <View style={[styles.batteryBarBg, { backgroundColor: colors.border }]}>
                      <View style={[styles.batteryBarFill, { width: `${batteryPct}%` as any, backgroundColor: batteryPct > 50 ? '#10B981' : '#F59E0B' }]} />
                    </View>
                  </View>

                  {isDefault && (
                    <View style={[styles.defaultBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.defaultBadgeText}>По умолчанию</Text>
                    </View>
                  )}
                </View>

                <View style={styles.checkCol}>
                  {isDefault
                    ? <Feather name="check-circle" size={24} color="#10B981" />
                    : <View style={[styles.emptyCircle, { borderColor: colors.border }]} />}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Settings */}
        <View style={[styles.settingsCard, { backgroundColor: '#FFFFFF' }]}>
          <View style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Только совместимые станции</Text>
            <Switch
              value={showCompatible}
              onValueChange={setShowCompatible}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Единицы измерения</Text>
            <View style={styles.settingValueRow}>
              <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>кВт·ч / км</Text>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>
          </View>
        </View>

        {/* Add button */}
        <TouchableOpacity activeOpacity={0.8} style={styles.addButton} onPress={() => setModalVisible(true)}>
          <LinearGradient
            colors={['#2563EB', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addButtonGradient}
          >
            <Feather name="plus" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Добавить автомобиль</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Add Car Modal ─────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modal, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
          {/* Modal header */}
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setModalVisible(false); setQuery(''); setResults([]); }}>
              <Feather name="x" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Добавить автомобиль</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Search box */}
          <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Например: Tesla Model 3, Hyundai IONIQ 5…"
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={handleSearch}
              autoFocus
              returnKeyType="search"
            />
            {searching && <ActivityIndicator size="small" color={colors.primary} />}
            {query.length > 0 && !searching && (
              <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setNoResults(false); }}>
                <Feather name="x-circle" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {/* Results */}
          {noResults && query.length > 1 && (
            <View style={styles.noResults}>
              <Text style={[styles.noResultsText, { color: colors.mutedForeground }]}>
                Автомобиль не найден. Попробуйте другой запрос.
              </Text>
            </View>
          )}

          <FlatList
            data={results}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.resultCard, { backgroundColor: colors.card }]}
                onPress={() => handleAddVehicle(item)}
                disabled={createVehicle.isPending}
              >
                <View style={[styles.resultIcon, { backgroundColor: colors.muted }]}>
                  <Feather name="zap" size={20} color={colors.primary} />
                </View>
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.resultMeta, { color: colors.mutedForeground }]}>
                    {item.connector_type}
                    {item.battery_kwh ? ` · ${item.battery_kwh} кВт·ч` : ''}
                    {item.range_km ? ` · ${item.range_km} км` : ''}
                  </Text>
                </View>
                {createVehicle.isPending
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Feather name="plus-circle" size={22} color={colors.primary} />}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              query.length < 2 ? (
                <View style={styles.hintWrap}>
                  <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                    Введите марку и модель для поиска
                  </Text>
                </View>
              ) : null
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  iconBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  scrollContent: { padding: 16, gap: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  emptyDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  carCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    alignItems: 'center',
    gap: 16,
  },
  carIconBox: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  carInfo: { flex: 1, gap: 4 },
  carName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  carConnector: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  batteryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  batteryText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  batteryBarBg: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  batteryBarFill: { height: '100%' as any, borderRadius: 3 },
  defaultBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 6 },
  defaultBadgeText: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Inter_500Medium' },
  checkCol: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  emptyCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  settingsCard: { borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  settingLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', paddingRight: 16 },
  settingValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingValue: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  addButton: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  addButtonGradient: { paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  addButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  // Modal
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  noResults: { paddingHorizontal: 24, paddingVertical: 8 },
  noResultsText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  resultIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  resultInfo: { flex: 1, gap: 3 },
  resultName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  resultMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  hintWrap: { alignItems: 'center', paddingVertical: 40 },
  hintText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
