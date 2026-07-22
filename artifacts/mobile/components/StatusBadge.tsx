import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Status = 'free' | 'occupied' | 'offline' | 'active' | 'completed' | 'cancelled';

const LABEL: Record<Status, string> = {
  free: 'Available',
  occupied: 'In Use',
  offline: 'Offline',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

interface StatusBadgeProps {
  status: Status;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const colors = useColors();

  const color =
    status === 'free' ? colors.free :
    status === 'occupied' ? colors.occupied :
    status === 'active' ? colors.primary :
    status === 'completed' ? colors.free :
    colors.offline;

  return (
    <View style={[styles.badge, { backgroundColor: color + '1A', borderColor: color + '33' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{LABEL[status] ?? status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
});
