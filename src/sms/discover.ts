import { readBankSms } from './native';
import { parseCardPaymentSms, parseCreditSms, parseDebitSms } from './parser';
import { bankName } from './banks';

export interface FoundSender {
  sender: string;
  bank: string | null;
  alerts: number;
  cards: string[];
  example: string | null;
}

// Looks through the whole inbox (on the phone, nothing is stored) for
// senders whose messages read like card or account alerts, so banks you
// haven't added yet can be switched on in one tap. Personal numbers are
// skipped: banks send from a name like "CIB", not a phone number.
export async function discoverBankSenders(current: string[], days = 120): Promise<FoundSender[]> {
  const messages = await readBankSms(Date.now() - days * 86400000, [], 3000);
  const known = current.map((s) => s.toLowerCase()).filter(Boolean);
  const bySender = new Map<string, FoundSender>();
  for (const m of messages) {
    const address = (m.address ?? '').trim();
    if (!address || !/[a-z]/i.test(address)) continue;
    if (known.some((k) => address.toLowerCase().includes(k))) continue;
    const parsed = parseCardPaymentSms(m.body) ?? parseDebitSms(m.body) ?? parseCreditSms(m.body);
    // A bank alert names a card or account, not just an amount.
    if (!parsed || !(parsed.cardLast4 || parsed.cardType || /card|account|acct|بطاق|حساب/i.test(m.body))) continue;
    const entry = bySender.get(address) ?? { sender: address, bank: bankName(address, m.body), alerts: 0, cards: [], example: null };
    entry.alerts++;
    if (parsed.cardLast4 && !entry.cards.includes(parsed.cardLast4)) entry.cards.push(parsed.cardLast4);
    if (!entry.example && parsed.merchant) entry.example = parsed.merchant;
    bySender.set(address, entry);
  }
  return [...bySender.values()].sort((a, b) => b.alerts - a.alerts);
}
