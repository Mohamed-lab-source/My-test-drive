import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, Modal, useWindowDimensions } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { EmptyState } from '../../../src/ui/EmptyState';
import { useFinanceStore } from '../../../src/store/financeStore';
import { getDb } from '../../../src/db/client';
import { formatMoney } from '../../../src/utils/money';
import { formatDateShort } from '../../../src/utils/date';
import type { Transaction } from '../../../src/db/types';

export default function ReceiptsScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { width } = useWindowDimensions();
  const transactions = useFinanceStore((s) => s.transactions);
  const [items, setItems] = useState<Transaction[]>([]);
  const [open, setOpen] = useState<Transaction | null>(null);
  const size = (width - spacing.lg * 2 - spacing.sm * 2) / 3;

  useEffect(() => {
    getDb()
      .then((db) => db.getAllAsync<Transaction>("SELECT * FROM transactions WHERE receipt_uri IS NOT NULL AND receipt_uri != '' ORDER BY date DESC"))
      .then(setItems);
  }, [transactions]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Receipts" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {items.length === 0 ? (
          <EmptyState icon="camera.fill" title="No receipts yet" message="Attach a photo when you log a transaction and it shows up here." />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.sm / 2 }}>
            {items.map((t) => (
              <Pressable key={t.id} onPress={() => setOpen(t)} style={{ margin: spacing.sm / 2 }}>
                <Image source={{ uri: t.receipt_uri! }} style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: colors.tertiaryFill }} />
                <Text style={[typography.caption2, { color: colors.secondaryLabel, marginTop: 2, width: size }]} numberOfLines={1}>
                  {formatMoney(t.amount, t.currency)} · {formatDateShort(t.date)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable onPress={() => setOpen(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', padding: spacing.md }}>
          {open ? (
            <>
              <Image source={{ uri: open.receipt_uri! }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />
              <Text style={[typography.body, { color: '#fff', textAlign: 'center', marginTop: spacing.md }]}>
                {open.note ? `${open.note} · ` : ''}
                {formatMoney(open.amount, open.currency)} · {formatDateShort(open.date)}
              </Text>
            </>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
