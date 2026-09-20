import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { ProgressBar } from '../../ui/ProgressBar';
import { useHabitsStore } from '../../store/habitsStore';
import { computeXP, freezeTokenBalance, levelForXP } from '../../domain/habits/gamification';

export function LevelHeader() {
  const { colors, typography, spacing } = useTheme();
  const checkins = useHabitsStore((s) => s.checkins);

  const xp = computeXP(checkins);
  const level = levelForXP(xp);
  const freezeTokens = freezeTokenBalance(checkins);

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Level {level.level}</Text>
          <Text style={[typography.headline, { color: colors.label }]}>{level.title}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>❄️ Freeze tokens</Text>
          <Text style={[typography.headline, { color: colors.teal }]}>{freezeTokens}</Text>
        </View>
      </View>
      <View style={{ marginTop: spacing.sm }}>
        <ProgressBar progress={level.progress} color={colors.indigo} />
        <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: 4 }]}>
          {level.xpIntoLevel} / {level.xpForNextLevel} XP to level {level.level + 1}
        </Text>
      </View>
    </Card>
  );
}
