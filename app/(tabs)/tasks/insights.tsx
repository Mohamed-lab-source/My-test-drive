import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { useProductivityStore } from '../../../src/store/productivityStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { taskInsights } from '../../../src/utils/taskInsights';
import { formatEstimate } from '../../../src/utils/estimate';
import { formatClock } from '../../../src/utils/date';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

export default function TaskInsightsScreen() {
  const { colors, typography, spacing } = useTheme();
  const { tasks, meetings, projects } = useProductivityStore(useShallow((s) => ({ tasks: s.tasks, meetings: s.meetings, projects: s.projects })));
  const weekStart = useSettingsStore((s) => s.weekStart);
  const d = useMemo(() => taskInsights(tasks, meetings, new Date(), weekStart), [tasks, meetings, weekStart]);
  const max = Math.max(1, ...d.byWeekday);

  const card = (emoji: string, title: string, lines: (string | null)[]) => (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={[typography.headline, { color: colors.label, marginBottom: 2 }]}>
        {emoji} {title}
      </Text>
      {lines.filter(Boolean).map((l, i) => (
        <Text key={i} style={[typography.subhead, { color: colors.secondaryLabel, marginTop: 2 }]}>
          {l}
        </Text>
      ))}
    </Card>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Task insights" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {card('✅', 'This month', [
          `${d.doneThisMonth} done · ${d.createdThisMonth} added`,
          d.doneLastMonth ? `${d.doneLastMonth} done last month` : null,
          d.createdThisMonth > d.doneThisMonth + 5 ? 'You are adding faster than you finish — a good time for a backlog clean-up.' : null,
        ])}

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label }]}>📆 Best days (90 days)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60, marginTop: spacing.sm }}>
            {d.byWeekday.map((v, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ width: 18, borderRadius: 4, height: Math.max(3, (v / max) * 60), backgroundColor: i === d.bestWeekday && v ? colors.green : colors.blue + '88' }} />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row' }}>
            {DAYS.map((n) => (
              <Text key={n} style={[typography.caption2, { flex: 1, textAlign: 'center', color: colors.tertiaryLabel }]}>
                {n}
              </Text>
            ))}
          </View>
          {d.recentDoneCount ? (
            <Text style={[typography.subhead, { color: colors.secondaryLabel, marginTop: spacing.xs }]}>
              You finish the most on {DAY_NAMES[d.bestWeekday]}, usually around {formatClock(`${String(d.bestHour).padStart(2, '0')}:00`)}.
            </Text>
          ) : null}
        </Card>

        {card('⏱️', 'Speed', [
          d.medianDays !== null
            ? d.medianDays < 1
              ? 'Most tasks are done the same day you add them.'
              : `A typical task takes ${Math.round(d.medianDays)} day${Math.round(d.medianDays) === 1 ? '' : 's'} from added to done.`
            : 'Finish a few tasks to see this.',
          d.onTimeRate !== null ? `${Math.round(d.onTimeRate * 100)}% of ${d.deadlineCount} tasks with a deadline were done on time.` : null,
        ])}

        {card('📂', 'Projects (90 days)', d.topProjects.length
          ? d.topProjects.map(([id, n]) => `${projects.find((p) => p.id === id)?.name ?? 'Project'}: ${n} done`)
          : ['Tasks done in projects show up here.'])}

        {card('📋', 'Open tasks', [
          `${d.openByPriority.high} high · ${d.openByPriority.medium} medium · ${d.openByPriority.low} low priority`,
          d.oldest && d.oldestDays > 7 ? `Oldest: "${d.oldest.title}" (${d.oldestDays} days)` : null,
        ])}

        {card('👥', 'Meetings this week', [
          `${d.meetingCount} meeting${d.meetingCount === 1 ? '' : 's'} · ${formatEstimate(Math.round(d.meetingMinutes))}`,
          d.meetingMinutes > 15 * 60 ? 'That is a heavy meeting week — protect some focus time.' : null,
        ])}
      </ScrollView>
    </View>
  );
}
