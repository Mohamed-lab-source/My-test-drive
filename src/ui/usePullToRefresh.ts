import { useCallback, useState } from 'react';
import { useFinanceStore } from '../store/financeStore';
import { useProductivityStore } from '../store/productivityStore';
import { useLifeStore } from '../store/lifeStore';
import { useHabitsStore } from '../store/habitsStore';
import { useWaterStore } from '../store/waterStore';
import { useSmsStore } from '../sms/smsStore';

// Reloads everything from the database (and checks for new bank SMS).
export function usePullToRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        useFinanceStore.getState().hydrate(),
        useProductivityStore.getState().hydrate(),
        useLifeStore.getState().hydrate(),
        useHabitsStore.getState().hydrate(),
        useWaterStore.getState().load(),
        useSmsStore.getState().scan().catch(() => 0),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, []);
  return { refreshing, onRefresh };
}
