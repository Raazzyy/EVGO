import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetVehicles,
  useCreateRoute,
  getGetRoutesQueryKey,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import { GradientButton } from '@/components/GradientButton';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') { window.alert(`${title}: ${message}`); }
  else { Alert.alert(title, message); }
}

export default function NewRouteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { selectedVehicleId } = useApp();

  // When navigated from station detail, stationName/lat/lng are pre-filled
  const params = useLocalSearchParams<{
    stationId?: string;
    stationName?: string;
    lat?: string;
    lng?: string;
  }>();

  const prefilledName = params.stationName ? decodeURIComponent(params.stationName) : '';
  const prefilledLat = params.lat ? parseFloat(params.lat) : null;
  const prefilledLng = params.lng ? parseFloat(params.lng) : null;

  const [origin, setOrigin] = useState('Ташкент, Узбекистан');
  const [destination, setDestination] = useState(prefilledName);
  const [batteryPct, setBatteryPct] = useState('85');
  const [originCoords] = useState({ lat: 41.2995, lng: 69.2401 });

  const [routeResult, setRouteResult] = useState<any>(null);

  const { data: vehicles = [] } = useGetVehicles();
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];

  const createRoute = useCreateRoute({
    mutation: {
      onSuccess: (res) => {
        qc.invalidateQueries({ queryKey: getGetRoutesQueryKey() });
        setRouteResult(res);
      },
      onError: () => showAlert('Ошибка', 'Не удалось построить маршрут. Попробуйте еще раз.'),
    },
  });

  function handleSwap() {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  }

  function handlePlanRoute() {
    if (!destination.trim()) {
      showAlert('Пункт назначения', 'Пожалуйста, введите конечную точку.');
      return;
    }
    const pct = parseFloat(batteryPct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      showAlert('Неверный заряд', 'Введите заряд от 0 до 100%.');
      return;
    }

    createRoute.mutate({
      data: {
        origin,
        destination,
        origin_lat: originCoords.lat,
        origin_lng: originCoords.lng,
        dest_lat: prefilledLat ?? 41.2995,
        dest_lng: prefilledLng ?? 69.2401,
        vehicle_id: selectedVehicleId ?? null,
        initial_battery_pct: pct,
      },
    });
  }

  function formatTime(totalMin: number) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
  }

  const bottomPad = Platform.OS === 'web' ? 84 + 16 : insets.bottom;
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Маршрут</Text>
        <TouchableOpacity style={styles.iconBtn}>
          <Feather name="more-vertical" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Points card */}
        <View style={[styles.card, { backgroundColor: colors.card, shadowColor: '#000' }]}>
          <View style={styles.inputRow}>
            <View style={[styles.inputDot, { backgroundColor: colors.primary }]} />
            <TextInput
              style={[styles.inputText, { color: colors.text }]}
              value={origin}
              onChangeText={setOrigin}
              placeholder="Введите начальную точку"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
          
          <View style={[styles.routeConnector, { borderColor: colors.border }]} />
          
          <TouchableOpacity onPress={handleSwap} style={[styles.swapBtn, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Feather name="code" size={14} color={colors.mutedForeground} style={{ transform: [{ rotate: '90deg' }] }} />
          </TouchableOpacity>

          <View style={styles.inputRow}>
            <View style={[styles.inputDot, { backgroundColor: colors.accent }]} />
            <TextInput
              style={[styles.inputText, { color: colors.text }]}
              value={destination}
              onChangeText={setDestination}
              placeholder="Введите конечную точку"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
        </View>

        {/* Car params card */}
        <View style={[styles.card, { backgroundColor: colors.card, shadowColor: '#000' }]}>
          <View style={styles.carHeaderRow}>
            <View style={styles.carIconCircle}>
              <Feather name="truck" size={18} color={colors.primary} />
            </View>
            <View style={styles.carInfo}>
              <Text style={[styles.carName, { color: colors.text }]}>
                {selectedVehicle?.name ?? 'Hyundai IONIQ 5'}
              </Text>
              <Text style={[styles.carSpecs, { color: colors.mutedForeground }]}>
                {batteryPct}% · {selectedVehicle?.range_km ?? 410} км
              </Text>
            </View>
            <TouchableOpacity>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          
          <View style={styles.paramRow}>
            <Text style={[styles.paramLabel, { color: colors.text }]}>Предпочтения:</Text>
            <Text style={[styles.paramValue, { color: colors.primary }]}>Быстрая зарядка</Text>
          </View>

          {routeResult && (
            <View style={styles.paramRow}>
              <Text style={[styles.paramLabel, { color: colors.text }]}>Поездка:</Text>
              <Text style={[styles.paramValue, { color: colors.text }]}>
                {Math.round(routeResult.total_distance_km)} км · ~{formatTime(routeResult.total_time_min)}
              </Text>
            </View>
          )}
        </View>

        {/* Route summary */}
        {routeResult && (
          <View style={[styles.summarySection]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Маршрут</Text>
            
            {/* Mini map view */}
            <View style={[styles.mapPlaceholder, { backgroundColor: colors.muted }]}>
              <View style={styles.mapLine} />
              <View style={[styles.mapDot, { left: '10%', backgroundColor: colors.primary }]} />
              <View style={[styles.mapDot, { left: '50%', backgroundColor: '#10B981' }]} />
              <View style={[styles.mapDot, { left: '90%', backgroundColor: colors.accent }]} />
              <Text style={[styles.mapText, { color: colors.mutedForeground }]}>Карта маршрута</Text>
            </View>

            {/* Stop cards */}
            <View style={styles.stopsContainer}>
              {(routeResult.stops || []).map((stop: any, i: number) => (
                <View key={i} style={[styles.stopCard, { backgroundColor: colors.card, shadowColor: '#000' }]}>
                  <View style={[styles.stopNumber, { backgroundColor: colors.primary + '1A' }]}>
                    <Text style={[styles.stopNumberText, { color: colors.primary }]}>{i + 1}</Text>
                  </View>
                  <View style={styles.stopInfo}>
                    <Text style={[styles.stopName, { color: colors.text }]}>{stop.station_name}</Text>
                    <Text style={[styles.stopDetails, { color: colors.mutedForeground }]}>
                      {stop.eta || '10:15'} · {stop.arrival_battery_pct}% → {stop.departure_battery_pct}% · {stop.charge_time_min} мин
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomPad + 12 }]}>
        {createRoute.isPending ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Построение маршрута...</Text>
          </View>
        ) : routeResult ? (
          <GradientButton
            label="Поехали"
            onPress={() => router.push('/navigate' as any)}
            icon={<Feather name="navigation" size={18} color="#fff" />}
          />
        ) : (
          <GradientButton
            label="Построить маршрут"
            onPress={handlePlanRoute}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 16, gap: 16 },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  inputText: { 
    flex: 1,
    fontSize: 16, 
    fontFamily: 'Inter_500Medium',
    paddingVertical: 8,
  },
  routeConnector: {
    height: 24,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    marginLeft: 5,
    marginVertical: 4,
  },
  swapBtn: {
    position: 'absolute',
    right: 20,
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    zIndex: 10,
  },
  carHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  carIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carInfo: {
    flex: 1,
    gap: 2,
  },
  carName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  carSpecs: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 16,
  },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paramLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  paramValue: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  summarySection: {
    gap: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  mapPlaceholder: {
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mapLine: {
    position: 'absolute',
    top: '50%',
    left: '10%',
    right: '10%',
    height: 4,
    backgroundColor: '#fff',
    borderRadius: 2,
    opacity: 0.5,
  },
  mapDot: {
    position: 'absolute',
    top: '50%',
    marginTop: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  mapText: {
    position: 'absolute',
    bottom: 12,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  stopsContainer: {
    gap: 10,
  },
  stopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopNumberText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  stopInfo: {
    flex: 1,
    gap: 4,
  },
  stopName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  stopDetails: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  loadingText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
});
