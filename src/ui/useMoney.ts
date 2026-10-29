import { useSettingsStore } from '../store/settingsStore';
import { formatMoney } from '../utils/money';

// formatMoney that respects the "hide balances" privacy toggle. Use it for
// headline balances people might not want visible over their shoulder.
export function useBalanceFormatter() {
  const hidden = useSettingsStore((s) => s.hideBalances);
  return (amountMinor: number, currency?: string) => (hidden ? '••••••' : formatMoney(amountMinor, currency));
}
