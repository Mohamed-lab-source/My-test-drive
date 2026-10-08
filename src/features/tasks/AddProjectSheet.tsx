import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Sheet } from '../../ui/Sheet';
import { TextField } from '../../ui/TextField';
import { ChipSelector } from '../../ui/ChipSelector';
import { Button } from '../../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useProductivityStore } from '../../store/productivityStore';
import { accentColors } from '../../theme/colors';
import { todayKey } from '../../db/client';
import type { Project } from '../../db/types';

const ICONS = ['briefcase.fill', 'house.fill', 'book.fill', 'heart.fill', 'airplane', 'graduationcap.fill', 'gamecontroller.fill', 'flag.fill'];

const DEADLINES = [
  { id: '7', label: '1 week' },
  { id: '14', label: '2 weeks' },
  { id: '30', label: '1 month' },
  { id: '90', label: '3 months' },
];

export function AddProjectSheet({ visible, onClose, editing }: { visible: boolean; onClose: () => void; editing?: Project | null }) {
  const { colors, typography, spacing } = useTheme();
  const { projects, addProject, updateProject } = useProductivityStore();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState<string>(accentColors[0]);
  const [saving, setSaving] = useState(false);
  const [deadline, setDeadline] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(editing?.name ?? '');
    setIcon(editing?.icon ?? ICONS[0]);
    setColor(editing?.color ?? accentColors[0]);
    setDeadline(editing?.due_date ?? '');
  }, [visible, editing?.id]);

  const validDeadline = deadline === '' || /^\d{4}-\d{2}-\d{2}$/.test(deadline);
  const canSave = name.trim().length > 0 && validDeadline;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const fields = { name: name.trim(), icon, color, due_date: deadline || null };
      if (editing) await updateProject(editing.id, fields);
      else await addProject({ ...fields, sort_order: projects.length });
      setName('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>{editing ? 'Edit Project' : 'New Project'}</Text>
        <TextField label="Name" placeholder="e.g. Wedding, Move house" value={name} onChangeText={setName} autoFocus />
        <TextField label="Deadline" placeholder="YYYY-MM-DD (optional)" value={deadline} onChangeText={setDeadline} />
        <View style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>
          <ChipSelector
            options={[{ id: 'none', label: 'No deadline' }, ...DEADLINES]}
            selectedId={null}
            onSelect={(id) => {
              if (id === 'none') return setDeadline('');
              const d = new Date();
              d.setDate(d.getDate() + Number(id));
              setDeadline(todayKey(d));
            }}
          />
        </View>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>Icon</Text>
        <View style={{ marginBottom: spacing.md }}>
          <ChipSelector options={ICONS.map((i) => ({ id: i, label: '', icon: i, color }))} selectedId={icon} onSelect={setIcon} />
        </View>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>Color</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md }}>
          {accentColors.map((c) => (
            <View
              key={c}
              onTouchEnd={() => setColor(c)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: c,
                marginRight: 10,
                marginBottom: 10,
                borderWidth: c === color ? 3 : 0,
                borderColor: colors.label,
              }}
            />
          ))}
        </View>
        <Button title="Save" onPress={handleSave} disabled={!canSave} loading={saving} />
      </ScrollView>
    </Sheet>
  );
}
