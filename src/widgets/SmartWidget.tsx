"use no memo";
import * as React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { widgetColors } from './theme';
import { Badge, Pill, tint } from './ui';
import type { SmartCard, SmartTone } from './smartEngine';

export interface SmartWidgetData {
  cards: SmartCard[];
  greeting: string;
  dateLine: string;
}

// Like iOS's Smart Stack: the one thing that matters most right now, big,
// with a one-tap action, and the next few underneath when there's room.
export function buildSmartWidget({ cards, greeting, dateLine }: SmartWidgetData, scheme: 'light' | 'dark', height = 180) {
  const c = widgetColors(scheme);
  const tone = (t: SmartTone) => c[t];
  // White text on light teal is hard to read, so teal cards get blue buttons.
  const button = (t: SmartTone) => (t === 'teal' ? c.blue : c[t]);
  const [hero, ...rest] = cards;
  const extra = rest.slice(0, Math.max(0, Math.min(3, Math.floor((height - 150) / 40))));

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
        clickActionData={{ uri: 'anchor://' }}
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent', marginBottom: 8 }}
      >
        <TextWidget text={greeting} style={{ fontSize: 14, fontWeight: '700', color: c.label }} />
        <TextWidget text={dateLine} maxLines={1} truncate="END" style={{ fontSize: 11, color: c.secondaryLabel, marginLeft: 8 }} />
      </FlexWidget>

      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: hero.uri }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: 'match_parent',
          borderRadius: 16,
          padding: 12,
          backgroundGradient: { from: tint(tone(hero.tone), 0.2), to: tint(tone(hero.tone), 0.07), orientation: 'TL_BR' },
        }}
      >
        <Badge emoji={hero.emoji} color={tone(hero.tone)} size={40} />
        <FlexWidget style={{ flex: 1, flexDirection: 'column', marginLeft: 10 }}>
          <TextWidget text={hero.title} maxLines={2} truncate="END" style={{ fontSize: 16, fontWeight: '700', color: c.label }} />
          <TextWidget text={hero.detail} maxLines={2} truncate="END" style={{ fontSize: 12, color: c.secondaryLabel, marginTop: 2 }} />
        </FlexWidget>
        {hero.action ? <Pill label={hero.action.label} color={button(hero.tone)} clickAction={hero.action.clickAction} data={hero.action.data} /> : null}
      </FlexWidget>

      {extra.map((card) => (
        <FlexWidget
          key={card.id}
          clickAction="OPEN_URI"
          clickActionData={{ uri: card.uri }}
          style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', marginTop: 8, paddingHorizontal: 4 }}
        >
          <Badge emoji={card.emoji} color={tone(card.tone)} size={28} />
          <FlexWidget style={{ flex: 1, flexDirection: 'column', marginLeft: 8 }}>
            <TextWidget text={card.title} maxLines={1} truncate="END" style={{ fontSize: 13, fontWeight: '600', color: c.label }} />
            <TextWidget text={card.detail} maxLines={1} truncate="END" style={{ fontSize: 11, color: c.secondaryLabel }} />
          </FlexWidget>
          {card.action ? <Pill small label={card.action.label} color={button(card.tone)} clickAction={card.action.clickAction} data={card.action.data} /> : null}
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}
