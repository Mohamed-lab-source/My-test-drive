import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useLifeStore } from '../../../src/store/lifeStore';
import { Card } from '../../../src/ui/Card';
import { TextField } from '../../../src/ui/TextField';
import { Button } from '../../../src/ui/Button';
import { EmptyState } from '../../../src/ui/EmptyState';
import { formatDateShort } from '../../../src/utils/date';
import { todayKey } from '../../../src/db/client';
import type { JournalMood } from '../../../src/db/types';

const MOODS: { id: JournalMood; emoji: string; label: string }[] = [
  { id: 'great', emoji: '😄', label: 'Great' },
  { id: 'good', emoji: '🙂', label: 'Good' },
  { id: 'okay', emoji: '😐', label: 'Okay' },
  { id: 'low', emoji: '😕', label: 'Low' },
  { id: 'rough', emoji: '😣', label: 'Rough' },
];

export default function JournalScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { journalEntries, setTodayMood } = useLifeStore();
  const todayEntry = useMemo(() => journalEntries.find((e) => e.date === todayKey()), [journalEntries]);

  const [mood, setMood] = useState<JournalMood | null>(todayEntry?.mood ?? null);
  const [note, setNote] = useState(todayEntry?.note ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!mood) return;
    setSaving(true);
    try {
      await setTodayMood(mood, note || null);
    } finally {
      setSaving(false);
    }
  };

  const pastEntries = journalEntries.filter((e) => e.date !== todayKey());

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
          <Button title="Save" onPress={handleSave} disabled={!mood} loading={saving} />
        </Card>

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
                    <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{formatDateShort(entry.date)}</Text>
                    {entry.note ? <Text style={[typography.body, { color: colors.label }]}>{entry.note}</Text> : null}
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
