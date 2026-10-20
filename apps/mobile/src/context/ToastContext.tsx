import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { radius, shadow, spacing, type ThemeColors } from "../theme";

const VISIBLE_MS = 3500;
const ANIM_MS = 200;

type ToastOptions = {
  actionLabel?: string;
  onAction?: () => void;
};

type ToastState = { message: string } & ToastOptions;

type ToastContextValue = {
  showToast: (message: string, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }).start(() => setToast(null));
  }, [opacity]);

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast({ message, ...options });
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(dismiss, VISIBLE_MS);
    },
    [opacity, dismiss]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View style={[styles.wrap, { opacity }]} pointerEvents="box-none">
          <View style={styles.toast}>
            <Text style={styles.message} numberOfLines={2}>
              {toast.message}
            </Text>
            {toast.actionLabel && toast.onAction ? (
              <Pressable
                onPress={() => {
                  toast.onAction?.();
                  if (hideTimer.current) clearTimeout(hideTimer.current);
                  dismiss();
                }}
                hitSlop={8}
              >
                <Text style={styles.action}>{toast.actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { position: "absolute", left: 0, right: 0, bottom: spacing(4), alignItems: "center" },
    toast: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.text,
      borderRadius: radius.md,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.5),
      maxWidth: "90%",
      ...shadow.floating,
    },
    message: { color: colors.background, fontSize: 13, fontWeight: "600", flexShrink: 1, marginEnd: spacing(1.5) },
    action: { color: colors.primary, fontWeight: "800", fontSize: 13 },
  });
