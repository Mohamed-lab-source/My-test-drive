import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { Card } from '../../../src/ui/Card';
import { ListRow } from '../../../src/ui/ListRow';
import { IconCircle } from '../../../src/ui/IconCircle';
import { FAB } from '../../../src/ui/FAB';
import { formatMoney } from '../../../src/utils/money';
import { AccountSheet } from '../../../src/features/money/AccountSheet';
import type { Account } from '../../../src/db/types';

export default function AccountsScreen() {
  const { colors, typography, spacing } = useTheme();
  const { accounts } = useFinanceStore();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const active = accounts.filter((a) => !a.is_archived);
  const archived = accounts.filter((a) => a.is_archived);

  const open = (account: Account | null) => {
    setEditing(account);
    setSheetVisible(true);
  };

  const renderList = (list: Account[]) => (
    <Card padded={false}>
      {list.map((a, i) => (
        <ListRow
          key={a.id}
          isLast={i === list.length - 1}
          leading={<IconCircle name={a.icon} color={a.color} />}
          title={a.name}
          subtitle={`${a.type} · ${a.currency}`}
          onPress={() => open(a)}
          trailing={<Text style={[typography.headline, { color: colors.label }]}>{formatMoney(a.balance, a.currency)}</Text>}
        />
      ))}
    </Card>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Accounts" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {renderList(active)}
        {archived.length > 0 ? (
          <>
            <Text style={[typography.title3, { color: colors.label, marginTop: spacing.lg, marginBottom: spacing.sm }]}>Archived</Text>
            {renderList(archived)}
          </>
        ) : null}
      </ScrollView>
      <FAB onPress={() => open(null)} />
      <AccountSheet visible={sheetVisible} editing={editing} onClose={() => setSheetVisible(false)} />
    </View>
  );
}
