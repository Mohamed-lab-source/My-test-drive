// Names the bank behind an alert (from the SMS sender, then the text) and the
// card network when the message mentions it.

// sender-only: names that also show up as merchants in other banks' alerts.
const BANKS: [RegExp, string, 'sender-only'?][] = [
  [/hsbc/i, 'HSBC'],
  [/\bcib\b|cibeg|commercial international/i, 'CIB'],
  [/\bnbe\b|nbegypt|ahly|الأهلي المصري|الاهلي المصري/i, 'NBE'],
  [/banque\s*misr|banquemisr|\bbm\b|بنك مصر/i, 'Banque Misr'],
  [/qnb/i, 'QNB'],
  [/aaib|arab african/i, 'AAIB'],
  [/alex\s*bank|alexbank/i, 'AlexBank'],
  [/banque\s*du\s*caire|\bbdc\b|بنك القاهرة/i, 'Banque du Caire'],
  [/credit\s*agricole|\bcae\b/i, 'Crédit Agricole'],
  [/\bsaib\b/i, 'SAIB'],
  [/\badib\b|abu dhabi islamic/i, 'ADIB'],
  [/\badcb\b/i, 'ADCB'],
  [/\bfab\b|first abu dhabi/i, 'FAB'],
  [/emirates\s*nbd|\benbd\b/i, 'Emirates NBD'],
  [/mashreq/i, 'Mashreq'],
  [/\bdib\b|dubai islamic/i, 'DIB'],
  [/rakbank/i, 'RAKBANK'],
  [/al\s*rajhi|alrajhi|الراجحي/i, 'Al Rajhi'],
  [/\bsnb\b|alahli|الأهلي السعودي/i, 'SNB'],
  [/riyad\s*bank|riyadbank/i, 'Riyad Bank'],
  [/\bstc\s*pay\b|stcpay/i, 'STC Pay', 'sender-only'],
  [/\bkfh\b|kuwait finance/i, 'KFH'],
  [/\bnbk\b/i, 'NBK'],
  [/telda/i, 'Telda', 'sender-only'],
  [/\bvalu\b/i, 'valU', 'sender-only'],
  [/instapay/i, 'InstaPay', 'sender-only'],
  [/vodafone\s*cash|vf\s*cash/i, 'Vodafone Cash', 'sender-only'],
  [/fawry/i, 'Fawry', 'sender-only'],
  [/\bmidbank\b|\bmid bank\b/i, 'MIDBANK'],
  [/\baub\b|ahli united/i, 'AUB'],
  [/\bebank\b|export development/i, 'EBank'],
];

export function bankName(sender: string, body = ''): string | null {
  for (const [re, name] of BANKS) if (re.test(sender)) return name;
  for (const [re, name, scope] of BANKS) if (!scope && re.test(body)) return name;
  // An alphanumeric sender ID is usually the bank's own short name.
  return /[a-z]/i.test(sender) ? sender.trim() : null;
}

export type CardNetwork = 'Visa' | 'Mastercard' | 'Amex' | 'mada' | 'Meeza';

export function cardNetwork(body: string): CardNetwork | null {
  if (/\bvisa\b|فيزا/i.test(body)) return 'Visa';
  if (/master\s*card|mastercard|ماستر/i.test(body)) return 'Mastercard';
  if (/\bamex\b|american express/i.test(body)) return 'Amex';
  if (/\bmada\b|مدى/i.test(body)) return 'mada';
  if (/meeza|ميزة/i.test(body)) return 'Meeza';
  return null;
}

// "CIB •• 4521", or the bank alone when the message shows no digits.
export function cardLabel(bank: string | null, last4: string | null): string {
  if (last4) return `${bank ?? 'Card'} •• ${last4}`;
  return bank ?? 'Card';
}
