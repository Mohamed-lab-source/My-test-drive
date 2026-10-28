import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { NavHeader } from '../../../../src/ui/NavHeader';
import { useTheme } from '../../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../../src/store/financeStore';
import { Card } from '../../../../src/ui/Card';
import { IconCircle } from '../../../../src/ui/IconCircle';
import { EmptyState } from '../../../../src/ui/EmptyState';
import { ChipSelector } from '../../../../src/ui/ChipSelector';
import { ProgressBar } from '../../../../src/ui/ProgressBar';
import { TransactionRow } from '../../../../src/features/money/TransactionRow';
import { AddTransactionSheet } from '../../../../src/features/money/AddTransactionSheet';
import * as repo from '../../../../src/db/repositories/finance';
import { formatMoney } from '../../../../src/utils/money';
import { useBalanceFormatter } from '../../../../src/ui/useMoney';
import { formatDateShort, localDateKey } from '../../../../src/utils/date';
import { buildStatement, statementPeriods } from '../../../../src/utils/statement';
import { DEFAULT_MIN_PCT, minimumPayment, monthlyInterest, payoffMonths } from '../../../../src/utils/cardMath';
import type { Transaction } from '../../../../src/db/types';
import { currentMonthStart } from '../../../../src/utils/period';

export default function AccountDetailScreen() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accounts, transactions, categories } = useFinanceStore();
  const account = accounts.find((a) => a.id === id);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [periodKey, setPeriodKey] = useState<string | null>(null);
  const [adding, setAdding] = useState<'expense' | 'income' | 'transfer' | null>(null);
  const [payAmount, setPayAmount] = useState<number | undefined>(undefined);
  const [direction, setDirection] = useState('all');
  const balance = useBalanceFormatter();

  useEffect(() => {
    if (!id) return;
    // Transfers *into* this account are stored on the source account.
    Promise.all([repo.listTransactionsForAccount(id), repo.listIncomingTransfers(id)]).then(([own, incoming]) => {
      setRows([...own, ...incoming].sort((a, b) => b.date.localeCompare(a.date)));
    });
  }, [id, transactions]);

  const periods = useMemo(() => (account ? statementPeriods(account, 12) : []), [account?.id, account?.statement_day, account?.due_day, account?.type]);
  const period = periods.find((p) => p.key === periodKey) ?? periods[0];
  const statement = useMemo(
    () => (account && period ? buildStatement(account, rows, period.start, period.end) : null),
    [account?.balance, rows, period?.key]
  );

  // Money in vs out for each of the last six months.
  const sixMonths = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      let inflow = 0;
      let outflow = 0;
      for (const t of rows) {
        if (!localDateKey(t.date).startsWith(key)) continue;
        const incoming = t.type === 'income' || (t.type === 'transfer' && t.transfer_to_account_id === id);
        if (incoming) inflow += t.amount;
        else outflow += t.amount;
      }
      return { key, label: d.toLocaleDateString(undefined, { month: 'short' }), inflow, outflow };
    });
  }, [rows, id]);

  if (!account || !period || !statement) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
        <NavHeader title="Account" />
        <EmptyState icon="building.columns.fill" title="Account not found" message="It may have been deleted." />
      </View>
    );
  }

  const isCredit = account.type === 'credit';
  const owed = isCredit ? Math.max(0, -account.balance) : 0;
  const limit = account.credit_limit ?? 0;
  const util = limit > 0 ? owed / limit : 0;
  // For a closed credit-card cycle, the statement balance is what you owed
  // when it closed; the next cycle's payments count towards it.
  const closedCycle = isCredit && account.statement_day && period.key !== periods[0].key;
  const statementOwed = Math.max(0, -statement.closing);
  const shown = (n: number) => formatMoney(isCredit ? -n : n, account.currency);
  // What's still due on a closed statement after payments made since.
  const statementLeft = closedCycle
    ? Math.max(
        0,
        statementOwed -
          rows
            .filter((t) => new Date(t.date) >= period.end && t.type === 'transfer' && t.transfer_to_account_id === account.id)
            .reduce((sum, t) => sum + t.amount, 0)
      )
    : 0;

  const shareStatement = (csv: boolean) => {
    const catName = (cid: string | null) => categories.find((c) => c.id === cid)?.name ?? '';
    const fmt = (n: number) => (n / 100).toFixed(2);
    if (csv) {
      const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
      const lines = ['Date,Description,Category,Money in,Money out,Balance'];
      lines.push(`${localDateKey(period.start.toISOString())},Opening balance,,,,${fmt(statement.opening)}`);
      for (const r of statement.rows) {
        lines.push(
          [
            localDateKey(r.tx.date),
            esc(r.tx.note ?? (r.tx.type === 'transfer' ? 'Transfer' : '')),
            esc(catName(r.tx.category_id)),
            r.delta > 0 ? fmt(r.delta) : '',
            r.delta < 0 ? fmt(-r.delta) : '',
            fmt(r.running),
          ].join(',')
        );
      }
      lines.push(`,Closing balance,,${fmt(statement.inflow)},${fmt(statement.outflow)},${fmt(statement.closing)}`);
      Share.share({ message: lines.join('\n'), title: `${account.name} statement.csv` });
      return;
    }
    const lines = [
      `${account.name} — statement`,
      `${period.start.toDateString()} to ${new Date(period.end.getTime() - 1).toDateString()}`,
      '',
      `Opening balance: ${formatMoney(statement.opening, account.currency)}`,
      ...statement.rows.map(
        (r) =>
          `${formatDateShort(r.tx.date)}  ${r.delta >= 0 ? '+' : '−'}${formatMoney(Math.abs(r.delta), account.currency)}  ${r.tx.note ?? catName(r.tx.category_id)}  → ${formatMoney(r.running, account.currency)}`
      ),
      '',
      `Money in: ${formatMoney(statement.inflow, account.currency)}`,
      `Money out: ${formatMoney(statement.outflow, account.currency)}`,
      `Closing balance: ${formatMoney(statement.closing, account.currency)}`,
    ];
    Share.share({ message: lines.join('\n') });
  };

  const stat = (label: string, value: string, color: string = colors.label) => (
    <View style={{ flex: 1 }}>
      <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>{label}</Text>
      <Text style={[typography.headline, { color }]}>{value}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title={account.name} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconCircle name={account.icon} color={account.color} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                {isCredit ? '💳 Credit card' : account.type === 'cash' ? '💵 Cash' : '🏦 ' + account.type[0].toUpperCase() + account.type.slice(1)} ·{' '}
                {account.currency}
              </Text>
              <Text style={[typography.title1, { color: colors.label }]}>
                {isCredit ? formatMoney(owed, account.currency) : balance(account.balance, account.currency)}
              </Text>
              {isCredit ? <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>owed now</Text> : null}
            </View>
            <Pressable onPress={() => router.push('/money/accounts')} hitSlop={8}>
              <Text style={[typography.subhead, { color: colors.blue }]}>Edit</Text>
            </Pressable>
          </View>
          {isCredit && limit > 0 ? (
            <View style={{ marginTop: spacing.md }}>
              <ProgressBar progress={util} color={util >= 0.7 ? colors.red : util >= 0.3 ? colors.orange : colors.green} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                  {Math.round(util * 100)}% of {formatMoney(limit, account.currency)} limit used
                </Text>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                  {formatMoney(Math.max(0, limit - owed), account.currency)} available
                </Text>
              </View>
              {util >= 0.3 ? (
                <Text style={[typography.caption1, { color: colors.orange, marginTop: 4 }]}>
                  Keeping usage under 30% of your limit is healthier for your credit score.
                </Text>
              ) : null}
            </View>
          ) : null}
          {isCredit && !account.statement_day ? (
            <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: spacing.sm }]}>
              Add your statement and due days (Edit) to see statements by billing cycle and get a payment reminder.
            </Text>
          ) : null}
          {isCredit && owed > 0 ? (
            <View style={{ marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.separator }}>
              <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                Minimum payment {formatMoney(minimumPayment(owed, account.min_payment_pct), account.currency)} ({account.min_payment_pct || DEFAULT_MIN_PCT}%)
                {account.apr ? ` · about ${formatMoney(monthlyInterest(owed, account.apr), account.currency)} interest a month if carried over` : ''}
              </Text>
              {account.apr ? (
                <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
                  {(() => {
                    const m = payoffMonths(owed, account.apr, minimumPayment(owed, account.min_payment_pct));
                    return m === null ? 'The minimum alone never clears this balance.' : `At the minimum, it's paid off in about ${m} month${m === 1 ? '' : 's'}.`;
                  })()}
                </Text>
              ) : null}
            </View>
          ) : null}
          {account.monthly_limit ? (
            (() => {
              const monthStart = currentMonthStart().getTime();
              const spent = rows
                .filter((t) => t.type === 'expense' && t.account_id === account.id && new Date(t.date).getTime() >= monthStart)
                .reduce((sum, t) => sum + t.amount, 0);
              const u = spent / account.monthly_limit;
              return (
                <View style={{ marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.separator }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>My monthly limit</Text>
                    <Text style={[typography.footnote, { color: u >= 1 ? colors.red : colors.label, fontWeight: '600' }]}>
                      {formatMoney(spent, account.currency)} of {formatMoney(account.monthly_limit, account.currency)}
                    </Text>
                  </View>
                  <ProgressBar progress={u} color={u >= 1 ? colors.red : u >= 0.8 ? colors.orange : colors.blue} height={6} />
                </View>
              );
            })()
          ) : null}
        </Card>

        <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
          {(
            [
              { type: 'expense', label: isCredit ? '+ Charge' : '+ Expense', color: colors.red },
              { type: 'income', label: isCredit ? '+ Refund' : '+ Income', color: colors.green },
              { type: 'transfer', label: isCredit ? 'Pay card' : 'Transfer', color: colors.blue },
            ] as const
          ).map((b) => (
            <Pressable
              key={b.type}
              onPress={() => setAdding(b.type)}
              style={{ flex: 1, marginHorizontal: 3, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: b.color + '1A' }}
            >
              <Text style={[typography.subhead, { color: b.color, fontWeight: '600' }]}>{b.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text style={[typography.title3, { color: colors.label }]}>Statement</Text>
          <View style={{ flexDirection: 'row' }}>
            <Pressable onPress={() => shareStatement(false)} hitSlop={8} style={{ marginRight: spacing.md }}>
              <Text style={[typography.subhead, { color: colors.blue }]}>Share</Text>
            </Pressable>
            <Pressable onPress={() => shareStatement(true)} hitSlop={8}>
              <Text style={[typography.subhead, { color: colors.blue }]}>CSV</Text>
            </Pressable>
          </View>
        </View>
        {sixMonths.some((m) => m.inflow || m.outflow) ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm }]}>Last 6 months</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80 }}>
              {sixMonths.map((m) => {
                const max = Math.max(1, ...sixMonths.map((x) => Math.max(x.inflow, x.outflow)));
                return (
                  <View key={m.key} style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 3 }}>
                    <View style={{ width: 8, height: Math.max(2, (m.inflow / max) * 80), borderRadius: 3, backgroundColor: colors.green }} />
                    <View style={{ width: 8, height: Math.max(2, (m.outflow / max) * 80), borderRadius: 3, backgroundColor: colors.red }} />
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', marginTop: 4 }}>
              {sixMonths.map((m) => (
                <Text key={m.key} style={[typography.caption2, { color: colors.secondaryLabel, flex: 1, textAlign: 'center' }]}>
                  {m.label}
                </Text>
              ))}
            </View>
            <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: spacing.xs }]}>
              <Text style={{ color: colors.green }}>●</Text> in   <Text style={{ color: colors.red }}>●</Text> out · average out{' '}
              {formatMoney(Math.round(sixMonths.reduce((s, m) => s + m.outflow, 0) / 6), account.currency)} a month
            </Text>
          </Card>
        ) : null}
        <View style={{ marginBottom: spacing.sm }}>
          <ChipSelector options={periods.map((p) => ({ id: p.key, label: p.label }))} selectedId={period.key} onSelect={setPeriodKey} />
        </View>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
            {period.start.toDateString()} – {new Date(period.end.getTime() - 1).toDateString()}
          </Text>
          <View style={{ flexDirection: 'row' }}>
            {stat(isCredit ? 'Owed at start' : 'Opening', shown(statement.opening))}
            {stat(isCredit ? 'Owed at end' : 'Closing', shown(statement.closing))}
          </View>
          <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
            {stat(isCredit ? 'Payments' : 'Money in', formatMoney(statement.inflow, account.currency), colors.green)}
            {stat(isCredit ? 'Charges' : 'Money out', formatMoney(statement.outflow, account.currency), colors.red)}
          </View>
          {closedCycle && period.dueDate ? (
            <View style={{ marginTop: spacing.md, padding: spacing.sm, borderRadius: 10, backgroundColor: colors.tertiaryFill }}>
              <Text style={[typography.subhead, { color: colors.label, fontWeight: '600' }]}>
                Statement balance {formatMoney(statementOwed, account.currency)}
              </Text>
              <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                Due {period.dueDate.toDateString()} — pay it in full to avoid interest.
              </Text>
              {statementOwed > 0 ? (
                <>
                <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
                  {(() => {
                    // Payments made since the cycle closed count towards it.
                    const paidSince = rows
                      .filter((t) => new Date(t.date) >= period.end && t.type === 'transfer' && t.transfer_to_account_id === account.id)
                      .reduce((sum, t) => sum + t.amount, 0);
                    const remaining = Math.max(0, statementOwed - paidSince);
                    // Typical minimum: 5% of the balance (at least 100), never more than the balance.
                    const minimum = Math.min(remaining, Math.max(10000, Math.round(remaining * 0.05)));
                    return remaining === 0
                      ? '✓ Paid in full — no interest on this statement.'
                      : `Still to pay: ${formatMoney(remaining, account.currency)}${paidSince > 0 ? ` (paid ${formatMoney(paidSince, account.currency)} so far)` : ''} · minimum about ${formatMoney(minimum, account.currency)}. Paying only the minimum means interest on the rest.`;
                  })()}
                </Text>
                {statementLeft > 0 ? (
                  <Pressable
                    onPress={() => {
                      setPayAmount(statementLeft);
                      setAdding('transfer');
                    }}
                    style={{ marginTop: 6 }}
                  >
                    <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>
                      Pay {formatMoney(statementLeft, account.currency)} now
                    </Text>
                  </Pressable>
                ) : null}
                </>
              ) : null}
            </View>
          ) : isCredit && period.dueDate ? (
            <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: spacing.sm }]}>
              This cycle closes {new Date(period.end.getTime() - 1).toDateString()}; payment due {period.dueDate.toDateString()}.
            </Text>
          ) : null}
        </Card>

        {statement.rows.length > 0 ? (
          <View style={{ marginBottom: spacing.sm }}>
            <ChipSelector
              options={[
                { id: 'all', label: 'All' },
                { id: 'in', label: isCredit ? 'Payments & refunds' : 'Money in' },
                { id: 'out', label: isCredit ? 'Charges' : 'Money out' },
              ]}
              selectedId={direction}
              onSelect={setDirection}
            />
          </View>
        ) : null}
        {statement.rows.length === 0 ? (
          <Card>
            <EmptyState icon="banknote" title="No transactions" message="Nothing in this period." />
          </Card>
        ) : (
          <Card padded={false}>
            {[...statement.rows].reverse().filter((r) => direction === 'all' || (direction === 'in' ? r.delta > 0 : r.delta < 0)).map((r, i, arr) => (
              <TransactionRow
                key={r.tx.id}
                tx={r.tx}
                isLast={i === arr.length - 1}
                onPress={() => setEditing(r.tx)}
                footnote={isCredit ? 'owed ' + formatMoney(Math.max(0, -r.running), account.currency) : 'bal ' + formatMoney(r.running, account.currency)}
              />
            ))}
          </Card>
        )}
      </ScrollView>
      <AddTransactionSheet visible={!!editing} editing={editing} onClose={() => setEditing(null)} />
      <AddTransactionSheet
        visible={!!adding}
        initialType={adding ?? undefined}
        // Paying a card moves money from a bank account into it.
        initialAccountId={isCredit && adding === 'transfer' ? accounts.find((a) => a.type === 'bank' && !a.is_archived)?.id : account.id}
        initialToAccountId={isCredit && adding === 'transfer' ? account.id : undefined}
        initialAmount={isCredit && adding === 'transfer' ? payAmount : undefined}
        initialNote={isCredit && adding === 'transfer' ? `${account.name} payment` : undefined}
        onClose={() => {
          setAdding(null);
          setPayAmount(undefined);
        }}
      />
    </View>
  );
}
