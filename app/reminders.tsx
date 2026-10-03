import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import * as Notifications from 'expo-notifications';
import { NavHeader } from '../src/ui/NavHeader';
import { useTheme } from '../src/theme/ThemeProvider';
import { Card } from '../src/ui/Card';
import { EmptyState } from '../src/ui/EmptyState';
import { areNotificationsEnabled } from '../src/notifications/scheduler';
import { formatClock, formatRelativeDay, formatTime } from '../src/utils/date';

interface Row {
  id: string;
  title: string;
  body: string;
  when: string;
  sort: number;
}

// Turns each trigger type into a readable "when" and a sort key.
function describe(n: Notifications.NotificationRequest): Row {
  const t = n.trigger as Record<string, unknown> | null;
  let when = 'Scheduled';
  let sort = Number.MAX_SAFE_INTEGER;
  if (t && typeof t.value === 'number') {
    // DATE triggers come back as { type: 'date', value: epochMillis }.
    const iso = new Date(t.value).toISOString();
    when = `${formatRelativeDay(iso)} · ${formatTime(iso)}`;
    sort = t.value;
  } else if (t && typeof t.hour === 'number' && typeof t.minute === 'number') {
    const hhmm = `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
    if (typeof t.month === 'number' && typeof t.day === 'number') {
      when = `Every year · ${new Date(2000, t.month, t.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    } else {
      when = `Every day · ${formatClock(hhmm)}`;
    }
    sort = Date.now() + (t.hour * 60 + t.minute) * 60000;
  }
  return { id: n.identifier, title: n.content.title ?? 'Reminder', body: n.content.body ?? '', when, sort };
}

export default function RemindersScreen() {
  const { colors, typography, spacing } = useTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setEnabled(await areNotificationsEnabled());
    const all = await Notifications.getAllScheduledNotificationsAsync();
    setRows(all.map(describe).sort((a, b) => a.sort - b.sort));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Upcoming reminders" />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        {!enabled ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.body, { color: colors.orange }]}>
              Reminders are off. Turn them on in Settings → Reminders (and allow notifications for Anchor) to receive these.
            </Text>
          </Card>
        ) : null}
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
          {rows.length} scheduled on this phone
        </Text>
        {rows.length === 0 ? (
          <EmptyState icon="bell.fill" title="Nothing scheduled" message="Reminders you turn on — prayers, bills, habits, meetings — will be listed here." />
        ) : (
          <Card padded={false}>
            {rows.map((r, i) => (
              <View
                key={r.id}
                style={{ padding: spacing.md, borderBottomWidth: i === rows.length - 1 ? 0 : 0.5, borderBottomColor: colors.separator }}
              >
                <View style={{ flexDirection: 'row' }}>
                  <Text style={[typography.body, { color: colors.label, flex: 1 }]} numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Text style={[typography.caption1, { color: colors.blue, marginLeft: spacing.sm }]}>{r.when}</Text>
                </View>
                {r.body ? (
                  <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 2 }]} numberOfLines={2}>
                    {r.body}
                  </Text>
                ) : null}
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
