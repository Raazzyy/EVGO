import React, { createContext, useContext, useState, type ReactNode } from 'react';

const DEMO_USER_ID = 'user_001';
const DEMO_USER_NAME = 'Akbar Pulatov';
const DEMO_USER_EMAIL = 'akbar.pulatov@example.com';
const DEMO_USER_MEMBERSHIP = 'premium';

interface AppContextType {
  userId: string;
  userName: string;
  userEmail: string;
  userMembership: string;
  activeSessionId: number | null;
  setActiveSessionId: (id: number | null) => void;
  selectedVehicleId: number | null;
  setSelectedVehicleId: (id: number | null) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(1);

  return (
    <AppContext.Provider
      value={{
        userId: DEMO_USER_ID,
        userName: DEMO_USER_NAME,
        userEmail: DEMO_USER_EMAIL,
        userMembership: DEMO_USER_MEMBERSHIP,
        activeSessionId,
        setActiveSessionId,
        selectedVehicleId,
        setSelectedVehicleId,
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
