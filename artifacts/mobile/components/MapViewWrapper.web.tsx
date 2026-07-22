import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';

export interface StationMarker {
  id: number;
  lat: number;
  lng: number;
  name: string;
  status: string;
  power_kw: number;
  price_per_kwh: number;
}

interface MapViewWrapperProps {
  stations: StationMarker[];
  onStationPress: (id: number) => void;
}

// Web fallback — react-native-maps is native-only
export function MapViewWrapper({ stations }: MapViewWrapperProps) {
  const colors = useColors();
  return (
    <View style={[styles.placeholder, { backgroundColor: colors.muted }]}>
      <Text style={[styles.text, { color: colors.mutedForeground }]}>
        Map view available on native (iOS / Android)
      </Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        {stations.length} stations loaded — scroll down to browse
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  sub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
});
