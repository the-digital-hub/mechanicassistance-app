import React, { createContext, useContext, useState } from 'react';

type MechanicStatus = 'available' | 'busy' | 'offline';

interface MechanicStatusContextType {
  mechanicStatus: MechanicStatus;
  setMechanicStatus: (status: MechanicStatus) => void;
}

const MechanicStatusContext = createContext<MechanicStatusContextType | undefined>(undefined);

export function MechanicStatusProvider({ children }: { children: React.ReactNode }) {
  const [mechanicStatus, setMechanicStatus] = useState<MechanicStatus>('available');

  return (
    <MechanicStatusContext.Provider value={{ mechanicStatus, setMechanicStatus }}>
      {children}
    </MechanicStatusContext.Provider>
  );
}

export function useMechanicStatus() {
  const context = useContext(MechanicStatusContext);
  if (!context) {
    throw new Error('useMechanicStatus must be used within a MechanicStatusProvider');
  }
  return context;
}
