"use no memo";
import * as React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { widgetColors } from './theme';
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
}

export function buildMoneyWidget(
  { netWorthMinor, currency, nextBill }: MoneyWidgetData,
  scheme: 'light' | 'dark' = 'light'
) {
  const c = widgetColors(scheme);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: c.secondarySystemGroupedBackground,
        borderRadius: 20,
        padding: 16,
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
        </FlexWidget>
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
