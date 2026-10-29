import type { Meeting, Task } from '../db/types';
import { localDateKey } from './date';

const DAY = 86400000;

export function taskInsights(tasks: Task[], meetings: Meeting[], now: Date = new Date(), weekStart = 6) {
  const month = localDateKey(now.toISOString()).slice(0, 7);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  const done = tasks.filter((t) => t.status === 'done' && t.completed_at);
  const recentDone = done.filter((t) => now.getTime() - new Date(t.completed_at!).getTime() <= 90 * DAY);

  const byWeekday = Array(7).fill(0);
  const byHour = Array(24).fill(0);
  for (const t of recentDone) {
    const d = new Date(t.completed_at!);
    byWeekday[d.getDay()]++;
    byHour[d.getHours()]++;
  }

  const durations = recentDone
    .map((t) => (new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime()) / DAY)
    .filter((d) => d >= 0)
    .sort((a, b) => a - b);
  const medianDays = durations.length ? durations[Math.floor(durations.length / 2)] : null;

  const withDeadline = done.filter((t) => t.due_date);
  const onTime = withDeadline.filter((t) => localDateKey(t.completed_at!) <= t.due_date!.slice(0, 10)).length;

  const projectCounts = new Map<string, number>();
  for (const t of recentDone) if (t.project_id) projectCounts.set(t.project_id, (projectCounts.get(t.project_id) ?? 0) + 1);

  const open = tasks.filter((t) => t.status !== 'done');
  const oldest = [...open].sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null;

  const back = (now.getDay() - weekStart + 7) % 7;
  const wkStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
  const wkEnd = new Date(wkStart.getTime() + 7 * DAY);
  const weekMeetings = meetings.filter((m) => {
    const s = new Date(m.start_at);
    return s >= wkStart && s < wkEnd;
  });
  const meetingMinutes = weekMeetings.reduce(
    (sum, m) => sum + (m.end_at ? Math.max(0, (new Date(m.end_at).getTime() - new Date(m.start_at).getTime()) / 60000) : 30),
    0
  );

  return {
    doneThisMonth: done.filter((t) => localDateKey(t.completed_at!).startsWith(month)).length,
    doneLastMonth: done.filter((t) => localDateKey(t.completed_at!).startsWith(prevMonth)).length,
    createdThisMonth: tasks.filter((t) => localDateKey(t.created_at).startsWith(month)).length,
    byWeekday,
    bestWeekday: byWeekday.indexOf(Math.max(...byWeekday)),
    bestHour: byHour.indexOf(Math.max(...byHour)),
    recentDoneCount: recentDone.length,
    medianDays,
    onTimeRate: withDeadline.length ? onTime / withDeadline.length : null,
    deadlineCount: withDeadline.length,
    topProjects: [...projectCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
    openByPriority: { high: open.filter((t) => t.priority === 'high').length, medium: open.filter((t) => t.priority === 'medium').length, low: open.filter((t) => t.priority === 'low').length },
    oldest,
    oldestDays: oldest ? Math.floor((now.getTime() - new Date(oldest.created_at).getTime()) / DAY) : 0,
    meetingCount: weekMeetings.length,
    meetingMinutes,
  };
}
