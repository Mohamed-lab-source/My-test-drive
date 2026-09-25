"use no memo";
import * as React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { widgetColors } from './theme';
import type { Prayer, PrayerLog } from '../db/types';
import { PRAYERS } from '../db/types';

const INITIALS: Record<Prayer, string> = {
  fajr: 'F',
  dhuhr: 'D',
  asr: 'A',
  maghrib: 'M',
  isha: 'I',
};

export interface PrayerWidgetData {
  logs: PrayerLog[];
  streak: number;
}

export function buildPrayerWidget(
  { logs, streak }: PrayerWidgetData,
  scheme: 'light' | 'dark' = 'light'
) {
  const c = widgetColors(scheme);
  const isDone = (p: Prayer) => logs.some((l) => l.prayer === p && l.completed === 1);

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'anchor://life' }}
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
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: 'match_parent',
        }}
      >
        <TextWidget text="Prayers" style={{ fontSize: 15, fontWeight: '600', color: c.label }} />
        {streak > 0 ? (
          <TextWidget text={`🔥 ${streak}`} style={{ fontSize: 13, color: c.secondaryLabel }} />
        ) : null}
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', width: 'match_parent' }}>
        {PRAYERS.map((prayer) => {
          const done = isDone(prayer);
          return (
            <FlexWidget
              key={prayer}
              clickAction="TOGGLE_PRAYER"
              clickActionData={{ prayer }}
              accessibilityLabel={`${prayer}${done ? ', done' : ''}`}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: done ? c.blue : c.fill,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <TextWidget
                text={INITIALS[prayer]}
                style={{ fontSize: 14, fontWeight: '700', color: done ? '#FFFFFF' : c.secondaryLabel }}
              />
            </FlexWidget>
          );
        })}
      </FlexWidget>
    </FlexWidget>
  );
}
