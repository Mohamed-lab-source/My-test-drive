import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { AnimatedPressable } from "../components/AnimatedPressable";
import { RecipeCard } from "../components/RecipeCard";
import { useCollections } from "../context/CollectionsContext";
import { useLocale } from "../i18n/LocaleContext";
import { useTheme } from "../theme/ThemeContext";
import { radius, spacing, type ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "CollectionDetail">;

export function CollectionDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { t, isRTL } = useLocale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { collections, rename, remove, removeRecipe } = useCollections();
  const collection = collections.find((c) => c.id === id);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(collection?.name ?? "");
  const textAlign = isRTL ? "right" : "left";

  useEffect(() => {
    if (collection) navigation.setOptions({ title: collection.name });
  }, [collection?.name, navigation]);

  if (!collection) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>{t("collections.emptyDetail")}</Text>
      </SafeAreaView>
    );
  }

  const saveRename = async () => {
    const name = nameInput.trim();
    if (name && name !== collection.name) await rename(collection.id, name).catch(() => {});
    setRenaming(false);
  };

  const handleShare = async () => {
    const lines = collection.recipes.map((r) => `- ${r.title}`);
    const message = [collection.name, "", ...lines].join("\n");
    try {
      await Share.share({ message });
    } catch {
      // User cancelled or share failed silently; nothing to recover.
    }
  };

  const handleDelete = () => {
    Alert.alert(t("collections.deleteConfirmTitle"), t("collections.deleteConfirmMessage"), [
      { text: t("home.cancel"), style: "cancel" },
      {
        text: t("collections.delete"),
        style: "destructive",
        onPress: () => {
          remove(collection.id).catch(() => {});
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={collection.recipes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            {renaming ? (
              <View style={styles.renameRow}>
                <TextInput
                  style={[styles.renameInput, { textAlign }]}
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  onSubmitEditing={saveRename}
                />
                <AnimatedPressable style={styles.renameSaveButton} pressScale={0.92} onPress={saveRename}>
                  <Text style={styles.renameSaveText}>{t("collections.create")}</Text>
                </AnimatedPressable>
              </View>
            ) : (
              <View style={styles.actionRow}>
                <AnimatedPressable
                  pressScale={0.92}
                  onPress={() => {
                    setNameInput(collection.name);
                    setRenaming(true);
                  }}
                >
                  <Text style={styles.actionLink}>{t("collections.rename")}</Text>
                </AnimatedPressable>
                <AnimatedPressable pressScale={0.92} onPress={handleShare}>
                  <Text style={styles.actionLink}>{t("share.button")}</Text>
                </AnimatedPressable>
                <AnimatedPressable pressScale={0.92} onPress={handleDelete}>
                  <Text style={[styles.actionLink, styles.deleteLink]}>{t("collections.delete")}</Text>
                </AnimatedPressable>
              </View>
            )}
            {collection.recipes.length > 0 ? (
              <Text style={[styles.hint, { textAlign }]}>{t("collections.longPressHint")}</Text>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <RecipeCard
            recipe={item}
            index={index}
            onPress={() => navigation.navigate("RecipeDetail", { slug: item.slug })}
            onLongPress={() => removeRecipe(collection.id, item.slug).catch(() => {})}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t("collections.emptyDetail")}</Text>}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: spacing(3), paddingTop: spacing(2) },
    headerRow: { marginBottom: spacing(2) },
    hint: { fontSize: 12, color: colors.textMuted, marginTop: spacing(1) },
    actionRow: { flexDirection: "row", gap: spacing(3) },
    actionLink: { color: colors.primaryDark, fontWeight: "700", fontSize: 13 },
    deleteLink: { color: colors.danger },
    renameRow: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
    renameInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1),
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: 15,
    },
    renameSaveButton: {
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1),
    },
    renameSaveText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing(6) },
  });
