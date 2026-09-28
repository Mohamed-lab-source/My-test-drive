import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { useSettingsStore } from '../../store/settingsStore';
import { useFinanceStore } from '../../store/financeStore';
import { useProductivityStore } from '../../store/productivityStore';

// A short setup checklist for new accounts. Hides itself once every step is
// done, or for good when dismissed.
export function GettingStartedCard() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { prayerCityId, notificationsEnabled, gettingStartedDismissed, setGettingStartedDismissed } = useSettingsStore();
  const { accounts, transactions, budgets } = useFinanceStore();
  const tasks = useProductivityStore((s) => s.tasks);

  const steps: { label: string; done: boolean; href: Href }[] = [
    { label: 'Add an account', done: accounts.length > 0, href: '/money/accounts' },
    { label: 'Log your first transaction', done: transactions.length > 0, href: '/money/transactions' },
    { label: 'Set a monthly budget', done: budgets.length > 0, href: '/money/budgets' },
    { label: 'Add a task', done: tasks.length > 0, href: '/tasks' },
    { label: 'Choose your prayer city', done: !!prayerCityId, href: '/settings' },
    { label: 'Turn on reminders', done: notificationsEnabled, href: '/settings' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (gettingStartedDismissed || doneCount === steps.length) return null;

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
        <Icon name="checklist" size={18} color={colors.blue} />
        <Text style={[typography.headline, { color: colors.label, marginLeft: spacing.xs, flex: 1 }]}>
          Getting started · {doneCount}/{steps.length}
        </Text>
        <Pressable onPress={() => setGettingStartedDismissed(true)} hitSlop={10}>
          <Icon name="xmark" size={18} color={colors.tertiaryLabel} />
        </Pressable>
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.tertiaryFill, marginBottom: spacing.xs }}>
        <View style={{ height: 4, borderRadius: 2, width: `${(doneCount / steps.length) * 100}%`, backgroundColor: colors.blue }} />
      </View>
      {steps.map((s) => (
        <Pressable
          key={s.label}
          disabled={s.done}
          onPress={() => router.push(s.href)}
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}
        >
          <Icon name={s.done ? 'checkmark.circle.fill' : 'circle'} size={20} color={s.done ? colors.green : colors.tertiaryLabel} />
          <Text
            style={[
              typography.body,
              {
                flex: 1,
                marginLeft: spacing.sm,
                color: s.done ? colors.secondaryLabel : colors.label,
                textDecorationLine: s.done ? 'line-through' : 'none',
              },
            ]}
          >
            {s.label}
          </Text>
          {!s.done ? <Icon name="chevron.right" size={14} color={colors.tertiaryLabel} /> : null}
        </Pressable>
      ))}
    </Card>
  );
}
