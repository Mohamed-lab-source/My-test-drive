"use no memo";
import * as React from 'react';
import { FlexWidget, OverlapWidget, TextWidget } from 'react-native-android-widget';
import { widgetColors } from './theme';
import { Bar, Pill, Ring, tint } from './ui';
import { formatMoney } from '../utils/money';

export interface SpendWidgetData {
  currency: string;
  spentToday: number;
  daily: number;
  week: { spent: number; limit: number };
  month: { spent: number; limit: number };
  status: 'on-track' | 'watch' | 'over';
  projectedMonthEnd: number;
  daysLeft: number;
}

const STATUS = {
  'on-track': { label: 'On track', tone: 'green' },
  watch: { label: 'Watch it', tone: 'orange' },
  over: { label: 'Over plan', tone: 'red' },
} as const;

// Today's allowance as a ring, with this week and this month underneath —
// what's left, not just what's gone.
export function buildSpendWidget(d: SpendWidgetData | null, scheme: 'light' | 'dark', height = 170) {
  const c = widgetColors(scheme);
  const money = (n: number) => formatMoney(Math.round(n), d?.currency ?? 'USD');

  if (!d || d.daily <= 0) {
    return (
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'anchor://money/plan' }}
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: c.secondarySystemGroupedBackground,
          borderRadius: 22,
          padding: 16,
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <TextWidget text="💳 Spending" style={{ fontSize: 15, fontWeight: '700', color: c.label }} />
        {d ? <TextWidget text={`Spent today: ${money(d.spentToday)}`} style={{ fontSize: 13, color: c.secondaryLabel, marginTop: 4 }} /> : null}
        <TextWidget text="Set up your spending plan to see what's left each day ›" style={{ fontSize: 13, color: c.blue, marginTop: 6 }} />
      </FlexWidget>
    );
  }

  const left = d.daily - d.spentToday;
  const over = left < 0;
  const st = STATUS[d.status];
  const ringColor = over ? c.red : d.spentToday / d.daily >= 0.8 ? c.orange : c.green;
  const compact = height < 150;

  const row = (label: string, spent: number, limit: number) => {
    const p = limit > 0 ? spent / limit : 0;
    const color = p >= 1 ? c.red : p >= 0.8 ? c.orange : c.blue;
    return (
      <FlexWidget style={{ flexDirection: 'column', width: 'match_parent', marginTop: 6 }}>
        <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', width: 'match_parent', marginBottom: 3 }}>
          <TextWidget text={label} style={{ fontSize: 11, color: c.secondaryLabel }} />
          <TextWidget text={limit > 0 ? `${money(Math.max(0, limit - spent))} left` : money(spent)} style={{ fontSize: 11, fontWeight: '600', color: p >= 1 ? c.red : c.label }} />
        </FlexWidget>
        <Bar progress={p} color={color} track={c.tertiaryFill} height={5} />
      </FlexWidget>
    );
  };

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'anchor://money/plan' }}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: c.secondarySystemGroupedBackground,
        borderRadius: 22,
        padding: 14,
        flexDirection: 'column',
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}>
        <TextWidget text="Spending" style={{ fontSize: 14, fontWeight: '700', color: c.label }} />
        <FlexWidget style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: tint(c[st.tone], 0.16) }}>
          <TextWidget text={st.label} style={{ fontSize: 11, fontWeight: '700', color: c[st.tone] }} />
        </FlexWidget>
      </FlexWidget>

      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', marginTop: 8 }}>
        <OverlapWidget style={{ width: 84, height: 84 }}>
          <Ring progress={d.spentToday / d.daily} color={ringColor} track={c.tertiaryFill} />
          <FlexWidget style={{ width: 84, height: 84, justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
            <TextWidget text={`${Math.round((d.spentToday / d.daily) * 100)}%`} style={{ fontSize: 16, fontWeight: '800', color: c.label }} />
            <TextWidget text="of today" style={{ fontSize: 9, color: c.secondaryLabel }} />
          </FlexWidget>
        </OverlapWidget>
        <FlexWidget style={{ flex: 1, flexDirection: 'column', marginLeft: 12 }}>
          <TextWidget text={over ? 'Over today by' : 'Left today'} style={{ fontSize: 11, color: c.secondaryLabel }} />
          <TextWidget
            text={money(Math.abs(left))}
            maxLines={1}
            style={{ adjustsFontSizeToFit: true, fontSize: 22, fontWeight: '800', color: over ? c.red : c.label }}
          />
          <TextWidget text={`Spent ${money(d.spentToday)} of ${money(d.daily)}`} maxLines={1} style={{ fontSize: 11, color: c.secondaryLabel }} />
        </FlexWidget>
      </FlexWidget>

      {!compact ? row('This week', d.week.spent, d.week.limit) : null}
      {!compact ? row('This month', d.month.spent, d.month.limit) : null}

      {height >= 200 ? (
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', marginTop: 10 }}>
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget
              text={`~${money(d.projectedMonthEnd)} by month end · ${d.daysLeft} day${d.daysLeft === 1 ? '' : 's'} left`}
              maxLines={1}
              truncate="END"
              style={{ fontSize: 11, color: c.secondaryLabel }}
            />
          </FlexWidget>
          <Pill small label="+ Expense" color={c.red} clickAction="OPEN_URI" data={{ uri: 'anchor://money?action=add-expense' }} />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
