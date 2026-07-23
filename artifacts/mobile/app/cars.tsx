import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  Switch, Modal, TextInput, FlatList, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import {
  useGetVehicles, useCreateVehicle, useDeleteVehicle,
  getGetVehiclesQueryKey,
} from '@workspace/api-client-react';
import { LinearGradient } from 'expo-linear-gradient';

interface SearchResult {
  name: string;
  connector_type: string;
  battery_kwh?: number;
  range_km?: number;
}

interface PopularGroup {
  make: string;
  vehicles: SearchResult[];
}

// Normalize connector types to enum values the API accepts
function normalizeConnector(ct: string): 'CCS2' | 'CHAdeMO' | 'Type2' | 'GB-T' {
  const c = (ct || '').toUpperCase();
  if (c.includes('CHAdeMO') || c === 'CHADEMO') return 'CHAdeMO';
  if (c.includes('TYPE2') || c === 'TYPE 2' || c === 'AC') return 'Type2';
  if (c.includes('GB')) return 'GB-T';
  return 'CCS2'; // default
}

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : '';

export default function CarsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { selectedVehicleId, setSelectedVehicleId, userId } = useApp();

  const { data: vehicles = [], isLoading } = useGetVehicles();
  const [showCompatible, setShowCompatible] = useState(true);

  // ── Confirm delete state ──────────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // ── Add Car modal ─────────────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [popular, setPopular] = useState<PopularGroup[]>([]);
  const [popularLoading, setPopularLoading] = useState(false);

  const deleteMutation = useDeleteVehicle({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetVehiclesQueryKey() });
        setConfirmDeleteId(null);
        // If deleted car was selected, clear selection
        if (confirmDeleteId === selectedVehicleId) setSelectedVehicleId(null);
      },
    },
  });

  const createVehicle = useCreateVehicle({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetVehiclesQueryKey() });
        closeModal();
      },
    },
  });

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setQuery('');
    setResults([]);
    setNoResults(false);
  }, []);

  const openModal = useCallback(async () => {
    setModalVisible(true);
    setQuery('');
    setResults([]);
    setNoResults(false);
    if (popular.length === 0) {
      setPopularLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/vehicles/popular`);
        const json = await res.json();
        if (Array.isArray(json)) setPopular(json as PopularGroup[]);
      } catch { /* silently ignore */ }
      finally { setPopularLoading(false); }
    }
  }, [popular.length]);

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    setNoResults(false);
    if (text.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`${API_BASE}/api/vehicles/search?q=${encodeURIComponent(text.trim())}`);
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
        connector_type: normalizeConnector(car.connector_type),
        battery_kwh: car.battery_kwh ?? 60,
        range_km: car.range_km ?? 300,
        user_id: userId,
      },
    });
  }, [createVehicle, userId]);

  const topPad = Platform.OS === 'web' ? 20 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const BATTERY_LEVELS = [85, 42, 100, 67, 55, 90, 38, 72, 48];

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
        ) : vehicles.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="truck" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Нет автомобилей</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Добавьте свой первый электромобиль.
            </Text>
          </View>
        ) : (
          vehicles.map((car, index) => {
            const batteryPct = BATTERY_LEVELS[index % BATTERY_LEVELS.length];
            const rangeKm = Math.round(batteryPct * ((car.range_km ?? 300) / 100));
            const isDefault = car.id === selectedVehicleId ||
              (selectedVehicleId == null && index === 0);
            const isDeleting = deleteMutation.isPending && confirmDeleteId === car.id;

            return (
              <View key={car.id}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setSelectedVehicleId(car.id)}
                  style={[
                    styles.carCard,
                    {
                      backgroundColor: '#FFFFFF',
                      borderColor: isDefault ? colors.primary : 'transparent',
                      borderWidth: isDefault ? 2 : 0,
                    },
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
                        <View style={[
                          styles.batteryBarFill,
                          { width: `${batteryPct}%` as any, backgroundColor: batteryPct > 50 ? '#10B981' : '#F59E0B' },
                        ]} />
                      </View>
                    </View>
                    {isDefault && (
                      <View style={[styles.defaultBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.defaultBadgeText}>По умолчанию</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.rightCol}>
                    {isDefault
                      ? <Feather name="check-circle" size={22} color="#10B981" />
                      : <View style={[styles.emptyCircle, { borderColor: colors.border }]} />}
                    {/* Delete button */}
                    <TouchableOpacity
                      onPress={() => setConfirmDeleteId(car.id)}
                      style={[styles.deleteBtn, { backgroundColor: '#FEE2E2' }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="trash-2" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>

                {/* Inline delete confirmation */}
                {confirmDeleteId === car.id && (
                  <View style={[styles.confirmRow, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                    <Text style={[styles.confirmText, { color: '#DC2626' }]}>Удалить автомобиль?</Text>
                    <View style={styles.confirmBtns}>
                      <TouchableOpacity
                        style={[styles.confirmBtn, { backgroundColor: '#EF4444' }]}
                        onPress={() => deleteMutation.mutate({ id: car.id })}
                        disabled={isDeleting}
                      >
                        {isDeleting
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={styles.confirmBtnText}>Удалить</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.confirmBtn, { backgroundColor: colors.muted }]}
                        onPress={() => setConfirmDeleteId(null)}
                      >
                        <Text style={[styles.confirmBtnText, { color: colors.text }]}>Отмена</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[{ fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }]}>кВт·ч / км</Text>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>
          </View>
        </View>

        {/* Add button */}
        <TouchableOpacity activeOpacity={0.8} style={styles.addButton} onPress={openModal}>
          <LinearGradient
            colors={['#2563EB', '#7C3AED']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.addButtonGradient}
          >
            <Feather name="plus" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Добавить автомобиль</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Add Car Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <View style={[styles.modal, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={closeModal}>
              <Feather name="x" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Добавить автомобиль</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInputText, { color: colors.text }]}
              placeholder="Tesla Model 3, Hyundai IONIQ 5…"
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={handleSearch}
              autoFocus
            />
            {searching && <ActivityIndicator size="small" color={colors.primary} />}
            {query.length > 0 && !searching && (
              <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setNoResults(false); }}>
                <Feather name="x-circle" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {/* Search results OR popular list */}
          {query.length >= 2 ? (
            /* ── Search results ─────────────────────────────────────────── */
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
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.text }]}>{item.name}</Text>
                    <Text style={[{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }]}>
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
                noResults
                  ? <Text style={[{ textAlign: 'center', padding: 32, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                      Не найдено. Попробуйте другой запрос.
                    </Text>
                  : searching ? null : (
                    <Text style={[{ textAlign: 'center', padding: 32, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                      Поиск…
                    </Text>
                  )
              }
            />
          ) : (
            /* ── Popular vehicles grouped by make ───────────────────────── */
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
              {popularLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
              ) : popular.length === 0 ? (
                <Text style={[{ textAlign: 'center', padding: 40, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                  Введите марку и модель для поиска
                </Text>
              ) : (
                popular.map(group => (
                  <View key={group.make} style={{ marginBottom: 20 }}>
                    {/* Make header */}
                    <View style={[styles.makeHeader, { borderBottomColor: colors.border }]}>
                      <View style={[styles.makeIconBox, { backgroundColor: colors.muted }]}>
                        <Feather name="zap" size={14} color={colors.primary} />
                      </View>
                      <Text style={[styles.makeTitle, { color: colors.text }]}>{group.make}</Text>
                    </View>
                    {/* Model list */}
                    {group.vehicles.map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.75}
                        style={[styles.popularRow, {
                          backgroundColor: colors.card,
                          borderTopWidth: idx === 0 ? 0 : 1,
                          borderTopColor: colors.border,
                        }]}
                        onPress={() => handleAddVehicle(item)}
                        disabled={createVehicle.isPending}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.text }]}>{item.name}</Text>
                          <Text style={[{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }]}>
                            {item.connector_type}
                            {item.battery_kwh ? ` · ${item.battery_kwh} кВт·ч` : ''}
                            {item.range_km ? ` · ${Math.round(item.range_km)} км` : ''}
                          </Text>
                        </View>
                        <Feather name="plus" size={18} color={colors.primary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  iconBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  scrollContent: { padding: 16, gap: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  emptyDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  carCard: {
    flexDirection: 'row', padding: 16, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
    alignItems: 'center', gap: 14,
  },
  carIconBox: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  carInfo: { flex: 1, gap: 4 },
  carName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  carConnector: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  batteryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  batteryText: { fontSize: 12, fontFamily: 'Inter_500Medium', minWidth: 80 },
  batteryBarBg: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  batteryBarFill: { height: '100%' as any, borderRadius: 3 },
  defaultBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 6 },
  defaultBadgeText: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Inter_500Medium' },
  rightCol: { alignItems: 'center', gap: 10 },
  emptyCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  deleteBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  confirmRow: {
    borderRadius: 12, borderWidth: 1, padding: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: -8,
  },
  confirmText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  confirmBtns: { flexDirection: 'row', gap: 8 },
  confirmBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  confirmBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  settingsCard: {
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  settingLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', paddingRight: 16 },
  addButton: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  addButtonGradient: { paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  addButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 16, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1,
  },
  searchInputText: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  resultCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14,
    borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  resultIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  makeHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingBottom: 8, marginBottom: 4, borderBottomWidth: 1,
  },
  makeIconBox: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  makeTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, textTransform: 'uppercase' },
  popularRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, paddingHorizontal: 14,
  },
});
