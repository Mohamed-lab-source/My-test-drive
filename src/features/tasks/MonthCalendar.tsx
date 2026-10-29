import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { useProductivityStore } from '../../store/productivityStore';
import { useSettingsStore } from '../../store/settingsStore';
import { todayKey } from '../../db/client';
import { formatTime, localDateKey } from '../../utils/date';

// A month grid: dots for tasks (blue), deadlines (red) and meetings
// (purple); tap a day to see what's on it.
export function MonthCalendar() {
  const { colors, typography, spacing } = useTheme();
  const { tasks, meetings } = useProductivityStore(useShallow((s) => ({ tasks: s.tasks, meetings: s.meetings })));
  const weekStart = useSettingsStore((s) => s.weekStart);
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState(todayKey());
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() - weekStart + 7) % 7;
  const keys: (string | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => todayKey(new Date(first.getFullYear(), first.getMonth(), i + 1))),
  ];
  const open = tasks.filter((t) => t.status !== 'done');
  const on = (key: string) => ({
    tasks: open.filter((t) => t.scheduled_date === key),
    due: open.filter((t) => t.due_date === key),
    meetings: meetings.filter((m) => localDateKey(m.start_at) === key),
  });
  const sel = on(picked);
  const names = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const today = todayKey();

  return (
    <>
      <Card style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => setOffset(offset - 1)} hitSlop={10}>
            <Text style={[typography.title3, { color: colors.blue }]}>‹</Text>
          </Pressable>
          <Text style={[typography.headline, { color: colors.label }]}>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
          <Pressable onPress={() => setOffset(offset + 1)} hitSlop={10}>
            <Text style={[typography.title3, { color: colors.blue }]}>›</Text>
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
          {keys.map((key, i) => {
            if (!key) return <View key={i} style={{ width: `${100 / 7}%`, height: 44 }} />;
            const d = on(key);
            const isPicked = key === picked;
            return (
              <Pressable key={key} onPress={() => setPicked(key)} style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', paddingTop: 4 }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isPicked ? colors.blue : 'transparent',
                    borderWidth: key === today && !isPicked ? 1 : 0,
                    borderColor: colors.blue,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isPicked ? '#fff' : colors.label }}>{Number(key.slice(8))}</Text>
                </View>
                <View style={{ flexDirection: 'row', marginTop: 2 }}>
                  {d.tasks.length ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.blue, marginHorizontal: 1 }} /> : null}
                  {d.due.length ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.red, marginHorizontal: 1 }} /> : null}
                  {d.meetings.length ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.purple, marginHorizontal: 1 }} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>
      <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>
        {new Date(Number(picked.slice(0, 4)), Number(picked.slice(5, 7)) - 1, Number(picked.slice(8))).toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
      </Text>
      <Card>
        {sel.meetings.length + sel.tasks.length + sel.due.length === 0 ? (
          <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>Nothing planned.</Text>
        ) : null}
        {sel.meetings.map((m) => (
          <Text key={m.id} style={[typography.body, { color: colors.label, paddingVertical: 4 }]}>
            🟣 {formatTime(m.start_at)} {m.title}
          </Text>
        ))}
        {sel.due.map((t) => (
          <Text key={`due-${t.id}`} style={[typography.body, { color: colors.red, paddingVertical: 4 }]}>
            📅 Due: {t.title}
          </Text>
        ))}
        {sel.tasks.map((t) => (
          <Text key={t.id} style={[typography.body, { color: colors.label, paddingVertical: 4 }]}>
            ☐ {t.title}
          </Text>
        ))}
      </Card>
    </>
  );
}
