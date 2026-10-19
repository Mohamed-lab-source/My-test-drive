import React, { useMemo, useState } from "react";
import { Alert, FlatList, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { EmptyState } from "../components/EmptyState";
import { PrimaryButton } from "../components/PrimaryButton";
import { useCookingJournal, type JournalEntry } from "../context/CookingJournalContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { CUISINE_EMOJI } from "../utils/cuisineEmoji";
import { formatClock } from "../utils/recipeBadges";
import { radius, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "CookingJournal">;

function dayLabel(iso: string): string {
  return iso.slice(0, 10);
}

export function CookingJournalScreen({ navigation }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { entries, updateNote, removeEntry } = useCookingJournal();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const textAlign = isRTL ? "right" : "left";

  const totalMinutes = entries.reduce((sum, e) => sum + e.durationMin, 0);

  const startEditing = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setDraft(entry.note);
  };

  const save = () => {
    if (editingId) updateNote(editingId, draft.trim());
    setEditingId(null);
  };

  const confirmRemove = (entry: JournalEntry) => {
    Alert.alert(t("journal.removeConfirm", { title: entry.title }), undefined, [
      { text: t("home.cancel"), style: "cancel" },
      { text: t("journal.remove"), style: "destructive", onPress: () => removeEntry(entry.id) },
    ]);
  };

  /** Plain text, one line per session -- easy to paste into notes or a spreadsheet. */
  const exportHistory = () => {
    const header = t("journal.exportHeader");
    const lines = entries.map((e) =>
      [dayLabel(e.finishedAt), e.title, `${e.durationMin} min`, `${e.servings}`, e.note.replace(/\s+/g, " ")].join(" | ")
    );
    Share.share({ message: [t("journal.exportTitle"), "", header, ...lines].join("\n") }).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          entries.length > 0 ? (
            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                {t("journal.summary", { count: entries.length, hours: Math.round((totalMinutes / 60) * 10) / 10 })}
              </Text>
              <View style={styles.exportButton}>
                <PrimaryButton label={t("journal.export")} variant="outline" onPress={exportHistory} />
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={<EmptyState icon="📓" message={t("journal.empty")} />}
        renderItem={({ item }) => {
          const editing = editingId === item.id;
          const finished = new Date(item.finishedAt);
          return (
            <View style={styles.card}>
              <AnimatedPressable
                pressScale={0.98}
                onPress={() => navigation.navigate("RecipeDetail", { slug: item.slug })}
                onLongPress={() => confirmRemove(item)}
              >
                <Text style={[styles.title, { textAlign }]}>
                  {CUISINE_EMOJI[item.cuisineSlug] ?? "🍽️"} {item.title}
                </Text>
                <Text style={[styles.meta, { textAlign }]}>
                  {t("journal.meta", {
                    date: dayLabel(item.finishedAt),
                    time: formatClock(finished, locale),
                    minutes: item.durationMin,
                    servings: item.servings,
                  })}
                </Text>
              </AnimatedPressable>
              {editing ? (
                <>
                  <TextInput
                    style={[styles.input, { textAlign }]}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={t("journal.notePlaceholder")}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    autoFocus
                  />
                  <AnimatedPressable style={styles.saveButton} pressScale={0.95} onPress={save}>
                    <Text style={styles.saveText}>{t("journal.saveNote")}</Text>
                  </AnimatedPressable>
                </>
              ) : (
                <AnimatedPressable pressScale={0.98} onPress={() => startEditing(item)}>
                  <Text style={[item.note ? styles.note : styles.addNote, { textAlign }]}>
                    {item.note ? `📝 ${item.note}` : t("journal.addNote")}
                  </Text>
                </AnimatedPressable>
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(2), paddingBottom: spacing(6) },
    summary: { marginBottom: spacing(1.5) },
    summaryText: { fontSize: 15, fontWeight: "800", color: colors.text },
    exportButton: { marginTop: spacing(1.5) },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing(1.5),
      marginBottom: spacing(1.25),
    },
    title: { fontSize: 15, fontWeight: "800", color: colors.text },
    meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    note: { fontSize: 14, color: colors.text, marginTop: spacing(1), lineHeight: 20 },
    addNote: { fontSize: 13, color: colors.primary, fontWeight: "700", marginTop: spacing(1) },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing(1.25),
      minHeight: 70,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.background,
      marginTop: spacing(1),
      textAlignVertical: "top",
    },
    saveButton: { alignSelf: "flex-end", marginTop: spacing(1) },
    saveText: { color: colors.primary, fontWeight: "800" },
  });
