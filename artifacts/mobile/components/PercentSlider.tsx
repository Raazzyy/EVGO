import React, { useRef, useState } from 'react';
import { View, PanResponder, StyleSheet, LayoutChangeEvent } from 'react-native';

/**
 * Лёгкий слайдер процента без внешних зависимостей (работает и на вебе, и на
 * нативе через PanResponder). Заменяет «сухой» числовой ввод заряда на понятный
 * ползунок — как у лидеров рынка.
 */
export function PercentSlider({
  value,
  onChange,
  color = '#2563EB',
  trackColor = 'rgba(148,163,184,0.3)',
  min = 0,
  max = 100,
}: {
  value: number;
  onChange: (v: number) => void;
  color?: string;
  trackColor?: string;
  min?: number;
  max?: number;
}) {
  const widthRef = useRef(0);
  const [, force] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    force((n) => n + 1); // перерисовать заполнение после измерения ширины
  };

  const setFromX = (x: number) => {
    const w = widthRef.current || 1;
    const pct = Math.round(Math.max(min, Math.min(max, (x / w) * (max - min) + min)));
    onChange(pct);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
    }),
  ).current;

  const frac = Math.max(0, Math.min(1, (value - min) / (max - min)));

  return (
    <View
      onLayout={onLayout}
      {...pan.panHandlers}
      style={styles.hit}
      hitSlop={{ top: 12, bottom: 12 }}
    >
      <View style={[styles.track, { backgroundColor: trackColor }]}>
        <View style={[styles.fill, { width: `${frac * 100}%`, backgroundColor: color }]} />
      </View>
      <View style={[styles.thumb, { left: `${frac * 100}%`, borderColor: color }]} />
    </View>
  );
}

const THUMB = 22;
const styles = StyleSheet.create({
  hit: { height: 36, justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    marginLeft: -THUMB / 2,
    backgroundColor: '#fff',
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
});
