import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { getDb } from '../../db/client';
import { formatDateShort } from '../../utils/date';

const COUNTS: { label: string; sql: string }[] = [
  { label: 'Transactions', sql: 'SELECT COUNT(*) AS n FROM transactions' },
  { label: 'Tasks', sql: 'SELECT COUNT(*) AS n FROM tasks' },
  { label: 'Prayers logged', sql: 'SELECT COUNT(*) AS n FROM prayer_logs WHERE completed = 1' },
  { label: 'Journal entries', sql: 'SELECT COUNT(*) AS n FROM journal_entries' },
  { label: 'Quran pages read', sql: 'SELECT COALESCE(SUM(pages), 0) AS n FROM quran_logs' },
  { label: 'Habit check-ins', sql: 'SELECT COUNT(*) AS n FROM habit_logs WHERE completed = 1' },
  { label: 'Notes', sql: 'SELECT COUNT(*) AS n FROM notes' },
];

// A quick look at how much is stored in Anchor.
export function DataStatsCard() {
  const { colors, typography, spacing } = useTheme();
  const [rows, setRows] = useState<{ label: string; n: number }[]>([]);
  const [since, setSince] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const counts = await Promise.all(COUNTS.map(async (c) => ({ label: c.label, n: (await db.getFirstAsync<{ n: number }>(c.sql))?.n ?? 0 })));
      setRows(counts);
      const first = await db.getFirstAsync<{ d: string | null }>(
        'SELECT MIN(d) AS d FROM (SELECT MIN(created_at) AS d FROM transactions UNION ALL SELECT MIN(created_at) FROM tasks UNION ALL SELECT MIN(created_at) FROM accounts)'
      );
      setSince(first?.d ?? null);
    })();
  }, []);

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.xs }]}>Your data</Text>
      {since ? (
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs }]}>
          Using Anchor since {formatDateShort(since)}
        </Text>
      ) : null}
      {rows.map((r) => (
        <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
          <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>{r.label}</Text>
          <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]}>{r.n.toLocaleString()}</Text>
        </View>
      ))}
    </Card>
  );
}
