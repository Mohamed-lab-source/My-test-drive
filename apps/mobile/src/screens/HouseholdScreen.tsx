import React, { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { fetchRecipes } from "../api/endpoints";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/PrimaryButton";
import { useHousehold, type HouseholdMember } from "../context/HouseholdContext";
import { useFavorites } from "../context/FavoritesContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { ALL_ALLERGENS } from "../utils/allergens";
import { isKidFriendly } from "../utils/kidFriendly";
import { shareViaWhatsApp } from "../utils/whatsapp";
import { APP_DOWNLOAD_URL } from "../data/appInfo";
import type { TranslationKey } from "../i18n/translations";
import { radius, spacing, type ThemeColors } from "../theme";
import type { Allergen, RecipeSummary } from "../api/types";

type Props = NativeStackScreenProps<RootStackParamList, "Household">;

const MEMBER_EMOJIS = ["👩", "👨", "👧", "👦", "👶", "👵", "👴", "🧑"];
const VOTE_OPTIONS = 3;

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function HouseholdScreen({ navigation }: Props) {
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { members, addMember, updateMember, removeMember, servingsFor } = useHousehold();
  const { favoriteRecipes } = useFavorites();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(MEMBER_EMOJIS[0]);
  const [isKid, setIsKid] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const textAlign = isRTL ? "right" : "left";
  const familyAllergens = new Set(members.flatMap((m) => m.allergies));

  const submit = () => {
    if (!name.trim()) return;
    addMember({ name, emoji, isKid, allergies: [] });
    setName("");
    setIsKid(false);
  };

  const confirmRemove = (member: HouseholdMember) => {
    Alert.alert(t("household.removeConfirmTitle", { name: member.name }), undefined, [
      { text: t("home.cancel"), style: "cancel" },
      { text: t("household.remove"), style: "destructive", onPress: () => removeMember(member.id) },
    ]);
  };

  const toggleAllergy = (member: HouseholdMember, allergen: Allergen) => {
    const allergies = member.allergies.includes(allergen)
      ? member.allergies.filter((a) => a !== allergen)
      : [...member.allergies, allergen];
    updateMember(member.id, { allergies });
  };

  /** Three safe options for the family to vote on: favourites first, topped up from kid-friendly recipes. */
  const startFamilyVote = async () => {
    setVoting(true);
    try {
      const safe = (r: RecipeSummary) => !r.allergens.some((a) => familyAllergens.has(a));
      let pool = shuffled(favoriteRecipes.filter(safe));
      if (pool.length < VOTE_OPTIONS) {
        const catalog = await fetchRecipes({}).catch(() => [] as RecipeSummary[]);
        const extra = shuffled(
          catalog.filter((r) => safe(r) && isKidFriendly(r) && r.dishType !== "Dessert" && !pool.some((p) => p.slug === r.slug))
        );
        pool = [...pool, ...extra];
      }
      const options = pool.slice(0, VOTE_OPTIONS);
      if (options.length === 0) {
        Alert.alert(t("share.error"));
        return;
      }
      const message = [
        t("household.voteQuestion"),
        "",
        ...options.map(
          (r, i) => `${i + 1}️⃣ ${r.title} (${r.prepMinutes + r.cookMinutes} ${t("recipeDetail.min")})`
        ),
        "",
        t("household.voteReply"),
      ].join("\n");
      await shareViaWhatsApp(message);
    } finally {
      setVoting(false);
    }
  };

  const inviteFriend = () => shareViaWhatsApp(t("household.inviteMessage", { url: APP_DOWNLOAD_URL }));

  const portions = servingsFor();

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.subtitle, { textAlign }]}>{t("household.subtitle")}</Text>
        {portions != null ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>
              {t("household.summary", { people: members.length, portions })}
            </Text>
          </View>
        ) : null}

        {members.map((member) => {
          const editing = editingId === member.id;
          return (
            <View key={member.id} style={styles.memberCard}>
              <AnimatedPressable
                style={styles.memberHeader}
                pressScale={0.98}
                onPress={() => setEditingId(editing ? null : member.id)}
                accessibilityRole="button"
              >
                <Text style={styles.memberEmoji}>{member.emoji}</Text>
                <View style={styles.flex1}>
                  <Text style={[styles.memberName, { textAlign }]}>
                    {member.name}
                    {member.isKid ? `  ·  ${t("household.kid")}` : ""}
                  </Text>
                  <Text style={[styles.memberMeta, { textAlign }]}>
                    {member.allergies.length > 0
                      ? t("household.allergicTo", {
                          allergens: member.allergies.map((a) => t(`allergen.${a}` as TranslationKey)).join(", "),
                        })
                      : t("household.noAllergies")}
                  </Text>
                </View>
                <Text style={styles.editHint}>{editing ? "▲" : "✎"}</Text>
              </AnimatedPressable>
              {editing ? (
                <View style={styles.editArea}>
                  <View style={styles.chipRow}>
                    <Chip
                      label={t("household.kidToggle")}
                      selected={member.isKid}
                      onPress={() => updateMember(member.id, { isKid: !member.isKid })}
                    />
                  </View>
                  <Text style={[styles.label, { textAlign }]}>{t("household.allergiesLabel")}</Text>
                  <View style={styles.chipRow}>
                    {ALL_ALLERGENS.map((a) => (
                      <Chip
                        key={a}
                        label={t(`allergen.${a}` as TranslationKey)}
                        selected={member.allergies.includes(a)}
                        onPress={() => toggleAllergy(member, a)}
                      />
                    ))}
                  </View>
                  <AnimatedPressable style={styles.removeButton} pressScale={0.95} onPress={() => confirmRemove(member)}>
                    <Text style={styles.removeText}>{t("household.remove")}</Text>
                  </AnimatedPressable>
                </View>
              ) : null}
            </View>
          );
        })}

        <Text style={[styles.sectionTitle, { textAlign }]}>{t("household.addTitle")}</Text>
        <View style={styles.chipRow}>
          {MEMBER_EMOJIS.map((e) => (
            <Chip key={e} label={e} selected={emoji === e} onPress={() => setEmoji(e)} />
          ))}
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { textAlign }]}
            placeholder={t("household.namePlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            onSubmitEditing={submit}
            returnKeyType="done"
          />
          <Chip label={t("household.kidToggle")} selected={isKid} onPress={() => setIsKid((v) => !v)} />
        </View>
        <View style={styles.buttonGap}>
          <PrimaryButton label={t("household.add")} onPress={submit} disabled={!name.trim()} />
        </View>

        <Text style={[styles.sectionTitle, { textAlign }]}>{t("household.toolsTitle")}</Text>
        <View style={styles.buttonGap}>
          <PrimaryButton label={t("lunchbox.title")} variant="outline" onPress={() => navigation.navigate("Lunchbox")} />
        </View>
        <View style={styles.buttonGap}>
          <PrimaryButton label={t("party.title")} variant="outline" onPress={() => navigation.navigate("PartyPlanner")} />
        </View>
        <View style={styles.buttonGap}>
          <PrimaryButton label={t("household.vote")} variant="outline" onPress={startFamilyVote} loading={voting} />
        </View>
        <View style={styles.buttonGap}>
          <PrimaryButton label={t("household.invite")} variant="outline" onPress={inviteFriend} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    subtitle: { color: colors.textMuted, lineHeight: 20, marginBottom: spacing(2) },
    summaryCard: {
      backgroundColor: colors.chipBackground,
      borderRadius: radius.md,
      padding: spacing(1.5),
      marginBottom: spacing(2),
    },
    summaryText: { fontSize: 14, fontWeight: "800", color: colors.primaryDark, textAlign: "center" },
    memberCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing(1.25),
      overflow: "hidden",
    },
    memberHeader: { flexDirection: "row", alignItems: "center", padding: spacing(1.5) },
    memberEmoji: { fontSize: 28, marginEnd: spacing(1.5) },
    flex1: { flex: 1 },
    memberName: { fontSize: 15, fontWeight: "800", color: colors.text },
    memberMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    editHint: { fontSize: 14, color: colors.textMuted, marginStart: spacing(1) },
    editArea: { paddingHorizontal: spacing(1.5), paddingBottom: spacing(1.5) },
    label: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: spacing(1.5), marginBottom: spacing(0.5) },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1) },
    removeButton: { alignSelf: "flex-start", marginTop: spacing(1.5) },
    removeText: { color: colors.danger, fontWeight: "700" },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: spacing(3), marginBottom: spacing(1) },
    inputRow: { flexDirection: "row", alignItems: "center", gap: spacing(1), marginTop: spacing(1.5) },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1.25),
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    buttonGap: { marginTop: spacing(1.5) },
  });
