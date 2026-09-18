import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthToken } from "../api/client";
import { fetchMe, googleSignIn, login as apiLogin, signup as apiSignup, updatePreferences } from "../api/endpoints";
import type { Allergen, DietGoal, Preference, User } from "../api/types";

const TOKEN_KEY = "cookmate.token";

type AuthContextValue = {
  user: User | null;
  isBootstrapping: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  savePreferences: (patch: {
    dietGoal?: DietGoal;
    favoriteCuisineSlugs?: string[];
    allergies?: Allergen[];
  }) => Promise<Preference>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
        if (storedToken) {
          setAuthToken(storedToken);
          const me = await fetchMe();
          setUser(me);
        }
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY);
        setAuthToken(null);
      } finally {
        setIsBootstrapping(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: loggedInUser } = await apiLogin(email, password);
    await AsyncStorage.setItem(TOKEN_KEY, token);
    setAuthToken(token);
    setUser(loggedInUser);
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const { token, user: newUser } = await apiSignup(email, password, name);
    await AsyncStorage.setItem(TOKEN_KEY, token);
    setAuthToken(token);
    setUser(newUser);
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const { token, user: loggedInUser } = await googleSignIn(idToken);
    await AsyncStorage.setItem(TOKEN_KEY, token);
    setAuthToken(token);
    setUser(loggedInUser);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
  }, []);

  const savePreferences = useCallback(
    async (patch: { dietGoal?: DietGoal; favoriteCuisineSlugs?: string[]; allergies?: Allergen[] }) => {
      const preference = await updatePreferences(patch);
      setUser((prev) => (prev ? { ...prev, preference } : prev));
      return preference;
    },
    []
  );

  const value = useMemo(
    () => ({
      user,
      isBootstrapping,
      isAuthenticated: !!user,
      login,
      signup,
      loginWithGoogle,
      logout,
      savePreferences,
    }),
    [user, isBootstrapping, login, signup, loginWithGoogle, logout, savePreferences]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
