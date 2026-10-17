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

// "120+45.5", "3*25", "1,250 - 50": + − × ÷ evaluated left to right with
// the usual precedence. Anything else (letters, brackets) gives NaN.
export function evalAmount(input: string): number {
  const text = input.replace(/,/g, '').replace(/[×x]/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s+/g, '');
  if (!text) return NaN;
  if (!/^-?\d*\.?\d+([+\-*/]-?\d*\.?\d+)*$/.test(text)) return Number(text);
  const tokens = text.match(/-?\d*\.?\d+|[+\-*/]/g) ?? [];
  // Re-join "a" "-5" as subtraction when a number precedes it.
  const parts: (number | string)[] = [];
  for (const tok of tokens) {
    if (/^-\d/.test(tok) && typeof parts[parts.length - 1] === 'number') {
      parts.push('-', Number(tok.slice(1)));
    } else parts.push(/^[+\-*/]$/.test(tok) ? tok : Number(tok));
  }
  // First pass: * and /.
  const sums: (number | string)[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if ((p === '*' || p === '/') && typeof sums[sums.length - 1] === 'number') {
      const left = sums.pop() as number;
      const right = parts[++i] as number;
      sums.push(p === '*' ? left * right : right === 0 ? NaN : left / right);
    } else sums.push(p);
  }
  let total = sums[0] as number;
  for (let i = 1; i < sums.length; i += 2) total = sums[i] === '+' ? total + (sums[i + 1] as number) : total - (sums[i + 1] as number);
  return Math.round(total * 100) / 100;
}
