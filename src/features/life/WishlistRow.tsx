import React from 'react';
import { Text } from 'react-native';
import { ListRow } from '../../ui/ListRow';
import { IconCircle } from '../../ui/IconCircle';
import { Badge } from '../../ui/Badge';
import { SwipeableRow } from '../../ui/SwipeableRow';
import { showUndoDelete } from '../../ui/undo';
import { useTheme } from '../../theme/ThemeProvider';
import { useLifeStore } from '../../store/lifeStore';
import { formatMoney } from '../../utils/money';
import type { WishlistItem } from '../../db/types';

const PRIORITY_ICON: Record<WishlistItem['priority'], string> = {
  high: 'star.fill',
  medium: 'star',
  low: 'lightbulb.fill',
};

export function WishlistRow({ item, isLast }: { item: WishlistItem; isLast?: boolean }) {
  const { colors } = useTheme();
  const removeWishlistItem = useLifeStore((s) => s.removeWishlistItem);
  const updateWishlistItem = useLifeStore((s) => s.updateWishlistItem);
  const convertWishlistToGoal = useLifeStore((s) => s.convertWishlistToGoal);
  const refreshWishlist = useLifeStore((s) => s.refreshWishlist);

  const color = item.priority === 'high' ? colors.orange : item.priority === 'medium' ? colors.blue : colors.gray;

  const handleDelete = async () => {
    await removeWishlistItem(item.id);
    showUndoDelete('wishlist_items', item, 'Idea deleted', refreshWishlist);
  };

  return (
    <SwipeableRow
      actions={[
        {
          label: item.status === 'purchased' ? 'Undo' : 'Got it',
          color: colors.green,
          onPress: () => updateWishlistItem(item.id, { status: item.status === 'purchased' ? 'idea' : 'purchased' }),
        },
        ...(item.status === 'idea' ? [{ label: 'Save up', color: colors.blue, onPress: () => convertWishlistToGoal(item.id) }] : []),
        { label: 'Delete', color: colors.red, onPress: handleDelete },
      ]}
    >
      <ListRow
        isLast={isLast}
        leading={<IconCircle name={PRIORITY_ICON[item.priority]} color={color} />}
        title={item.title}
        subtitle={item.notes ?? undefined}
        trailing={
          item.status === 'purchased' ? (
            <Badge text="Got it" color={colors.green} />
          ) : item.price ? (
            <Text style={{ color: colors.secondaryLabel }}>{formatMoney(item.price, item.currency)}</Text>
          ) : undefined
        }
      />
    </SwipeableRow>
  );
}
