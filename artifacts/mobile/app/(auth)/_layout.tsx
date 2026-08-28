import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Экраны входа идут цепочкой, поэтому переход горизонтальный,
        // а не модальный: человек должен видеть, что может вернуться назад.
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="phone" />
      <Stack.Screen name="code" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
