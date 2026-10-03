import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useLifeStore } from '../../../src/store/lifeStore';
import { Card } from '../../../src/ui/Card';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { WishlistRow } from '../../../src/features/life/WishlistRow';
import { AddWishlistSheet } from '../../../src/features/life/AddWishlistSheet';

export default function WishlistScreen() {
  const { colors, spacing } = useTheme();
  const { wishlist } = useLifeStore();
  const [addVisible, setAddVisible] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Wishlist & Ideas" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {wishlist.length === 0 ? (
          <EmptyState icon="lightbulb.fill" title="No ideas yet" message="Capture things you want, gift ideas, or plans for later." />
        ) : (
          <Card padded={false}>
            {wishlist.map((item, i, arr) => (
              <WishlistRow key={item.id} item={item} isLast={i === arr.length - 1} />
            ))}
          </Card>
        )}
      </ScrollView>
      <FAB onPress={() => setAddVisible(true)} />
      <AddWishlistSheet visible={addVisible} onClose={() => setAddVisible(false)} />
    </View>
  );
}
