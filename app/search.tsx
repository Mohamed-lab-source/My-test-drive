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

const TYPE_META: Record<SearchResultType, { icon: string; color: string; route: string }> = {
  transaction: { icon: 'banknote.fill', color: '#34C759', route: '/money/transactions' },
  task: { icon: 'checkmark.circle.fill', color: '#007AFF', route: '/tasks' },
  meeting: { icon: 'calendar', color: '#5856D6', route: '/tasks/meetings' },
  wishlist: { icon: 'lightbulb.fill', color: '#FF9500', route: '/life/wishlist' },
};

export default function SearchScreen() {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

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
            placeholder="Search transactions, tasks, meetings, ideas"
            value={query}
            onChangeText={setQuery}
            autoFocus
            style={{ marginBottom: 0 }}
          />
        </View>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginLeft: spacing.md }}>
          <Text style={[typography.body, { color: colors.blue }]}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {query.trim().length === 0 ? null : results.length === 0 ? (
          <EmptyState icon="magnifyingglass" title="No results" message="Try a different search term." />
        ) : (
          <Card padded={false}>
            {results.map((r, i) => {
              const meta = TYPE_META[r.type];
              return (
                <Pressable
                  key={`${r.type}-${r.id}`}
                  onPress={() => router.push(meta.route as any)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.md,
                    borderBottomWidth: i === results.length - 1 ? 0 : 0.5,
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
            })}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
