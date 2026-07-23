import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { MapViewWrapper } from '@/components/MapViewWrapper';

const STEPS = [
  { instruction: 'Поверните направо', street: 'ул. Афросиаб', distance: '1,2 км', icon: 'corner-right-up' },
  { instruction: 'Поверните налево', street: 'пр. Амира Темура', distance: '3,4 км', icon: 'corner-left-up' },
  { instruction: 'Продолжайте прямо', street: 'Ташкент–Самарканд трасса', distance: '280 км', icon: 'arrow-up' },
];

export default function NavigateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % STEPS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const topPad = Platform.OS === 'web' ? 20 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const step = STEPS[currentStep];

  return (
    <View style={styles.container}>
      <MapViewWrapper stations={[]} onStationPress={() => {}} />

      <View style={[styles.topOverlay, { paddingTop: topPad + 16 }]}>
        <View style={[styles.instructionCard, { backgroundColor: '#FFFFFF' }]}>
          <View style={[styles.directionIcon, { backgroundColor: colors.primary }]}>
            <Feather name={step.icon as any} size={24} color="#FFFFFF" />
          </View>
          <View style={styles.instructionText}>
            <Text style={[styles.distance, { color: colors.text }]}>{step.distance}</Text>
            <Text style={[styles.action, { color: colors.text }]}>{step.instruction}</Text>
            <Text style={[styles.street, { color: colors.mutedForeground }]}>{step.street}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.bottomBar, { backgroundColor: '#FFFFFF', paddingBottom: bottomPad + 16 }]}>
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.text }]}>12:45</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>прибытие</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.text }]}>3:15 ч</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>в пути</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.text }]}>310 км</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>осталось</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.endButton, { borderColor: colors.destructive }]} 
          onPress={() => router.back()}
        >
          <Text style={[styles.endButtonText, { color: colors.destructive }]}>Завершить</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    gap: 16,
  },
  directionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionText: {
    flex: 1,
  },
  distance: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  action: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 2,
  },
  street: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  endButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});
