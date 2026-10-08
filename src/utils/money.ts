// Amounts are stored as integer minor units (cents).
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export function fromMinorUnits(amount: number): number {
  return amount / 100;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

// Set from settings at launch; when on, amounts are shown rounded to whole
// units (EGP 1,250 rather than EGP 1,249.50). Stored values are unchanged.
let wholeUnits = false;
export function setWholeMoney(on: boolean): void {
  wholeUnits = on;
}

export function formatMoney(amountMinor: number, currency: string = 'USD'): string {
  const digits = wholeUnits ? 0 : 2;
  const key = `${currency}|${digits}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits });
    formatterCache.set(key, f);
  }
  return f.format(wholeUnits ? Math.round(fromMinorUnits(amountMinor)) : fromMinorUnits(amountMinor));
}

export function formatMoneySigned(amountMinor: number, currency: string, type: 'income' | 'expense' | 'transfer'): string {
  const formatted = formatMoney(Math.abs(amountMinor), currency);
  if (type === 'income') return `+${formatted}`;
  if (type === 'expense') return `-${formatted}`;
  return formatted;
}
