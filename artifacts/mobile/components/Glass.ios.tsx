import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Glass as GlassBlur, type GlassProps } from './GlassBlur';

/**
 * iOS: нативный Liquid Glass (`expo-glass-effect`).
 *
 * Два закона скила liquid-glass: (1) на iOS стекло только нативное, никогда не
 * имитируем вручную; (2) уважаем «Уменьшение прозрачности» — под ним падаем на
 * честный блюр-фолбэк, а не показываем стекло насильно.
 *
 * Если нативное стекло недоступно (iOS < 26) — тоже фолбэк на блюр.
 */

function useGlassAllowed(): boolean {
  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.().then((v) => { if (alive) setReduce(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', (v) => setReduce(!!v));
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  let native = false;
  try { native = isLiquidGlassAvailable(); } catch { native = false; }
  return native && !reduce;
}

export function Glass(props: GlassProps) {
  const allowed = useGlassAllowed();
  if (!allowed) return <GlassBlur {...props} />;

  return (
    <GlassView
      glassEffectStyle={props.glassStyle === 'clear' ? 'clear' : 'regular'}
      isInteractive={props.interactive ?? false}
      tintColor={props.tint}
      style={props.style}
    >
      {props.children}
    </GlassView>
  );
}

export type { GlassProps } from './GlassBlur';
