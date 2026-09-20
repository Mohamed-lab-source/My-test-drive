"use no memo";
import * as React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { widgetColors } from './theme';
import type { Task } from '../db/types';

export interface TasksWidgetData {
  tasks: Task[];
}

export function buildTasksWidget({ tasks }: TasksWidgetData, scheme: 'light' | 'dark' = 'light') {
  const c = widgetColors(scheme);
  const shown = tasks.slice(0, 4);
  const remaining = tasks.length - shown.length;

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'anchor://tasks' }}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: c.secondarySystemGroupedBackground,
        borderRadius: 20,
        padding: 16,
        flexDirection: 'column',
      }}
    >
      <TextWidget
        text="Today"
        style={{ fontSize: 15, fontWeight: '600', color: c.label, marginBottom: 8 }}
      />
      {shown.length === 0 ? (
        <TextWidget
          text="Nothing scheduled today"
          style={{ fontSize: 13, color: c.secondaryLabel }}
        />
      ) : (
        <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
          {shown.map((t) => (
            <FlexWidget
              key={t.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 4,
                width: 'match_parent',
              }}
            >
              <FlexWidget
                style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.gray3, marginRight: 8 }}
              />
              <FlexWidget style={{ flex: 1 }}>
                <TextWidget
                  text={t.title}
                  truncate="END"
                  maxLines={1}
                  style={{ fontSize: 13, color: c.label, width: 'match_parent' }}
                />
              </FlexWidget>
            </FlexWidget>
          ))}
        </FlexWidget>
      )}
      {remaining > 0 ? (
        <TextWidget
          text={`+${remaining} more`}
          style={{ fontSize: 12, color: c.blue, marginTop: 4 }}
        />
      ) : null}
    </FlexWidget>
  );
}
