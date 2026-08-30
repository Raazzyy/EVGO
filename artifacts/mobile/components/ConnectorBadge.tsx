import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Rect, Path } from 'react-native-svg';

type ConnectorType = 'CCS2' | 'CHAdeMO' | 'Type2' | 'GB-T';

const CONNECTOR_COLORS: Record<ConnectorType, { bg: string; text: string }> = {
  CCS2:    { bg: '#2FD08A1A', text: '#2FD08A' },
  CHAdeMO: { bg: '#16A46B1A', text: '#16A46B' },
  Type2:   { bg: '#10B9811A', text: '#10B981' },
  'GB-T':  { bg: '#F59E0B1A', text: '#F59E0B' },
};

// ── Connector shape icons ─────────────────────────────────────────────────

interface IconProps { color: string; size?: number; }

function CCS2Icon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      {/* AC circle (Type2 upper part) */}
      <Circle cx="10" cy="8" r="6.5" fill="none" stroke={color} strokeWidth="1.5"/>
      {/* AC pin holes: top-centre, mid-left, mid-right, lower-left, lower-right */}
      <Circle cx="10" cy="4.5" r="1"   fill={color}/>
      <Circle cx="7"  cy="7.5" r="1"   fill={color}/>
      <Circle cx="13" cy="7.5" r="1"   fill={color}/>
      <Circle cx="7.5"  cy="10.5" r="1" fill={color}/>
      <Circle cx="12.5" cy="10.5" r="1" fill={color}/>
      {/* DC contacts – the characteristic CCS2 "jaw" */}
      <Rect x="3.5" y="15" width="4.5" height="3" rx="1" fill={color}/>
      <Rect x="12"  y="15" width="4.5" height="3" rx="1" fill={color}/>
    </Svg>
  );
}

function CHAdeMOIcon({ color, size = 18 }: IconProps) {
  // Ring of 5 contacts + centre contact inside a circle
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Circle cx="10" cy="10" r="8"   fill="none" stroke={color} strokeWidth="1.5"/>
      <Circle cx="10" cy="10" r="1.2" fill={color}/>
      {/* Ring at r=5 */}
      <Circle cx="10"    cy="5"     r="1" fill={color}/>
      <Circle cx="14.76" cy="7.55"  r="1" fill={color}/>
      <Circle cx="14.76" cy="12.45" r="1" fill={color}/>
      <Circle cx="5.24"  cy="12.45" r="1" fill={color}/>
      <Circle cx="5.24"  cy="7.55"  r="1" fill={color}/>
    </Svg>
  );
}

function Type2Icon({ color, size = 18 }: IconProps) {
  // Heptagonal outline + 7 pin holes
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path
        d="M10 2 L16.25 5.01 L17.8 12.24 L13.46 17.21 L6.54 17.21 L2.2 12.24 L3.75 5.01 Z"
        fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* Top row × 3 */}
      <Circle cx="10" cy="6.5"  r="0.9" fill={color}/>
      <Circle cx="7"  cy="8.5"  r="0.9" fill={color}/>
      <Circle cx="13" cy="8.5"  r="0.9" fill={color}/>
      {/* Middle × 1 */}
      <Circle cx="10" cy="11"   r="0.9" fill={color}/>
      {/* Bottom row × 3 */}
      <Circle cx="7"  cy="13.5" r="0.9" fill={color}/>
      <Circle cx="13" cy="13.5" r="0.9" fill={color}/>
      <Circle cx="10" cy="15.5" r="0.9" fill={color}/>
    </Svg>
  );
}

function GBTIcon({ color, size = 18 }: IconProps) {
  // Rounded rectangle + 3×3 pin grid
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Rect x="2" y="2" width="16" height="16" rx="3" fill="none" stroke={color} strokeWidth="1.5"/>
      {[6, 10, 14].flatMap((y) =>
        [6, 10, 14].map((x) => (
          <Circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill={color}/>
        ))
      )}
    </Svg>
  );
}

const CONNECTOR_ICONS: Record<ConnectorType, React.ComponentType<IconProps>> = {
  CCS2:    CCS2Icon,
  CHAdeMO: CHAdeMOIcon,
  Type2:   Type2Icon,
  'GB-T':  GBTIcon,
};

// ── Badge component ───────────────────────────────────────────────────────

interface ConnectorBadgeProps {
  type: string;
  powerKw?: number;
}

export function ConnectorBadge({ type, powerKw }: ConnectorBadgeProps) {
  const c    = CONNECTOR_COLORS[type as ConnectorType] ?? { bg: '#94A3B81A', text: '#94A3B8' };
  const Icon = CONNECTOR_ICONS[type as ConnectorType] ?? null;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {Icon && <Icon color={c.text} size={15} />}
      <Text style={[styles.text, { color: c.text }]}>
        {type}{powerKw ? ` · ${powerKw} кВт` : ''}
      </Text>
    </View>
  );
}

// ── Standalone icon export (for station detail screen) ────────────────────

export function ConnectorIcon({ type, size = 18, color }: { type: string; size?: number; color: string }) {
  const Icon = CONNECTOR_ICONS[type as ConnectorType] ?? null;
  return Icon ? <Icon color={color} size={size} /> : null;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  text: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
