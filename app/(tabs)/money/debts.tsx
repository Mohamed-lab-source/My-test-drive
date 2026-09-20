import React, { useState } from 'react';
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
import { AddDebtSheet } from '../../../src/features/money/AddDebtSheet';
import { AmountPromptSheet } from '../../../src/features/money/AmountPromptSheet';
import type { Debt } from '../../../src/db/types';

export default function DebtsScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { debts, payDebt, removeDebt } = useFinanceStore();
  const [addVisible, setAddVisible] = useState(false);
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);

  const iOwe = debts.filter((d) => d.direction === 'i_owe' && d.status !== 'paid');
  const owedToMe = debts.filter((d) => d.direction === 'owed_to_me' && d.status !== 'paid');
  const settled = debts.filter((d) => d.status === 'paid');

  const renderDebt = (debt: Debt) => {
    const progress = 1 - debt.remaining_amount / debt.principal_amount;
    const color = debt.direction === 'i_owe' ? colors.red : colors.green;
    return (
      <SwipeableRow
        key={debt.id}
        actions={[{ label: 'Delete', color: colors.red, onPress: () => removeDebt(debt.id) }]}
      >
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
          <Button
            title={debt.direction === 'i_owe' ? 'Pay' : 'Log payment received'}
            variant="secondary"
            onPress={() => setPayingDebt(debt)}
            style={{ marginTop: spacing.sm, alignSelf: 'flex-start', paddingHorizontal: spacing.md }}
          />
        </Card>
      </SwipeableRow>
    );
  };

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
