import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { useThemeScheme } from '@/contexts/ThemeContext';

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
  const dark = useThemeScheme() === 'dark';
  const blurIntensity = intensity ?? (glassStyle === 'clear' ? 55 : 75);
  // В тёмной теме стекло тёмное с тёмной подложкой и приглушённой границей;
  // в светлой — светлое с белой подложкой и светлым бликом.
  const overlay = dark ? 'rgba(20,27,43,0.42)' : 'rgba(255,255,255,0.34)';
  const borderColor = dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.5)';
  return (
    <BlurView intensity={blurIntensity} tint={dark ? 'dark' : 'light'} style={[styles.base, { borderColor }, style]}>
      {/* Полупрозрачная подложка: даёт материалу «толщину» и держит контраст
          текста поверх пёстрой карты. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} pointerEvents="none" />
      {tint && <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} pointerEvents="none" />}
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
