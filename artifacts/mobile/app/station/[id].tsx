import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetStation,
  useStartSession,
  getGetSessionsQueryKey,
  getGetStationsQueryKey,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/contexts/AppContext';
import { StatusBadge } from '@/components/StatusBadge';
import { ConnectorBadge } from '@/components/ConnectorBadge';
import { GradientButton } from '@/components/GradientButton';

interface Connector {
  type: string;
  power_kw: number;
  total: number;
  available: number;
}

export default function StationDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { userId, setActiveSessionId } = useApp();
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);

  const { data: station, isLoading } = useGetStation({ id: Number(id) });

  const startMutation = useStartSession({
    mutation: {
      onSuccess: (session) => {
        setActiveSessionId(session.id);
        qc.invalidateQueries({ queryKey: getGetSessionsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetStationsQueryKey() });
        router.push('/charge');
      },
      onError: () => Alert.alert('Error', 'Failed to start session. Try again.'),
    },
  });

  const connectors: Connector[] = (station?.connectors as Connector[] | null) ?? [];
  const amenities: string[] = (station?.amenities as string[] | null) ?? [];

  function handleCharge() {
    if (!station) return;
    if (station.status === 'offline') {
      Alert.alert('Station Offline', 'This station is currently offline.');
      return;
    }
    startMutation.mutate({
      data: {
        station_id: station.id,
        user_id: userId,
        connector_type: selectedConnector ?? connectors[0]?.type ?? 'CCS2',
      },
    });
  }

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!station) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Station not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroTitles}>
              <Text style={[styles.stationName, { color: colors.text }]}>{station.name}</Text>
              {station.operator && (
                <Text style={[styles.operatorName, { color: colors.mutedForeground }]}>
                  {(station.operator as { name: string }).name}
                </Text>
              )}
            </View>
            <StatusBadge status={station.status as 'free' | 'occupied' | 'offline'} />
          </View>

          <View style={styles.addressRow}>
            <Feather name="map-pin" size={14} color={colors.mutedForeground} />
            <Text style={[styles.address, { color: colors.mutedForeground }]}>
              {station.address}
            </Text>
          </View>
        </View>

        {/* Key stats */}
        <View style={[styles.statsGrid, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statBlock}>
            <Feather name="zap" size={20} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{station.power_kw} kW</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Max Power</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statBlock}>
            <Feather name="credit-card" size={20} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {station.price_per_kwh.toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>sum / kWh</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statBlock}>
            <Feather name="cpu" size={20} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {connectors.reduce((a, c) => a + c.available, 0)}/{connectors.reduce((a, c) => a + c.total, 0)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Available</Text>
          </View>
        </View>

        {/* Connectors */}
        {connectors.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Connector</Text>
            {connectors.map((c, i) => {
              const isSelected = selectedConnector === c.type || (!selectedConnector && i === 0);
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelectedConnector(c.type)}
                  style={[
                    styles.connectorRow,
                    {
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primary + '08' : 'transparent',
                    },
                  ]}
                >
                  <ConnectorBadge type={c.type} powerKw={c.power_kw} />
                  <View style={styles.connectorInfo}>
                    <Text style={[styles.connectorType, { color: colors.text }]}>{c.type}</Text>
                    <Text style={[styles.connectorAvail, { color: colors.mutedForeground }]}>
                      {c.available}/{c.total} available
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
                      <Feather name="check" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Amenities */}
        {amenities.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Amenities</Text>
            <View style={styles.amenitiesRow}>
              {amenities.map((a) => (
                <View key={a} style={[styles.amenityBadge, { backgroundColor: colors.muted }]}>
                  <Feather
                    name={a === 'cafe' ? 'coffee' : a === 'wifi' ? 'wifi' : a === 'toilet' ? 'home' : a === 'shop' ? 'shopping-bag' : a === 'lounge' ? 'star' : 'check'}
                    size={12}
                    color={colors.mutedForeground}
                  />
                  <Text style={[styles.amenityText, { color: colors.mutedForeground }]}>
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Cost estimate */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Cost Estimate</Text>
          {[10, 30, 60].map((mins) => {
            const energyKwh = (station.power_kw * mins) / 60;
            const cost = energyKwh * station.price_per_kwh;
            return (
              <View key={mins} style={styles.estimateRow}>
                <Text style={[styles.estimateMins, { color: colors.mutedForeground }]}>
                  {mins} minutes
                </Text>
                <Text style={[styles.estimateKwh, { color: colors.mutedForeground }]}>
                  ~{energyKwh.toFixed(1)} kWh
                </Text>
                <Text style={[styles.estimateCost, { color: colors.text }]}>
                  {Math.round(cost).toLocaleString()} sum
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Charge button */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: bottomPad + 12,
          },
        ]}
      >
        <GradientButton
          label={
            station.status === 'offline'
              ? 'Station Offline'
              : station.status === 'occupied'
              ? 'Station Busy'
              : 'Start Charging'
          }
          onPress={handleCharge}
          loading={startMutation.isPending}
          disabled={station.status !== 'free'}
          icon={<Feather name="zap" size={18} color="#fff" />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
  heroCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  heroTitles: { flex: 1, gap: 2 },
  stationName: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  operatorName: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  address: { fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1 },
  statsGrid: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    borderWidth: 1,
  },
  statBlock: { flex: 1, alignItems: 'center', gap: 6 },
  statValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  statDivider: { width: 1, height: 50, alignSelf: 'center', marginHorizontal: 4 },
  section: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  connectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  connectorInfo: { flex: 1 },
  connectorType: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  connectorAvail: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amenitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  amenityText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  estimateMins: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  estimateKwh: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  estimateCost: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
});
