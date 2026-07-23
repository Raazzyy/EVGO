import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * CircularProgress — pure-RN ring using the two-half-clip technique.
 *
 * Props (all optional except the value):
 *   progress / pct  — 0..100 fill level  (progress takes priority)
 *   size            — outer diameter in px (default 64)
 *   strokeWidth     — ring thickness in px (default: 9% of size)
 *   color           — filled arc colour (default '#F59E0B')
 *   trackColor      — empty track colour (default '#FDE68A')
 *   fontSize        — label font size (default 13)
 *   subLabel        — small text under the percentage (e.g. "Заряжено")
 *   icon            — React element rendered above the percentage
 */

interface Props {
  // Value — accept both legacy "pct" and the newer "progress" prop name
  progress?: number;
  pct?: number;

  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  fontSize?: number;
  subLabel?: string;
  icon?: React.ReactElement;
}

export function CircularProgress({
  progress,
  pct,
  size = 64,
  strokeWidth,
  color = '#F59E0B',
  trackColor = '#FDE68A',
  fontSize = 13,
  subLabel,
  icon,
}: Props) {
  // Normalise value
  const value = Math.min(100, Math.max(0, progress ?? pct ?? 0));
  const stroke = strokeWidth ?? Math.max(4, Math.round(size * 0.09));
  const deg = Math.round(value * 3.6);

  // Right half shows 0→180°, left half shows 181→360°
  const rightDeg = Math.min(deg, 180);
  const leftDeg  = deg > 180 ? deg - 180 : 0;

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <View style={{ width: size, height: size }}>
        {/* Track ring */}
        <View style={[
          StyleSheet.absoluteFillObject,
          { borderRadius: size / 2, borderWidth: stroke, borderColor: trackColor },
        ]} />

        {/* Right half clip — fill 0→180 */}
        <View style={{
          position: 'absolute', right: 0, top: 0,
          width: size / 2, height: size, overflow: 'hidden',
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

        {/* Left half clip — fill 180→360 */}
        {leftDeg > 0 && (
          <View style={{
            position: 'absolute', left: 0, top: 0,
            width: size / 2, height: size, overflow: 'hidden',
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

        {/* Centre content: optional icon + percentage */}
        <View style={[StyleSheet.absoluteFillObject, styles.centre]}>
          {icon && <View style={{ marginBottom: 2 }}>{icon}</View>}
          <Text style={{ fontSize, fontFamily: 'Inter_700Bold', color }}>
            {Math.round(value)}%
          </Text>
        </View>
      </View>

      {/* Optional sub-label below the ring */}
      {subLabel ? (
        <Text style={{ fontSize: fontSize - 2, fontFamily: 'Inter_500Medium', color, opacity: 0.75 }}>
          {subLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
});
