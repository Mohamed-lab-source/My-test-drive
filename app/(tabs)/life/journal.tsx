import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useLifeStore } from '../../../src/store/lifeStore';
import { Card } from '../../../src/ui/Card';
import { TextField } from '../../../src/ui/TextField';
import { Button } from '../../../src/ui/Button';
import { EmptyState } from '../../../src/ui/EmptyState';
import { formatDateKey } from '../../../src/utils/date';
import { todayKey } from '../../../src/db/client';
import type { JournalMood } from '../../../src/db/types';

const MOODS: { id: JournalMood; emoji: string; label: string }[] = [
  { id: 'great', emoji: '😄', label: 'Great' },
  { id: 'good', emoji: '🙂', label: 'Good' },
  { id: 'okay', emoji: '😐', label: 'Okay' },
  { id: 'low', emoji: '😕', label: 'Low' },
  { id: 'rough', emoji: '😣', label: 'Rough' },
];

const MOOD_SCORE: Record<JournalMood, number> = { great: 5, good: 4, okay: 3, low: 2, rough: 1 };
const TREND_DAYS = 30;
const TREND_HEIGHT = 56;

export default function JournalScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { journalEntries, setTodayMood } = useLifeStore();
  const todayEntry = useMemo(() => journalEntries.find((e) => e.date === todayKey()), [journalEntries]);

  const [mood, setMood] = useState<JournalMood | null>(todayEntry?.mood ?? null);
  const [note, setNote] = useState(todayEntry?.note ?? '');
  const [gratitude, setGratitude] = useState<string[]>(() => {
    const lines = (todayEntry?.gratitude ?? '').split('\n');
    return [lines[0] ?? '', lines[1] ?? '', lines[2] ?? ''];
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!mood) return;
    setSaving(true);
    try {
      const lines = gratitude.map((g) => g.trim()).filter(Boolean);
      await setTodayMood(mood, note || null, lines.length ? lines.join('\n') : null);
    } finally {
      setSaving(false);
    }
  };

  const pastEntries = journalEntries.filter((e) => e.date !== todayKey());

  const trend = useMemo(() => {
    const byDate = new Map(journalEntries.map((e) => [e.date, e.mood]));
    const now = new Date();
    return Array.from({ length: TREND_DAYS }, (_, i) => {
      const key = todayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (TREND_DAYS - 1 - i)));
      return { key, mood: byDate.get(key) ?? null };
    });
  }, [journalEntries]);
  const logged = trend.filter((d): d is { key: string; mood: JournalMood } => d.mood !== null);
  const avgScore = logged.length ? logged.reduce((sum, d) => sum + MOOD_SCORE[d.mood], 0) / logged.length : null;
  const avgMood = avgScore === null ? null : MOODS[5 - Math.round(avgScore)];
  const moodColor = (m: JournalMood) =>
    m === 'great' ? colors.green : m === 'good' ? colors.mint : m === 'okay' ? colors.yellow : m === 'low' ? colors.orange : colors.red;

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Journal" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm }]}>How's today going?</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
            {MOODS.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setMood(m.id)}
                style={{
                  alignItems: 'center',
                  padding: spacing.sm,
                  borderRadius: radius.md,
                  backgroundColor: mood === m.id ? colors.fill : 'transparent',
                }}
              >
                <Text style={{ fontSize: 28 }}>{m.emoji}</Text>
                <Text style={[typography.caption2, { color: colors.secondaryLabel, marginTop: 4 }]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextField placeholder="Anything on your mind? (optional)" value={note} onChangeText={setNote} multiline />
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
            Three things I'm grateful for
          </Text>
          {gratitude.map((g, i) => (
            <TextField
              key={i}
              placeholder={`${i + 1}.`}
              value={g}
              onChangeText={(v) => setGratitude((prev) => prev.map((x, j) => (j === i ? v : x)))}
            />
          ))}
          <Button title="Save" onPress={handleSave} disabled={!mood} loading={saving} />
        </Card>

        {logged.length >= 2 ? (
          <Card style={{ marginBottom: spacing.lg }}>
            <Text style={[typography.headline, { color: colors.label }]}>Last 30 days</Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
              {logged.length} check-ins · on average {avgMood?.emoji} {avgMood?.label.toLowerCase()}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: TREND_HEIGHT }}>
              {trend.map((d) => (
                <View key={d.key} style={{ flex: 1, alignItems: 'center' }}>
                  <View
                    style={{
                      width: '70%',
                      borderRadius: 2,
                      height: d.mood ? (MOOD_SCORE[d.mood] / 5) * TREND_HEIGHT : 3,
                      backgroundColor: d.mood ? moodColor(d.mood) : colors.quaternaryFill,
                    }}
                  />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
              <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>{formatDateKey(trend[0].key)}</Text>
              <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>Today</Text>
            </View>
          </Card>
        ) : null}

        <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Past entries</Text>
        {pastEntries.length === 0 ? (
          <EmptyState icon="text.book.closed.fill" title="No past entries" message="Your journal history will show up here." />
        ) : (
          <Card padded={false}>
            {pastEntries.map((entry, i) => {
              const moodInfo = MOODS.find((m) => m.id === entry.mood);
              return (
                <View
                  key={entry.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.md,
                    borderBottomWidth: i === pastEntries.length - 1 ? 0 : 0.5,
                    borderBottomColor: colors.separator,
                  }}
                >
                  <Text style={{ fontSize: 22, marginRight: spacing.sm }}>{moodInfo?.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{formatDateKey(entry.date)}</Text>
                    {entry.note ? <Text style={[typography.body, { color: colors.label }]}>{entry.note}</Text> : null}
                    {entry.gratitude
                      ? entry.gratitude.split('\n').map((line, j) => (
                          <Text key={j} style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
                            🤲 {line}
                          </Text>
                        ))
                      : null}
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
