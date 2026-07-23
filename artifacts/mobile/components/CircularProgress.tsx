import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  pct: number;   // 0-100
  size?: number;
  color?: string;
  trackColor?: string;
  fontSize?: number;
}

/**
 * Pure-RN circular progress ring using the two-half-clip technique.
 */
export function CircularProgress({
  pct,
  size = 64,
  color = '#F59E0B',
  trackColor = '#FDE68A',
  fontSize = 13,
}: Props) {
  const stroke = Math.max(4, Math.round(size * 0.09));
  const deg = Math.round(Math.min(100, Math.max(0, pct)) * 3.6);

  // Right half — shows 0..180 of fill
  const rightDeg = Math.min(deg, 180);
  // Left half — shows 181..360 of fill
  const leftDeg = deg > 180 ? deg - 180 : 0;

  return (
    <View style={{ width: size, height: size }}>
      {/* Track ring */}
      <View style={[StyleSheet.absoluteFillObject, {
        borderRadius: size / 2,
        borderWidth: stroke,
        borderColor: trackColor,
      }]} />

      {/* Right half clip — shows fill 0→180 */}
      <View style={{
        position: 'absolute', right: 0, top: 0,
        width: size / 2, height: size,
        overflow: 'hidden',
      }}>
        <View style={{
          position: 'absolute', right: 0, top: 0,
          width: size, height: size,
          borderRadius: size / 2,
          borderWidth: stroke,
          borderColor: rightDeg > 0 ? color : 'transparent',
          transform: [{ rotate: `${rightDeg}deg` }],
        }} />
      </View>

      {/* Left half clip — shows fill 180→360 */}
      {leftDeg > 0 && (
        <View style={{
          position: 'absolute', left: 0, top: 0,
          width: size / 2, height: size,
          overflow: 'hidden',
        }}>
          <View style={{
            position: 'absolute', left: 0, top: 0,
            width: size, height: size,
            borderRadius: size / 2,
            borderWidth: stroke,
            borderColor: color,
            transform: [{ rotate: `${leftDeg}deg` }],
          }} />
        </View>
      )}

      {/* Centre label */}
      <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize, fontFamily: 'Inter_700Bold', color }}>{pct}%</Text>
      </View>
    </View>
  );
}
