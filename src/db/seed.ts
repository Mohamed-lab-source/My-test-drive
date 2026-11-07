import { createAccount, createCategory } from './repositories/finance';

export const DEFAULT_CATEGORIES: Array<{
  name: string;
  icon: string;
  color: string;
  kind: 'expense' | 'income' | 'both';
}> = [
  { name: 'Groceries', icon: 'cart.fill', color: '#34C759', kind: 'expense' },
  { name: 'Rent', icon: 'house.fill', color: '#FF9500', kind: 'expense' },
  { name: 'Transport', icon: 'car.fill', color: '#007AFF', kind: 'expense' },
  { name: 'Dining', icon: 'fork.knife', color: '#FF3B30', kind: 'expense' },
  { name: 'Utilities', icon: 'bolt.fill', color: '#FFCC00', kind: 'expense' },
  { name: 'Health', icon: 'heart.fill', color: '#FF2D55', kind: 'expense' },
  { name: 'Subscriptions', icon: 'repeat', color: '#AF52DE', kind: 'expense' },
  { name: 'Shopping', icon: 'bag.fill', color: '#5AC8FA', kind: 'expense' },
  { name: 'Wedding', icon: 'heart.circle.fill', color: '#FF2D55', kind: 'expense' },
  { name: 'Giving / Sadaqah', icon: 'gift.fill', color: '#00C7BE', kind: 'expense' },
  { name: 'Salary', icon: 'banknote.fill', color: '#34C759', kind: 'income' },
  { name: 'Freelance', icon: 'laptopcomputer', color: '#5856D6', kind: 'income' },
  { name: 'Other', icon: 'ellipsis.circle.fill', color: '#8E8E93', kind: 'both' },
];

export async function seedDefaultsIfEmpty(existingCategoriesCount: number, existingAccountsCount: number) {
  if (existingCategoriesCount === 0) {
    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
      const c = DEFAULT_CATEGORIES[i];
      await createCategory({ ...c, sort_order: i });
    }
  }
  if (existingAccountsCount === 0) {
    await createAccount({
      name: 'Cash',
      type: 'cash',
      currency: 'USD',
      icon: 'dollarsign.circle.fill',
      color: '#34C759',
      sort_order: 0,
    });
    await createAccount({
      name: 'Bank Account',
      type: 'bank',
      currency: 'USD',
      icon: 'building.columns.fill',
      color: '#007AFF',
      sort_order: 1,
    });
  }
}
