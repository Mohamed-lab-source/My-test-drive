import React from 'react';
import { useQuickAddStore } from '../../store/quickAddStore';
import { AddTransactionSheet } from '../money/AddTransactionSheet';
import { AddTaskSheet } from '../tasks/AddTaskSheet';

// The add sheets the + menu opens, available on every tab.
export function GlobalSheets() {
  const { sheet, open, accountId } = useQuickAddStore();
  const close = () => open(null);
  return (
    <>
      <AddTransactionSheet
        visible={sheet === 'expense' || sheet === 'income' || sheet === 'transfer'}
        initialType={sheet === 'income' ? 'income' : sheet === 'transfer' ? 'transfer' : 'expense'}
        initialAccountId={accountId ?? undefined}
        onClose={close}
      />
      <AddTaskSheet visible={sheet === 'task'} onClose={close} />
    </>
  );
}
