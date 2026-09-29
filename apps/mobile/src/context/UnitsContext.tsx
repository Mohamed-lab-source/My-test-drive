import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UnitSystem } from "../utils/units";

const STORAGE_KEY = "cookmate.unitSystem";

type UnitsContextValue = {
  unitSystem: UnitSystem;
  isLoading: boolean;
  setUnitSystem: (system: UnitSystem) => Promise<void>;
};

const UnitsContext = createContext<UnitsContextValue | undefined>(undefined);

export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>("metric");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "metric" || stored === "imperial") setUnitSystemState(stored);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setUnitSystem = useCallback(async (system: UnitSystem) => {
    setUnitSystemState(system);
    await AsyncStorage.setItem(STORAGE_KEY, system);
  }, []);

  const value = useMemo(
    () => ({ unitSystem, isLoading, setUnitSystem }),
    [unitSystem, isLoading, setUnitSystem]
  );

  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits() {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error("useUnits must be used within UnitsProvider");
  return ctx;
}
