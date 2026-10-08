import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { EmptyState } from '../../../src/ui/EmptyState';
import { useFinanceStore } from '../../../src/store/financeStore';
import { getDb } from '../../../src/db/client';
import { formatMoney } from '../../../src/utils/money';
import { formatDateShort } from '../../../src/utils/date';
import type { Transaction } from '../../../src/db/types';

// Every income/expense without a category, fixable with one tap each.
export default function UncategorizedScreen() {
  const { colors, typography, spacing } = useTheme();
  const { categories, transactions, updateTransaction } = useFinanceStore();
  const [items, setItems] = useState<Transaction[]>([]);

  useEffect(() => {
    getDb()
      .then((db) =>
        db.getAllAsync<Transaction>("SELECT * FROM transactions WHERE category_id IS NULL AND type != 'transfer' ORDER BY date DESC LIMIT 200")
      )
      .then(setItems);
  }, [transactions]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Needs a category" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {items.length === 0 ? (
          <EmptyState icon="checkmark.circle.fill" title="All categorized" message="Every transaction has a category." />
        ) : (
          items.map((t) => (
            <Card key={t.id} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
                <Text style={[typography.body, { color: colors.label, flex: 1 }]} numberOfLines={1}>
                  {t.note || (t.type === 'income' ? 'Income' : 'Expense')} · {formatDateShort(t.date)}
                </Text>
                <Text style={[typography.body, { color: t.type === 'income' ? colors.green : colors.label, fontWeight: '600' }]}>
                  {formatMoney(t.amount, t.currency)}
                </Text>
              </View>
              <ChipSelector
                options={categories
                  .filter((c) => !c.is_archived && (t.type === 'income' ? c.kind !== 'expense' : c.kind !== 'income'))
                  .map((c) => ({ id: c.id, label: c.name, color: c.color, icon: c.icon }))}
                selectedId={null}
                onSelect={(id) => updateTransaction(t.id, { category_id: id })}
              />
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
