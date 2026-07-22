import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetRoutes } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { StatusBadge } from '@/components/StatusBadge';
import { GradientButton } from '@/components/GradientButton';

interface RouteStop {
  station_name: string;
  arrival_battery_pct: number;
  departure_battery_pct: number;
  charge_time_min: number;
  distance_from_prev_km: number;
  eta?: string;
}

function formatTime(totalMin: number) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function RoutesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: routes = [], isLoading } = useGetRoutes();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My Routes</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Smart charging plans
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {routes.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                <Feather name="navigation" size={32} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No routes yet</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                Plan a smart route and we'll find the optimal charging stops for your trip.
              </Text>
            </View>
          ) : (
            routes.map((route) => {
              const stops = (route.stops as RouteStop[] | null) ?? [];
              return (
                <View
                  key={route.id}
                  style={[styles.routeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  {/* Route header */}
                  <View style={styles.routeHeader}>
                    <View style={styles.routeOriginRow}>
                      <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                      <Text style={[styles.routeCity, { color: colors.text }]} numberOfLines={1}>
                        {route.origin}
                      </Text>
                    </View>
                    <View style={[styles.routeLine, { borderColor: colors.border }]} />
                    <View style={styles.routeOriginRow}>
                      <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                      <Text style={[styles.routeCity, { color: colors.text }]} numberOfLines={1}>
                        {route.destination}
                      </Text>
                    </View>
                  </View>

                  {/* Stats */}
                  <View style={styles.routeStats}>
                    <View style={styles.statItem}>
                      <Feather name="map" size={14} color={colors.primary} />
                      <Text style={[styles.statText, { color: colors.text }]}>
                        {route.total_distance_km.toFixed(0)} km
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Feather name="clock" size={14} color={colors.primary} />
                      <Text style={[styles.statText, { color: colors.text }]}>
                        {formatTime(route.total_time_min)}
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Feather name="zap" size={14} color={colors.primary} />
                      <Text style={[styles.statText, { color: colors.text }]}>
                        {stops.length} stop{stops.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <StatusBadge status={route.status as 'active' | 'completed' | 'cancelled'} />
                  </View>

                  {/* Stops */}
                  {stops.length > 0 && (
                    <View style={[styles.stopsSection, { borderTopColor: colors.border }]}>
                      <Text style={[styles.stopsTitle, { color: colors.mutedForeground }]}>
                        CHARGING STOPS
                      </Text>
                      {stops.map((stop, i) => (
                        <View key={i} style={styles.stopRow}>
                          <View style={[styles.stopDot, { backgroundColor: colors.primary + '40' }]}>
                            <Text style={[styles.stopNum, { color: colors.primary }]}>{i + 1}</Text>
                          </View>
                          <View style={styles.stopInfo}>
                            <Text style={[styles.stopName, { color: colors.text }]}>
                              {stop.station_name}
                            </Text>
                            <Text style={[styles.stopDetail, { color: colors.mutedForeground }]}>
                              +{stop.charge_time_min}min · {stop.arrival_battery_pct}% → {stop.departure_battery_pct}%
                              {stop.eta ? ` · ETA ${stop.eta}` : ''}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* New Route FAB */}
      <View style={[styles.fab, { bottom: bottomPad + 90 }]}>
        <GradientButton
          label="Plan New Route"
          onPress={() => router.push('/route/new')}
          icon={<Feather name="plus" size={18} color="#fff" />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 2 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  emptyDesc: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  routeCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  routeHeader: {
    padding: 16,
    gap: 6,
  },
  routeOriginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeLine: {
    height: 20,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    marginLeft: 4,
  },
  routeCity: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  routeStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  stopsSection: {
    borderTopWidth: 1,
    padding: 16,
    gap: 10,
  },
  stopsTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stopDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stopNum: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  stopInfo: { flex: 1, gap: 2 },
  stopName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  stopDetail: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  fab: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
});
