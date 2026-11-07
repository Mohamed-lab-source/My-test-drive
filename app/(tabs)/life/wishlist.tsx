import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useLifeStore } from '../../../src/store/lifeStore';
import { Card } from '../../../src/ui/Card';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { WishlistRow } from '../../../src/features/life/WishlistRow';
import { AddWishlistSheet } from '../../../src/features/life/AddWishlistSheet';
import { ChipSelector } from '../../../src/ui/ChipSelector';

export default function WishlistScreen() {
  const { colors, spacing } = useTheme();
  const { wishlist } = useLifeStore(useShallow((s) => ({ wishlist: s.wishlist })));
  const [addVisible, setAddVisible] = useState(false);
  const [order, setOrder] = useState('newest');
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...wishlist].sort((a, b) =>
    order === 'priority'
      ? (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3)
      : order === 'cheap'
        ? (a.price ?? Infinity) - (b.price ?? Infinity)
        : order === 'pricey'
          ? (b.price ?? -1) - (a.price ?? -1)
          : b.created_at.localeCompare(a.created_at)
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Wishlist & Ideas" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {wishlist.length === 0 ? (
          <EmptyState icon="lightbulb.fill" title="No ideas yet" message="Capture things you want, gift ideas, or plans for later." />
        ) : (
          <>
          <View style={{ marginBottom: spacing.sm }}>
            <ChipSelector
              options={[
                { id: 'newest', label: 'Newest' },
                { id: 'priority', label: 'Priority' },
                { id: 'cheap', label: 'Cheapest' },
                { id: 'pricey', label: 'Priciest' },
              ]}
              selectedId={order}
              onSelect={setOrder}
            />
          </View>
          <Card padded={false}>
            {sorted.map((item, i, arr) => (
              <WishlistRow key={item.id} item={item} isLast={i === arr.length - 1} />
            ))}
          </Card>
          </>
        )}
      </ScrollView>
      <FAB onPress={() => setAddVisible(true)} />
      <AddWishlistSheet visible={addVisible} onClose={() => setAddVisible(false)} />
    </View>
  );
}
