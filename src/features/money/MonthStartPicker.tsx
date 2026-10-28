import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useSettingsStore } from '../../store/settingsStore';
import { ChipSelector } from '../../ui/ChipSelector';
import { monthPeriod, periodLabel } from '../../utils/period';

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

// The day money months start — budgets, the spending plan, limits and
// "this month" totals all follow it.
export function MonthStartPicker() {
  const { colors, typography, spacing } = useTheme();
  const day = useSettingsStore((s) => s.monthStartDay);
  const setDay = useSettingsStore((s) => s.setMonthStartDay);
  return (
    <View>
      <Text style={[typography.subhead, { color: colors.secondaryLabel, marginBottom: spacing.xs }]}>My month starts on the</Text>
      <ChipSelector
        options={Array.from({ length: 28 }, (_, i) => ({ id: String(i + 1), label: ordinal(i + 1) }))}
        selectedId={String(day)}
        onSelect={(id) => setDay(Number(id))}
      />
      <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: spacing.xs }]}>
        {day === 1
          ? 'Calendar months. Pick your payday to run budgets and limits from one salary to the next.'
          : `This month is ${periodLabel(monthPeriod(new Date(), 0, day))}. Budgets, your plan, limits and monthly totals all follow it.`}
      </Text>
    </View>
  );
}
