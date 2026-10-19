import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedPressable } from "./AnimatedPressable";
import { api } from "../api/client";
import { isOnline, subscribeConnectivity } from "../utils/connectivity";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";

/** A slim bar over every screen while API requests are failing for lack of a connection. */
export function OfflineBanner() {
  const { t } = useLocale();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [online, setOnline] = useState(isOnline());
  const [checking, setChecking] = useState(false);

  useEffect(() => subscribeConnectivity(setOnline), []);

  if (online) return null;

  const retry = () => {
    setChecking(true);
    // The response interceptor reports the result; nothing else to do here.
    api
      .get("/health")
      .catch(() => {})
      .finally(() => setChecking(false));
  };

  return (
    <View style={[styles.wrap, { top: insets.top + spacing(0.5) }]} pointerEvents="box-none">
      <View style={styles.banner}>
        <Text style={styles.text}>{t("offline.banner")}</Text>
        <AnimatedPressable pressScale={0.92} onPress={retry} disabled={checking} accessibilityRole="button">
          <Text style={styles.retry}>{checking ? "…" : t("offline.retry")}</Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { position: "absolute", left: spacing(1.5), right: spacing(1.5) },
    banner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.text,
      borderRadius: radius.md,
      paddingVertical: spacing(1),
      paddingHorizontal: spacing(1.5),
      gap: spacing(1),
    },
    text: { flex: 1, color: colors.background, fontSize: 12, fontWeight: "700" },
    retry: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  });
