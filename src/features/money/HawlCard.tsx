import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { ChipSelector } from '../../ui/ChipSelector';
import { TextField } from '../../ui/TextField';
import { Button } from '../../ui/Button';
import { useSettingsStore } from '../../store/settingsStore';
import { HIJRI_MONTHS, toHijri } from '../../utils/hijri';
import { requestNotificationPermission, rescheduleIslamicReminders } from '../../notifications/scheduler';
import { formatDateShort } from '../../utils/date';

// Next Gregorian date that lands on a given Hijri month/day.
function nextOccurrence(month: number, day: number, offset: number): Date | null {
  const d = new Date();
  for (let i = 0; i <= 400; i++) {
    const h = toHijri(d, offset);
    if (h.month === month && h.day === day) return new Date(d);
    d.setDate(d.getDate() + 1);
  }
  return null;
}

// The Hijri date your zakat year (hawl) renews, with a yearly reminder.
export function HawlCard() {
  const { colors, typography, spacing } = useTheme();
  const { zakatHawl, setZakatHawl, hijriOffset, notificationsEnabled } = useSettingsStore();
  const today = toHijri(new Date(), hijriOffset);
  const [month, setMonth] = useState(zakatHawl?.month ?? today.month);
  const [day, setDay] = useState(String(zakatHawl?.day ?? today.day));
  const next = zakatHawl ? nextOccurrence(zakatHawl.month, zakatHawl.day, hijriOffset) : null;

  const save = async () => {
    const d = Math.min(30, Math.max(1, Number(day) || 1));
    if (!notificationsEnabled) await requestNotificationPermission();
    setZakatHawl({ month, day: d });
    await rescheduleIslamicReminders();
  };

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={[typography.headline, { color: colors.label }]}>Zakat year (hawl)</Text>
      <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
        {zakatHawl
          ? `Renews every ${zakatHawl.day} ${HIJRI_MONTHS[zakatHawl.month - 1]}${next ? ` — next on ${formatDateShort(next.toISOString())}` : ''}. You'll get a reminder that morning.`
          : 'Pick the Hijri date your savings first reached nisab, and Anchor will remind you each year.'}
      </Text>
      <ChipSelector
        options={HIJRI_MONTHS.map((m, i) => ({ id: String(i + 1), label: m }))}
        selectedId={String(month)}
        onSelect={(id) => setMonth(Number(id))}
      />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.sm }}>
        <View style={{ width: 90, marginRight: spacing.sm }}>
          <TextField placeholder="Day" keyboardType="number-pad" value={day} onChangeText={setDay} />
        </View>
        <Button title={zakatHawl ? 'Update' : 'Remind me yearly'} variant="secondary" onPress={save} style={{ flex: 1 }} />
      </View>
      {zakatHawl ? (
        <Text
          onPress={async () => {
            setZakatHawl(null);
            await rescheduleIslamicReminders();
          }}
          style={[typography.footnote, { color: colors.red, marginTop: -spacing.xs }]}
        >
          Turn off reminder
        </Text>
      ) : null}
    </Card>
  );
}
