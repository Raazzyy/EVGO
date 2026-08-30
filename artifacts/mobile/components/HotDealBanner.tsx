import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { PromoCountdown } from './PromoCountdown';

const BANNER_MAX_H = Math.round(Dimensions.get('window').height * 0.20);

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
  const hasClock = !!station.promo_ends_at;
  const untilTime = hasClock
    ? new Date(station.promo_ends_at!).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.wrapper}>
      <LinearGradient
        colors={['#0F172A', '#06231F', '#2FD08A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Decorative blobs */}
        <View style={[styles.blob, styles.blob1]} />
        <View style={[styles.blob, styles.blob2]} />

        {/* Right icon — smaller circle */}
        <View style={styles.rightIcon}>
          <LinearGradient
            colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
            style={styles.chargerCircle}
          >
            <Feather name="zap" size={24} color="rgba(255,255,255,0.9)" />
          </LinearGradient>
        </View>

        {/* Left content */}
        <View style={styles.leftContent}>
          {/* Row 1: HOT DEAL badge */}
          <View style={styles.hotBadge}>
            <Feather name="zap" size={9} color="#06231F" />
            <Text style={styles.hotBadgeText}>HOT DEAL</Text>
          </View>

          {/* Row 2: title + discount inline */}
          <View style={styles.titleRow}>
            <Text style={styles.saleTitle}>MEGA SALE ⚡</Text>
            <Text style={styles.discountLabel}> -{station.discount_pct}%</Text>
          </View>

          {/* Row 3: subtitle + until */}
          <Text style={styles.subtitle} numberOfLines={1}>
            на быструю зарядку{untilTime ? `  ·  до ${untilTime}` : ''}
          </Text>

          {/* Row 4: compact countdown + button */}
          <View style={styles.bottom}>
            {hasClock && <PromoCountdown endsAt={station.promo_ends_at} compact />}
            <TouchableOpacity onPress={onRoute} activeOpacity={0.85} style={styles.routeBtn}>
              <Feather name="navigation" size={11} color="#06231F" />
              <Text style={styles.routeBtnText}>Маршрут</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
    borderRadius: 16,
    shadowColor: '#2FD08A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    maxHeight: BANNER_MAX_H,
  },
  card: {
    borderRadius: 16,
    padding: 11,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.15,
  },
  blob1: {
    width: 100,
    height: 100,
    backgroundColor: '#16A46B',
    top: -30,
    right: 10,
  },
  blob2: {
    width: 70,
    height: 70,
    backgroundColor: '#2FD08A',
    bottom: -15,
    left: 50,
  },
  rightIcon: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -22,
  },
  chargerCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  leftContent: {
    flex: 1,
    paddingRight: 56, // space for charger icon
    gap: 3,
  },
  hotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FBBF24',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  hotBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: '#06231F',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'nowrap',
  },
  saleTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.3,
  },
  discountLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: '#fff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  routeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FBBF24',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  routeBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: '#06231F',
  },
});
