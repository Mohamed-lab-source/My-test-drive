import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable, Share } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { Icon } from '../../../src/ui/Icon';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { DUAS } from '../../../src/content/duas';
import { TextField } from '../../../src/ui/TextField';

export default function DuasScreen() {
  const { colors, typography, spacing } = useTheme();
  const { favoriteDuas, toggleFavoriteDua } = useSettingsStore(useShallow((s) => ({ favoriteDuas: s.favoriteDuas, toggleFavoriteDua: s.toggleFavoriteDua })));
  const themes = ['All', 'Favorites', ...Array.from(new Set(DUAS.map((d) => d.theme)))];
  const [theme, setTheme] = useState('All');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const shown = DUAS.filter(
    (d) =>
      (theme === 'All' ? true : theme === 'Favorites' ? favoriteDuas.includes(d.id) : d.theme === theme) &&
      (!q || d.meaning.toLowerCase().includes(q) || d.ref.toLowerCase().includes(q) || d.arabic.includes(query.trim()) || d.theme.toLowerCase().includes(q))
  ).sort(
    (a, b) => Number(favoriteDuas.includes(b.id)) - Number(favoriteDuas.includes(a.id))
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Duas" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <TextField placeholder="Search duas (e.g. forgiveness, parents)" value={query} onChangeText={setQuery} />
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector options={themes.map((t) => ({ id: t, label: t }))} selectedId={theme} onSelect={setTheme} />
        </View>
        {shown.length === 0 ? (
          <Text style={[typography.body, { color: colors.secondaryLabel }]}>Tap ☆ on a dua to keep it here.</Text>
        ) : (
          shown.map((d) => {
            const fav = favoriteDuas.includes(d.id);
            return (
              <Card key={d.id} style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
                  <Text style={[typography.caption1, { color: colors.green, fontWeight: '700', flex: 1 }]}>{d.ref}</Text>
                  <Pressable onPress={() => Share.share({ message: `${d.arabic}\n\n${d.meaning}\n— ${d.ref}` })} hitSlop={8} style={{ marginRight: spacing.md }}>
                    <Icon name="square.and.arrow.up" size={18} color={colors.secondaryLabel} />
                  </Pressable>
                  <Pressable onPress={() => toggleFavoriteDua(d.id)} hitSlop={8}>
                    <Icon name={fav ? 'star.fill' : 'star'} size={20} color={fav ? colors.yellow : colors.secondaryLabel} />
                  </Pressable>
                </View>
                <Text style={{ fontSize: 22, lineHeight: 38, color: colors.label, textAlign: 'right', writingDirection: 'rtl' }}>{d.arabic}</Text>
                <Text style={[typography.subhead, { color: colors.secondaryLabel, marginTop: spacing.xs }]}>{d.meaning}</Text>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
