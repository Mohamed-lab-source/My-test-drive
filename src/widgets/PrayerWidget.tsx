"use no memo";
import * as React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { widgetColors } from './theme';
import { tint } from './ui';
import type { Prayer, PrayerLog } from '../db/types';
import { PRAYERS } from '../db/types';

const NAMES: Record<Prayer, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

export interface PrayerWidgetData {
  logs: PrayerLog[];
  streak: number;
  nextPrayer?: string | null;
  // Each prayer's time today ("3:12 PM"), when a city is set.
  times?: Partial<Record<Prayer, string>> | null;
  // The prayer whose time it is now, and the one coming up.
  current?: Prayer | null;
  next?: Prayer | null;
  hijri?: string | null;
}

export function buildPrayerWidget(
  { logs, streak, nextPrayer, times, current, next, hijri }: PrayerWidgetData,
  scheme: 'light' | 'dark' = 'light'
) {
  const c = widgetColors(scheme);
  const isDone = (p: Prayer) => logs.some((l) => l.prayer === p && l.completed === 1);
  const doneCount = PRAYERS.filter(isDone).length;
  const pending = current && !isDone(current) ? current : null;

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'anchor://life' }}
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
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}>
        <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
          <TextWidget
            text={pending ? `${NAMES[pending]} — tap to mark it` : nextPrayer ? `Next: ${nextPrayer}` : 'Prayers'}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 14, fontWeight: '700', color: pending ? c.orange : c.label }}
          />
          <TextWidget
            text={[hijri, `${doneCount}/5 today`].filter(Boolean).join(' · ')}
            maxLines={1}
            style={{ fontSize: 11, color: c.secondaryLabel, marginTop: 1 }}
          />
        </FlexWidget>
        {streak > 0 ? <TextWidget text={`🔥 ${streak}`} style={{ fontSize: 13, fontWeight: '600', color: c.secondaryLabel }} /> : null}
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', width: 'match_parent' }}>
        {PRAYERS.map((prayer) => {
          const done = isDone(prayer);
          const isPending = prayer === pending;
          const isNext = prayer === next && !done;
          return (
            <FlexWidget
              key={prayer}
              clickAction="TOGGLE_PRAYER"
              clickActionData={{ prayer }}
              accessibilityLabel={`${NAMES[prayer]}${done ? ', done' : ''}`}
              style={{ flexDirection: 'column', alignItems: 'center' }}
            >
              <FlexWidget
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: done ? c.teal : isPending ? tint(c.orange, 0.16) : c.tertiaryFill,
                  borderWidth: isPending || isNext ? 2 : 0,
                  borderColor: isPending ? c.orange : c.teal,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <TextWidget
                  text={done ? '✓' : NAMES[prayer][0]}
                  style={{ fontSize: 14, fontWeight: '800', color: done ? '#FFFFFF' : isPending ? c.orange : c.secondaryLabel }}
                />
              </FlexWidget>
              {times?.[prayer] ? (
                <TextWidget
                  text={times[prayer]!}
                  style={{ fontSize: 9, fontWeight: isNext || isPending ? '700' : '400', color: isNext || isPending ? c.label : c.secondaryLabel, marginTop: 3 }}
                />
              ) : null}
            </FlexWidget>
          );
        })}
      </FlexWidget>
    </FlexWidget>
  );
}
