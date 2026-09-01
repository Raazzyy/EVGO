import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  Switch, Modal, TextInput, FlatList, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiOrigin } from '@/lib/apiBase';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import {
  useGetUserVehicles, useCreateUserVehicle, useDeleteUserVehicle,
  getGetUserVehiclesQueryKey,
  type UserVehicle,
} from '@workspace/api-client-react';
import { LinearGradient } from 'expo-linear-gradient';

interface SearchResult {
  id?: number;
  name: string;
  connector_type: string;
  battery_kwh?: number;
  range_km?: number;
  data_source?: string;
  is_verified?: boolean;
  body_style?: string;
  vehicle_type?: string;
  make?: string;
  model?: string;
  year?: number;
}

interface PopularGroup {
  make: string;
  vehicles: SearchResult[];
}

interface SearchResponse {
  results: SearchResult[];
  fuzzy: boolean;
}

function normalizeConnector(ct: string): 'CCS2' | 'CHAdeMO' | 'Type2' | 'GB-T' {
  const c = (ct || '').toUpperCase().replace(/[-\s]/g, '');
  if (c.includes('CHADEMO')) return 'CHAdeMO';
  if (c.includes('TYPE2') || c === 'TYPE2' || c === 'AC') return 'Type2';
  if (c.includes('GBT') || c.includes('GB-T') || c.includes('GB_T')) return 'GB-T';
  return 'CCS2';
}

function vehicleIcon(item: SearchResult): React.ComponentProps<typeof Feather>['name'] {
  const style = (item.body_style ?? '').toLowerCase();
  const type  = (item.vehicle_type ?? '').toLowerCase();
  if (type.includes('suv') || style.includes('crossover') || style.includes('suv')) return 'shield';
  if (type.includes('van') || style.includes('van') || style.includes('minivan')) return 'box';
  if (type.includes('pickup') || style.includes('pickup')) return 'tool';
  if (style.includes('coupe') || style.includes('roadster')) return 'wind';
  return 'zap';
}

const API_BASE = apiOrigin();
const CONNECTOR_OPTIONS: Array<'CCS2' | 'CHAdeMO' | 'Type2' | 'GB-T'> = ['CCS2', 'CHAdeMO', 'Type2', 'GB-T'];
const BODY_STYLE_OPTIONS = ['sedan', 'hatchback', 'crossover', 'suv', 'coupe', 'wagon', 'van', 'pickup'];

export default function CarsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { selectedVehicleId, setSelectedVehicleId, userId } = useApp();

  // User's garage (user_vehicles with joined catalog vehicle)
  const { data: userVehicles = [], isLoading } = useGetUserVehicles(userId);
  const [showCompatible, setShowCompatible] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // ── Add Car modal ─────────────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [isFuzzy, setIsFuzzy] = useState(false);
  const [popular, setPopular] = useState<PopularGroup[]>([]);
  const [popularLoading, setPopularLoading] = useState(false);

  // ── Manual add form ───────────────────────────────────────────────────
  const [showManual, setShowManual] = useState(false);
  const [manualMake, setManualMake] = useState('');
  const [manualModel, setManualModel] = useState('');
  const [manualYear, setManualYear] = useState('');
  const [manualBattery, setManualBattery] = useState('');
  const [manualRange, setManualRange] = useState('');
  const [manualConnector, setManualConnector] = useState<'CCS2' | 'CHAdeMO' | 'Type2' | 'GB-T'>('CCS2');
  const [manualBodyStyle, setManualBodyStyle] = useState('sedan');
  const [savingManual, setSavingManual] = useState(false);
  const [manualError, setManualError] = useState('');

  const invalidate = useCallback(() =>
    qc.invalidateQueries({ queryKey: getGetUserVehiclesQueryKey(userId) }), [qc, userId]);

  const deleteMutation = useDeleteUserVehicle({
    mutation: {
      onSuccess: () => {
        invalidate();
        if (confirmDeleteId === selectedVehicleId) setSelectedVehicleId(null);
        setConfirmDeleteId(null);
      },
    },
  });

  const createMutation = useCreateUserVehicle({
    mutation: {
      onSuccess: (uv) => {
        invalidate();
        // Auto-select newly added car if none selected
        if (!selectedVehicleId) setSelectedVehicleId(uv.id);
        closeModal();
      },
      onError: (err: any) => {
        // 409 = already in garage — just close and select
        if (err?.status === 409 || String(err).includes('409')) closeModal();
      },
    },
  });

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setQuery(''); setResults([]); setNoResults(false);
    setIsFuzzy(false); setShowManual(false); setManualError('');
  }, []);

  const openModal = useCallback(async () => {
    setModalVisible(true);
    setQuery(''); setResults([]); setNoResults(false); setShowManual(false);
    if (popular.length === 0) {
      setPopularLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/vehicles/popular`);
        const json = await res.json();
        if (Array.isArray(json)) setPopular(json as PopularGroup[]);
      } catch { /* ignore */ } finally { setPopularLoading(false); }
    }
  }, [popular.length]);

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    setNoResults(false); setIsFuzzy(false); setShowManual(false);
    if (text.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`${API_BASE}/api/vehicles/search?q=${encodeURIComponent(text.trim())}`);
      const json = await res.json() as SearchResponse | SearchResult[];
      const list: SearchResult[] = Array.isArray(json) ? json : (json.results ?? []);
      const fuzzy = Array.isArray(json) ? false : (json.fuzzy ?? false);
      setResults(list); setIsFuzzy(fuzzy); setNoResults(list.length === 0);
    } catch {
      setResults([]); setNoResults(true);
    } finally { setSearching(false); }
  }, []);

  // Add from catalog search result
  const handleAddVehicle = useCallback((car: SearchResult) => {
    createMutation.mutate({
      user_id: userId,
      ...(car.id ? { vehicle_id: car.id } : {
        name: car.name,
        connector_type: normalizeConnector(car.connector_type),
        battery_kwh: car.battery_kwh ?? 60,
        range_km: car.range_km ?? 300,
        make: car.make,
        model: car.model,
        year: car.year,
        body_style: car.body_style,
        vehicle_type: car.vehicle_type,
      }),
    });
  }, [createMutation, userId]);

  // Manual entry: create catalog record first, then link
  const handleSaveManual = useCallback(async () => {
    if (!manualMake.trim() || !manualModel.trim()) { setManualError('Введите марку и модель'); return; }
    const battery = parseFloat(manualBattery);
    const range   = parseFloat(manualRange);
    if (!battery || battery <= 0) { setManualError('Укажите корректную ёмкость батареи'); return; }
    if (!range || range <= 0)     { setManualError('Укажите корректный запас хода'); return; }
    setSavingManual(true); setManualError('');
    try {
      createMutation.mutate({
        user_id: userId,
        name: `${manualMake.trim()} ${manualModel.trim()}`,
        connector_type: manualConnector,
        battery_kwh: battery,
        range_km: range,
        make: manualMake.trim(),
        model: manualModel.trim(),
        year: manualYear.trim() ? parseInt(manualYear.trim()) : undefined,
        body_style: manualBodyStyle,
      });
    } catch (e: any) {
      setManualError(e?.message ?? 'Ошибка сети');
    } finally {
      setSavingManual(false);
    }
  }, [manualMake, manualModel, manualYear, manualBattery, manualRange, manualConnector, manualBodyStyle, userId, createMutation]);

  const topPad = Platform.OS === 'web' ? 20 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const BATTERY_LEVELS = [85, 42, 100, 67, 55, 90, 38, 72, 48];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Назад" style={styles.iconBtn}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Мои автомобили</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 40 }]} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : userVehicles.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="truck" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Нет автомобилей</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>Добавьте свой первый электромобиль.</Text>
          </View>
        ) : (
          userVehicles.map((uv: UserVehicle, index) => {
            const v = uv.vehicle;
            const batteryPct = uv.current_battery_pct ?? BATTERY_LEVELS[index % BATTERY_LEVELS.length];
            const rangeKm = Math.round(batteryPct * ((v?.range_km ?? 300) / 100));
            const isDefault = uv.id === selectedVehicleId || (selectedVehicleId == null && index === 0);
            const isDeleting = deleteMutation.isPending && confirmDeleteId === uv.id;
            return (
              <View key={uv.id}>
                <TouchableOpacity activeOpacity={0.85} onPress={() => setSelectedVehicleId(uv.id)}
                  style={[styles.carCard, { backgroundColor: colors.card, borderColor: isDefault ? colors.primary : 'transparent', borderWidth: isDefault ? 2 : 0 }]}>
                  <View style={[styles.carIconBox, { backgroundColor: colors.muted }]}>
                    <Feather name="zap" size={26} color={isDefault ? colors.primary : colors.mutedForeground} />
                  </View>
                  <View style={styles.carInfo}>
                    <Text style={[styles.carName, { color: colors.text }]}>
                      {uv.nickname ?? v?.name ?? '—'}
                    </Text>
                    <Text style={[styles.carConnector, { color: colors.mutedForeground }]}>
                      {v?.connector_type ?? '—'}{v?.battery_kwh ? ` · ${v.battery_kwh} кВт·ч` : ''}
                    </Text>
                    <View style={styles.batteryRow}>
                      <Text style={[styles.batteryText, { color: colors.mutedForeground }]}>{batteryPct}% · {rangeKm} км</Text>
                      <View style={[styles.batteryBarBg, { backgroundColor: colors.border }]}>
                        <View style={[styles.batteryBarFill, { width: `${batteryPct}%` as any, backgroundColor: batteryPct > 50 ? '#10B981' : '#F59E0B' }]} />
                      </View>
                    </View>
                    {isDefault && <View style={[styles.defaultBadge, { backgroundColor: colors.primary }]}><Text style={styles.defaultBadgeText}>По умолчанию</Text></View>}
                  </View>
                  <View style={styles.rightCol}>
                    {isDefault ? <Feather name="check-circle" size={22} color="#10B981" /> : <View style={[styles.emptyCircle, { borderColor: colors.border }]} />}
                    <TouchableOpacity onPress={() => setConfirmDeleteId(uv.id)} style={[styles.deleteBtn, { backgroundColor: '#FEE2E2' }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="trash-2" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
                {confirmDeleteId === uv.id && (
                  <View style={[styles.confirmRow, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                    <Text style={[styles.confirmText, { color: '#DC2626' }]}>Удалить автомобиль?</Text>
                    <View style={styles.confirmBtns}>
                      <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#EF4444' }]} onPress={() => deleteMutation.mutate({ id: uv.id })} disabled={isDeleting}>
                        {isDeleting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmBtnText}>Удалить</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.muted }]} onPress={() => setConfirmDeleteId(null)}>
                        <Text style={[styles.confirmBtnText, { color: colors.text }]}>Отмена</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
          <View style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Только совместимые станции</Text>
            <Switch value={showCompatible} onValueChange={setShowCompatible} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#FFFFFF" />
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Единицы измерения</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[{ fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }]}>кВт·ч / км</Text>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>
          </View>
        </View>

        <TouchableOpacity activeOpacity={0.8} style={styles.addButton} onPress={openModal}>
          <LinearGradient colors={['#2563EB', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addButtonGradient}>
            <Feather name="plus" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Добавить автомобиль</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Add Car Modal ──────────────────────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modal, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
            <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={showManual ? () => setShowManual(false) : closeModal}>
                <Feather name={showManual ? 'arrow-left' : 'x'} size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {showManual ? 'Добавить вручную' : 'Добавить автомобиль'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            {showManual ? (
              /* ── Manual entry form ─────────────────────────────────────── */
              <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} showsVerticalScrollIndicator={false}>
                <Text style={[styles.manualHint, { color: colors.mutedForeground }]}>
                  Запись будет помечена «добавлено пользователем» до верификации администратором.
                </Text>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>Марка *</Text>
                    <TextInput style={[styles.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} placeholder="BYD" placeholderTextColor={colors.mutedForeground} value={manualMake} onChangeText={setManualMake} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>Модель *</Text>
                    <TextInput style={[styles.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} placeholder="Han" placeholderTextColor={colors.mutedForeground} value={manualModel} onChangeText={setManualModel} />
                  </View>
                </View>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>Год</Text>
                    <TextInput style={[styles.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} placeholder="2023" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" value={manualYear} onChangeText={setManualYear} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>Батарея (кВт·ч) *</Text>
                    <TextInput style={[styles.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} placeholder="85.4" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" value={manualBattery} onChangeText={setManualBattery} />
                  </View>
                </View>
                <View>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Запас хода (км) *</Text>
                  <TextInput style={[styles.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]} placeholder="605" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" value={manualRange} onChangeText={setManualRange} />
                </View>
                <View>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Тип коннектора *</Text>
                  <View style={styles.chipRow}>
                    {CONNECTOR_OPTIONS.map(c => (
                      <TouchableOpacity key={c} onPress={() => setManualConnector(c)}
                        style={[styles.chipBtn, manualConnector === c && { backgroundColor: 'transparent', borderColor: 'transparent' }]}>
                        {manualConnector === c && <LinearGradient colors={['#2563EB', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />}
                        <Text style={[styles.chipText, { color: manualConnector === c ? '#fff' : colors.text }]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Тип кузова</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={[styles.chipRow, { flexWrap: 'nowrap' }]}>
                      {BODY_STYLE_OPTIONS.map(b => (
                        <TouchableOpacity key={b} onPress={() => setManualBodyStyle(b)}
                          style={[styles.chipBtn, manualBodyStyle === b && { backgroundColor: 'transparent', borderColor: 'transparent' }]}>
                          {manualBodyStyle === b && <LinearGradient colors={['#2563EB', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />}
                          <Text style={[styles.chipText, { color: manualBodyStyle === b ? '#fff' : colors.text }]}>{b}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
                {manualError ? <Text style={styles.errorText}>{manualError}</Text> : null}
                <TouchableOpacity onPress={handleSaveManual} disabled={savingManual || createMutation.isPending} style={[styles.addButton, { marginTop: 4 }]}>
                  <LinearGradient colors={['#2563EB', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addButtonGradient}>
                    {(savingManual || createMutation.isPending) ? <ActivityIndicator color="#fff" /> : <><Feather name="check" size={18} color="#fff" /><Text style={styles.addButtonText}>Сохранить</Text></>}
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              /* ── Search view ────────────────────────────────────────────── */
              <>
                <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="search" size={18} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.searchInputText, { color: colors.text }]}
                    placeholder="Tesla Model 3, BYD Han, Тесла…"
                    placeholderTextColor={colors.mutedForeground}
                    value={query} onChangeText={handleSearch} autoFocus
                  />
                  {searching && <ActivityIndicator size="small" color={colors.primary} />}
                  {query.length > 0 && !searching && (
                    <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setNoResults(false); }}>
                      <Feather name="x-circle" size={18} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  )}
                </View>

                {query.length >= 2 ? (
                  <FlatList
                    data={results}
                    keyExtractor={(_, i) => String(i)}
                    contentContainerStyle={{ padding: 16, gap: 10 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity activeOpacity={0.85} style={[styles.resultCard, { backgroundColor: colors.card }]}
                        onPress={() => handleAddVehicle(item)} disabled={createMutation.isPending}>
                        <View style={[styles.resultIcon, { backgroundColor: colors.muted }]}>
                          <Feather name={vehicleIcon(item)} size={20} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1, gap: 3 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.text }]}>{item.name}</Text>
                            {item.is_verified === false && (
                              <View style={[styles.unverifiedBadge, { backgroundColor: colors.muted }]}>
                                <Text style={[{ fontSize: 9, fontFamily: 'Inter_500Medium', color: colors.mutedForeground }]}>пользователь</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }]}>
                            {item.connector_type}{item.battery_kwh ? ` · ${item.battery_kwh} кВт·ч` : ''}{item.range_km ? ` · ${item.range_km} км` : ''}
                          </Text>
                        </View>
                        {createMutation.isPending ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="plus-circle" size={22} color={colors.primary} />}
                      </TouchableOpacity>
                    )}
                    ListHeaderComponent={isFuzzy && results.length > 0 ? (
                      <View style={[styles.fuzzyBanner, { backgroundColor: '#FEF3C7' }]}>
                        <Feather name="alert-circle" size={14} color="#92400E" />
                        <Text style={[styles.fuzzyText, { color: '#92400E' }]}>Возможно, вы имели в виду:</Text>
                      </View>
                    ) : null}
                    ListEmptyComponent={
                      noResults ? (
                        <View style={styles.noResultsBox}>
                          <Text style={[{ textAlign: 'center', color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginBottom: 16 }]}>
                            Автомобиль не найден в базе
                          </Text>
                          <TouchableOpacity onPress={() => setShowManual(true)} style={[styles.addButton]}>
                            <LinearGradient colors={['#2563EB', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.addButtonGradient, { paddingVertical: 12 }]}>
                              <Feather name="edit-3" size={16} color="#fff" />
                              <Text style={[styles.addButtonText, { fontSize: 14 }]}>Добавить вручную</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>
                      ) : searching ? null : (
                        <Text style={[{ textAlign: 'center', padding: 32, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>Поиск…</Text>
                      )
                    }
                  />
                ) : (
                  /* Popular */
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
                          <View style={[styles.makeHeader, { borderBottomColor: colors.border }]}>
                            <View style={[styles.makeIconBox, { backgroundColor: colors.muted }]}>
                              <Feather name="zap" size={14} color={colors.primary} />
                            </View>
                            <Text style={[styles.makeTitle, { color: colors.text }]}>{group.make}</Text>
                          </View>
                          {group.vehicles.map((item, idx) => (
                            <TouchableOpacity key={idx} activeOpacity={0.75} style={[styles.popularRow, { backgroundColor: colors.card, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: colors.border }]}
                              onPress={() => handleAddVehicle(item)} disabled={createMutation.isPending}>
                              <View style={{ flex: 1 }}>
                                <Text style={[{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.text }]}>{item.name}</Text>
                                <Text style={[{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }]}>
                                  {item.connector_type}{item.battery_kwh ? ` · ${item.battery_kwh} кВт·ч` : ''}{item.range_km ? ` · ${Math.round(item.range_km)} км` : ''}
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
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  iconBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  scrollContent: { padding: 16, gap: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  emptyDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  carCard: { flexDirection: 'row', padding: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, alignItems: 'center', gap: 14 },
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
  confirmRow: { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -8 },
  confirmText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  confirmBtns: { flexDirection: 'row', gap: 8 },
  confirmBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  confirmBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  settingsCard: { borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  settingLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', paddingRight: 16 },
  addButton: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  addButtonGradient: { paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  addButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  searchInputText: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  resultIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  unverifiedBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  makeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8, marginBottom: 4, borderBottomWidth: 1 },
  makeIconBox: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  makeTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, textTransform: 'uppercase' },
  popularRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14 },
  row: { flexDirection: 'row', gap: 12 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: 'Inter_400Regular' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chipBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#CBD5E1', position: 'relative', overflow: 'hidden' },
  chipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', position: 'relative', zIndex: 1 },
  errorText: { color: '#EF4444', fontSize: 13, fontFamily: 'Inter_500Medium' },
  manualHint: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19, paddingBottom: 4 },
  noResultsBox: { paddingHorizontal: 24, paddingTop: 24 },
  fuzzyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, marginBottom: 8 },
  fuzzyText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
});
