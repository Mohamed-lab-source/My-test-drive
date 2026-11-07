import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from '../../utils/haptics';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { useSettingsStore } from '../../store/settingsStore';
import { todayKey } from '../../db/client';

const ITEMS = [
  { id: 'ghusl', label: 'Ghusl' },
  { id: 'kahf', label: 'Read Surat al-Kahf' },
  { id: 'salawat', label: 'Send salawat on the Prophet ﷺ' },
  { id: 'early', label: "Go early to Jumu'ah" },
  { id: 'dua', label: 'Make dua in the last hour before Maghrib' },
];

// Friday's sunnahs as a checklist, only on Fridays.
export function FridayCard() {
  const { colors, typography, spacing } = useTheme();
  const { fridayChecklist, setFridayChecklist } = useSettingsStore(useShallow((s) => ({ fridayChecklist: s.fridayChecklist, setFridayChecklist: s.setFridayChecklist })));
  if (new Date().getDay() !== 5) return null;
  const today = todayKey();
  const done = fridayChecklist?.date === today ? fridayChecklist.done : [];

  const toggle = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFridayChecklist({ date: today, done: done.includes(id) ? done.filter((x) => x !== id) : [...done, id] });
  };

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.xs }]}>
        Jumu'ah Mubarak 🕌 <Text style={{ color: colors.secondaryLabel, fontWeight: '400' }}>{done.length}/{ITEMS.length}</Text>
      </Text>
      {ITEMS.map((item) => {
        const on = done.includes(item.id);
        return (
          <Pressable key={item.id} onPress={() => toggle(item.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
            <Icon name={on ? 'checkmark.circle.fill' : 'circle'} size={22} color={on ? colors.green : colors.gray3} />
            <Text
              style={[
                typography.body,
                { marginLeft: spacing.sm, color: on ? colors.secondaryLabel : colors.label, textDecorationLine: on ? 'line-through' : 'none' },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </Card>
  );
}
