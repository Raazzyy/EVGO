import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface PromoCountdownProps {
  endsAt: string | Date | null | undefined;
  compact?: boolean; // smaller variant for stop cards
}

function parseDiff(endsAt: string | Date | null | undefined): { h: number; m: number; s: number } | null {
  if (!endsAt) return null;
  const target = typeof endsAt === 'string' ? new Date(endsAt) : endsAt;
  if (isNaN(target.getTime())) return null;
  const diff = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000));
  if (diff === 0) return null;
  return { h: Math.floor(diff / 3600), m: Math.floor((diff % 3600) / 60), s: diff % 60 };
}

function pad(n: number) { return String(n).padStart(2, '0'); }

export function PromoCountdown({ endsAt, compact = false }: PromoCountdownProps) {
  const [diff, setDiff] = useState(() => parseDiff(endsAt));

  useEffect(() => {
    setDiff(parseDiff(endsAt));
    const id = setInterval(() => setDiff(parseDiff(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!diff) return null;

  if (compact) {
    return (
      <View style={styles.compact}>
        <Text style={styles.compactText}>
          {pad(diff.h)}:{pad(diff.m)}:{pad(diff.s)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {[
        { value: diff.h, label: 'часов' },
        { value: diff.m, label: 'мин' },
        { value: diff.s, label: 'сек' },
      ].map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Text style={styles.colon}> : </Text>}
          <View style={styles.unit}>
            <Text style={styles.number}>{pad(item.value)}</Text>
            <Text style={styles.label}>{item.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unit: { alignItems: 'center', minWidth: 34 },
  number: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: '#fff',
    letterSpacing: 0.5,
  },
  label: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    marginTop: -1,
  },
  colon: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: '#fff',
    marginBottom: 8,
  },
  // Compact variant
  compact: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  compactText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: '#EF4444',
  },
});
