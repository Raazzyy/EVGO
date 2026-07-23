import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { PromoCountdown } from './PromoCountdown';

interface HotDealBannerProps {
  station: {
    id: number;
    name: string;
    discount_pct: number;
    promo_ends_at?: string | null;
    operator?: { name: string } | null;
  };
  onPress: () => void;
  onRoute: () => void;
}

export function HotDealBanner({ station, onPress, onRoute }: HotDealBannerProps) {
  const operatorName = station.operator?.name ?? station.name;
  const hasClock = !!station.promo_ends_at;

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.wrapper}>
      <LinearGradient
        colors={['#0F172A', '#1E1B4B', '#2563EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Decorative glow blobs */}
        <View style={[styles.blob, styles.blob1]} />
        <View style={[styles.blob, styles.blob2]} />

        {/* Top badge */}
        <View style={styles.hotBadge}>
          <Feather name="zap" size={11} color="#1E1B4B" />
          <Text style={styles.hotBadgeText}>HOT DEAL</Text>
        </View>

        {/* Right side: charger icon placeholder */}
        <View style={styles.rightIcon}>
          <LinearGradient
            colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
            style={styles.chargerCircle}
          >
            <Feather name="zap" size={38} color="rgba(255,255,255,0.9)" />
          </LinearGradient>
        </View>

        {/* Left: main content */}
        <View style={styles.leftContent}>
          <Text style={styles.saleTitle} numberOfLines={1}>MEGA SALE ⚡</Text>
          <Text style={styles.discountLabel}>-{station.discount_pct}%</Text>
          <Text style={styles.subtitle}>на быструю зарядку</Text>
          {hasClock && (
            <Text style={styles.untilText}>
              Только до{' '}
              {new Date(station.promo_ends_at!).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>

        {/* Bottom: countdown + button */}
        <View style={styles.bottom}>
          {hasClock && (
            <View style={styles.countdownBox}>
              <PromoCountdown endsAt={station.promo_ends_at} />
            </View>
          )}
          <TouchableOpacity onPress={onRoute} activeOpacity={0.85} style={styles.routeBtn}>
            <Feather name="navigation" size={13} color="#1E1B4B" />
            <Text style={styles.routeBtnText}>Маршрут</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  card: {
    borderRadius: 20,
    padding: 18,
    overflow: 'hidden',
    minHeight: 170,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.18,
  },
  blob1: {
    width: 140,
    height: 140,
    backgroundColor: '#7C3AED',
    top: -40,
    right: 20,
  },
  blob2: {
    width: 90,
    height: 90,
    backgroundColor: '#2563EB',
    bottom: -20,
    left: 60,
  },
  hotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FBBF24',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  hotBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: '#1E1B4B',
  },
  rightIcon: {
    position: 'absolute',
    right: 18,
    top: 14,
  },
  chargerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  leftContent: {
    maxWidth: '65%',
    gap: 2,
  },
  saleTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: '#fff',
    letterSpacing: 0.5,
  },
  discountLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 38,
    color: '#fff',
    lineHeight: 44,
    letterSpacing: -1,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  untilText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#FBBF24',
    marginTop: 2,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  countdownBox: {
    flex: 1,
  },
  routeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FBBF24',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 100,
  },
  routeBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#1E1B4B',
  },
});
