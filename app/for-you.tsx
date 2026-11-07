import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { NavHeader } from '../src/ui/NavHeader';
import { useTheme } from '../src/theme/ThemeProvider';
import { Card } from '../src/ui/Card';
import { ActionMenu } from '../src/ui/ActionMenu';
import { Icon } from '../src/ui/Icon';
import { useSettingsStore } from '../src/store/settingsStore';
import { useFinanceStore } from '../src/store/financeStore';
import { useBudgetStatuses } from '../src/features/money/budgets';
import { budgetName } from '../src/features/money/budgetCore';
import { useForYou } from '../src/features/foryou/useForYou';
import { NudgeRow } from '../src/features/foryou/NudgeRow';
import { NUDGE_KINDS, type Nudge, type NudgeKind } from '../src/features/foryou/engine';

const TOOLS: { label: string; emoji: string; route: string }[] = [
  { label: 'Payday checklist', emoji: '💰', route: '/money/payday' },
  { label: "Gam'eya", emoji: '🤝', route: '/money/gameya' },
  { label: 'Gifts & nokta', emoji: '🎁', route: '/life/gifts' },
  { label: 'Eidiya', emoji: '🌙', route: '/life/eidiya' },
  { label: 'Calculators', emoji: '🧮', route: '/money/tools' },
];

// Everything worth your attention right now, from your own data.
export default function ForYouScreen() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const statuses = useBudgetStatuses();
  const { budgets, categories } = useFinanceStore(useShallow((s) => ({ budgets: s.budgets, categories: s.categories })));
  const names = useMemo(() => Object.fromEntries(budgets.map((b) => [b.id, budgetName(b, categories)])), [budgets, categories]);
  const { nudges } = useForYou(statuses, names);
  const { muted, setNudgeMuted, dismissNudge } = useSettingsStore(useShallow((s) => ({ muted: s.forYouMuted, setNudgeMuted: s.setNudgeMuted, dismissNudge: s.dismissNudge })));
  const [menuFor, setMenuFor] = useState<Nudge | null>(null);

  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const urgent = nudges.filter((n) => n.priority >= 60);
  const rest = nudges.filter((n) => n.priority < 60);

  const section = (title: string, list: Nudge[]) =>
    list.length ? (
      <>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'uppercase', marginBottom: 4, marginTop: spacing.sm }]}>{title}</Text>
        <Card style={{ marginBottom: spacing.md, paddingVertical: 4 }}>
          {list.map((n, k) => (
            <NudgeRow key={n.id} nudge={n} onMenu={() => setMenuFor(n)} isLast={k === list.length - 1} />
          ))}
        </Card>
      </>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="For you" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Text style={[typography.title2, { color: colors.label }]}>{hello} ✨</Text>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2, marginBottom: spacing.sm }]}>
          Picked from your money, cards, prayers, habits and plans, and updated through the day. Long-press one to hide it.
        </Text>

        {nudges.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.md }}>
            <Text style={{ fontSize: 34 }}>🌿</Text>
            <Text style={[typography.headline, { color: colors.label, marginTop: 6 }]}>All clear</Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, textAlign: 'center', marginTop: 2 }]}>Nothing needs you right now. Alhamdulillah.</Text>
          </Card>
        ) : (
          <>
            {section('Now', urgent)}
            {section(urgent.length ? 'Also for you' : 'For you', rest)}
          </>
        )}

        <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'uppercase', marginBottom: 4, marginTop: spacing.sm }]}>Your tools</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginBottom: spacing.md }}>
          {TOOLS.map((t) => (
            <Pressable key={t.route} onPress={() => router.push(t.route as never)} style={{ width: '50%', padding: 4 }} accessibilityRole="button">
              <Card style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
                <Text style={{ fontSize: 20 }}>{t.emoji}</Text>
                <Text style={[typography.subhead, { color: colors.label, fontWeight: '600', marginLeft: 8, flex: 1 }]} numberOfLines={1}>
                  {t.label}
                </Text>
              </Card>
            </Pressable>
          ))}
        </View>

        {muted.length ? (
          <>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'uppercase', marginBottom: 4 }]}>Turned off</Text>
            <Card style={{ paddingVertical: 4 }}>
              {muted.map((k, idx) => (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: idx === muted.length - 1 ? 0 : 0.5, borderBottomColor: colors.separator }}>
                  <Text style={[typography.body, { color: colors.label, flex: 1 }]}>{NUDGE_KINDS[k as NudgeKind] ?? k}</Text>
                  <Pressable onPress={() => setNudgeMuted(k, false)} hitSlop={8} accessibilityRole="button">
                    <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Turn on</Text>
                  </Pressable>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>

      <ActionMenu
        visible={!!menuFor}
        title={menuFor?.title}
        onClose={() => setMenuFor(null)}
        actions={
          menuFor
            ? [
                ...(menuFor.route ? [{ label: 'Open', icon: 'chevron.right', onPress: () => router.push(menuFor.route as never) }] : []),
                { label: 'Done for today', icon: 'checkmark.circle.fill', onPress: () => dismissNudge(menuFor.id), section: !!menuFor.route },
                { label: `Stop showing “${NUDGE_KINDS[menuFor.kind]}”`, icon: 'xmark', destructive: true, onPress: () => setNudgeMuted(menuFor.kind, true) },
              ]
            : []
        }
      />
    </View>
  );
}
