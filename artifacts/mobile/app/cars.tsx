import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useGetVehicles } from '@workspace/api-client-react';
import { LinearGradient } from 'expo-linear-gradient';

export default function CarsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: apiVehicles } = useGetVehicles();
  const vehicles = apiVehicles?.slice(0, 3) || [];
  
  const [showCompatible, setShowCompatible] = useState(true);

  const topPad = Platform.OS === 'web' ? 20 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: '#F7F8FA' }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: '#FFFFFF' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Мои автомобили</Text>
        <TouchableOpacity style={styles.editButton}>
          <Text style={[styles.editText, { color: colors.primary }]}>Изменить</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 40 }]} showsVerticalScrollIndicator={false}>
        {vehicles.map((car, index) => {
          const batteryPct = [85, 42, 100][index % 3];
          const rangeKm = Math.round(batteryPct * 4.8);
          const isDefault = index === 0;

          return (
            <View key={car.id} style={[styles.carCard, { backgroundColor: '#FFFFFF' }]}>
              <View style={[styles.carIconBox, { backgroundColor: colors.muted }]}>
                <Feather name="cpu" size={28} color={colors.mutedForeground} />
              </View>
              
              <View style={styles.carInfo}>
                <Text style={[styles.carName, { color: colors.text }]}>{car.name}</Text>
                <Text style={[styles.carConnector, { color: colors.mutedForeground }]}>{car.connector_type}</Text>
                
                <View style={styles.batteryRow}>
                  <Text style={[styles.batteryText, { color: colors.mutedForeground }]}>{batteryPct}% · {rangeKm} км</Text>
                  <View style={[styles.batteryBarBg, { backgroundColor: colors.border }]}>
                    <View style={[styles.batteryBarFill, { width: `${batteryPct}%`, backgroundColor: '#10B981' }]} />
                  </View>
                </View>
                
                {isDefault && (
                  <View style={[styles.defaultBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.defaultBadgeText}>По умолчанию</Text>
                  </View>
                )}
              </View>

              <View style={styles.checkCol}>
                {isDefault ? (
                  <Feather name="check-circle" size={24} color="#10B981" />
                ) : (
                  <View style={[styles.emptyCircle, { borderColor: colors.border }]} />
                )}
              </View>
            </View>
          );
        })}

        <View style={[styles.settingsCard, { backgroundColor: '#FFFFFF' }]}>
          <View style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Показывать только совместимые станции</Text>
            <Switch
              value={showCompatible}
              onValueChange={setShowCompatible}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Единицы измерения</Text>
            <View style={styles.settingValueRow}>
              <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>кВт·ч / л</Text>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>
          </View>
        </View>

        <TouchableOpacity activeOpacity={0.8} style={styles.addButton}>
          <LinearGradient
            colors={['#2563EB', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addButtonGradient}
          >
            <Text style={styles.addButtonText}>+ Добавить автомобиль</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  editButton: {
    width: 80,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  editText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  carCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    alignItems: 'center',
    gap: 16,
  },
  carIconBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carInfo: {
    flex: 1,
    gap: 4,
  },
  carName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  carConnector: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  batteryText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  batteryBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  batteryBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  defaultBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 6,
  },
  defaultBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  checkCol: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  settingsCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    paddingRight: 16,
  },
  settingValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingValue: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  addButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  addButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});
