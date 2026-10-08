import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import * as repo from '../../db/repositories/lists';
import type { WeeklyGoal } from '../../db/types';

const MAX_GOALS = 3;

// Up to three bigger outcomes for the week, above the daily task list.
export function WeeklyGoalsCard() {
  const { colors, typography, spacing } = useTheme();
  const week = repo.weekKey();
  const [goals, setGoals] = useState<WeeklyGoal[]>([]);
  const [draft, setDraft] = useState('');

  const load = useCallback(() => repo.listWeeklyGoals(week).then(setGoals), [week]);
  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!draft.trim()) return;
    await repo.createWeeklyGoal(week, draft.trim());
    setDraft('');
    await load();
  };

  const done = goals.filter((g) => g.done).length;

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={[typography.headline, { color: colors.label }]}>
        This week's goals {goals.length ? <Text style={{ color: colors.secondaryLabel, fontWeight: '400' }}>{done}/{goals.length}</Text> : null}
      </Text>
      {goals.map((g) => (
        <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
          <Pressable
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              await repo.setWeeklyGoalDone(g.id, !g.done);
              await load();
            }}
            hitSlop={8}
          >
            <Icon name={g.done ? 'checkmark.circle.fill' : 'circle'} size={22} color={g.done ? colors.green : colors.gray3} />
          </Pressable>
          <Text
            style={[
              typography.body,
              { flex: 1, marginLeft: spacing.sm, color: g.done ? colors.secondaryLabel : colors.label, textDecorationLine: g.done ? 'line-through' : 'none' },
            ]}
          >
            {g.title}
          </Text>
          <Pressable
            onPress={async () => {
              await repo.deleteWeeklyGoal(g.id);
              await load();
            }}
            hitSlop={8}
          >
            <Icon name="xmark" size={14} color={colors.tertiaryLabel} />
          </Pressable>
        </View>
      ))}
      {goals.length < MAX_GOALS ? (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          returnKeyType="done"
          placeholder={goals.length ? 'Add another goal' : 'What would make this week a win?'}
          placeholderTextColor={colors.placeholderText}
          style={[typography.body, { color: colors.label, paddingVertical: 6 }]}
        />
      ) : null}
    </Card>
  );
}
