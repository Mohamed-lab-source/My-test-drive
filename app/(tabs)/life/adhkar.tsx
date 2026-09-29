import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { Icon } from '../../../src/ui/Icon';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { SegmentedControl } from '../../../src/ui/SegmentedControl';
import { adhkarFor } from '../../../src/content/adhkar';
import * as repo from '../../../src/db/repositories/life';
import { todayKey } from '../../../src/db/client';
import type { AdhkarSession } from '../../../src/db/types';

const SESSIONS: AdhkarSession[] = ['morning', 'evening'];

export default function AdhkarScreen() {
  const { colors, typography, spacing } = useTheme();
  // Evening adhkar are said from Asr onward; mid-afternoon is a fair default.
  const [sessionIndex, setSessionIndex] = useState(new Date().getHours() >= 15 ? 1 : 0);
  const session = SESSIONS[sessionIndex];
  const [done, setDone] = useState<string[]>([]);
  const items = adhkarFor(session);
  const date = todayKey();

  const load = useCallback(() => repo.getAdhkarDone(date, session).then(setDone), [date, session]);
  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = done.includes(id) ? done.filter((d) => d !== id) : [...done, id];
    setDone(next);
    await repo.setAdhkarDone(date, session, next);
    if (next.length === items.length && done.length < items.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const completed = items.filter((i) => done.includes(i.id)).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Adhkar" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={{ marginBottom: spacing.md }}>
          <SegmentedControl options={['Morning', 'Evening']} selectedIndex={sessionIndex} onChange={setSessionIndex} />
        </View>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.xs }]}>
            {completed === items.length ? 'All done — may Allah accept it' : `${completed} of ${items.length} done`}
          </Text>
          <ProgressBar progress={completed / items.length} color={colors.green} />
        </Card>
        <Card padded={false}>
          {items.map((item, i) => {
            const isDone = done.includes(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => toggle(item.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  padding: spacing.md,
                  borderBottomWidth: i === items.length - 1 ? 0 : 0.5,
                  borderBottomColor: colors.separator,
                }}
              >
                <View style={{ marginTop: 2, marginRight: spacing.sm }}>
                  <Icon name={isDone ? 'checkmark.circle.fill' : 'circle'} size={24} color={isDone ? colors.green : colors.gray3} />
                </View>
                <View style={{ flex: 1 }}>
                  {item.arabic ? (
                    <Text
                      style={{
                        fontSize: 20,
                        lineHeight: 34,
                        textAlign: 'right',
                        writingDirection: 'rtl',
                        color: isDone ? colors.secondaryLabel : colors.label,
                        marginBottom: 4,
                      }}
                    >
                      {item.arabic}
                    </Text>
                  ) : null}
                  <Text style={[item.arabic ? typography.footnote : typography.body, { color: colors.secondaryLabel }]}>
                    {item.text}
                  </Text>
                </View>
                <View
                  style={{
                    marginLeft: spacing.sm,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 10,
                    backgroundColor: colors.tertiaryFill,
                  }}
                >
                  <Text style={[typography.caption1, { color: colors.label, fontWeight: '600' }]}>×{item.count}</Text>
                </View>
              </Pressable>
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}
