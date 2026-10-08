// Turns a bank alert SMS into a debit, or null when it isn't one (credits,
// OTPs, declined attempts, balance notices…). Tuned on HSBC's English
// wording, with general English/Arabic fallbacks for other banks.

export interface ParsedDebit {
  amount: number; // minor units
  currency: string;
  merchant: string | null;
  cardLast4: string | null;
  kind: 'purchase' | 'withdrawal' | 'transfer' | 'debit' | 'credit' | 'card_payment';
  // Which kind of card/account the bank says was used, when it says.
  cardType: CardType | null;
}

export type CardType = 'credit' | 'debit';

// "Credit Card ending 1234" / "available limit" → credit; "Debit card",
// "account", "available balance" or an HSBC-style masked account number
// (005-375***-013) → debit. Credit is checked first because a credit-card
// alert can also say "account".
export function detectCardType(raw: string): CardType | null {
  const text = normalizeDigits(raw);
  if (/credit\s*card|\bcc\b|card\s*credit|بطاقة\s*(?:ال)?ائتمان|الائتمانية|available\s+(?:credit\s+)?limit|الحد\s+المتاح/i.test(text)) return 'credit';
  if (/debit\s*card|prepaid|meeza|ميزة|\baccount\b|\bacct\b|a\/c\b|حساب|available\s+balance|الرصيد|\d{3}-\d{3}\*+-\d{3}/i.test(text)) return 'debit';
  return null;
}

const CURRENCY_ALIASES: Record<string, string> = {
  LE: 'EGP',
  'L.E': 'EGP',
  'L.E.': 'EGP',
  'E£': 'EGP',
  'جنيه': 'EGP',
  'ج.م': 'EGP',
  'جم': 'EGP',
  'درهم': 'AED',
  'ريال': 'SAR',
  'دولار': 'USD',
  'دينار': 'KWD',
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
};
const CODES = 'EGP|USD|EUR|GBP|AED|SAR|KWD|QAR|BHD|OMR|JOD|INR|PKR|MYR|IDR|TRY|MAD|CAD|AUD';
const CUR = `(${CODES}|L\\.E\\.?|LE|E£|جنيه|ج\\.م|جم|درهم|ريال|دولار|دينار|\\$|€|£)`;
const AMT = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,3})?|\\d+(?:\\.\\d{1,3})?)';

const IGNORE =
  /\b(otp|one[- ]?time|password|passcode|verification|activation code|code is|declined|failed|unsuccessful|rejected|not (?:been )?completed|insufficient|statement|minimum (?:payment|amount)|payment (?:is )?due|due (?:date|on)|will be (?:debited|deducted|charged))\b|رمز|كلمة (?:ال)?مرور|مرفوض|فشل|لم تتم|غير ناجح|كشف حساب|كشف الحساب|الحد الأدنى|مستحق/i;
const CREDIT = /\b(credited|deposit(?:ed)?|received|refund(?:ed)?|revers(?:al|ed)|cash ?back|salary)\b|إيداع|ايداع|إضافة|اضافة|استلام|دائن|مرتجع|استرداد/i;
const DEBIT =
  /\b(debited|debit|purchases?|purchased|used|spent|paid|payment|withdrawn|withdrawal|pos|atm|transferred|transfer|charged|deducted)\b|خصم|سحب|شراء|مشتريات|دفع|مدين|تحويل/i;
// A preceding word that marks an amount as a balance/limit, not the charge.
const BALANCE_BEFORE = /(avail(?:able)?|bal(?:ance)?|limit|outstanding|رصيد|الحد|المتاح)[^\d]{0,20}$/i;

function normalizeDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',');
}

function toCode(raw: string): string {
  const key = raw.toUpperCase();
  return CURRENCY_ALIASES[raw] ?? CURRENCY_ALIASES[key] ?? key;
}

function findAmount(text: string): { amount: number; currency: string } | null {
  const patterns = [new RegExp(`${CUR}\\s?${AMT}`, 'gi'), new RegExp(`${AMT}\\s?${CUR}`, 'gi')];
  const hits: { index: number; amount: string; currency: string }[] = [];
  for (const [i, re] of patterns.entries()) {
    for (const m of text.matchAll(re)) {
      const [currency, amount] = i === 0 ? [m[1], m[2]] : [m[2], m[1]];
      const index = m.index ?? 0;
      // "005-375***-013 EGP 105.00": an amount-first match whose number is
      // glued to a masked account/card number ("-013") isn't a price.
      if (i === 1 && index > 0 && /[-*xX\d.\/]/.test(text[index - 1])) continue;
      hits.push({ index, amount, currency });
    }
  }
  hits.sort((a, b) => a.index - b.index);
  for (const h of hits) {
    if (BALANCE_BEFORE.test(text.slice(Math.max(0, h.index - 40), h.index))) continue;
    const value = Number(h.amount.replace(/,/g, ''));
    if (!(value > 0)) continue;
    return { amount: Math.round(value * 100), currency: toCode(h.currency) };
  }
  return null;
}

function findMerchant(text: string): string | null {
  const stop = '(?=\\s+(?:on|dated|with|using|via|ref|reference|card|for|from|at\\s+\\d)\\b|\\s*[.,;]\\s|\\s*[.,;]?$|\\s+\\d{1,2}[\\/\\-.]\\d|\\s+\\d{1,2}-[A-Za-z]{3})';
  const patterns = [
    // HSBC Egypt: "07OCT26 FAWRY*FRIENDS 2 SUPE Purchase from …"
    /^(?:From\s+HSBC\s*:\s*)?\d{1,2}[A-Z]{3}\d{2,4}\s+(.{2,40}?)\s+(?:Purchase|Payment|Withdrawal|POS|E-?Commerce|Refund|Reversal|Transfer)\b/i,
    new RegExp(`(?:\\bat\\s+|@\\s*)(.{2,40}?)${stop}`, 'i'),
    new RegExp(`\\b(?:to|towards)\\s+(.{2,40}?)${stop}`, 'i'),
    /(?:لدى|عند|في)\s+([^\d،,.]{2,40}?)(?=\s+(?:بتاريخ|يوم|في)|[،,.]|$)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const name = m[1].replace(/\s+/g, ' ').trim();
    // Skip phrases that are clearly not a merchant ("to your account").
    if (/^(your|you|the|a|an)\b/i.test(name) || /account|card|\d{4,}/i.test(name)) continue;
    return name;
  }
  return null;
}

function findCard(text: string): string | null {
  const m =
    text.match(/(?:ending(?:\s+(?:with|in))?|ends? with|no\.?|number|\*{2,}|x{2,}|\.{3}|\b(?:card|acct|account))\s*:?\s*(\d{4})\b/i) ??
    text.match(/(?:المنتهية|المنتهي|تنتهي|رقم)\s*(?:ب|بـ|في)?\s*\*{0,}(\d{4})\b/) ??
    // Masked numbers like "005-375***-013": keep the visible tail.
    text.match(/[*xX]{2,}[-\s]?(\d{3,4})\b/);
  return m ? m[1] : null;
}

export function parseDebitSms(raw: string): ParsedDebit | null {
  const text = normalizeDigits(raw).replace(/\s+/g, ' ').trim();
  if (IGNORE.test(text)) return null;
  if (!DEBIT.test(text)) return null;
  // "Credit card was used" is a debit; "account credited" is not. Only bail
  // on credit wording when there's no stronger debit verb.
  if (CREDIT.test(text) && !/\b(debited|purchase|used|spent|withdraw|paid)\b|خصم|سحب|شراء/i.test(text)) return null;
  const money = findAmount(text);
  if (!money) return null;

  const lower = text.toLowerCase();
  const kind: ParsedDebit['kind'] = /\batm\b|withdraw|سحب/.test(lower)
    ? 'withdrawal'
    : /transfer|تحويل/.test(lower)
      ? 'transfer'
      : /purchase|\bused\b|spent|\bpos\b|شراء|مشتريات/.test(lower)
        ? 'purchase'
        : 'debit';

  return { ...money, merchant: findMerchant(text), cardLast4: findCard(text), kind, cardType: detectCardType(text) };
}

// Paying off a credit card: "Your HSBC credit card payment of EGP 3,000.00
// has been received". Imported as a transfer from a bank account to the card.
export function parseCardPaymentSms(raw: string): ParsedDebit | null {
  const text = normalizeDigits(raw).replace(/\s+/g, ' ').trim();
  if (/\b(otp|password|declined|failed|due|minimum)\b/i.test(text)) return null;
  const isPayment =
    /(credit\s*card|card)\s+payment/i.test(text) ||
    /payment\s+(?:of\s+)?\S+\s*[\d,.]+\s+(?:to|towards|for)\s+your\s+(?:\w+\s+)?credit\s*card/i.test(text) ||
    /سداد.*بطاقة/.test(text);
  if (!isPayment || !/receiv|credited|thank|successful|تم/i.test(text)) return null;
  const money = findAmount(text);
  if (!money) return null;
  return { ...money, merchant: 'Credit card payment', cardLast4: findCard(text), kind: 'card_payment', cardType: 'credit' };
}

// Money coming in: salary, transfers received, deposits and refunds.
export function parseCreditSms(raw: string): ParsedDebit | null {
  const text = normalizeDigits(raw).replace(/\s+/g, ' ').trim();
  if (IGNORE.test(text)) return null;
  if (!CREDIT.test(text)) return null;
  // "Payment received for your credit card" is you paying the bank — skip.
  if (/credit card payment|card payment/i.test(text)) return null;
  const money = findAmount(text);
  if (!money) return null;
  const from = text.match(/\bfrom\s+(.{2,40}?)(?=\s+(?:on|dated|to|ref|reference|into)\b|\s*[.,;]\s|\s*[.,;]?$)/i);
  const source = from && !/your|account|card|\d{4,}/i.test(from[1]) ? from[1].trim() : null;
  const label = /salary|payroll|راتب/i.test(text) ? 'Salary' : /refund|مرتجع|استرداد/i.test(text) ? 'Refund' : source;
  return { ...money, merchant: label, cardLast4: findCard(text), kind: 'credit', cardType: detectCardType(text) };
}

// "Available balance EGP 20,000.00" → the balance the bank reports after
// this transaction (credit-card "available limit" is deliberately ignored).
export function parseReportedBalance(raw: string): { amount: number; currency: string } | null {
  const text = normalizeDigits(raw).replace(/\s+/g, ' ');
  const m =
    text.match(new RegExp(`(?:available|avail\\.?|current|ledger|account)?\\s*bal(?:ance)?\\.?\\s*(?:is|:|of)?\\s*${CUR}\\s?${AMT}`, 'i')) ??
    text.match(new RegExp(`(?:available|avail\\.?|current)?\\s*bal(?:ance)?\\.?\\s*(?:is|:|of)?\\s*${AMT}\\s?${CUR}`, 'i')) ??
    text.match(new RegExp(`(?:الرصيد|رصيد)(?:\\s*(?:المتاح|الحالي))?\\s*:?\\s*${AMT}\\s?${CUR}`));
  if (!m) return null;
  // Group order differs between the currency-first and amount-first forms.
  const [a, b] = [m[1], m[2]];
  const amountStr = /\d/.test(a) ? a : b;
  const curStr = /\d/.test(a) ? b : a;
  const value = Number(amountStr.replace(/,/g, ''));
  if (!(value >= 0)) return null;
  return { amount: Math.round(value * 100), currency: toCode(curStr) };
}
