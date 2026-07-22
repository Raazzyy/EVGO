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
import { useRouter } from 'expo-router';
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

const PRESET_ROUTES = [
  {
    label: 'Tashkent → Samarkand',
    origin: 'Tashkent, Uzbekistan',
    dest: 'Samarkand, Uzbekistan',
    originLat: 41.2995,
    originLng: 69.2401,
    destLat: 39.6542,
    destLng: 66.9597,
  },
  {
    label: 'Tashkent → Namangan',
    origin: 'Tashkent, Uzbekistan',
    dest: 'Namangan, Uzbekistan',
    originLat: 41.2995,
    originLng: 69.2401,
    destLat: 41.0011,
    destLng: 71.6725,
  },
  {
    label: 'Tashkent → Bukhara',
    origin: 'Tashkent, Uzbekistan',
    dest: 'Bukhara, Uzbekistan',
    originLat: 41.2995,
    originLng: 69.2401,
    destLat: 39.7747,
    destLng: 64.4286,
  },
];

export default function NewRouteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { selectedVehicleId, setSelectedVehicleId } = useApp();

  const [origin, setOrigin] = useState('Tashkent, Uzbekistan');
  const [destination, setDestination] = useState('');
  const [batteryPct, setBatteryPct] = useState('80');
  const [originCoords, setOriginCoords] = useState({ lat: 41.2995, lng: 69.2401 });
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);

  const { data: vehicles = [] } = useGetVehicles();

  const createRoute = useCreateRoute({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetRoutesQueryKey() });
        router.back();
      },
      onError: () => Alert.alert('Error', 'Failed to plan route. Try again.'),
    },
  });

  function applyPreset(preset: (typeof PRESET_ROUTES)[0]) {
    setOrigin(preset.origin);
    setDestination(preset.dest);
    setOriginCoords({ lat: preset.originLat, lng: preset.originLng });
    setDestCoords({ lat: preset.destLat, lng: preset.destLng });
  }

  function handleSubmit() {
    if (!destination.trim()) {
      Alert.alert('Missing Destination', 'Please enter a destination.');
      return;
    }
    const pct = parseFloat(batteryPct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      Alert.alert('Invalid Battery', 'Enter a battery % between 0 and 100.');
      return;
    }

    createRoute.mutate({
      data: {
        origin,
        destination,
        origin_lat: originCoords.lat,
        origin_lng: originCoords.lng,
        dest_lat: destCoords?.lat ?? null,
        dest_lng: destCoords?.lng ?? null,
        vehicle_id: selectedVehicleId ?? null,
        initial_battery_pct: pct,
      },
    });
  }

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Presets */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Routes</Text>
          {PRESET_ROUTES.map((p) => (
            <TouchableOpacity
              key={p.label}
              onPress={() => applyPreset(p)}
              style={[
                styles.presetBtn,
                {
                  borderColor:
                    destination === p.dest ? colors.primary : colors.border,
                  backgroundColor:
                    destination === p.dest ? colors.primary + '08' : 'transparent',
                },
              ]}
            >
              <Feather name="navigation" size={16} color={destination === p.dest ? colors.primary : colors.mutedForeground} />
              <Text
                style={[
                  styles.presetText,
                  { color: destination === p.dest ? colors.primary : colors.text },
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Route inputs */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Route Details</Text>

          <View style={styles.inputRow}>
            <View style={[styles.inputDot, { backgroundColor: colors.primary }]} />
            <View style={[styles.inputBox, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <TextInput
                style={[styles.inputText, { color: colors.text }]}
                value={origin}
                onChangeText={setOrigin}
                placeholder="From"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>

          <View style={[styles.routeConnector, { borderColor: colors.border }]} />

          <View style={styles.inputRow}>
            <View style={[styles.inputDot, { backgroundColor: colors.accent }]} />
            <View style={[styles.inputBox, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <TextInput
                style={[styles.inputText, { color: colors.text }]}
                value={destination}
                onChangeText={setDestination}
                placeholder="To (e.g. Samarkand)"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>
        </View>

        {/* Vehicle */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>My Vehicle</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {vehicles.map((v) => {
              const selected = selectedVehicleId === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => setSelectedVehicleId(v.id)}
                  style={[
                    styles.vehicleChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.muted,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Feather name="zap" size={14} color={selected ? '#fff' : colors.mutedForeground} />
                  <Text style={[styles.vehicleText, { color: selected ? '#fff' : colors.text }]}>
                    {v.name}
                  </Text>
                  <Text style={[styles.vehicleSub, { color: selected ? 'rgba(255,255,255,0.8)' : colors.mutedForeground }]}>
                    {v.range_km}km
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Battery */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Current Battery</Text>
          <View style={styles.batteryRow}>
            <Feather name="battery-charging" size={20} color={colors.primary} />
            <View style={[styles.inputBox, { flex: 1, borderColor: colors.border, backgroundColor: colors.muted }]}>
              <TextInput
                style={[styles.inputText, { color: colors.text }]}
                value={batteryPct}
                onChangeText={setBatteryPct}
                keyboardType="numeric"
                placeholder="80"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <Text style={[styles.pctLabel, { color: colors.mutedForeground }]}>%</Text>
          </View>
          <Text style={[styles.batteryHint, { color: colors.mutedForeground }]}>
            We'll plan your stops to keep you above 20% at all times.
          </Text>
        </View>
      </ScrollView>

      {/* Submit */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomPad + 12 }]}>
        {createRoute.isPending ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Planning route…</Text>
          </View>
        ) : (
          <GradientButton
            label="Plan Route"
            onPress={handleSubmit}
            icon={<Feather name="navigation" size={18} color="#fff" />}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  section: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  presetText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  inputBox: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  routeConnector: {
    height: 20,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    marginLeft: 5,
  },
  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  vehicleText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  vehicleSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pctLabel: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  batteryHint: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
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
