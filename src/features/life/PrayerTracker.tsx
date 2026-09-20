import React from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { useLifeStore } from '../../store/lifeStore';
import { PRAYERS } from '../../db/types';

const PRAYER_LABELS: Record<string, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

export function PrayerTracker() {
  const { colors, typography, spacing } = useTheme();
  const { togglePrayer, isPrayerDone, prayerStreak } = useLifeStore();

  const completedCount = PRAYERS.filter((p) => isPrayerDone(p)).length;

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
        <View>
          <Text style={[typography.headline, { color: colors.label }]}>Today's Prayers</Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{completedCount} of 5 completed</Text>
        </View>
        {prayerStreak > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="sparkles" size={16} color={colors.orange} />
            <Text style={[typography.subhead, { color: colors.orange, marginLeft: 4, fontWeight: '700' }]}>
              {prayerStreak} day streak
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {PRAYERS.map((prayer) => {
          const done = isPrayerDone(prayer);
          return (
            <Pressable
              key={prayer}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                togglePrayer(prayer, !done);
              }}
              style={{ alignItems: 'center' }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: done ? colors.green : colors.fill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 6,
                }}
              >
                <Icon name={done ? 'checkmark.circle.fill' : 'moon.stars.fill'} size={20} color={done ? '#fff' : colors.secondaryLabel} />
              </View>
              <Text style={[typography.caption2, { color: colors.secondaryLabel }]}>{PRAYER_LABELS[prayer]}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
