import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { Card } from '../../../src/ui/Card';
import { ListRow } from '../../../src/ui/ListRow';
import { IconCircle } from '../../../src/ui/IconCircle';
import { Badge } from '../../../src/ui/Badge';
import { FAB } from '../../../src/ui/FAB';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { AddCategorySheet } from '../../../src/features/settings/AddCategorySheet';

export default function CategoriesScreen() {
  const { colors, spacing } = useTheme();
  const { categories, deleteCategory } = useFinanceStore();
  const [addVisible, setAddVisible] = useState(false);
  const active = categories.filter((c) => !c.is_archived);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Categories" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Card padded={false}>
          {active.map((cat, i, arr) => (
            <SwipeableRow key={cat.id} actions={[{ label: 'Delete', color: colors.red, onPress: () => deleteCategory(cat.id) }]}>
              <ListRow
                isLast={i === arr.length - 1}
                leading={<IconCircle name={cat.icon} color={cat.color} size={32} />}
                title={cat.name}
                trailing={<Badge text={cat.kind} color={colors.gray} />}
              />
            </SwipeableRow>
          ))}
        </Card>
      </ScrollView>
      <FAB onPress={() => setAddVisible(true)} />
      <AddCategorySheet visible={addVisible} onClose={() => setAddVisible(false)} />
    </View>
  );
}
