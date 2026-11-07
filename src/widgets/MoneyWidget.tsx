"use no memo";
import * as React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { widgetColors } from './theme';
import { Bar } from './ui';
import { formatMoney } from '../utils/money';

export interface MoneyWidgetBill {
  ruleId: string;
  name: string;
  amountMinor: number;
  currency: string;
  dueLabel: string;
}

export interface MoneyWidgetData {
  netWorthMinor: number;
  currency: string;
  nextBill: MoneyWidgetBill | null;
  // Change since the start of the month, and daily net-worth points.
  monthChange?: number | null;
  history?: number[];
  // Day-to-day spending today against the plan's daily limit.
  spentToday?: number;
  dailyLimit?: number;
}

// A smooth-ish sparkline as an SVG polyline.
function sparkSvg(points: number[], color: string, w = 88, h = 30): string {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((v, i) => `${((i / (points.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<polyline points="${xy.join(' ')}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
</svg>`;
}

export function buildMoneyWidget(
  { netWorthMinor, currency, nextBill, monthChange, history = [], spentToday = 0, dailyLimit = 0 }: MoneyWidgetData,
  scheme: 'light' | 'dark' = 'light',
  height = 110
) {
  const c = widgetColors(scheme);
  const up = (monthChange ?? 0) >= 0;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: c.secondarySystemGroupedBackground,
        borderRadius: 22,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'anchor://money' }}
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}
      >
        <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
          <TextWidget text="Net worth" style={{ fontSize: 13, color: c.secondaryLabel }} />
          <TextWidget
            text={formatMoney(netWorthMinor, currency)}
            style={{ fontSize: 24, fontWeight: '700', color: c.label, marginTop: 2 }}
          />
          {monthChange ? (
            <TextWidget
              text={`${up ? '▲' : '▼'} ${formatMoney(Math.abs(monthChange), currency)} this month`}
              maxLines={1}
              style={{ fontSize: 11, fontWeight: '600', color: up ? c.green : c.red }}
            />
          ) : null}
        </FlexWidget>
        {history.length >= 3 ? (
          <SvgWidget svg={sparkSvg(history, up ? c.green : c.red)} style={{ width: 88, height: 30, marginRight: 10, marginLeft: 6 }} />
        ) : null}
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'anchor://money?action=add-expense' }}
          accessibilityLabel="Add expense"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: c.red,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TextWidget text="+" style={{ fontSize: 20, fontWeight: '700', color: '#FFFFFF' }} />
        </FlexWidget>
      </FlexWidget>
      {dailyLimit > 0 && height >= 140 ? (
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'anchor://money/plan' }} style={{ flexDirection: 'column', width: 'match_parent' }}>
          <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', width: 'match_parent', marginBottom: 3 }}>
            <TextWidget text="Today" style={{ fontSize: 11, color: c.secondaryLabel }} />
            <TextWidget
              text={
                spentToday > dailyLimit
                  ? `${formatMoney(spentToday - dailyLimit, currency)} over`
                  : `${formatMoney(dailyLimit - spentToday, currency)} left of ${formatMoney(dailyLimit, currency)}`
              }
              style={{ fontSize: 11, fontWeight: '600', color: spentToday > dailyLimit ? c.red : c.label }}
            />
          </FlexWidget>
          <Bar progress={spentToday / dailyLimit} color={spentToday > dailyLimit ? c.red : spentToday / dailyLimit >= 0.8 ? c.orange : c.green} track={c.tertiaryFill} height={5} />
        </FlexWidget>
      ) : null}
      {nextBill ? (
        <FlexWidget
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: 'match_parent',
          }}
        >
          <FlexWidget
            clickAction="OPEN_URI"
            clickActionData={{ uri: 'anchor://money/subscriptions' }}
            style={{ flex: 1 }}
          >
            <TextWidget
              text={`${nextBill.name} · ${nextBill.dueLabel} · ${formatMoney(nextBill.amountMinor, nextBill.currency)}`}
              truncate="END"
              maxLines={1}
              style={{ fontSize: 12, color: c.secondaryLabel, width: 'match_parent' }}
            />
          </FlexWidget>
          <FlexWidget
            clickAction="PAY_BILL"
            clickActionData={{ ruleId: nextBill.ruleId }}
            accessibilityLabel={`Pay ${nextBill.name} now`}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
              backgroundColor: c.blue,
              marginLeft: 8,
            }}
          >
            <TextWidget text="Pay" style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }} />
          </FlexWidget>
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
