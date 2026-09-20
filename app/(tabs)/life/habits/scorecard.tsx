import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../../src/ui/NavHeader';
import { useTheme } from '../../../../src/theme/ThemeProvider';
import { Card } from '../../../../src/ui/Card';
import { ListRow } from '../../../../src/ui/ListRow';
import { EmptyState } from '../../../../src/ui/EmptyState';
import { FAB } from '../../../../src/ui/FAB';
import { SwipeableRow } from '../../../../src/ui/SwipeableRow';
import { useHabitsStore } from '../../../../src/store/habitsStore';
import { AddScorecardSheet } from '../../../../src/features/habits/AddScorecardSheet';

const RATING_COLOR: Record<string, (c: ReturnType<typeof useTheme>['colors']) => string> = {
  '+': (c) => c.green,
  '-': (c) => c.red,
  '=': (c) => c.gray,
};

export default function ScorecardScreen() {
  const { colors, typography, spacing } = useTheme();
  const { scorecardEntries, removeScorecardEntry } = useHabitsStore();
  const [addVisible, setAddVisible] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Habits Scorecard" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Text style={[typography.subhead, { color: colors.secondaryLabel, marginBottom: spacing.md }]}>
          A simple awareness exercise from Atomic Habits — list everyday behaviors and mark whether they help or hurt.
        </Text>
        {scorecardEntries.length === 0 ? (
          <Card>
            <EmptyState icon="doc.text.fill" title="No entries yet" message="Notice a behavior and rate it." />
          </Card>
        ) : (
          <Card padded={false}>
            {scorecardEntries.map((entry, i, arr) => (
              <SwipeableRow key={entry.id} actions={[{ label: 'Delete', color: colors.red, onPress: () => removeScorecardEntry(entry.id) }]}>
                <ListRow
                  isLast={i === arr.length - 1}
                  title={entry.activity}
                  subtitle={entry.note || undefined}
                  trailing={
                    <Text style={{ fontSize: 18, color: RATING_COLOR[entry.rating](colors), fontWeight: '700' }}>
                      {entry.rating}
                    </Text>
                  }
                />
              </SwipeableRow>
            ))}
          </Card>
        )}
      </ScrollView>
      <FAB onPress={() => setAddVisible(true)} />
      <AddScorecardSheet visible={addVisible} onClose={() => setAddVisible(false)} />
    </View>
  );
}
