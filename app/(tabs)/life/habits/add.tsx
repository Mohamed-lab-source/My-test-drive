import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { NavHeader } from '../../../../src/ui/NavHeader';
import { useTheme } from '../../../../src/theme/ThemeProvider';
import { TextField } from '../../../../src/ui/TextField';
import { SegmentedControl } from '../../../../src/ui/SegmentedControl';
import { ChipSelector } from '../../../../src/ui/ChipSelector';
import { Button } from '../../../../src/ui/Button';
import { useHabitsStore } from '../../../../src/store/habitsStore';
import { HABIT_TEMPLATES, ICON_CHOICES } from '../../../../src/domain/habits/templates';
import { WEEKDAY_LABELS } from '../../../../src/domain/habits/dateUtils';
import type { Frequency, StackAnchor, TimeOfDay, Weekday } from '../../../../src/domain/habits/types';

const TIME_OPTIONS: TimeOfDay[] = ['anytime', 'morning', 'afternoon', 'evening'];

export default function AddHabitScreen() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { identities, habits, addHabit, addIdentity } = useHabitsStore();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICON_CHOICES[0]);
  const [identityId, setIdentityId] = useState<string | null>(null);
  const [newIdentityText, setNewIdentityText] = useState('');
  const [showNewIdentity, setShowNewIdentity] = useState(false);

  const [frequencyIndex, setFrequencyIndex] = useState(0); // 0 = daily, 1 = specific days
  const [selectedDays, setSelectedDays] = useState<Weekday[]>([1, 2, 3, 4, 5]);
  const [timeIndex, setTimeIndex] = useState(0);

  const [cue, setCue] = useState('');
  const [craving, setCraving] = useState('');
  const [response, setResponse] = useState('');
  const [reward, setReward] = useState('');
  const [twoMinuteVersion, setTwoMinuteVersion] = useState('');

  const [stackIndex, setStackIndex] = useState(0); // 0 none, 1 habit, 2 custom
  const [stackHabitId, setStackHabitId] = useState<string | null>(null);
  const [stackText, setStackText] = useState('');

  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0;

  const applyTemplate = (t: (typeof HABIT_TEMPLATES)[number]) => {
    setName(t.name);
    setIcon(t.icon);
    setCue(t.cue);
    setCraving(t.craving);
    setResponse(t.response);
    setReward(t.reward);
    setTwoMinuteVersion(t.twoMinuteVersion);
  };

  const toggleDay = (day: Weekday) => {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  const handleCreateIdentity = async () => {
    if (!newIdentityText.trim()) return;
    await addIdentity(newIdentityText.trim(), '');
    setNewIdentityText('');
    setShowNewIdentity(false);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const frequency: Frequency = frequencyIndex === 0 ? { type: 'daily' } : { type: 'weekdays', days: selectedDays };
      const stackAnchor: StackAnchor =
        stackIndex === 1 && stackHabitId
          ? { type: 'habit', habitId: stackHabitId }
          : stackIndex === 2 && stackText.trim()
            ? { type: 'custom', text: stackText.trim() }
            : { type: 'none' };

      await addHabit({
        name: name.trim(),
        icon,
        identityId,
        frequency,
        timeOfDay: TIME_OPTIONS[timeIndex],
        cue,
        craving,
        response,
        reward,
        twoMinuteVersion,
        stackAnchor,
        tags: [],
        sortOrder: habits.length,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const identityOptions = useMemo(
    () => identities.filter((i) => !i.archived).map((i) => ({ id: i.id, label: i.statement })),
    [identities]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="New Habit" right={<Pressable onPress={handleSave}><Text style={{ color: colors.blue, fontWeight: '600' }}>Save</Text></Pressable>} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
          Start from a template
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          {HABIT_TEMPLATES.map((t) => (
            <Pressable
              key={t.name}
              onPress={() => applyTemplate(t)}
              style={{
                alignItems: 'center',
                backgroundColor: colors.secondarySystemGroupedBackground,
                borderRadius: 14,
                padding: spacing.sm,
                marginRight: spacing.sm,
                width: 84,
              }}
            >
              <Text style={{ fontSize: 26 }}>{t.icon}</Text>
              <Text style={[typography.caption2, { color: colors.label, marginTop: 4, textAlign: 'center' }]} numberOfLines={2}>
                {t.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <TextField label="Habit name" placeholder="e.g. Read" value={name} onChangeText={setName} autoFocus />

        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>Icon</Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector options={ICON_CHOICES.map((e) => ({ id: e, label: e }))} selectedId={icon} onSelect={setIcon} />
        </View>

        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
          Identity — "I am becoming..."
        </Text>
        <View style={{ marginBottom: spacing.sm }}>
          <ChipSelector
            options={[{ id: '__new', label: '+ New' }, ...identityOptions]}
            selectedId={identityId}
            onSelect={(id) => (id === '__new' ? setShowNewIdentity(true) : setIdentityId(id === identityId ? null : id))}
          />
        </View>
        {showNewIdentity ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <TextField placeholder="a healthy person" value={newIdentityText} onChangeText={setNewIdentityText} />
            </View>
            <Button title="Add" variant="secondary" onPress={handleCreateIdentity} />
          </View>
        ) : null}

        <View style={{ marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
            Frequency
          </Text>
          <SegmentedControl options={['Daily', 'Specific days']} selectedIndex={frequencyIndex} onChange={setFrequencyIndex} />
        </View>
        {frequencyIndex === 1 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md }}>
            {WEEKDAY_LABELS.map((label, i) => {
              const day = i as Weekday;
              const selected = selectedDays.includes(day);
              return (
                <Pressable
                  key={label}
                  onPress={() => toggleDay(day)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? colors.blue : colors.fill,
                    marginRight: 8,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: selected ? '#fff' : colors.label, fontWeight: '600' }}>{label[0]}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={{ marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
            Time of day
          </Text>
          <SegmentedControl
            options={['Anytime', 'Morning', 'Afternoon', 'Evening']}
            selectedIndex={timeIndex}
            onChange={setTimeIndex}
          />
        </View>

        <Text style={[typography.title3, { color: colors.label, marginTop: spacing.sm, marginBottom: spacing.sm }]}>
          The Four Laws
        </Text>
        <TextField label="Cue — what triggers it" placeholder="I finish breakfast" value={cue} onChangeText={setCue} />
        <TextField label="Craving — what you want to feel" placeholder="I feel accomplished" value={craving} onChangeText={setCraving} />
        <TextField label="Response — the habit itself" placeholder="Read 10 pages" value={response} onChangeText={setResponse} />
        <TextField label="Reward — what reinforces it" placeholder="Cross it off" value={reward} onChangeText={setReward} />
        <TextField
          label="Two-minute version (make it easy)"
          placeholder="Read one page"
          value={twoMinuteVersion}
          onChangeText={setTwoMinuteVersion}
        />

        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: spacing.sm, marginBottom: 6, textTransform: 'uppercase' }]}>
          Habit stacking — "After [X], I will do this"
        </Text>
        <View style={{ marginBottom: spacing.sm }}>
          <SegmentedControl options={['None', 'After a habit', 'Custom']} selectedIndex={stackIndex} onChange={setStackIndex} />
        </View>
        {stackIndex === 1 ? (
          <View style={{ marginBottom: spacing.md }}>
            <ChipSelector
              options={habits.map((h) => ({ id: h.id, label: `${h.icon} ${h.name}` }))}
              selectedId={stackHabitId}
              onSelect={setStackHabitId}
            />
          </View>
        ) : null}
        {stackIndex === 2 ? (
          <TextField placeholder="I finish my morning coffee" value={stackText} onChangeText={setStackText} />
        ) : null}

        <Button title="Create habit" onPress={handleSave} disabled={!canSave} loading={saving} style={{ marginTop: spacing.sm }} />
      </ScrollView>
    </View>
  );
}
