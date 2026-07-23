import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type ConnectorType = 'CCS2' | 'CHAdeMO' | 'Type2' | 'GB-T';

const CONNECTOR_COLORS: Record<ConnectorType, { bg: string; text: string }> = {
  CCS2: { bg: '#2563EB1A', text: '#2563EB' },
  CHAdeMO: { bg: '#7C3AED1A', text: '#7C3AED' },
  Type2: { bg: '#10B9811A', text: '#10B981' },
  'GB-T': { bg: '#F59E0B1A', text: '#F59E0B' },
};

interface ConnectorBadgeProps {
  type: string;
  powerKw?: number;
}

export function ConnectorBadge({ type, powerKw }: ConnectorBadgeProps) {
  const c = CONNECTOR_COLORS[type as ConnectorType] ?? { bg: '#94A3B81A', text: '#94A3B8' };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.text }]}>
        {type}{powerKw ? ` · ${powerKw} кВт` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  text: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
