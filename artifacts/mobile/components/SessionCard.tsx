import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { StatusBadge } from './StatusBadge';

interface Session {
  id: number;
  station?: { name: string; address: string } | null;
  energy_kwh?: number | null;
  cost?: number | null;
  status: 'active' | 'completed' | 'cancelled';
  started_at: string;
  ended_at?: string | null;
  connector_type?: string | null;
}

interface SessionCardProps {
  session: Session;
  onPress?: () => void;
  onStop?: () => void;
}

function formatDuration(startedAt: string, endedAt?: string | null) {
  const start = new Date(startedAt);
  const end = endedAt ? new Date(endedAt) : new Date();
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SessionCard({ session, onPress, onStop }: SessionCardProps) {
  const colors = useColors();
  const isActive = session.status === 'active';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isActive ? colors.primary + '40' : colors.border,
          borderWidth: isActive ? 1.5 : 1,
        },
      ]}
    >
      {isActive && (
        <View style={[styles.activeBanner, { backgroundColor: colors.primary + '0D' }]}>
          <View style={[styles.pulse, { backgroundColor: colors.primary }]} />
          <Text style={[styles.activeBannerText, { color: colors.primary }]}>
            Charging in progress
          </Text>
        </View>
      )}

      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={[styles.stationName, { color: colors.text }]} numberOfLines={1}>
            {session.station?.name ?? 'Unknown Station'}
          </Text>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {formatDate(session.started_at)}
          </Text>
        </View>
        <StatusBadge status={session.status} />
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Feather name="clock" size={13} color={colors.mutedForeground} />
          <Text style={[styles.statText, { color: colors.mutedForeground }]}>
            {formatDuration(session.started_at, session.ended_at)}
          </Text>
        </View>
        {session.energy_kwh != null && (
          <View style={styles.stat}>
            <Feather name="zap" size={13} color={colors.primary} />
            <Text style={[styles.statText, { color: colors.text }]}>
              {session.energy_kwh.toFixed(1)} kWh
            </Text>
          </View>
        )}
        {session.cost != null && (
          <View style={styles.stat}>
            <Feather name="credit-card" size={13} color={colors.primary} />
            <Text style={[styles.statText, { color: colors.text }]}>
              {Math.round(session.cost).toLocaleString()} sum
            </Text>
          </View>
        )}
        {session.connector_type && (
          <View style={styles.stat}>
            <Feather name="cpu" size={13} color={colors.mutedForeground} />
            <Text style={[styles.statText, { color: colors.mutedForeground }]}>
              {session.connector_type}
            </Text>
          </View>
        )}
      </View>

      {isActive && onStop && (
        <TouchableOpacity
          onPress={onStop}
          style={[styles.stopBtn, { borderColor: colors.destructive + '40', backgroundColor: colors.destructive + '0D' }]}
          activeOpacity={0.8}
        >
          <Feather name="square" size={14} color={colors.destructive} />
          <Text style={[styles.stopText, { color: colors.destructive }]}>Stop Session</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    gap: 12,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeBannerText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
  },
  titleBlock: { flex: 1, gap: 2 },
  stationName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  date: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 4,
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
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    margin: 16,
    marginTop: 0,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  stopText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
