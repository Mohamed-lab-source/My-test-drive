import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { useProductivityStore } from '../../../src/store/productivityStore';
import * as repo from '../../../src/db/repositories/productivity';
import { todayKey } from '../../../src/db/client';
import { localDateKey } from '../../../src/utils/date';
import type { FocusSession } from '../../../src/db/types';
import { MiniBars, lastDays } from '../../../src/ui/MiniBars';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useLocalSearchParams } from 'expo-router';
import { FocusTimer } from '../../../src/features/tasks/FocusTimer';
import { Button } from '../../../src/ui/Button';

const DAYS = 7;
const CHART_HEIGHT = 100;

const fmt = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);

export default function FocusStatsScreen() {
  const { colors, typography, spacing } = useTheme();
  const tasks = useProductivityStore((s) => s.tasks);
  const projects = useProductivityStore((s) => s.projects);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const { focusGoal, setFocusGoal } = useSettingsStore();
  // Opened from a task's "Focus on this": start the timer on that task.
  const { task: taskParam } = useLocalSearchParams<{ task?: string }>();
  const [timerTask, setTimerTask] = useState<string | null>(null);
  const [timerOpen, setTimerOpen] = useState(false);
  useEffect(() => {
    if (taskParam) {
      setTimerTask(taskParam);
      setTimerOpen(true);
    }
  }, [taskParam]);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - 90);
    repo.listFocusSessionsSince(since.toISOString()).then(setSessions);
  }, []);

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) m.set(localDateKey(s.completed_at), (m.get(localDateKey(s.completed_at)) ?? 0) + s.minutes);
    return m;
  }, [sessions]);

  const now = new Date();
  const week = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DAYS - 1 - i));
    return { key: todayKey(d), label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), minutes: byDay.get(todayKey(d)) ?? 0 };
  });
  const max = Math.max(1, ...week.map((d) => d.minutes));
  const today = byDay.get(todayKey()) ?? 0;
  const weekTotal = week.reduce((s, d) => s + d.minutes, 0);

  // Consecutive days with any focus, counting back from today (or from
  // yesterday if nothing's been logged yet today).
  let streak = 0;
  for (let i = today > 0 ? 0 : 1; i < 90; i++) {
    const key = todayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
    if (!byDay.get(key)) break;
    streak++;
  }

  const completed = useMemo(() => {
    const days = lastDays(14, todayKey);
    const counts = new Map<string, number>();
    for (const t of tasks) if (t.completed_at) counts.set(localDateKey(t.completed_at), (counts.get(localDateKey(t.completed_at)) ?? 0) + 1);
    return days.map((d) => ({ ...d, value: counts.get(d.key) ?? 0 }));
  }, [tasks]);
  const completedTotal = completed.reduce((s, d) => s + d.value, 0);

  // Days in a row with at least one task completed (today counts once done).
  const doneStreak = useMemo(() => {
    const days = new Set(tasks.filter((t) => t.completed_at).map((t) => localDateKey(t.completed_at!)));
    let n = 0;
    const d = new Date();
    if (!days.has(todayKey(d))) d.setDate(d.getDate() - 1);
    while (days.has(todayKey(d)) && n < 3650) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }, [tasks]);

  const topTasks = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) if (s.task_id) m.set(s.task_id, (m.get(s.task_id) ?? 0) + s.minutes);
    return Array.from(m.entries())
      .map(([id, minutes]) => ({ title: tasks.find((t) => t.id === id)?.title ?? 'Deleted task', minutes }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5);
  }, [sessions, tasks]);

  // Focus minutes per project over the same 90 days.
  const byProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) {
      const projectId = tasks.find((t) => t.id === s.task_id)?.project_id ?? 'none';
      m.set(projectId, (m.get(projectId) ?? 0) + s.minutes);
    }
    const total = Array.from(m.values()).reduce((a, b) => a + b, 0);
    return Array.from(m.entries())
      .map(([id, minutes]) => {
        const p = projects.find((x) => x.id === id);
        return { id, name: p?.name ?? 'No project', color: p?.color ?? colors.gray, minutes, share: total ? minutes / total : 0 };
      })
      .sort((a, b) => b.minutes - a.minutes);
  }, [sessions, tasks, projects, colors.gray]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Focus" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Button
          title="Start a focus session"
          onPress={() => {
            setTimerTask(null);
            setTimerOpen(true);
          }}
          style={{ marginBottom: spacing.md }}
        />
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label }]}>Daily focus goal</Text>
          {focusGoal > 0 ? (
            <>
              <Text style={[typography.subhead, { color: colors.secondaryLabel, marginTop: 2 }]}>
                {fmt(today)} of {fmt(focusGoal)} today{today >= focusGoal ? ' — goal reached 🎉' : ''}
              </Text>
              <View style={{ marginTop: 6 }}>
                <ProgressBar progress={today / focusGoal} color={today >= focusGoal ? colors.green : colors.indigo} />
              </View>
              <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
                Goal met on {week.filter((d) => d.minutes >= focusGoal).length} of the last 7 days
              </Text>
            </>
          ) : null}
          <View style={{ marginTop: spacing.sm }}>
            <ChipSelector
              options={[0, 30, 60, 90, 120, 180, 240].map((m) => ({ id: String(m), label: m === 0 ? 'Off' : fmt(m) }))}
              selectedId={String(focusGoal)}
              onSelect={(id) => setFocusGoal(Number(id))}
            />
          </View>
        </Card>
        <View style={{ flexDirection: 'row', marginHorizontal: -4, marginBottom: spacing.md }}>
          {[
            { label: 'Today', value: fmt(today) },
            { label: 'Last 7 days', value: fmt(weekTotal) },
            { label: 'Streak', value: `${streak} day${streak === 1 ? '' : 's'}` },
          ].map((s) => (
            <Card key={s.label} style={{ flex: 1, marginHorizontal: 4, alignItems: 'center' }}>
              <Text style={[typography.title3, { color: colors.label }]}>{s.value}</Text>
              <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 2 }]}>{s.label}</Text>
            </Card>
          ))}
        </View>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm }]}>This week</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT }}>
            {week.map((d) => (
              <View key={d.key} style={{ flex: 1, alignItems: 'center' }}>
                {d.minutes > 0 ? (
                  <Text style={[typography.caption2, { color: colors.secondaryLabel, marginBottom: 2 }]}>{d.minutes}</Text>
                ) : null}
                <View
                  style={{
                    width: 18,
                    borderRadius: 4,
                    backgroundColor: d.key === todayKey() ? colors.orange : colors.blue,
                    height: Math.max(3, (d.minutes / max) * (CHART_HEIGHT - 16)),
                  }}
                />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', marginTop: 4 }}>
            {week.map((d) => (
              <Text key={d.key} style={[typography.caption2, { flex: 1, textAlign: 'center', color: colors.secondaryLabel }]}>
                {d.label}
              </Text>
            ))}
          </View>
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label }]}>Tasks completed</Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
            {completedTotal} in the last 14 days · {(completedTotal / 14).toFixed(1)} a day
            {doneStreak > 1 ? ` · 🔥 ${doneStreak}-day streak` : ''}
          </Text>
          <MiniBars data={completed} color={colors.green} />
        </Card>

        {byProject.length > 1 || (byProject.length === 1 && byProject[0].id !== 'none') ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm }]}>Time by project (90 days)</Text>
            {byProject.map((p) => (
              <View key={p.id} style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={[typography.subhead, { color: colors.label }]}>{p.name}</Text>
                  <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>
                    {fmt(p.minutes)} · {Math.round(p.share * 100)}%
                  </Text>
                </View>
                <ProgressBar progress={p.share} color={p.color} />
              </View>
            ))}
          </Card>
        ) : null}

        <Card>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.xs }]}>Most focused tasks (90 days)</Text>
          {topTasks.length === 0 ? (
            <Text style={[typography.body, { color: colors.secondaryLabel }]}>
              Start a focus timer from any task to see your stats here.
            </Text>
          ) : (
            topTasks.map((t, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
                <Text style={[typography.body, { color: colors.label, flex: 1 }]} numberOfLines={1}>
                  {t.title}
                </Text>
                <Text style={[typography.body, { color: colors.secondaryLabel }]}>{fmt(t.minutes)}</Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
      <FocusTimer task={tasks.find((t) => t.id === timerTask) ?? null} visible={timerOpen} onClose={() => setTimerOpen(false)} />
    </View>
  );
}
