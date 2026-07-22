import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';

interface CircularProgressProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
  subLabel?: string;
}

export function CircularProgress({
  progress,
  size = 160,
  strokeWidth = 12,
  label,
  subLabel,
}: CircularProgressProps) {
  const colors = useColors();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;
  const center = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={colors.gradientStart} />
            <Stop offset="100%" stopColor={colors.gradientEnd} />
          </SvgGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#ring-grad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.value, { color: colors.text }]}>
          {label ?? `${Math.round(progress)}%`}
        </Text>
        {subLabel ? (
          <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>{subLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -1,
  },
  subLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
});
