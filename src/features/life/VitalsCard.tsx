import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { TextField } from '../../ui/TextField';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Button } from '../../ui/Button';
import * as repo from '../../db/repositories/health';
import { formatDateShort, formatTime } from '../../utils/date';
import type { Vital, VitalKind } from '../../db/types';

const KINDS: { kind: VitalKind; label: string; unit: string }[] = [
  { kind: 'bp', label: 'Blood pressure', unit: 'mmHg' },
  { kind: 'sugar', label: 'Blood sugar', unit: 'mg/dL' },
  { kind: 'heart', label: 'Heart rate', unit: 'bpm' },
];

// General guidance bands (not medical advice).
function band(v: Vital): { label: string; level: 0 | 1 | 2 } {
  if (v.kind === 'bp') {
    const s = v.value;
    const d = v.value2 ?? 0;
    if (s >= 140 || d >= 90) return { label: 'High', level: 2 };
    if (s >= 120 || d >= 80) return { label: 'Elevated', level: 1 };
    if (s < 90 || d < 60) return { label: 'Low', level: 1 };
    return { label: 'Normal', level: 0 };
  }
  if (v.kind === 'sugar') {
    if (v.value < 70) return { label: 'Low', level: 2 };
    if (v.value > 180) return { label: 'High', level: 2 };
    if (v.value > 140) return { label: 'Above target', level: 1 };
    return { label: 'In range', level: 0 };
  }
  if (v.value < 50 || v.value > 100) return { label: v.value < 50 ? 'Low' : 'High', level: 1 };
  return { label: 'Normal', level: 0 };
}

export function VitalsCard() {
  const { colors, typography, spacing } = useTheme();
  const [index, setIndex] = useState(0);
  const [rows, setRows] = useState<Vital[]>([]);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const kind = KINDS[index];

  const load = useCallback(() => {
    repo.listVitals(kind.kind, 30).then(setRows);
  }, [kind.kind]);
  useEffect(load, [load]);

  const save = async () => {
    const v1 = Number(a);
    const v2 = kind.kind === 'bp' ? Number(b) : null;
    if (!(v1 > 0) || (kind.kind === 'bp' && !(v2! > 0))) return;
    await repo.addVital(kind.kind, v1, v2, null);
    setA('');
    setB('');
    load();
  };

  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
  const week = rows.filter((r) => Date.now() - new Date(r.date).getTime() <= 7 * 86400000);
  const levelColor = [colors.green, colors.orange, colors.red];
  const show = (r: Vital) => (r.kind === 'bp' ? `${r.value}/${r.value2}` : String(r.value));

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm }]}>🩺 Vitals</Text>
      <SegmentedControl options={KINDS.map((k) => k.label)} selectedIndex={index} onChange={setIndex} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.md }}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <TextField label={kind.kind === 'bp' ? 'Systolic' : kind.unit} keyboardType="number-pad" value={a} onChangeText={setA} placeholder={kind.kind === 'bp' ? '120' : kind.kind === 'sugar' ? '95' : '70'} />
        </View>
        {kind.kind === 'bp' ? (
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <TextField label="Diastolic" keyboardType="number-pad" value={b} onChangeText={setB} placeholder="80" />
          </View>
        ) : null}
        <Button title="Log" onPress={save} style={{ marginBottom: spacing.md, paddingHorizontal: spacing.lg }} />
      </View>
      {week.length ? (
        <Text style={[typography.subhead, { color: colors.secondaryLabel, marginBottom: 4 }]}>
          7-day average:{' '}
          {kind.kind === 'bp'
            ? `${avg(week.map((r) => r.value))}/${avg(week.map((r) => r.value2 ?? 0))}`
            : avg(week.map((r) => r.value))}{' '}
          {kind.unit} ({week.length} reading{week.length === 1 ? '' : 's'})
        </Text>
      ) : null}
      {rows.slice(0, 8).map((r) => {
        const bnd = band(r);
        return (
          <Pressable
            key={r.id}
            onLongPress={() =>
              Alert.alert('Delete reading?', `${show(r)} ${kind.unit}`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: async () => { await repo.deleteVital(r.id); load(); } },
              ])
            }
            style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}
          >
            <Text style={[typography.body, { color: colors.label }]}>
              {show(r)} <Text style={{ color: colors.secondaryLabel, fontSize: 13 }}>{kind.unit}</Text>
            </Text>
            <Text style={[typography.caption1, { color: levelColor[bnd.level] }]}>{bnd.label}</Text>
            <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
              {formatDateShort(r.date)} {formatTime(r.date)}
            </Text>
          </Pressable>
        );
      })}
      <Text style={[typography.caption2, { color: colors.tertiaryLabel, marginTop: spacing.xs }]}>
        Ranges are general guidance, not medical advice. Long-press a reading to delete it.
      </Text>
    </Card>
  );
}
