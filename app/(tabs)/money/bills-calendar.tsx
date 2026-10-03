import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { Card } from '../../../src/ui/Card';
import { Icon } from '../../../src/ui/Icon';
import { formatMoney } from '../../../src/utils/money';
import { convertToBase } from '../../../src/db/repositories/fx';
import { advanceDueDate } from '../../../src/db/repositories/finance';
import type { RecurringRule } from '../../../src/db/types';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Occurrence {
  rule: RecurringRule;
  day: number;
}

// Every due date of every active item that lands in the given month,
// projected forward from its next due date.
function occurrencesInMonth(rules: RecurringRule[], year: number, month: number): Occurrence[] {
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 1).getTime();
  const out: Occurrence[] = [];
  for (const rule of rules) {
    if (!rule.is_active || rule.is_paused) continue;
    let due = rule.next_due_date;
    for (let i = 0; i < 400 && new Date(due).getTime() < end; i++) {
      const t = new Date(due).getTime();
      if (t >= start) out.push({ rule, day: new Date(due).getDate() });
      due = advanceDueDate(due, rule.frequency, rule.interval_count || 1);
    }
  }
  return out;
}

export default function BillsCalendarScreen() {
  const { colors, typography, spacing } = useTheme();
  const currency = useSettingsStore((s) => s.currency);
  const { recurringRules, fxRates } = useFinanceStore();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const occurrences = useMemo(
    () => occurrencesInMonth(recurringRules, cursor.year, cursor.month),
    [recurringRules, cursor]
  );
  const byDay = useMemo(() => {
    const m = new Map<number, Occurrence[]>();
    for (const o of occurrences) m.set(o.day, [...(m.get(o.day) ?? []), o]);
    return m;
  }, [occurrences]);

  const toBase = (r: RecurringRule) => convertToBase(r.amount, r.currency, currency, fxRates);
  const totalOut = occurrences.filter((o) => o.rule.type === 'expense').reduce((s, o) => s + toBase(o.rule), 0);
  const totalIn = occurrences.filter((o) => o.rule.type === 'income').reduce((s, o) => s + toBase(o.rule), 0);

  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const blanks = new Date(cursor.year, cursor.month, 1).getDay();
  const cells: (number | null)[] = [...Array(blanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const isCurrentMonth = cursor.year === now.getFullYear() && cursor.month === now.getMonth();

  const shift = (dir: number) => {
    setSelectedDay(null);
    setCursor((c) => {
      const d = new Date(c.year, c.month + dir, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const listed = (selectedDay ? occurrences.filter((o) => o.day === selectedDay) : occurrences).sort((a, b) => a.day - b.day);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Bill calendar" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <Pressable onPress={() => shift(-1)} hitSlop={10}>
              <Icon name="chevron.left" size={22} color={colors.blue} />
            </Pressable>
            <Text style={[typography.headline, { color: colors.label, flex: 1, textAlign: 'center' }]}>
              {new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </Text>
            <Pressable onPress={() => shift(1)} hitSlop={10}>
              <Icon name="chevron.right" size={22} color={colors.blue} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={[typography.caption2, { flex: 1, textAlign: 'center', color: colors.secondaryLabel }]}>
                {w}
              </Text>
            ))}
          </View>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <View key={row} style={{ flexDirection: 'row' }}>
              {cells.slice(row * 7, row * 7 + 7).map((day, i) => {
                if (!day) return <View key={i} style={{ flex: 1, height: 44 }} />;
                const items = byDay.get(day) ?? [];
                const isToday = isCurrentMonth && day === now.getDate();
                const selected = day === selectedDay;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setSelectedDay(selected ? null : day)}
                    style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selected ? colors.blue : isToday ? colors.tertiaryFill : 'transparent',
                      }}
                    >
                      <Text style={[typography.subhead, { color: selected ? '#fff' : colors.label, fontWeight: isToday ? '700' : '400' }]}>
                        {day}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', position: 'absolute', bottom: 2 }}>
                      {items.slice(0, 3).map((o, j) => (
                        <View
                          key={j}
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 3,
                            marginHorizontal: 1,
                            backgroundColor: o.rule.type === 'income' ? colors.green : colors.red,
                          }}
                        />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Going out</Text>
              <Text style={[typography.headline, { color: colors.red }]}>{formatMoney(totalOut, currency)}</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Coming in</Text>
              <Text style={[typography.headline, { color: colors.green }]}>{formatMoney(totalIn, currency)}</Text>
            </View>
          </View>
        </Card>

        <Card padded={false}>
          {listed.length === 0 ? (
            <Text style={[typography.body, { color: colors.secondaryLabel, padding: spacing.md }]}>
              {selectedDay ? 'Nothing due that day.' : 'Nothing due this month.'}
            </Text>
          ) : (
            listed.map((o, i) => (
              <View
                key={`${o.rule.id}-${o.day}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: spacing.md,
                  borderBottomWidth: i === listed.length - 1 ? 0 : 0.5,
                  borderBottomColor: colors.separator,
                }}
              >
                <Text style={[typography.subhead, { color: colors.secondaryLabel, width: 36 }]}>{o.day}</Text>
                <Text style={[typography.body, { color: colors.label, flex: 1 }]} numberOfLines={1}>
                  {o.rule.name}
                </Text>
                <Text style={[typography.body, { color: o.rule.type === 'income' ? colors.green : colors.label, fontWeight: '600' }]}>
                  {o.rule.type === 'income' ? '+' : ''}
                  {formatMoney(o.rule.amount, o.rule.currency)}
                </Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
