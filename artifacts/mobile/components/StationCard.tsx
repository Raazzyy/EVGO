import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
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
  };
  onPress: () => void;
  compact?: boolean;
  discount_pct?: number;
  is_promoted?: boolean;
  amenities?: string[] | null;
  onRoute?: () => void;
}

export function StationCard({ station, onPress, compact = false, discount_pct = 0, is_promoted, amenities = [], onRoute }: StationCardProps) {
  const colors = useColors();
  const connectors = (station.connectors as Connector[] | null) ?? [];
  
  const totalConnectors = connectors.reduce((sum, c) => sum + c.total, 0);
  const availableConnectors = connectors.reduce((sum, c) => sum + c.available, 0);
  
  const oldPrice = discount_pct ? station.price_per_kwh / (1 - discount_pct / 100) : station.price_per_kwh;

  const getOperatorInitial = () => {
    return station.operator?.name ? station.operator.name.charAt(0).toUpperCase() : 'i';
  };

  const mapAmenityIcon = (amenity: string): keyof typeof Feather.glyphMap => {
    const map: Record<string, keyof typeof Feather.glyphMap> = {
      cafe: 'coffee',
      toilet: 'user', // closest approximation
      shop: 'shopping-bag',
      wifi: 'wifi',
      '24h': 'clock'
    };
    return map[amenity] || 'check-circle';
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.card, { backgroundColor: '#FFFFFF' }]}
    >
      {/* Row 1: Operator + Name + Distance */}
      <View style={styles.row1}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={styles.operatorCircle}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.operatorInitial}>{getOperatorInitial()}</Text>
        </LinearGradient>
        
        <View style={styles.nameDistanceBlock}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {station.name}
          </Text>
          {station.distance_km != null && (
            <View style={[styles.distanceBadge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.distanceText, { color: colors.text }]}>{station.distance_km.toFixed(1)} км</Text>
            </View>
          )}
        </View>
      </View>

      {/* Row 2: Subtitle */}
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Быстрая зарядка · DC · {connectors.length > 0 ? connectors[0].type : 'Неизвестно'}
      </Text>

      {/* Row 3: Power + Availability + Price */}
      <View style={styles.row3}>
        <View style={styles.powerBadge}>
          <Text style={styles.powerText}>{station.power_kw} кВт</Text>
        </View>
        
        {availableConnectors > 0 && (
          <Text style={styles.availabilityText}>{availableConnectors}/{totalConnectors} доступно</Text>
        )}
        
        <View style={{ flex: 1 }} />
        
        <View style={styles.priceBlock}>
          {discount_pct > 0 && (
            <>
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-{discount_pct}%</Text>
              </View>
              <Text style={[styles.oldPrice, { color: colors.mutedForeground }]}>
                {oldPrice.toLocaleString()}
              </Text>
            </>
          )}
          <Text style={[styles.priceText, { color: colors.text }]}>
            {station.price_per_kwh.toLocaleString()} сум/кВт·ч
          </Text>
        </View>
      </View>

      {/* Row 4: Amenities */}
      {amenities && amenities.length > 0 && (
        <View style={styles.amenitiesRow}>
          {amenities.map((am, idx) => (
            <Feather key={idx} name={mapAmenityIcon(am)} size={14} color={colors.mutedForeground} />
          ))}
        </View>
      )}

      {/* Row 5: Connector badges */}
      {!compact && connectors.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.connectorsScroll} contentContainerStyle={styles.connectors}>
          {connectors.map((c, i) => (
            <View key={i} style={[styles.connectorChip, { backgroundColor: colors.muted }]}>
              <Text style={[styles.connectorChipType, { color: colors.text }]}>{c.type}</Text>
              <Text style={[styles.connectorChipPower, { color: colors.mutedForeground }]}>{c.power_kw} кВт</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.donutWrapper}>
          <Svg width={32} height={32} viewBox="0 0 32 32">
            <Circle cx={16} cy={16} r={14} stroke={colors.muted} strokeWidth={4} fill="none" />
            {totalConnectors > 0 && availableConnectors > 0 && (
              <Circle 
                cx={16} cy={16} r={14} 
                stroke={colors.free} 
                strokeWidth={4} 
                fill="none" 
                strokeDasharray={2 * Math.PI * 14} 
                strokeDashoffset={(2 * Math.PI * 14) * (1 - (availableConnectors / totalConnectors))} 
                strokeLinecap="round" 
                transform="rotate(-90 16 16)" 
              />
            )}
          </Svg>
          <View style={styles.donutCenter}>
            <Text style={[styles.donutText, { color: colors.text }]}>
              {availableConnectors}/{totalConnectors}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={onRoute ? onRoute : () => {}} activeOpacity={0.8}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.routeBtn}
          >
            <Text style={styles.routeBtnText}>Маршрут</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  operatorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorInitial: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  nameDistanceBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    flex: 1,
  },
  distanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  distanceText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  row3: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  powerBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  powerText: {
    color: '#2563EB',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  availabilityText: {
    color: '#10B981',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  priceBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  discountBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: '#EF4444',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  oldPrice: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    textDecorationLine: 'line-through',
  },
  priceText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  amenitiesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  connectorsScroll: {
    marginBottom: 16,
  },
  connectors: {
    flexDirection: 'row',
    gap: 8,
  },
  connectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  connectorChipType: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  connectorChipPower: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  donutWrapper: {
    position: 'relative',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
  },
  routeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
  routeBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
