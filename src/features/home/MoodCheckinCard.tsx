import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { useLifeStore } from '../../store/lifeStore';
import { getJournalEntries, setJournalMood } from '../../db/repositories/journal';
import { todayKey } from '../../db/client';
import type { JournalMood } from '../../db/types';

const MOODS: { id: JournalMood; emoji: string; label: string }[] = [
  { id: 'great', emoji: '😄', label: 'Great' },
  { id: 'good', emoji: '🙂', label: 'Good' },
  { id: 'okay', emoji: '😐', label: 'Okay' },
  { id: 'low', emoji: '😔', label: 'Low' },
  { id: 'rough', emoji: '😣', label: 'Rough' },
];

// One-tap mood for today; it lands in the journal, keeping any note already
// written there.
export function MoodCheckinCard() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const refreshJournal = useLifeStore((s) => s.refreshJournal);
  const journalEntries = useLifeStore((s) => s.journalEntries);
  const [mood, setMood] = useState<JournalMood | null>(null);
  const key = todayKey();

  useEffect(() => {
    getJournalEntries([key]).then((rows) => setMood(rows[0]?.mood ?? null));
  }, [key, journalEntries]);

  const pick = async (m: JournalMood) => {
    Haptics.selectionAsync();
    setMood(m);
    await setJournalMood(key, m);
    await refreshJournal();
  };

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[typography.headline, { color: colors.label }]}>How are you feeling?</Text>
        {mood ? (
          <Pressable onPress={() => router.push('/life/journal')} hitSlop={8}>
            <Text style={[typography.subhead, { color: colors.blue }]}>Add a note</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
        {MOODS.map((m) => (
          <Pressable key={m.id} onPress={() => pick(m.id)} style={{ alignItems: 'center', flex: 1, opacity: mood && mood !== m.id ? 0.4 : 1 }}>
            <Text style={{ fontSize: 30 }}>{m.emoji}</Text>
            <Text style={[typography.caption2, { color: mood === m.id ? colors.label : colors.secondaryLabel, fontWeight: mood === m.id ? '700' : '400' }]}>
              {m.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}
