/** VelodeskModuleContext v1.0.0 — ativação do módulo Desk / header secundário */
import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

interface VelodeskModuleContextValue {
  isDeskActive: boolean;
  activateDesk: () => void;
  deactivateDesk: () => void;
}

const VelodeskModuleContext = createContext<VelodeskModuleContextValue | null>(null);

export function VelodeskModuleProvider({ children }: { children: ReactNode }) {
  const [isDeskActive, setIsDeskActive] = useState(true);

  const value = useMemo(
    () => ({
      isDeskActive,
      activateDesk: () => setIsDeskActive(true),
      deactivateDesk: () => setIsDeskActive(false),
    }),
    [isDeskActive]
  );

  return <VelodeskModuleContext.Provider value={value}>{children}</VelodeskModuleContext.Provider>;
}

export function useVelodeskModule() {
  const ctx = useContext(VelodeskModuleContext);
  if (!ctx) throw new Error('useVelodeskModule deve ser usado dentro de VelodeskModuleProvider');
  return ctx;
}
