import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';

/**
 * Стеклянная поверхность на `expo-blur` — фолбэк для веба и Android, а также
 * для iOS без нативного Liquid Glass. Не имитирует нативное стекло на iOS
 * (там используется `GlassView` из Glass.ios.tsx) — это честный блюр, который
 * реально работает вне iOS 26.
 */

export interface GlassProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 'regular' — карточки/модалки, 'clear' — хромировка контролов. */
  glassStyle?: 'regular' | 'clear';
  /** Семантический оттенок (состояние/статус), не декор. rgba(...). */
  tint?: string;
  /** Тактильная поверхность (для симметрии с GlassView.isInteractive). */
  interactive?: boolean;
  intensity?: number;
}

export function Glass({ children, style, glassStyle = 'regular', tint, intensity }: GlassProps) {
  const blurIntensity = intensity ?? (glassStyle === 'clear' ? 55 : 75);
  return (
    <BlurView intensity={blurIntensity} tint="light" style={[styles.base, style]}>
      {/* Полупрозрачная подложка: даёт материалу «толщину» и держит контраст
          текста поверх пёстрой карты. Плюс тонкая светлая граница-блик. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.34)' }]} pointerEvents="none" />
      {tint && <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} pointerEvents="none" />}
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.5)',
  },
});
