import React, { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Notifications from "expo-notifications";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAppSettings, type StartTab } from "../context/AppSettingsContext";
import { useKitchenTimers } from "../context/KitchenTimersContext";
import { useLeftovers } from "../context/LeftoversContext";
import { useMealReminder } from "../context/MealReminderContext";
import { useToast } from "../context/ToastContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { clearRecipeCache, createBackup, restoreBackup } from "../utils/backup";
import { FEEDBACK_EMAIL } from "../data/appInfo";
import appConfig from "../../app.json";
import type { TranslationKey } from "../i18n/translations";
import { radius, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

const START_TABS: { key: StartTab; labelKey: TranslationKey }[] = [
  { key: "Home", labelKey: "tabs.home" },
  { key: "Lists", labelKey: "tabs.lists" },
  { key: "Profile", labelKey: "tabs.profile" },
];

function hourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

export function SettingsScreen({ navigation }: Props) {
  const { t, locale, isRTL, arabicNumerals, setArabicNumerals } = useLocale();
  const { colors, highContrast, setHighContrast } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { startTab, setStartTab, quietHours, setQuietHours } = useAppSettings();
  const { enabled: mealRemindersOn } = useMealReminder();
  const { remindersEnabled: leftoverRemindersOn } = useLeftovers();
  const { timers } = useKitchenTimers();
  const { showToast } = useToast();
  const [shoppingReminderOn, setShoppingReminderOn] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [restoreText, setRestoreText] = useState("");
  const [restoreOpen, setRestoreOpen] = useState(false);
  const textAlign = isRTL ? "right" : "left";

  useEffect(() => {
    AsyncStorage.getItem("cookmate.shoppingReminder.enabled")
      .then((v) => setShoppingReminderOn(v === "true"))
      .catch(() => {});
    Notifications.getPermissionsAsync()
      .then((p) => setPermissionGranted(p.granted))
      .catch(() => setPermissionGranted(false));
  }, []);

  const runningTimers = timers.filter((tm) => tm.endsAt != null).length;

  const sendTestNotification = async () => {
    try {
      let granted = (await Notifications.getPermissionsAsync()).granted;
      if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
      setPermissionGranted(granted);
      if (!granted) {
        Alert.alert(t("mealPlanner.remindersPermissionDeniedTitle"), t("mealPlanner.remindersPermissionDeniedMessage"));
        return;
      }
      await Notifications.scheduleNotificationAsync({
        content: { title: t("settings.testTitle"), body: t("settings.testBody") },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 },
      });
      showToast(t("settings.testScheduled"));
    } catch {
      Alert.alert(t("share.error"));
    }
  };

  const exportBackup = async (mode: "share" | "copy") => {
    try {
      const { json, keyCount } = await createBackup();
      if (mode === "copy") {
        await Clipboard.setStringAsync(json);
        showToast(t("settings.backupCopied", { count: keyCount }));
      } else {
        await Share.share({ message: json, title: t("settings.backupTitle") });
      }
    } catch {
      Alert.alert(t("share.error"));
    }
  };

  const confirmRestore = () => {
    Alert.alert(t("settings.restoreConfirmTitle"), t("settings.restoreConfirmMessage"), [
      { text: t("home.cancel"), style: "cancel" },
      {
        text: t("settings.restore"),
        style: "destructive",
        onPress: async () => {
          const result = await restoreBackup(restoreText);
          if (!result.ok) {
            Alert.alert(t(result.reason === "empty" ? "settings.restoreEmpty" : "settings.restoreInvalid"));
            return;
          }
          setRestoreText("");
          setRestoreOpen(false);
          Alert.alert(t("settings.restoreDoneTitle"), t("settings.restoreDoneMessage", { count: result.keyCount }));
        },
      },
    ]);
  };

  const clearCache = async () => {
    const { count, kb } = await clearRecipeCache();
    showToast(count === 0 ? t("settings.cacheEmpty") : t("settings.cacheCleared", { count, kb }));
  };

  const sendFeedback = async () => {
    const subject = encodeURIComponent(t("settings.feedbackSubject"));
    const body = encodeURIComponent(
      `\n\n---\nCookmate ${appConfig.expo.version} · ${Platform.OS} ${String(Platform.Version)} · ${locale}`
    );
    try {
      await Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`);
    } catch {
      Alert.alert(t("settings.feedbackNoMail"));
    }
  };

  const reminderRow = (label: string, on: boolean, onManage: () => void) => (
    <AnimatedPressable style={styles.row} pressScale={0.98} onPress={onManage}>
      <Text style={[styles.rowLabel, { textAlign }]}>{label}</Text>
      <Text style={[styles.status, on ? styles.statusOn : styles.statusOff]}>
        {on ? t("settings.on") : t("settings.off")} ›
      </Text>
    </AnimatedPressable>
  );

  const shiftHour = (field: "startHour" | "endHour", delta: number) =>
    setQuietHours({ [field]: (quietHours[field] + delta + 24) % 24 });

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.section, { textAlign }]}>{t("settings.notificationsTitle")}</Text>
        <View style={styles.card}>
          <Text style={[styles.muted, { textAlign }]}>
            {permissionGranted === false ? t("settings.permissionOff") : t("settings.permissionOn")}
          </Text>
          {reminderRow(t("settings.mealReminders"), mealRemindersOn, () => navigation.navigate("MealPlanner"))}
          {reminderRow(t("settings.leftoverReminders"), leftoverRemindersOn, () =>
            navigation.navigate("Main", { screen: "Home" })
          )}
          {reminderRow(t("settings.shoppingReminder"), shoppingReminderOn, () =>
            navigation.navigate("Main", { screen: "Lists" })
          )}
          {reminderRow(t("settings.kitchenTimers", { count: runningTimers }), runningTimers > 0, () =>
            navigation.navigate("KitchenTimer")
          )}
          <View style={styles.buttonGap}>
            <PrimaryButton label={t("settings.testButton")} variant="outline" onPress={sendTestNotification} />
          </View>
        </View>

        <Text style={[styles.section, { textAlign }]}>{t("settings.quietTitle")}</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Text style={[styles.rowLabel, { textAlign }]}>{t("settings.quietToggle")}</Text>
            <Switch value={quietHours.enabled} onValueChange={(enabled) => setQuietHours({ enabled })} />
          </View>
          {quietHours.enabled ? (
            <>
              {(["startHour", "endHour"] as const).map((field) => (
                <View key={field} style={styles.switchRow}>
                  <Text style={[styles.rowLabel, { textAlign }]}>
                    {t(field === "startHour" ? "settings.quietFrom" : "settings.quietUntil")}
                  </Text>
                  <View style={styles.hourStepper}>
                    <AnimatedPressable style={styles.stepButton} pressScale={0.88} onPress={() => shiftHour(field, -1)}>
                      <Text style={styles.stepText}>−</Text>
                    </AnimatedPressable>
                    <Text style={styles.hourText}>{hourLabel(quietHours[field])}</Text>
                    <AnimatedPressable style={styles.stepButton} pressScale={0.88} onPress={() => shiftHour(field, 1)}>
                      <Text style={styles.stepText}>+</Text>
                    </AnimatedPressable>
                  </View>
                </View>
              ))}
            </>
          ) : null}
          <Text style={[styles.muted, { textAlign }]}>{t("settings.quietExplainer")}</Text>
        </View>

        <Text style={[styles.section, { textAlign }]}>{t("settings.displayTitle")}</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Text style={[styles.rowLabel, { textAlign }]}>{t("settings.highContrast")}</Text>
            <Switch value={highContrast} onValueChange={setHighContrast} />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.rowLabel, { textAlign }]}>{t("settings.arabicNumerals")}</Text>
            <Switch value={arabicNumerals} onValueChange={setArabicNumerals} />
          </View>
          <Text style={[styles.muted, { textAlign }]}>{t("settings.arabicNumeralsHint")}</Text>
          <Text style={[styles.rowLabel, styles.topGap, { textAlign }]}>{t("settings.startScreen")}</Text>
          <View style={styles.chipRow}>
            {START_TABS.map((tab) => (
              <Chip key={tab.key} label={t(tab.labelKey)} selected={startTab === tab.key} onPress={() => setStartTab(tab.key)} />
            ))}
          </View>
        </View>

        <Text style={[styles.section, { textAlign }]}>{t("settings.dataTitle")}</Text>
        <View style={styles.card}>
          <Text style={[styles.muted, { textAlign }]}>{t("settings.backupExplainer")}</Text>
          <View style={styles.rowButtons}>
            <View style={styles.flex1}>
              <PrimaryButton label={t("settings.backupShare")} variant="outline" onPress={() => exportBackup("share")} />
            </View>
            <View style={styles.flex1}>
              <PrimaryButton label={t("settings.backupCopy")} variant="outline" onPress={() => exportBackup("copy")} />
            </View>
          </View>
          {restoreOpen ? (
            <>
              <TextInput
                style={[styles.input, { textAlign }]}
                placeholder={t("settings.restorePlaceholder")}
                placeholderTextColor={colors.textMuted}
                value={restoreText}
                onChangeText={setRestoreText}
                multiline
                autoCorrect={false}
                autoCapitalize="none"
              />
              <View style={styles.buttonGap}>
                <PrimaryButton label={t("settings.restore")} onPress={confirmRestore} disabled={!restoreText.trim()} />
              </View>
            </>
          ) : (
            <AnimatedPressable style={styles.linkButton} pressScale={0.95} onPress={() => setRestoreOpen(true)}>
              <Text style={styles.link}>{t("settings.restoreOpen")}</Text>
            </AnimatedPressable>
          )}
          <AnimatedPressable style={styles.linkButton} pressScale={0.95} onPress={clearCache}>
            <Text style={styles.link}>{t("settings.clearCache")}</Text>
          </AnimatedPressable>
        </View>

        <View style={styles.buttonGap}>
          <PrimaryButton label={t("settings.feedback")} variant="outline" onPress={sendFeedback} />
        </View>
        <View style={styles.buttonGap}>
          <PrimaryButton label={t("about.title")} variant="outline" onPress={() => navigation.navigate("About")} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(2), paddingBottom: spacing(6) },
    section: { fontSize: 13, fontWeight: "800", color: colors.textMuted, marginTop: spacing(2), marginBottom: spacing(1) },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(1.5),
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing(1.25),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing(0.75) },
    rowLabel: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text },
    status: { fontSize: 13, fontWeight: "800" },
    statusOn: { color: colors.success },
    statusOff: { color: colors.textMuted },
    muted: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginTop: spacing(0.5) },
    topGap: { marginTop: spacing(1.5), marginBottom: spacing(0.75) },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1) },
    hourStepper: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
    stepButton: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: colors.chipBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    stepText: { fontSize: 18, fontWeight: "800", color: colors.primaryDark },
    hourText: { fontSize: 15, fontWeight: "800", color: colors.text, minWidth: 52, textAlign: "center" },
    rowButtons: { flexDirection: "row", gap: spacing(1), marginTop: spacing(1.5) },
    flex1: { flex: 1 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing(1.25),
      minHeight: 90,
      maxHeight: 180,
      fontSize: 12,
      color: colors.text,
      backgroundColor: colors.background,
      marginTop: spacing(1.5),
      textAlignVertical: "top",
    },
    buttonGap: { marginTop: spacing(1.5) },
    linkButton: { marginTop: spacing(1.5) },
    link: { color: colors.primary, fontWeight: "800" },
  });
