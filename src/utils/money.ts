// Amounts are stored as integer minor units (cents).
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export function fromMinorUnits(amount: number): number {
  return amount / 100;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

export function formatMoney(amountMinor: number, currency: string = 'USD'): string {
  let f = formatterCache.get(currency);
  if (!f) {
    f = new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 });
    formatterCache.set(currency, f);
  }
  return f.format(fromMinorUnits(amountMinor));
}

export function formatMoneySigned(amountMinor: number, currency: string, type: 'income' | 'expense' | 'transfer'): string {
  const formatted = formatMoney(Math.abs(amountMinor), currency);
  if (type === 'income') return `+${formatted}`;
  if (type === 'expense') return `-${formatted}`;
  return formatted;
}
