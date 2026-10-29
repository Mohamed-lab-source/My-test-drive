"use no memo";
import * as React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { ColorProp } from 'react-native-android-widget';
import { widgetColors } from './theme';
import { Bar, Pill, tint } from './ui';

export interface LifeWidgetData {
  habits: { id: string; name: string; done: boolean; color: string; streak: number }[];
  water: { count: number; goal: number };
}

// Today's habits as tap-to-tick chips and a glass-by-glass water row.
export function buildLifeWidget({ habits, water }: LifeWidgetData, scheme: 'light' | 'dark', height = 180) {
  const c = widgetColors(scheme);
  const done = habits.filter((h) => h.done).length;
  const rows = Math.max(1, Math.floor((height - 112) / 34));
  // Unfinished first, so what's left is always visible.
  const shown = [...habits].sort((a, b) => Number(a.done) - Number(b.done)).slice(0, rows * 2);
  const pairs: (typeof shown)[] = [];
  for (let i = 0; i < shown.length; i += 2) pairs.push(shown.slice(i, i + 2));
  const glasses = Math.min(water.goal, 10);

  const chip = (h: LifeWidgetData['habits'][number]) => (
    <FlexWidget
      key={h.id}
      clickAction="TOGGLE_HABIT"
      clickActionData={{ habitId: h.id }}
      accessibilityLabel={`${h.name}${h.done ? ', done' : ''}`}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 12,
        marginRight: 6,
        backgroundColor: h.done ? tint(h.color, 0.16) : c.tertiaryFill,
      }}
    >
      <FlexWidget
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: h.done ? 0 : 1.5,
          borderColor: h.color as ColorProp,
          backgroundColor: h.done ? (h.color as ColorProp) : tint(h.color, 0),
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {h.done ? <TextWidget text="✓" style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }} /> : null}
      </FlexWidget>
      <FlexWidget style={{ flex: 1, marginLeft: 6 }}>
        <TextWidget text={h.name} maxLines={1} truncate="END" style={{ fontSize: 12, fontWeight: '600', color: h.done ? c.secondaryLabel : c.label }} />
      </FlexWidget>
      {h.streak >= 2 ? <TextWidget text={`🔥${h.streak}`} style={{ fontSize: 10, color: c.secondaryLabel }} /> : null}
    </FlexWidget>
  );

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: c.secondarySystemGroupedBackground,
        borderRadius: 22,
        padding: 14,
        flexDirection: 'column',
      }}
    >
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'anchor://life/habits' }}
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}
      >
        <TextWidget text="🌱 Habits" style={{ fontSize: 14, fontWeight: '700', color: c.label }} />
        <TextWidget
          text={habits.length ? (done === habits.length ? 'All done ✨' : `${done} of ${habits.length}`) : ''}
          style={{ fontSize: 12, fontWeight: '600', color: done === habits.length && habits.length ? c.green : c.secondaryLabel }}
        />
      </FlexWidget>
      {habits.length ? (
        <FlexWidget style={{ width: 'match_parent', marginTop: 6 }}>
          <Bar progress={done / habits.length} color={c.green} track={c.tertiaryFill} height={4} />
        </FlexWidget>
      ) : null}

      <FlexWidget style={{ flex: 1, flexDirection: 'column', width: 'match_parent', marginTop: 8 }}>
        {habits.length === 0 ? (
          <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'anchor://life/habits' }}>
            <TextWidget text="Add a habit to tick it off from here ›" style={{ fontSize: 12, color: c.blue }} />
          </FlexWidget>
        ) : (
          pairs.map((pair, i) => (
            <FlexWidget key={i} style={{ flexDirection: 'row', width: 'match_parent', marginBottom: 6 }}>
              {chip(pair[0])}
              {pair[1] ? chip(pair[1]) : <FlexWidget style={{ flex: 1, marginRight: 6 }} />}
            </FlexWidget>
          ))
        )}
      </FlexWidget>

      {water.goal > 0 ? (
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }}>
          <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'anchor://life/health' }} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <TextWidget text={`💧 ${water.count}/${water.goal}`} style={{ fontSize: 12, fontWeight: '700', color: c.label, marginRight: 8 }} />
            {Array.from({ length: glasses }, (_, i) => (
              <FlexWidget
                key={i}
                style={{
                  width: 9,
                  height: 12,
                  borderRadius: 3,
                  marginRight: 3,
                  backgroundColor: i < water.count ? c.blue : c.tertiaryFill,
                }}
              />
            ))}
          </FlexWidget>
          <Pill small label="+1 glass" color={c.blue} clickAction="WATER_ADD" />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
