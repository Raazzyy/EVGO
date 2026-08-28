import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Состояние текущего сеанса работы: активная сессия зарядки, выбранный
 * автомобиль, активный маршрут.
 *
 * Данные пользователя берутся из AuthContext — раньше здесь стоял
 * захардкоженный DEMO_USER_ID, из-за чего всё приложение работало от имени
 * одного и того же человека.
 */

interface AppContextType {
  userId: string;
  userName: string;
  userEmail: string;
  userMembership: string;
  activeSessionId: number | null;
  setActiveSessionId: (id: number | null) => void;
  selectedVehicleId: number | null;
  setSelectedVehicleId: (id: number | null) => void;
  activeRouteId: number | null;
  setActiveRouteId: (id: number | null) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  // selectedVehicleId now refers to user_vehicles.id (not vehicles/catalog id)
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [activeRouteId, setActiveRouteId] = useState<number | null>(null);

  return (
    <AppContext.Provider
      value={{
        // Экраны за пределами (auth) рендерятся только после входа — там user
        // всегда есть. Пустые значения нужны на время первичной загрузки.
        userId: user?.id ?? '',
        userName: user?.name ?? '',
        userEmail: user?.email ?? '',
        userMembership: user?.membership_tier ?? 'free',
        activeSessionId,
        setActiveSessionId,
        selectedVehicleId,
        setSelectedVehicleId,
        activeRouteId,
        setActiveRouteId,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
