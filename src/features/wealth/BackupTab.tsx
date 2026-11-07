import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, Pressable, Alert } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { ProgressBar } from '../../ui/ProgressBar';
import { ChipSelector } from '../../ui/ChipSelector';
import { Switch } from '../../ui/Switch';
import { Button } from '../../ui/Button';
import { useSettingsStore } from '../../store/settingsStore';
import { useFinanceStore } from '../../store/financeStore';
import { usePersonalStore } from '../../store/personalStore';
import { useUndoStore } from '../../store/undoStore';
import { AccountSheet } from '../money/AccountSheet';
import { kindInfo } from '../../utils/wealth';
import type { useWealth } from './useWealth';

type W = ReturnType<typeof useWealth>;

// Backup money (an emergency fund): months of spending set aside, where
// it's kept, and how to fill it.
export function BackupTab({ w }: { w: W }) {
  const { colors, typography, spacing } = useTheme();
  const s = useSettingsStore(
    useShallow((x) => ({
      backupMonths: x.backupMonths,
      setBackupMonths: x.setBackupMonths,
      backupAccountIds: x.backupAccountIds,
      setBackupAccountIds: x.setBackupAccountIds,
      backupHoldingIds: x.backupHoldingIds,
      setBackupHoldingIds: x.setBackupHoldingIds,
      essentialsOnly: x.backupEssentialsOnly,
      setEssentialsOnly: x.setBackupEssentialsOnly,
    }))
  );
  const accounts = useFinanceStore((x) => x.accounts).filter((a) => !a.is_archived && a.type !== 'credit');
  const addStep = usePersonalStore((x) => x.add);
  const steps = usePersonalStore((x) => x.payday_step);
  const show = useUndoStore((x) => x.show);
  const [creating, setCreating] = useState(false);

  const b = w.backup;
  const months = Number.isFinite(b.months) ? b.months : b.targetMonths;
  const chosen = new Set(w.backupAccounts.map((a) => a.id));
  const toggleAccount = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    s.setBackupAccountIds([...next]);
  };
  const liquid = w.valued.filter((v) => v.h.liquid);
  const status =
    b.level === 'full'
      ? { text: 'Full — you’re covered. Alhamdulillah.', color: colors.green }
      : b.level === 'building'
        ? { text: 'Building — past the first month.', color: colors.orange }
        : b.level === 'starter'
          ? { text: 'Just started — aim for one month first.', color: colors.red }
          : { text: 'Not started yet.', color: colors.red };

  const addToPayday = async () => {
    if (steps.some((x) => /backup/i.test(x.title))) {
      show('Already on your payday checklist');
      return;
    }
    await addStep('payday_step', { title: 'Top up backup money', emoji: '🛟', mode: 'fixed', value: b.per12, doneFor: null, order: -1, route: '/money/wealth?tab=backup' });
    show('Added to your payday checklist');
  };

  return (
    <View>
      <Card style={{ marginBottom: spacing.md }}>
        <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Your backup would last</Text>
        <Text style={[typography.title1, { color: colors.label }]}>
          {b.monthly ? `${months >= 10 ? Math.round(months) : months.toFixed(1)} months` : '—'}
        </Text>
        <View style={{ marginVertical: spacing.xs }}>
          <ProgressBar progress={b.target ? Math.min(1, b.saved / b.target) : 0} color={status.color} />
        </View>
        <Text style={[typography.footnote, { color: status.color, fontWeight: '600' }]}>{status.text}</Text>
        <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 2 }]}>
          {w.fmt(b.saved)} saved of {w.fmt(b.target)} ({b.targetMonths} × {w.fmt(b.monthly)} a month)
        </Text>
      </Card>

      {b.gap > 0 && b.monthly > 0 ? (
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label }]}>Fill it</Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
            {w.fmt(b.per12)} a month fills it in a year — or {w.fmt(b.per6)} a month in six months.
            {w.avgSaved > 0 ? ` You save about ${w.fmt(w.avgSaved)} a month now.` : ''}
          </Text>
          <Button title="Add to my payday checklist" variant="secondary" onPress={addToPayday} style={{ marginTop: spacing.sm }} />
        </Card>
      ) : null}

      <Card style={{ marginBottom: spacing.md }}>
        <Text style={[typography.headline, { color: colors.label }]}>How many months?</Text>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs }]}>3 with a very steady job; 6 for most people; more if you have family depending on you or income that varies.</Text>
        <ChipSelector options={[3, 6, 9, 12].map((m) => ({ id: String(m), label: `${m} months` }))} selectedId={String(s.backupMonths)} onSelect={(id) => s.setBackupMonths(Number(id))} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.body, { color: colors.label }]}>Only essentials</Text>
            <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
              Size it on groceries, bills, rent, transport and health ({w.fmt(w.essentials)}) instead of all spending ({w.fmt(w.avgSpend)}).
            </Text>
          </View>
          <Switch value={s.essentialsOnly} onValueChange={s.setEssentialsOnly} />
        </View>
      </Card>

      <Card style={{ marginBottom: spacing.md }}>
        <Text style={[typography.headline, { color: colors.label }]}>Where it’s kept</Text>
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs }]}>
          Choose the accounts that are your backup{s.backupAccountIds ? '' : ' (your savings accounts for now)'}.
        </Text>
        {accounts.map((a) => (
          <Pressable key={a.id} onPress={() => toggleAccount(a.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }} accessibilityRole="checkbox" accessibilityState={{ checked: chosen.has(a.id) }}>
            <Text style={{ fontSize: 18, width: 30 }}>{chosen.has(a.id) ? '✅' : '⬜️'}</Text>
            <Text style={[typography.body, { color: colors.label, flex: 1 }]} numberOfLines={1}>
              {a.name}
            </Text>
            <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>{w.fmt(w.toBase(a.balance, a.currency))}</Text>
          </Pressable>
        ))}
        {liquid.map((v) => {
          const on = s.backupHoldingIds.includes(v.h.id);
          return (
            <Pressable
              key={v.h.id}
              onPress={() => s.setBackupHoldingIds(on ? s.backupHoldingIds.filter((x) => x !== v.h.id) : [...s.backupHoldingIds, v.h.id])}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}
            >
              <Text style={{ fontSize: 18, width: 30 }}>{on ? '✅' : '⬜️'}</Text>
              <Text style={[typography.body, { color: colors.label, flex: 1 }]} numberOfLines={1}>
                {kindInfo(v.h.kind).emoji} {v.h.name}
              </Text>
              <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>{w.fmt(v.value)}</Text>
            </Pressable>
          );
        })}
        {!w.backupAccounts.length ? (
          <Button title="Open a separate backup account" onPress={() => setCreating(true)} style={{ marginTop: spacing.sm }} />
        ) : null}
      </Card>

      <Card style={{ marginBottom: spacing.md }}>
        <Text style={[typography.headline, { color: colors.label, marginBottom: 2 }]}>Keeping backup money right</Text>
        {[
          ['🔒', 'Separate', 'In its own account, not the one your card spends from, so it isn’t spent by accident.'],
          ['💧', 'Ready within days', 'A savings account, an Islamic savings account or a money market fund you can withdraw from quickly — not property or a long certificate.'],
          ['📉', 'Not in anything that swings', 'Gold and stocks can be down 20% the week you need them. Keep at most a small part of backup in gold or dollars.'],
          ['🚑', 'Only for real emergencies', 'Losing income, health, urgent repairs. A sale or a trip isn’t one — plan those as goals.'],
          ['🔁', 'Refill after using it', 'Put topping it up back on the payday checklist until it’s full again.'],
        ].map(([e, t, d]) => (
          <View key={t} style={{ flexDirection: 'row', paddingVertical: 6 }}>
            <Text style={{ fontSize: 17, width: 30 }}>{e}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]}>{t}</Text>
              <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{d}</Text>
            </View>
          </View>
        ))}
      </Card>
      <AccountSheet
        visible={creating}
        initialType="savings"
        onClose={() => {
          setCreating(false);
          // The newest savings account becomes the backup.
          const savings = useFinanceStore.getState().accounts.filter((a) => a.type === 'savings' && !a.is_archived);
          const newest = savings.sort((a, c) => c.created_at.localeCompare(a.created_at))[0];
          if (newest && !s.backupAccountIds) s.setBackupAccountIds([newest.id]);
          else if (newest && !s.backupAccountIds?.includes(newest.id))
            Alert.alert('Use it for backup money?', newest.name, [
              { text: 'No', style: 'cancel' },
              { text: 'Yes', onPress: () => s.setBackupAccountIds([...(s.backupAccountIds ?? []), newest.id]) },
            ]);
        }}
      />
    </View>
  );
}
