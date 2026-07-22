import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  small?: boolean;
  icon?: React.ReactNode;
}

export function GradientButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style,
  small = false,
  icon,
}: GradientButtonProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[styles.wrapper, style, disabled && { opacity: 0.5 }]}
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradient, small && styles.gradientSmall]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {icon}
            <Text style={[styles.label, small && styles.labelSmall]}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  gradientSmall: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
  },
  labelSmall: {
    fontSize: 14,
  },
});
