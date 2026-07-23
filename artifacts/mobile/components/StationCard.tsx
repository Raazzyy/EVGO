import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';

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
    rating?: number | null;
    source?: string | null;
  };
  onPress: () => void;
  compact?: boolean;
  discount_pct?: number;
  is_promoted?: boolean;
  amenities?: string[] | null;
  onRoute?: () => void;
}

// Deterministic color based on operator initial
const OPERATOR_COLORS: Record<string, [string, string]> = {
  I: ['#0EA5E9', '#0284C7'],
  K: ['#F59E0B', '#D97706'],
  C: ['#10B981', '#059669'],
  T: ['#8B5CF6', '#7C3AED'],
  U: ['#EF4444', '#DC2626'],
  B: ['#EC4899', '#DB2777'],
  G: ['#14B8A6', '#0D9488'],
};

function getOperatorColors(name?: string | null): [string, string] {
  const initial = name?.charAt(0).toUpperCase() ?? 'i';
  return OPERATOR_COLORS[initial] ?? ['#6366F1', '#4F46E5'];
}

function getChargeType(connectors: Connector[]): string {
  const dcTypes = ['CCS2', 'CHAdeMO', 'GB/T'];
  const hasDC = connectors.some((c) => dcTypes.includes(c.type));
  return hasDC ? 'DC' : 'AC';
}

function getFirstConnectorType(connectors: Connector[]): string {
  return connectors[0]?.type ?? 'CCS2';
}

function estimateMinutes(distanceKm?: number | null): number | null {
  if (!distanceKm || distanceKm <= 0) return null;
  return Math.max(1, Math.round((distanceKm / 30) * 60));
}

export function StationCard({
  station,
  onPress,
  compact = false,
  discount_pct = 0,
  is_promoted,
  onRoute,
}: StationCardProps) {
  const colors = useColors();
  const connectors: Connector[] = (station.connectors as Connector[] | null) ?? [];

  const totalConnectors = connectors.reduce((s, c) => s + c.total, 0);
  const availableConnectors = connectors.reduce((s, c) => s + c.available, 0);

  const operatorName = station.operator?.name ?? null;
  const [gradStart, gradEnd] = getOperatorColors(operatorName);
  const initial = operatorName?.charAt(0).toUpperCase() ?? 'i';

  const chargeType = getChargeType(connectors);
  const connType = getFirstConnectorType(connectors);

  const originalPrice = discount_pct > 0
    ? Math.round(station.price_per_kwh / (1 - discount_pct / 100))
    : null;

  const statusColor =
    station.status === 'free' ? '#10B981'
    : station.status === 'occupied' ? '#F59E0B'
    : '#94A3B8';

  const rating = station.rating ?? (is_promoted ? 4.8 : null);
  const minutes = estimateMinutes(station.distance_km);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.card, { backgroundColor: '#FFFFFF' }]}
    >
      {/* Row 1: Operator icon + Name + Distance */}
      <View style={styles.row1}>
        <LinearGradient
          colors={[gradStart, gradEnd]}
          style={styles.operatorCircle}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.operatorInitial}>{initial}</Text>
        </LinearGradient>

        <View style={styles.namePart}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {station.name}
            </Text>
            {is_promoted && (
              <Feather name="star" size={13} color="#F59E0B" style={{ marginLeft: 4 }} />
            )}
            {station.source === 'mock' && (
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>демо</Text>
              </View>
            )}
          </View>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {chargeType === 'DC' ? 'Быстрая зарядка' : 'Медленная зарядка'} · {chargeType} · {connType}
          </Text>
        </View>

        <View style={styles.distancePart}>
          {station.distance_km != null && (
            <Text style={[styles.distanceText, { color: colors.mutedForeground }]}>
              {station.distance_km < 1
                ? `${Math.round(station.distance_km * 1000)} м`
                : `${station.distance_km.toFixed(1)} км`}
            </Text>
          )}
        </View>
      </View>

      {/* Row 2: Power + Availability + Price */}
      <View style={styles.row2}>
        {/* Power */}
        <View style={[styles.powerBadge, { backgroundColor: '#EFF6FF' }]}>
          <Feather name="zap" size={10} color="#2563EB" />
          <Text style={styles.powerText}>{station.power_kw} кВт</Text>
        </View>

        {/* Status dot + availability */}
        <View style={styles.availRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.availText, { color: statusColor }]}>
            {availableConnectors}/{totalConnectors} доступно
          </Text>
        </View>

        <View style={{ flex: 1 }} />

        {/* Price */}
        <View style={styles.priceBlock}>
          {originalPrice && (
            <Text style={[styles.oldPrice, { color: colors.mutedForeground }]}>
              {originalPrice.toLocaleString('ru-RU')}
            </Text>
          )}
          <Text style={[styles.price, { color: colors.text }]}>
            {station.price_per_kwh.toLocaleString('ru-RU')}
          </Text>
          {discount_pct > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{discount_pct}%</Text>
            </View>
          )}
        </View>
      </View>

      {/* Rating row (for promoted) */}
      {rating && (
        <View style={styles.ratingRow}>
          <Feather name="star" size={11} color="#F59E0B" />
          <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>{rating}</Text>
          <View style={styles.ratingDot} />
          <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>
            {station.price_per_kwh.toLocaleString('ru-RU')} сум/кВт·ч
          </Text>
        </View>
      )}

      {/* Footer: Donut + Маршрут button + time chip */}
      <View style={styles.footer}>
        {!compact && totalConnectors > 0 && (
          <View style={styles.donutWrapper}>
            <Svg width={28} height={28} viewBox="0 0 28 28">
              <Circle cx={14} cy={14} r={12} stroke={colors.muted} strokeWidth={3.5} fill="none" />
              {availableConnectors > 0 && (
                <Circle
                  cx={14}
                  cy={14}
                  r={12}
                  stroke={statusColor}
                  strokeWidth={3.5}
                  fill="none"
                  strokeDasharray={2 * Math.PI * 12}
                  strokeDashoffset={
                    (2 * Math.PI * 12) * (1 - availableConnectors / totalConnectors)
                  }
                  strokeLinecap="round"
                  transform="rotate(-90 14 14)"
                />
              )}
            </Svg>
            <View style={styles.donutCenter}>
              <Text style={[styles.donutText, { color: colors.text }]}>
                {availableConnectors}/{totalConnectors}
              </Text>
            </View>
          </View>
        )}

        <View style={{ flex: 1 }} />

        <TouchableOpacity onPress={onRoute ?? onPress} activeOpacity={0.85}>
          <LinearGradient
            colors={['#2563EB', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.routeBtn}
          >
            <Text style={styles.routeBtnText}>Маршрут</Text>
          </LinearGradient>
        </TouchableOpacity>

        {minutes != null && (
          <View style={[styles.timeChip, { backgroundColor: colors.muted }]}>
            <Text style={[styles.timeText, { color: colors.mutedForeground }]}>{minutes} мин</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 12,
  },
  row1: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  operatorCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  operatorInitial: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  namePart: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  distancePart: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  distanceText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  powerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  powerText: {
    color: '#2563EB',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  availText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  priceBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  oldPrice: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    textDecorationLine: 'line-through',
  },
  price: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  discountBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  discountText: {
    color: '#EF4444',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  ratingDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },
  priceLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  donutWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  donutCenter: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutText: {
    fontSize: 7,
    fontFamily: 'Inter_700Bold',
  },
  routeBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 100,
  },
  routeBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  timeChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 100,
  },
  timeText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  demoBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 5,
  },
  demoBadgeText: {
    color: '#92400E',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
});
