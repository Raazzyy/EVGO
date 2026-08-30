import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function ChargeFAB(props: { onPress?: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity onPress={props.onPress} activeOpacity={0.85} style={styles.fabWrapper}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.fab}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Feather name="zap" size={26} color="#fff" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const isIOS = Platform.OS === 'ios';
  const isDark = false;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2FD08A',
        tabBarInactiveTintColor: '#94A3B8',
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          elevation: 0,
          height: Platform.OS === 'web' ? 84 : 80,
          paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 8,
          paddingTop: 8,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint={isDark ? 'dark' : 'extraLight'}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }]} />
          ),
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Карта',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="map" tintColor={color} size={size} />
            ) : (
              <Feather name="map" size={size - 2} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="routes"
        options={{
          title: 'Маршруты',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="location.north.line" tintColor={color} size={size} />
            ) : (
              <Feather name="navigation" size={size - 2} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="charge"
        options={{
          title: '',
          tabBarButton: () => (
            <ChargeFAB onPress={() => router.push('/charge')} />
          ),
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Сессии',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="bolt.fill" tintColor={color} size={size} />
            ) : (
              <Feather name="activity" size={size - 2} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="person.circle" tintColor={color} size={size} />
            ) : (
              <Feather name="user" size={size - 2} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fabWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    top: -16,
    shadowColor: '#2FD08A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
