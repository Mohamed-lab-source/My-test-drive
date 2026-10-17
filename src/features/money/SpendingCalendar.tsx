import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { formatMoney } from '../../utils/money';
import type { Spend } from '../../utils/moneyInsights';

// "1.2k"-style amounts that fit in a calendar cell.
function compact(minor: number): string {
  const v = minor / 100;
  if (v >= 100000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(v));
}

// A month grid of what you spent each day; darker = more. Tap a day for its total.
export function SpendingCalendar({ spends, currency, weekStart }: { spends: Spend[]; currency: string; weekStart: number }) {
  const { colors, typography, spacing } = useTheme();
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const month = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const byDay = new Map<string, number>();
  for (const s of spends) if (s.month === month) byDay.set(s.key, (byDay.get(s.key) ?? 0) + s.amount);
  const max = Math.max(1, ...byDay.values());
  const lead = (first.getDay() - weekStart + 7) % 7;
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const total = [...byDay.values()].reduce((a, b) => a + b, 0);
  const names = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => setOffset(offset + 1)} hitSlop={10}>
          <Text style={[typography.title3, { color: colors.blue }]}>‹</Text>
        </Pressable>
        <Text style={[typography.headline, { color: colors.label }]}>
          🗓 {first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} · {formatMoney(total, currency)}
        </Text>
        <Pressable onPress={() => setOffset(Math.max(0, offset - 1))} hitSlop={10} disabled={offset === 0}>
          <Text style={[typography.title3, { color: offset === 0 ? colors.tertiaryLabel : colors.blue }]}>›</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
        {Array.from({ length: 7 }, (_, i) => (
          <Text key={i} style={[typography.caption2, { flex: 1, textAlign: 'center', color: colors.tertiaryLabel }]}>
            {names[(weekStart + i) % 7]}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((key, i) => {
          const v = key ? byDay.get(key) ?? 0 : 0;
          return (
            <Pressable key={i} disabled={!key} onPress={() => setPicked(key)} style={{ width: `${100 / 7}%`, padding: 2 }}>
              {key ? (
                <View
                  style={{
                    borderRadius: 6,
                    paddingVertical: 4,
                    alignItems: 'center',
                    backgroundColor: v ? colors.red + Math.round(0x22 + (v / max) * 0xaa).toString(16).padStart(2, '0') : colors.tertiaryFill,
                    borderWidth: picked === key ? 1.5 : 0,
                    borderColor: colors.label,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.label }}>{Number(key.slice(8))}</Text>
                  <Text style={{ fontSize: 9, color: colors.secondaryLabel }}>{v ? compact(v) : '·'}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {picked ? (
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 4 }]}>
          {new Date(Number(picked.slice(0, 4)), Number(picked.slice(5, 7)) - 1, Number(picked.slice(8))).toDateString()}:{' '}
          {formatMoney(byDay.get(picked) ?? 0, currency)}
        </Text>
      ) : null}
    </Card>
  );
}
