import { nowIso } from '../client';
import { allRows, deleteRow, getRow, insertRow, updateRow } from '../helpers';
import type { FxRate } from '../types';

// id is the currency code itself (see schema.ts), so lookups are just getRow.
export const listFxRates = () => allRows<FxRate>('fx_rates', 'currency ASC');
export const getFxRate = (currency: string) => getRow<FxRate>('fx_rates', currency);

export async function setFxRate(currency: string, rateToBase: number): Promise<void> {
  const existing = await getFxRate(currency);
  if (existing) {
    await updateRow('fx_rates', currency, { rate_to_base: rateToBase, updated_at: nowIso() });
  } else {
    await insertRow('fx_rates', { id: currency, currency, rate_to_base: rateToBase, updated_at: nowIso() });
  }
}

export const deleteFxRate = (currency: string) => deleteRow('fx_rates', currency);

// Converts an amount in `currency` into the base currency using the stored
// manual rate. rate_to_base is "how many units of base currency is 1 unit
// of `currency` worth" — 1:1 when the account already uses the base
// currency, or when no rate has been set (better an unconverted number than
// a silently wrong one).
export function convertToBase(amountMinor: number, currency: string, baseCurrency: string, rates: FxRate[]): number {
  if (currency === baseCurrency) return amountMinor;
  const rate = rates.find((r) => r.currency === currency);
  if (!rate) return amountMinor;
  return Math.round(amountMinor * rate.rate_to_base);
}
