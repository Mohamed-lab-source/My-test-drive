import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { useSettingsStore } from '../../store/settingsStore';
import * as repo from '../../db/repositories/life';
import { todayKey } from '../../db/client';
import { PRAYERS, type Prayer } from '../../db/types';

const LABELS: Record<Prayer, string> = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

// When yesterday has some prayers logged but not all, ask what happened to
// the rest: prayed but not logged, or owed as qada. (A day with nothing
// logged is probably just a day the app wasn't opened, so it's left alone.)
export function MissedPrayersCard({ onChanged }: { onChanged?: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const { missedPromptDate, setMissedPromptDate } = useSettingsStore();
  const [missing, setMissing] = useState<Prayer[]>([]);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = todayKey(y);

  useEffect(() => {
    if (missedPromptDate === yesterday) return;
    repo.listPrayerLogsForDate(yesterday).then((logs) => {
      const done = new Set(logs.filter((l) => l.completed).map((l) => l.prayer));
      if (done.size === 0 || done.size === PRAYERS.length) return setMissing([]);
      setMissing(PRAYERS.filter((p) => !done.has(p)));
    });
  }, [missedPromptDate, yesterday]);

  if (missedPromptDate === yesterday || missing.length === 0) return null;

  const finish = () => {
    setMissedPromptDate(yesterday);
    onChanged?.();
  };

  return (
    <Card style={{ marginBottom: spacing.md, borderWidth: 1, borderColor: colors.orange + '55' }}>
      <Text style={[typography.headline, { color: colors.label }]}>Yesterday: {missing.map((p) => LABELS[p]).join(', ')} not logged</Text>
      <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2, marginBottom: spacing.sm }]}>
        Did you pray {missing.length === 1 ? 'it' : 'them'} and forget to log, or should {missing.length === 1 ? 'it' : 'they'} go on your qada list?
      </Text>
      <View style={{ flexDirection: 'row' }}>
        <Button
          title="I prayed"
          variant="secondary"
          onPress={async () => {
            for (const p of missing) await repo.setPrayerLog(yesterday, p, true);
            finish();
          }}
          style={{ flex: 1, marginRight: spacing.sm }}
        />
        <Button
          title="Add to qada"
          onPress={async () => {
            for (const p of missing) await repo.adjustQada(p, 1);
            finish();
          }}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}
