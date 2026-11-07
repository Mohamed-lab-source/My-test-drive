// Decides what the Smart Stack widget shows: every possible card gets a
// score from the time of day and what's going on (a meeting about to start,
// a prayer not marked yet, a bill due, today's spending, tasks, habits,
// water), and the widget shows the highest ones. Pure, so it's testable and
// runs in the headless widget task.

export type SmartTone = 'blue' | 'green' | 'orange' | 'red' | 'indigo' | 'teal' | 'purple';

export interface SmartAction {
  label: string;
  clickAction: string;
  data: Record<string, unknown>;
}

export interface SmartCard {
  id: string;
  score: number;
  emoji: string;
  title: string;
  detail: string;
  tone: SmartTone;
  // Where a tap on the card goes.
  uri: string;
  action?: SmartAction;
}

export interface SmartContext {
  now: Date;
  // Today's prayer times, or null when no city is set.
  prayers: { prayer: string; label: string; time: Date; done: boolean }[] | null;
  // Tomorrow's Fajr, to close Isha's window and for the night card.
  nextFajr: Date | null;
  meetings: { id: string; title: string; start: Date; end: Date | null; link: string | null }[];
  // Open tasks for today plus overdue ones.
  tasks: { id: string; title: string; priority: 'low' | 'medium' | 'high'; overdue: boolean; remindAt: Date | null; deadlineToday: boolean }[];
  doneToday: number;
  tomorrowTasks: number;
  bills: { ruleId: string; name: string; amount: string; due: Date }[];
  // Day-to-day spending against the plan, in minor units.
  spend: { spentToday: number; dailyLimit: number; status: 'on-track' | 'watch' | 'over' } | null;
  habits: { id: string; name: string; done: boolean }[];
  water: { count: number; goal: number };
  islamicDay: string | null;
  money: (minor: number) => string;
  time: (d: Date) => string;
}

const MIN = 60000;

function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function minutesUntil(t: Date, now: Date): number {
  return Math.round((t.getTime() - now.getTime()) / MIN);
}

function inMinutes(mins: number): string {
  if (mins <= 0) return 'now';
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m >= 10 ? `in ${h} h ${m} min` : `in ${h} h`;
}

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Good night';
}

export function pickSmartCards(ctx: SmartContext): SmartCard[] {
  const { now } = ctx;
  const hour = now.getHours() + now.getMinutes() / 60;
  const today = dayStart(now).getTime();
  const tomorrow = today + 86400000;
  const night = hour >= 21.5 || hour < 4;
  const cards: SmartCard[] = [];

  // Meetings: urgent when they're about to start or running.
  for (const m of ctx.meetings) {
    const end = m.end ?? new Date(m.start.getTime() + 30 * MIN);
    if (end <= now) continue;
    const mins = minutesUntil(m.start, now);
    if (mins > 180) continue;
    const live = mins <= 0;
    cards.push({
      id: `meeting-${m.id}`,
      score: live ? 96 : mins <= 15 ? 94 : mins <= 60 ? 74 : 52,
      emoji: '📅',
      title: m.title,
      detail: live ? `Happening now · until ${ctx.time(end)}` : `${ctx.time(m.start)} · ${inMinutes(mins)}`,
      tone: live || mins <= 15 ? 'red' : 'indigo',
      uri: 'anchor://tasks/meetings',
      action: m.link ? { label: 'Join', clickAction: 'OPEN_URI', data: { uri: m.link } } : undefined,
    });
    break;
  }

  // Prayers: the current one if it isn't marked yet, else the next one.
  if (ctx.prayers?.length) {
    const list = ctx.prayers;
    let current: (typeof list)[number] | null = null;
    let next: (typeof list)[number] | null = null;
    for (let i = 0; i < list.length; i++) {
      const windowEnd = list[i + 1]?.time ?? ctx.nextFajr ?? new Date(tomorrow);
      if (list[i].time <= now && now < windowEnd) current = list[i];
      if (!next && list[i].time > now) next = list[i];
    }
    if (current && !current.done) {
      const since = -minutesUntil(current.time, now);
      cards.push({
        id: `prayer-${current.prayer}`,
        score: since <= 45 ? 90 : 80,
        emoji: '🕌',
        title: `${current.label} — not marked yet`,
        detail: `Started ${ctx.time(current.time)}${next ? ` · ${next.label} ${inMinutes(minutesUntil(next.time, now))}` : ''}`,
        tone: 'teal',
        uri: 'anchor://life',
        action: { label: 'Prayed', clickAction: 'TOGGLE_PRAYER', data: { prayer: current.prayer } },
      });
    } else if (next) {
      const mins = minutesUntil(next.time, now);
      cards.push({
        id: `prayer-${next.prayer}`,
        score: mins <= 20 ? 82 : mins <= 60 ? 48 : 22,
        emoji: '🕌',
        title: `${next.label} at ${ctx.time(next.time)}`,
        detail: mins <= 20 ? `${inMinutes(mins)} — time to get ready` : inMinutes(mins),
        tone: 'teal',
        uri: 'anchor://life',
      });
    }
  }

  // Bills due today or late, then tomorrow.
  for (const b of ctx.bills) {
    const due = dayStart(b.due).getTime();
    if (due > tomorrow) continue;
    const late = due < today;
    cards.push({
      id: `bill-${b.ruleId}`,
      score: late ? 89 : due === today ? 86 : 58,
      emoji: '🧾',
      title: `${b.name} · ${b.amount}`,
      detail: late ? 'Overdue — pay it now' : due === today ? 'Due today' : 'Due tomorrow',
      tone: late ? 'red' : 'orange',
      uri: 'anchor://money/subscriptions',
      action: { label: 'Pay', clickAction: 'PAY_BILL', data: { ruleId: b.ruleId } },
    });
  }

  // Spending against today's limit.
  if (ctx.spend && ctx.spend.dailyLimit > 0) {
    const { spentToday, dailyLimit, status } = ctx.spend;
    const left = dailyLimit - spentToday;
    if (left < 0) {
      cards.push({
        id: 'spend',
        score: 77,
        emoji: '💸',
        title: `${ctx.money(-left)} over today's limit`,
        detail: `Spent ${ctx.money(spentToday)} of ${ctx.money(dailyLimit)}`,
        tone: 'red',
        uri: 'anchor://money/plan',
        action: { label: '+ Expense', clickAction: 'OPEN_URI', data: { uri: 'anchor://money?action=add-expense' } },
      });
    } else {
      const morning = hour >= 5 && hour < 11;
      cards.push({
        id: 'spend',
        score: morning ? 62 : spentToday / dailyLimit >= 0.8 ? 64 : status === 'over' ? 60 : 34,
        emoji: '💳',
        title: `${ctx.money(left)} left to spend today`,
        detail:
          status === 'over'
            ? 'This month is over plan — keep today light'
            : status === 'watch'
              ? `Spent ${ctx.money(spentToday)} · the month needs watching`
              : `Spent ${ctx.money(spentToday)} · on track this month`,
        tone: status === 'over' ? 'orange' : 'green',
        uri: 'anchor://money/plan',
        action: { label: '+ Expense', clickAction: 'OPEN_URI', data: { uri: 'anchor://money?action=add-expense' } },
      });
    }
  }

  // Tasks: a reminder coming up, the most important open one, overdue ones.
  const open = ctx.tasks;
  const rank = { high: 0, medium: 1, low: 2 } as const;
  const soon = open
    .filter((t) => t.remindAt && minutesUntil(t.remindAt, now) <= 60 && minutesUntil(t.remindAt, now) >= -30)
    .sort((a, b) => a.remindAt!.getTime() - b.remindAt!.getTime())[0];
  const top =
    soon ??
    [...open].sort(
      (a, b) => Number(b.deadlineToday) - Number(a.deadlineToday) || rank[a.priority] - rank[b.priority] || Number(b.overdue) - Number(a.overdue)
    )[0];
  if (top && !night) {
    const remind = top.remindAt ? minutesUntil(top.remindAt, now) : null;
    cards.push({
      id: `task-${top.id}`,
      score: soon ? 79 : top.deadlineToday ? 72 : top.priority === 'high' ? 66 : 46,
      emoji: top.priority === 'high' ? '🔥' : '✅',
      title: top.title,
      detail:
        remind !== null && soon
          ? `Reminder ${remind <= 0 ? 'now' : inMinutes(remind)}`
          : top.deadlineToday
            ? 'Due today'
            : `${open.length} task${open.length === 1 ? '' : 's'} left today${ctx.doneToday ? ` · ${ctx.doneToday} done` : ''}`,
      tone: top.priority === 'high' || top.deadlineToday ? 'orange' : 'blue',
      uri: 'anchor://tasks',
      action: { label: 'Done', clickAction: 'TOGGLE_TASK', data: { taskId: top.id } },
    });
  }
  const overdue = open.filter((t) => t.overdue).length;
  if (overdue > 0 && !night) {
    cards.push({
      id: 'overdue',
      score: 57,
      emoji: '⏰',
      title: `${overdue} overdue task${overdue === 1 ? '' : 's'}`,
      detail: 'Do them today or move them on',
      tone: 'red',
      uri: 'anchor://tasks',
    });
  }
  if (!open.length && ctx.doneToday > 0 && !night) {
    cards.push({
      id: 'tasks-done',
      score: 44,
      emoji: '🎉',
      title: 'All done for today',
      detail: `${ctx.doneToday} task${ctx.doneToday === 1 ? '' : 's'} finished${ctx.tomorrowTasks ? ` · ${ctx.tomorrowTasks} tomorrow` : ''}`,
      tone: 'green',
      uri: 'anchor://tasks',
    });
  }

  // Habits: more pressing as the evening goes on.
  const left = ctx.habits.filter((h) => !h.done);
  if (left.length && ctx.habits.length) {
    cards.push({
      id: 'habits',
      score: hour >= 18 ? 68 : hour >= 14 ? 40 : 24,
      emoji: '🌱',
      title: `${left.length} habit${left.length === 1 ? '' : 's'} left today`,
      detail: left.slice(0, 3).map((h) => h.name).join(', '),
      tone: 'green',
      uri: 'anchor://life/habits',
      action: { label: left[0].name.length <= 10 ? `✓ ${left[0].name}` : '✓ Tick off', clickAction: 'TOGGLE_HABIT', data: { habitId: left[0].id } },
    });
  }

  // Water: behind the pace for this time of day (8 AM to 10 PM).
  if (ctx.water.goal > 0 && ctx.water.count < ctx.water.goal && hour >= 8 && !night) {
    const expected = Math.floor(ctx.water.goal * Math.min(1, (hour - 8) / 14));
    const behind = expected - ctx.water.count;
    cards.push({
      id: 'water',
      score: behind >= 2 ? 56 : 18,
      emoji: '💧',
      title: behind >= 2 ? 'Time for some water' : 'Water',
      detail: `${ctx.water.count} of ${ctx.water.goal} glasses${behind >= 2 ? ` · ${behind} behind` : ''}`,
      tone: 'blue',
      uri: 'anchor://life/health',
      action: { label: '+1 glass', clickAction: 'WATER_ADD', data: {} },
    });
  }

  if (ctx.islamicDay) {
    cards.push({
      id: 'islamic',
      score: hour < 12 ? 63 : 36,
      emoji: '🌙',
      title: ctx.islamicDay,
      detail: 'Today in the Hijri calendar',
      tone: 'purple',
      uri: 'anchor://life',
    });
  }

  // Late evening: a look at tomorrow.
  if (night) {
    const firstMeeting = ctx.meetings
      .filter((m) => m.start.getTime() >= tomorrow && m.start.getTime() < tomorrow + 86400000)
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
    cards.push({
      id: 'tomorrow',
      score: 61,
      emoji: '🌙',
      title: 'Tomorrow',
      detail:
        [
          ctx.tomorrowTasks ? `${ctx.tomorrowTasks} task${ctx.tomorrowTasks === 1 ? '' : 's'}` : 'No tasks yet',
          firstMeeting ? `first meeting ${ctx.time(firstMeeting.start)}` : null,
          ctx.nextFajr ? `Fajr ${ctx.time(ctx.nextFajr)}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      tone: 'indigo',
      uri: 'anchor://tasks',
      action: { label: '+ Task', clickAction: 'OPEN_URI', data: { uri: 'anchor://tasks?action=add' } },
    });
  }

  if (!cards.length) {
    cards.push({
      id: 'clear',
      score: 1,
      emoji: '✨',
      title: 'All clear',
      detail: 'Nothing needs you right now',
      tone: 'green',
      uri: 'anchor://',
      action: { label: '+ Task', clickAction: 'OPEN_URI', data: { uri: 'anchor://tasks?action=add' } },
    });
  }
  return cards.sort((a, b) => b.score - a.score);
}
