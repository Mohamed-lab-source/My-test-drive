import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { TextField } from '../src/ui/TextField';
import { Card } from '../src/ui/Card';
import { IconCircle } from '../src/ui/IconCircle';
import { Icon } from '../src/ui/Icon';
import { EmptyState } from '../src/ui/EmptyState';
import { searchAll, type SearchResult, type SearchResultType } from '../src/db/search';
import { useSettingsStore } from '../src/store/settingsStore';
import { ChipSelector } from '../src/ui/ChipSelector';

const TYPE_LABEL: Record<SearchResultType, string> = {
  transaction: 'Money',
  task: 'Tasks',
  meeting: 'Meetings',
  wishlist: 'Wishlist',
  note: 'Notes',
  book: 'Books',
  shopping: 'Shopping',
  countdown: 'Countdowns',
  journal: 'Journal',
};

const TYPE_META: Record<SearchResultType, { icon: string; color: string; route: string }> = {
  transaction: { icon: 'banknote.fill', color: '#34C759', route: '/money/transactions' },
  task: { icon: 'checkmark.circle.fill', color: '#007AFF', route: '/tasks' },
  meeting: { icon: 'calendar', color: '#5856D6', route: '/tasks/meetings' },
  wishlist: { icon: 'lightbulb.fill', color: '#FF9500', route: '/life/wishlist' },
  note: { icon: 'doc.text.fill', color: '#8E8E93', route: '/life/notes' },
  book: { icon: 'bookmark.fill', color: '#FF9500', route: '/life/books' },
  shopping: { icon: 'cart.fill', color: '#34C759', route: '/money/shopping' },
  countdown: { icon: 'hourglass', color: '#5856D6', route: '/life/countdowns' },
  journal: { icon: 'text.book.closed.fill', color: '#5856D6', route: '/life/journal' },
};

export default function SearchScreen() {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [typeFilter, setTypeFilter] = useState<SearchResultType | 'all'>('all');
  const { recentSearches, addRecentSearch, clearRecentSearches } = useSettingsStore();

  useEffect(() => {
    const handle = setTimeout(() => {
      searchAll(query).then(setResults);
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <TextField
            placeholder="Search money (or an amount), tasks, notes, journal…"
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => addRecentSearch(query)}
            style={{ marginBottom: 0 }}
          />
        </View>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginLeft: spacing.md }}>
          <Text style={[typography.body, { color: colors.blue }]}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {query.trim().length === 0 ? (
          recentSearches.length > 0 ? (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'uppercase' }]}>Recent</Text>
                <Pressable onPress={clearRecentSearches} hitSlop={8}>
                  <Text style={[typography.footnote, { color: colors.blue }]}>Clear</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {recentSearches.map((q) => (
                  <Pressable
                    key={q}
                    onPress={() => setQuery(q)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.secondarySystemGroupedBackground,
                      borderRadius: 16,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 6,
                      marginRight: spacing.sm,
                      marginBottom: spacing.sm,
                    }}
                  >
                    <Icon name="clock.fill" size={12} color={colors.secondaryLabel} />
                    <Text style={[typography.subhead, { color: colors.label, marginLeft: 6 }]}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null
        ) : results.length === 0 ? (
          <EmptyState icon="magnifyingglass" title="No results" message="Try a different search term." />
        ) : (
          <>
          {new Set(results.map((r) => r.type)).size > 1 ? (
            <View style={{ marginBottom: spacing.sm }}>
              <ChipSelector
                options={[
                  { id: 'all', label: `All ${results.length}` },
                  ...Array.from(new Set(results.map((r) => r.type))).map((t) => ({
                    id: t,
                    label: `${TYPE_LABEL[t]} ${results.filter((r) => r.type === t).length}`,
                  })),
                ]}
                selectedId={results.some((r) => r.type === typeFilter) ? typeFilter : 'all'}
                onSelect={(id) => setTypeFilter(id as SearchResultType | 'all')}
              />
            </View>
          ) : null}
          <Card padded={false}>
            {(() => {
              const shown = results.some((r) => r.type === typeFilter) ? results.filter((r) => r.type === typeFilter) : results;
              return shown.map((r, i) => {
              const meta = TYPE_META[r.type];
              return (
                <Pressable
                  key={`${r.type}-${r.id}`}
                  onPress={() => {
                    addRecentSearch(query);
                    router.push(meta.route as any);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.md,
                    borderBottomWidth: i === shown.length - 1 ? 0 : 0.5,
                    borderBottomColor: colors.separator,
                  }}
                >
                  <IconCircle name={meta.icon} color={meta.color} size={32} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={[typography.body, { color: colors.label }]} numberOfLines={1}>
                      {r.title}
                    </Text>
                    {r.subtitle ? (
                      <Text style={[typography.caption1, { color: colors.secondaryLabel }]} numberOfLines={1}>
                        {r.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <Icon name="chevron.right" size={16} color={colors.tertiaryLabel} />
                </Pressable>
              );
              });
            })()}
          </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
