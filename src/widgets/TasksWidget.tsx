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
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: c.secondarySystemGroupedBackground,
        borderRadius: 20,
        padding: 16,
        flexDirection: 'column',
      }}
    >
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'anchor://tasks' }}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: 'match_parent',
          marginBottom: 8,
        }}
      >
        <TextWidget text="Today" style={{ fontSize: 15, fontWeight: '600', color: c.label }} />
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'anchor://tasks?action=add' }}
          accessibilityLabel="Add task"
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: c.blue,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TextWidget text="+" style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }} />
        </FlexWidget>
      </FlexWidget>
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
                clickAction="TOGGLE_TASK"
                clickActionData={{ taskId: t.id }}
                accessibilityLabel={`Mark "${t.title}" done`}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  borderWidth: 1.5,
                  borderColor: c.gray3,
                  marginRight: 8,
                }}
              />
              <FlexWidget style={{ flex: 1 }} clickAction="OPEN_URI" clickActionData={{ uri: 'anchor://tasks' }}>
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
