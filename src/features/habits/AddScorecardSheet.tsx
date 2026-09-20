import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { Button } from '../../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useHabitsStore } from '../../store/habitsStore';
import type { ScorecardRating } from '../../domain/habits/types';
import type { ThemeColors } from '../../theme/colors';

const RATINGS: { value: ScorecardRating; label: string; color: (c: ThemeColors) => string }[] = [
  { value: '+', label: 'Good', color: (c) => c.green },
  { value: '=', label: 'Neutral', color: (c) => c.gray },
  { value: '-', label: 'Bad', color: (c) => c.red },
];

export function AddScorecardSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, typography, spacing, radius } = useTheme();
  const addScorecardEntry = useHabitsStore((s) => s.addScorecardEntry);

  const [activity, setActivity] = useState('');
  const [rating, setRating] = useState<ScorecardRating>('+');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = activity.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await addScorecardEntry(activity.trim(), rating, note.trim());
      setActivity('');
      setNote('');
      setRating('+');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.xs }]}>Scorecard Entry</Text>
        <Text style={[typography.subhead, { color: colors.secondaryLabel, marginBottom: spacing.md }]}>
          Point out an everyday behavior — is it helping who you want to become?
        </Text>
        <TextField label="Activity" placeholder="e.g. Checking my phone first thing" value={activity} onChangeText={setActivity} autoFocus />
        <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
          {RATINGS.map((r) => (
            <Pressable
              key={r.value}
              onPress={() => setRating(r.value)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: spacing.sm,
                marginRight: r.value !== '-' ? spacing.sm : 0,
                borderRadius: radius.md,
                backgroundColor: rating === r.value ? r.color(colors) : colors.fill,
              }}
            >
              <Text style={{ fontSize: 20, color: rating === r.value ? '#fff' : colors.label }}>{r.value}</Text>
              <Text style={[typography.caption1, { color: rating === r.value ? '#fff' : colors.secondaryLabel, marginTop: 2 }]}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextField label="Note" placeholder="Optional" value={note} onChangeText={setNote} />
        <Button title="Save" onPress={handleSave} disabled={!canSave} loading={saving} />
      </ScrollView>
    </Sheet>
  );
}
