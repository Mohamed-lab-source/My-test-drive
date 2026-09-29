import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { Icon } from '../../../src/ui/Icon';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { HIJRI_MONTHS, getHijriMonthDays, islamicDay, upcomingIslamicDays } from '../../../src/utils/hijri';
import { formatDateShort } from '../../../src/utils/date';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function HijriCalendarScreen() {
  const { colors, typography, spacing } = useTheme();
  const hijriOffset = useSettingsStore((s) => s.hijriOffset);
  const [anchor, setAnchor] = useState(() => new Date());

  const days = useMemo(() => getHijriMonthDays(anchor, hijriOffset), [anchor, hijriOffset]);
  const upcoming = useMemo(() => upcomingIslamicDays(new Date(), 400, hijriOffset).slice(0, 6), [hijriOffset]);
  const first = days[0];
  const last = days[days.length - 1];
  const todayStr = new Date().toDateString();

  const shift = (dir: -1 | 1) => {
    const base = dir === 1 ? last.date : first.date;
    setAnchor(new Date(base.getFullYear(), base.getMonth(), base.getDate() + dir * 2));
  };

  const kindColor = (kind: string) => (kind === 'eid' ? colors.green : kind === 'fast' ? colors.purple : colors.orange);
  const blanks = first.date.getDay();
  const cells: (typeof days[number] | null)[] = [...Array(blanks).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const marked = days
    .map((d) => ({ d, info: islamicDay(d.hijri) }))
    .filter((x) => x.info)
    .filter((x, i, arr) => i === 0 || arr[i - 1].info!.label !== x.info!.label);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Hijri calendar" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <Pressable onPress={() => shift(-1)} hitSlop={10}>
              <Icon name="chevron.left" size={22} color={colors.blue} />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[typography.headline, { color: colors.label }]}>
                {HIJRI_MONTHS[first.hijri.month - 1]} {first.hijri.year}
              </Text>
              <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                {formatDateShort(first.date.toISOString())} – {formatDateShort(last.date.toISOString())}
              </Text>
            </View>
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
              {cells.slice(row * 7, row * 7 + 7).map((cell, i) => {
                if (!cell) return <View key={i} style={{ flex: 1, height: 48 }} />;
                const info = islamicDay(cell.hijri);
                const isToday = cell.date.toDateString() === todayStr;
                return (
                  <View key={i} style={{ flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' }}>
                    <View
                      style={{
                        width: 38,
                        height: 42,
                        borderRadius: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isToday ? colors.blue : info ? kindColor(info.kind) + '26' : 'transparent',
                      }}
                    >
                      <Text style={[typography.subhead, { fontWeight: '600', color: isToday ? '#fff' : colors.label }]}>
                        {cell.hijri.day}
                      </Text>
                      <Text style={{ fontSize: 9, color: isToday ? '#fff' : colors.tertiaryLabel }}>{cell.date.getDate()}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
          {marked.length > 0 ? (
            <View style={{ marginTop: spacing.sm }}>
              {marked.map(({ d, info }) => (
                <View key={d.date.toISOString()} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: kindColor(info!.kind), marginRight: 8 }} />
                  <Text style={[typography.footnote, { color: colors.label, flex: 1 }]}>{info!.label}</Text>
                  <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                    {d.hijri.day} {HIJRI_MONTHS[d.hijri.month - 1]}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        <Card>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.xs }]}>Coming up</Text>
          {upcoming.map((u) => {
            const days = Math.round((u.date.getTime() - new Date().setHours(12, 0, 0, 0)) / 86400000);
            return (
              <View key={u.date.toISOString()} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
                <Text style={[typography.body, { color: colors.label }]}>{u.label}</Text>
                <Text style={[typography.body, { color: colors.secondaryLabel }]}>
                  {days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `in ${days} days`}
                </Text>
              </View>
            );
          })}
          <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: spacing.xs }]}>
            Dates follow the Umm al-Qura calendar with your Hijri adjustment from Settings; local moon sighting may differ by a day.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}
