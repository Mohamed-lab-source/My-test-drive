import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Text, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { useFinanceStore } from '../../store/financeStore';
import { useSettingsStore } from '../../store/settingsStore';
import { convertToBase } from '../../db/repositories/fx';
import { formatMoney } from '../../utils/money';
import * as I from '../../utils/moneyInsights';

// One money insight a day, rotating through whichever ones have data.
export function InsightOfDayCard() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { transactions, fxRates, categories } = useFinanceStore(useShallow((s) => ({ transactions: s.transactions, fxRates: s.fxRates, categories: s.categories })));
  const currency = useSettingsStore((s) => s.currency);

  const [shift, setShift] = useState(0);
  const all = useMemo(() => {
    const now = new Date();
    const sp = I.toSpends(transactions, (a, c) => convertToBase(a, c, currency, fxRates));
    if (sp.length < 5) return [];
    const m = I.monthKeyOf(now);
    const pm = I.monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const money = (n: number) => formatMoney(Math.round(n), currency);
    const out: string[] = [];
    const rides = I.groupStats(sp, I.RIDE_HAILING, m, pm);
    if (rides.count) out.push(`🚗 ${rides.count} rides this month cost ${money(rides.total)} — about ${money(rides.avg)} each.`);
    const delivery = I.groupStats(sp, I.FOOD_DELIVERY, m, pm);
    if (delivery.count) out.push(`🛵 ${delivery.count} delivery orders this month: ${money(delivery.total)}.`);
    const ns = I.noSpendStreaks(sp, now);
    if (ns.thisMonth) out.push(`🌱 ${ns.thisMonth} no-spend day${ns.thisMonth === 1 ? '' : 's'} so far this month.`);
    const small = I.smallPurchases(sp, m);
    if (small.count >= 3) out.push(`☕ ${small.count} small purchases this month add up to ${money(small.total)}.`);
    const shift = I.categoryShifts(sp, m, pm, now.getDate(), new Date(now.getFullYear(), now.getMonth(), 0).getDate());
    if (shift.up && shift.up.before > 0) {
      const name = categories.find((c) => c.id === shift.up!.categoryId)?.name ?? 'Uncategorised';
      out.push(`📊 ${name} is up ${money(shift.up.now - shift.up.before)} on this point last month.`);
    }
    const top = I.topMerchants(sp, `${m}-01`, 1)[0];
    if (top) out.push(`🏆 Your top place this month is ${top.name}: ${money(top.total)} over ${top.count} visit${top.count === 1 ? '' : 's'}.`);
    const late = I.lateNight(sp, m);
    if (late.count >= 2) out.push(`🌙 ${late.count} late-night purchases this month (${money(late.total)}).`);
    return out;
  }, [transactions, fxRates, currency, categories]);

  if (!all || !all.length) return null;
  // Today's pick first; tapping the card steps through the others.
  const day = Math.floor(Date.now() / 86400000);
  const text = all[(day + shift) % all.length];
  return (
    <Pressable onPress={() => setShift((n) => n + 1)} style={{ marginBottom: spacing.md }}>
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
            Insight of the day{all.length > 1 ? ` · ${((day + shift) % all.length) + 1}/${all.length}, tap for another` : ''}
          </Text>
          <Text style={[typography.subhead, { color: colors.label, marginTop: 2 }]}>{text}</Text>
        </View>
        <Pressable onPress={() => router.push('/money/insights')} hitSlop={12}>
          <Icon name="chevron.right" size={16} color={colors.tertiaryLabel} />
        </Pressable>
      </Card>
    </Pressable>
  );
}

// "Spent today" in one line, under the quick actions.
export function SpentTodayLine() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { transactions, fxRates } = useFinanceStore(useShallow((s) => ({ transactions: s.transactions, fxRates: s.fxRates })));
  const currency = useSettingsStore((s) => s.currency);
  const today = new Date().toDateString();
  const list = transactions.filter((t) => t.type === 'expense' && new Date(t.date).toDateString() === today);
  const total = list.reduce((s, t) => s + convertToBase(t.amount, t.currency, currency, fxRates), 0);
  return (
    <Pressable onPress={() => router.push('/money/transactions')} style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.sm, marginBottom: spacing.md }}>
      <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
        {list.length ? `Spent today: ${formatMoney(total, currency)} · ${list.length} purchase${list.length === 1 ? '' : 's'}` : 'Nothing spent today 🌱'}
      </Text>
    </Pressable>
  );
}
