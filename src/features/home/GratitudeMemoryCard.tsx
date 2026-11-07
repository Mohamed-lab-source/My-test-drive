import React, { useEffect, useState } from 'react';
import { Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { listGratitudeEntries } from '../../db/repositories/journal';
import { formatDateKey } from '../../utils/date';
import { todayKey } from '../../db/client';

// Brings back one thing you were grateful for (a different one each day),
// from at least a week ago.
export function GratitudeMemoryCard() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const [memory, setMemory] = useState<{ line: string; date: string } | null>(null);

  useEffect(() => {
    const weekAgo = todayKey(new Date(Date.now() - 7 * 86400000));
    listGratitudeEntries(400).then((entries) => {
      const lines = entries
        .filter((e) => e.date <= weekAgo)
        .flatMap((e) => (e.gratitude ?? '').split('\n').filter((l) => l.trim()).map((line) => ({ line: line.trim(), date: e.date })));
      if (!lines.length) return setMemory(null);
      const day = Math.floor(Date.now() / 86400000);
      setMemory(lines[day % lines.length]);
    });
  }, []);

  if (!memory) return null;
  return (
    <Pressable onPress={() => router.push('/life/journal')} style={{ marginBottom: spacing.md }}>
      <Card>
        <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>🤲 You were grateful for · {formatDateKey(memory.date)}</Text>
        <Text style={[typography.body, { color: colors.label, marginTop: 4 }]}>{memory.line}</Text>
      </Card>
    </Pressable>
  );
}
