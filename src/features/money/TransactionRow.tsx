import React, { useState } from 'react';
import { Text, View, Modal, Image, Pressable } from 'react-native';
import { ListRow } from '../../ui/ListRow';
import { IconCircle } from '../../ui/IconCircle';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../theme/ThemeProvider';
import { useFinanceStore } from '../../store/financeStore';
import { formatMoneySigned } from '../../utils/money';
import { formatRelativeDay } from '../../utils/date';
import type { Transaction } from '../../db/types';

export function TransactionRow({ tx, isLast }: { tx: Transaction; isLast?: boolean }) {
  const { colors, typography, spacing } = useTheme();
  const category = useFinanceStore((s) => s.categories.find((c) => c.id === tx.category_id));
  const account = useFinanceStore((s) => s.accounts.find((a) => a.id === tx.account_id));
  const toAccount = useFinanceStore((s) => s.accounts.find((a) => a.id === tx.transfer_to_account_id));
  const [previewVisible, setPreviewVisible] = useState(false);

  const color = tx.type === 'transfer' ? colors.blue : category?.color ?? colors.gray;
  const icon = tx.type === 'transfer' ? 'arrow.left.arrow.right' : category?.icon ?? 'ellipsis.circle.fill';

  const title =
    tx.type === 'transfer'
      ? `${account?.name ?? '—'} → ${toAccount?.name ?? '—'}`
      : tx.note || category?.name || (tx.type === 'income' ? 'Income' : 'Expense');

  const amountColor =
    tx.type === 'income' ? colors.green : tx.type === 'expense' ? colors.label : colors.secondaryLabel;

  return (
    <>
      <ListRow
        isLast={isLast}
        leading={<IconCircle name={icon} color={color} />}
        title={title}
        subtitle={`${account?.name ?? ''} · ${formatRelativeDay(tx.date)}`}
        onPress={tx.receipt_uri ? () => setPreviewVisible(true) : undefined}
        trailing={
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[typography.headline, { color: amountColor }]}>
              {formatMoneySigned(tx.amount, tx.currency, tx.type)}
            </Text>
            {tx.receipt_uri ? <Icon name="camera.fill" size={12} color={colors.tertiaryLabel} /> : null}
          </View>
        }
      />
      {tx.receipt_uri ? (
        <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' }}
            onPress={() => setPreviewVisible(false)}
          >
            <Image source={{ uri: tx.receipt_uri }} style={{ width: '90%', height: '70%' }} resizeMode="contain" />
            <Text style={[typography.footnote, { color: '#fff', marginTop: spacing.md }]}>Tap anywhere to close</Text>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}
