"use no memo";
import * as React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { ColorProp } from 'react-native-android-widget';
import { widgetColors } from './theme';
import { Bar, tint } from './ui';

export interface TasksWidgetTask {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  overdue: boolean;
  // "5:30 PM" when it has a reminder today.
  time: string | null;
  deadlineToday: boolean;
}

export interface TasksWidgetData {
  // Open tasks for today and overdue ones, most important first.
  tasks: TasksWidgetTask[];
  doneToday: number;
  tomorrow: string[];
}

// Today's list, sorted so what matters is on top: overdue and due-today
// first, then by priority and reminder time. When everything's done it
// shows a little celebration and a peek at tomorrow.
export function buildTasksWidget({ tasks, doneToday, tomorrow }: TasksWidgetData, scheme: 'light' | 'dark' = 'light', height = 180) {
  const c = widgetColors(scheme);
  const rows = Math.max(1, Math.floor((height - 84) / 28));
  const shown = tasks.slice(0, rows);
  const remaining = tasks.length - shown.length;
  const total = tasks.length + doneToday;
  const ring = (t: TasksWidgetTask): ColorProp => (t.overdue ? c.red : t.priority === 'high' ? c.orange : t.priority === 'medium' ? c.blue : c.gray3);

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
        clickActionData={{ uri: 'anchor://tasks' }}
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}
      >
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget text="Today" style={{ fontSize: 15, fontWeight: '700', color: c.label }} />
          {total > 0 ? (
            <TextWidget text={`  ${doneToday}/${total}`} style={{ fontSize: 13, fontWeight: '600', color: c.secondaryLabel }} />
          ) : null}
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'anchor://tasks?action=add' }}
          accessibilityLabel="Add task"
          style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.blue, justifyContent: 'center', alignItems: 'center' }}
        >
          <TextWidget text="+" style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF' }} />
        </FlexWidget>
      </FlexWidget>
      {total > 0 ? (
        <FlexWidget style={{ width: 'match_parent', marginTop: 6, marginBottom: 6 }}>
          <Bar progress={doneToday / total} color={tasks.length ? c.blue : c.green} track={c.tertiaryFill} height={4} />
        </FlexWidget>
      ) : null}

      {shown.length === 0 ? (
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'anchor://tasks' }}
          style={{ flex: 1, flexDirection: 'column', justifyContent: 'center', width: 'match_parent' }}
        >
          <TextWidget
            text={doneToday ? '🎉 All done for today' : 'Nothing scheduled today'}
            style={{ fontSize: 14, fontWeight: '600', color: doneToday ? c.green : c.secondaryLabel }}
          />
          {tomorrow.length ? (
            <TextWidget
              text={`Tomorrow: ${tomorrow.slice(0, 2).join(', ')}${tomorrow.length > 2 ? ` +${tomorrow.length - 2}` : ''}`}
              maxLines={2}
              truncate="END"
              style={{ fontSize: 12, color: c.secondaryLabel, marginTop: 4 }}
            />
          ) : null}
        </FlexWidget>
      ) : (
        <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
          {shown.map((t) => (
            <FlexWidget key={t.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, width: 'match_parent' }}>
              <FlexWidget
                clickAction="TOGGLE_TASK"
                clickActionData={{ taskId: t.id }}
                accessibilityLabel={`Mark "${t.title}" done`}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: ring(t),
                  backgroundColor: tint(ring(t), 0.08),
                  marginRight: 8,
                }}
              />
              <FlexWidget style={{ flex: 1 }} clickAction="OPEN_URI" clickActionData={{ uri: 'anchor://tasks' }}>
                <TextWidget text={t.title} truncate="END" maxLines={1} style={{ fontSize: 13, color: c.label }} />
              </FlexWidget>
              {t.overdue || t.deadlineToday || t.time ? (
                <TextWidget
                  text={t.overdue ? 'Overdue' : t.deadlineToday ? 'Due today' : t.time!}
                  style={{ fontSize: 11, fontWeight: '600', color: t.overdue ? c.red : t.deadlineToday ? c.orange : c.secondaryLabel, marginLeft: 6 }}
                />
              ) : null}
            </FlexWidget>
          ))}
        </FlexWidget>
      )}
      {remaining > 0 ? (
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'anchor://tasks' }}>
          <TextWidget text={`+${remaining} more`} style={{ fontSize: 12, color: c.blue, marginTop: 2 }} />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
