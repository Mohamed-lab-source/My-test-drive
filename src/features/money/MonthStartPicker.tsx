import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useSettingsStore } from '../../store/settingsStore';
import { useFinanceStore } from '../../store/financeStore';
import { useUndoStore } from '../../store/undoStore';
import { ChipSelector } from '../../ui/ChipSelector';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { getMonthConfig, monthPeriod, periodLabel } from '../../utils/period';
import { formatDateShort } from '../../utils/date';
import { todayKey } from '../../db/client';

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

// When money months start: the day your salary arrives (found in your
// income) or a fixed day. Budgets, the plan, limits and "this month" totals
// all follow it.
export function MonthStartPicker() {
  const { colors, typography, spacing } = useTheme();
  const { monthStartDay: day, setMonthStartDay: setDay, monthFromPayday, setMonthFromPayday, addManualPayday, smsReadCredits, setSmsReadCredits, smsImportEnabled } =
    useSettingsStore(
      useShallow((s) => ({
        monthStartDay: s.monthStartDay,
        setMonthStartDay: s.setMonthStartDay,
        monthFromPayday: s.monthFromPayday,
        setMonthFromPayday: s.setMonthFromPayday,
        addManualPayday: s.addManualPayday,
        smsReadCredits: s.smsReadCredits,
        setSmsReadCredits: s.setSmsReadCredits,
        smsImportEnabled: s.smsImportEnabled,
      }))
    );
  // Re-read the detected paydays whenever transactions change.
  useFinanceStore((s) => s.transactions);
  const show = useUndoStore((s) => s.show);
  const paydays = getMonthConfig().paydays;
  const last = paydays.length ? new Date(paydays[paydays.length - 1]) : null;
  const now = new Date();
  const period = monthPeriod(now);
  const expectedNext = last ? new Date(last.getFullYear(), last.getMonth() + 1, last.getDate()) : null;
  const late = !!expectedNext && now.getTime() > expectedNext.getTime() + 86400000;

  return (
    <View>
      <Text style={[typography.subhead, { color: colors.secondaryLabel, marginBottom: spacing.xs }]}>My month starts</Text>
      <SegmentedControl
        options={['When salary arrives', 'Fixed day']}
        selectedIndex={monthFromPayday ? 0 : 1}
        onChange={(i) => setMonthFromPayday(i === 0)}
      />
      <View style={{ height: spacing.sm }} />

      {monthFromPayday ? (
        <>
          {last ? (
            <Text style={[typography.footnote, { color: colors.label }]}>
              💰 Last payday {formatDateShort(last.toISOString())} — this month is {periodLabel(period)}.
              {late ? ' Your salary looks late, so this month stays open until it arrives.' : ''}
            </Text>
          ) : (
            <Text style={[typography.footnote, { color: colors.label }]}>
              No salary found yet. Log it as income in your Salary category (or with “salary” in the note) and the new month starts that day. Until then, months start on the {ordinal(day)}.
            </Text>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm }}>
            <Pressable
              onPress={() => {
                addManualPayday(todayKey());
                show('New month started today');
              }}
              accessibilityRole="button"
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: colors.green, marginRight: 8, marginBottom: 6 }}
            >
              <Text style={[typography.subhead, { color: '#FFFFFF', fontWeight: '600' }]}>My salary arrived today</Text>
            </Pressable>
            {smsImportEnabled && !smsReadCredits ? (
              <Pressable
                onPress={() => setSmsReadCredits(true)}
                accessibilityRole="button"
                style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: colors.tertiaryFill, marginBottom: 6 }}
              >
                <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Read salary from bank SMS</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: 2 }]}>
            Budgets, your plan, limits and monthly totals restart the day your salary lands.
          </Text>
        </>
      ) : (
        <>
          <ChipSelector
            options={Array.from({ length: 28 }, (_, i) => ({ id: String(i + 1), label: ordinal(i + 1) }))}
            selectedId={String(day)}
            onSelect={(id) => setDay(Number(id))}
          />
          <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: spacing.xs }]}>
            {day === 1
              ? 'Calendar months. Pick your payday to run budgets and limits from one salary to the next.'
              : `This month is ${periodLabel(monthPeriod(now, 0, day))}. Budgets, your plan, limits and monthly totals all follow it.`}
          </Text>
        </>
      )}
    </View>
  );
}
