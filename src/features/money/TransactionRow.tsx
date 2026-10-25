import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { ListRow } from '../../ui/ListRow';
import { IconCircle } from '../../ui/IconCircle';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../theme/ThemeProvider';
import { useFinanceStore } from '../../store/financeStore';
import { formatMoneySigned } from '../../utils/money';
import { formatRelativeDay, formatTime } from '../../utils/date';
import type { Transaction } from '../../db/types';
import { ActionMenu } from '../../ui/ActionMenu';
import { useUndoStore } from '../../store/undoStore';

export function TransactionRow({
  tx,
  isLast,
  onPress,
  footnote,
}: {
  tx: Transaction;
  isLast?: boolean;
  onPress?: () => void;
  footnote?: string;
}) {
  const { colors, typography } = useTheme();
  const category = useFinanceStore((s) => s.categories.find((c) => c.id === tx.category_id));
  const account = useFinanceStore((s) => s.accounts.find((a) => a.id === tx.account_id));
  const toAccount = useFinanceStore((s) => s.accounts.find((a) => a.id === tx.transfer_to_account_id));

  const color = tx.type === 'transfer' ? colors.blue : category?.color ?? colors.gray;
  const icon = tx.type === 'transfer' ? 'arrow.left.arrow.right' : category?.icon ?? 'ellipsis.circle.fill';

  const title =
    tx.type === 'transfer'
      ? `${account?.name ?? '—'} → ${toAccount?.name ?? '—'}`
      : tx.note || category?.name || (tx.type === 'income' ? 'Income' : 'Expense');

  const [menu, setMenu] = useState(false);
  // Long-press: the common actions without opening the editor.
  const actions = [
    ...(onPress ? [{ label: 'Edit', icon: 'pencil', onPress }] : []),
    {
      label: 'Duplicate for today',
      icon: 'doc.on.doc',
      onPress: async () => {
        const { id: _id, created_at: _c, receipt_uri: _r, ...rest } = tx;
        await useFinanceStore.getState().addTransaction({ ...rest, flag: null, date: new Date().toISOString() });
        useUndoStore.getState().show('Duplicated for today');
      },
    },
    {
      label: tx.flag ? 'Clear follow-up' : 'Flag to check',
      icon: 'flag.fill',
      onPress: () => useFinanceStore.getState().updateTransaction(tx.id, { flag: tx.flag ? null : 'review' }),
    },
    {
      label: 'Delete',
      icon: 'trash.fill',
      destructive: true,
      section: true,
      onPress: async () => {
        const { id: _id, created_at: _c, ...rest } = tx;
        await useFinanceStore.getState().removeTransaction(tx.id);
        useUndoStore.getState().show('Transaction deleted', () => {
          useFinanceStore.getState().addTransaction(rest);
        });
      },
    },
  ];

  const amountColor =
    tx.type === 'income' ? colors.green : tx.type === 'expense' ? colors.label : colors.secondaryLabel;

  return (
    <>
    <ListRow
      isLast={isLast}
      leading={<IconCircle name={icon} color={color} />}
      title={title}
      subtitle={`${account?.name ?? ''} · ${formatRelativeDay(tx.date)} ${formatTime(tx.date)}`}
      onPress={onPress}
      onLongPress={() => setMenu(true)}
      trailing={
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typography.headline, { color: amountColor }]}>
            {formatMoneySigned(tx.amount, tx.currency, tx.type)}
          </Text>
          {footnote ? <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>{footnote}</Text> : null}
          {tx.flag ? (
            <Text style={[typography.caption2, { color: colors.orange }]}>
              {tx.flag === 'review' ? '🚩 check' : tx.flag === 'reimburse' ? '💼 claim' : '↩️ refund due'}
            </Text>
          ) : null}
          {tx.receipt_uri ? <Icon name="camera.fill" size={12} color={colors.tertiaryLabel} /> : null}
        </View>
      }
    />
    <ActionMenu visible={menu} title={title} actions={actions} onClose={() => setMenu(false)} />
    </>
  );
}
