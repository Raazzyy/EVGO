import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { StatusBadge } from './StatusBadge';
import { ConnectorBadge } from './ConnectorBadge';

interface Connector {
  type: string;
  power_kw: number;
  total: number;
  available: number;
}

interface StationCardProps {
  station: {
    id: number;
    name: string;
    address: string;
    power_kw: number;
    price_per_kwh: number;
    status: 'free' | 'occupied' | 'offline';
    connectors?: Connector[] | null;
    distance_km?: number | null;
    operator?: { name: string } | null;
  };
  onPress: () => void;
  compact?: boolean;
}

export function StationCard({ station, onPress, compact = false }: StationCardProps) {
  const colors = useColors();
  const connectors = (station.connectors as Connector[] | null) ?? [];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {station.name}
          </Text>
          {station.operator ? (
            <Text style={[styles.operator, { color: colors.mutedForeground }]}>
              {station.operator.name}
            </Text>
          ) : null}
        </View>
        <StatusBadge status={station.status} />
      </View>

      <Text style={[styles.address, { color: colors.mutedForeground }]} numberOfLines={1}>
        <Feather name="map-pin" size={12} color={colors.mutedForeground} /> {station.address}
      </Text>

      {!compact && connectors.length > 0 && (
        <View style={styles.connectors}>
          {connectors.slice(0, 3).map((c, i) => (
            <ConnectorBadge key={i} type={c.type} powerKw={c.power_kw} />
          ))}
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={styles.stat}>
            <Feather name="zap" size={13} color={colors.primary} />
            <Text style={[styles.statText, { color: colors.text }]}>
              {station.power_kw} kW
            </Text>
          </View>
          <View style={styles.stat}>
            <Feather name="credit-card" size={13} color={colors.primary} />
            <Text style={[styles.statText, { color: colors.text }]}>
              {station.price_per_kwh.toLocaleString()} sum/kWh
            </Text>
          </View>
          {station.distance_km != null && (
            <View style={styles.stat}>
              <Feather name="navigation" size={13} color={colors.mutedForeground} />
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                {station.distance_km.toFixed(1)} km
              </Text>
            </View>
          )}
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  operator: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  address: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  connectors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  footerLeft: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});
