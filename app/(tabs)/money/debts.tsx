import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { Card } from '../../../src/ui/Card';
import { IconCircle } from '../../../src/ui/IconCircle';
import { Badge } from '../../../src/ui/Badge';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { Button } from '../../../src/ui/Button';
import { formatMoney } from '../../../src/utils/money';
import { formatDateShort } from '../../../src/utils/date';
import { estimatePaceCompletionDate } from '../../../src/utils/projection';
import { AddDebtSheet } from '../../../src/features/money/AddDebtSheet';
import { AmountPromptSheet } from '../../../src/features/money/AmountPromptSheet';
import { showUndoDelete } from '../../../src/ui/undo';
import * as financeRepo from '../../../src/db/repositories/finance';
import type { Debt } from '../../../src/db/types';

function DebtCard({ debt, onPay, onDelete }: { debt: Debt; onPay: () => void; onDelete: () => void }) {
  const { colors, typography, spacing } = useTheme();
  const [payoffDate, setPayoffDate] = useState<string | null>(null);

  useEffect(() => {
    financeRepo.listDebtPayments(debt.id).then((payments) => {
      setPayoffDate(estimatePaceCompletionDate(debt.remaining_amount, payments));
    });
  }, [debt.id, debt.remaining_amount]);

  const progress = 1 - debt.remaining_amount / debt.principal_amount;
  const color = debt.direction === 'i_owe' ? colors.red : colors.green;

  return (
    <SwipeableRow actions={[{ label: 'Delete', color: colors.red, onPress: onDelete }]}>
      <Card style={{ marginBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconCircle name={debt.direction === 'i_owe' ? 'arrow.up.circle.fill' : 'arrow.down.circle.fill'} color={color} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={[typography.headline, { color: colors.label }]}>{debt.person_name}</Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
              {formatMoney(debt.remaining_amount, debt.currency)} of {formatMoney(debt.principal_amount, debt.currency)}
            </Text>
          </View>
          {debt.status === 'partially_paid' ? <Badge text="Partial" color={colors.orange} /> : null}
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <ProgressBar progress={progress} color={color} />
        </View>
        {payoffDate ? (
          <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: spacing.xs }]}>
            At this pace, paid off around {formatDateShort(payoffDate)}
          </Text>
        ) : null}
        <Button
          title={debt.direction === 'i_owe' ? 'Pay' : 'Log payment received'}
          variant="secondary"
          onPress={onPay}
          style={{ marginTop: spacing.sm, alignSelf: 'flex-start', paddingHorizontal: spacing.md }}
        />
      </Card>
    </SwipeableRow>
  );
}

export default function DebtsScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { debts, payDebt, removeDebt, refreshDebts } = useFinanceStore();
  const [addVisible, setAddVisible] = useState(false);
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);

  const iOwe = debts.filter((d) => d.direction === 'i_owe' && d.status !== 'paid');
  const owedToMe = debts.filter((d) => d.direction === 'owed_to_me' && d.status !== 'paid');
  const settled = debts.filter((d) => d.status === 'paid');

  const handleDelete = async (debt: Debt) => {
    await removeDebt(debt.id);
    showUndoDelete('debts', debt, 'Debt deleted', refreshDebts);
  };

  const renderDebt = (debt: Debt) => (
    <DebtCard key={debt.id} debt={debt} onPay={() => setPayingDebt(debt)} onDelete={() => handleDelete(debt)} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Debts" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {debts.length === 0 ? (
          <EmptyState icon="exclamationmark.triangle.fill" title="No debts tracked" message="Add money you owe or that's owed to you." />
        ) : (
          <>
            {iOwe.length > 0 && (
              <>
                <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>I owe</Text>
                {iOwe.map(renderDebt)}
              </>
            )}
            {owedToMe.length > 0 && (
              <>
                <Text style={[typography.title3, { color: colors.label, marginTop: spacing.md, marginBottom: spacing.sm }]}>
                  Owed to me
                </Text>
                {owedToMe.map(renderDebt)}
              </>
            )}
            {settled.length > 0 && (
              <>
                <Text style={[typography.title3, { color: colors.label, marginTop: spacing.md, marginBottom: spacing.sm }]}>
                  Settled
                </Text>
                {settled.map(renderDebt)}
              </>
            )}
          </>
        )}
      </ScrollView>
      <FAB onPress={() => setAddVisible(true)} />
      <AddDebtSheet visible={addVisible} onClose={() => setAddVisible(false)} />
      <AmountPromptSheet
        visible={!!payingDebt}
        onClose={() => setPayingDebt(null)}
        title={`Record payment for ${payingDebt?.person_name ?? ''}`}
        onSubmit={async (amount, note) => {
          if (payingDebt) await payDebt(payingDebt.id, amount, note);
        }}
      />
    </View>
  );
}
