import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import * as repo from '../../db/repositories/life';
import { PRAYERS, type Prayer } from '../../db/types';

const LABELS: Record<Prayer, string> = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

// Make-up prayers still owed: + when one is missed, − when it's made up.
export function QadaCard() {
  const { colors, typography, spacing } = useTheme();
  const [counts, setCounts] = useState<Record<Prayer, number> | null>(null);

  const load = useCallback(() => repo.getQadaCounts().then(setCounts), []);
  useEffect(() => {
    load();
  }, [load]);

  const adjust = async (prayer: Prayer, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await repo.adjustQada(prayer, delta);
    await load();
  };

  if (!counts) return null;
  const total = PRAYERS.reduce((sum, p) => sum + counts[p], 0);

  return (
    <Card>
      <Text style={[typography.headline, { color: colors.label }]}>Qada — prayers to make up</Text>
      <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs }]}>
        {total === 0 ? 'Nothing owed. Tap + if you miss one.' : `${total} still to make up`}
      </Text>
      {PRAYERS.map((p) => (
        <View key={p} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
          <Text style={[typography.body, { color: colors.label, flex: 1 }]}>{LABELS[p]}</Text>
          <Pressable onPress={() => adjust(p, -1)} disabled={counts[p] === 0} hitSlop={8}>
            <Icon name="minus.circle" size={26} color={counts[p] === 0 ? colors.gray4 : colors.green} />
          </Pressable>
          <Text style={[typography.headline, { color: colors.label, width: 44, textAlign: 'center' }]}>{counts[p]}</Text>
          <Pressable onPress={() => adjust(p, 1)} hitSlop={8}>
            <Icon name="plus.circle.fill" size={26} color={colors.orange} />
          </Pressable>
        </View>
      ))}
    </Card>
  );
}
