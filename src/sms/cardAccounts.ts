// Keeping each card from bank SMS on its own account. A card number that
// isn't linked yet must never borrow another card's account: that's how
// every new card used to pile onto the first credit card you added.
import { useFinanceStore } from '../store/financeStore';
import { useSettingsStore } from '../store/settingsStore';
import * as financeRepo from '../db/repositories/finance';
import * as linksRepo from '../db/repositories/cardLinks';
import { getDb } from '../db/client';
import type { Account, CardLink, SmsImport } from '../db/types';
import { bankName } from './banks';

// The account these digits belong to: the one they're linked to, the one
// you gave these digits, or one named with them.
export function cardOwner(digits: string, accounts: Account[], links: Record<string, CardLink>): Account | undefined {
  const open = accounts.filter((a) => !a.is_archived);
  return (
    open.find((a) => a.id === links[digits]?.account_id) ??
    open.find((a) => a.card_last4 === digits) ??
    open.find((a) => a.name.includes(digits))
  );
}

// A card account that already belongs to a different card number.
export function claimedByOther(account: Account, digits: string, links: Record<string, CardLink>): boolean {
  if (account.card_last4 && account.card_last4 !== digits) return true;
  // Named after another card, like "Visa ••1234".
  if (/••\s?\d{3,4}/.test(account.name) && !account.name.includes(digits)) return true;
  return Object.entries(links).some(([d, l]) => d !== digits && l.account_id === account.id);
}

// Credit card accounts a card with these digits may land on: ones that
// don't already belong to another card.
export function freeCreditCards(digits: string | null, accounts: Account[], links: Record<string, CardLink>): Account[] {
  return accounts.filter((a) => !a.is_archived && a.type === 'credit' && !(digits && claimedByOther(a, digits, links)));
}

export function cardAccountName(bank: string | null, credit: boolean, digits: string | null): string {
  return `${bank ?? (credit ? 'My' : 'Card')} ${credit ? 'Credit Card' : 'Debit'}${digits ? ` ••${digits}` : ''}`;
}

// A new account for one card, linked to its digits and shown on Home.
export async function createCardAccount(opts: { digits: string | null; bank: string | null; credit: boolean; currency: string }): Promise<Account | null> {
  const finance = useFinanceStore.getState();
  const id = await financeRepo.createAccount({
    name: cardAccountName(opts.bank, opts.credit, opts.digits),
    type: opts.credit ? 'credit' : 'bank',
    currency: opts.currency,
    icon: 'creditcard.fill',
    color: opts.credit ? '#AF52DE' : '#007AFF',
    sort_order: finance.accounts.length,
    card_last4: opts.digits,
  });
  if (opts.digits) await linksRepo.setCardLink(opts.digits, id, opts.credit ? 'credit' : 'debit');
  await useFinanceStore.getState().refreshAccounts();
  const { homeAccounts, setHomeAccountShown } = useSettingsStore.getState();
  if (homeAccounts && !homeAccounts.includes(id)) {
    setHomeAccountShown(id, true, useFinanceStore.getState().accounts.map((a) => a.id));
  }
  return useFinanceStore.getState().accounts.find((a) => a.id === id) ?? null;
}

// The card account for an SMS with digits nobody owns yet.
export function createCardAccountFor(item: SmsImport, currency?: string): Promise<Account | null> {
  return createCardAccount({
    digits: item.card_last4,
    bank: bankName(item.sender, item.body),
    credit: item.kind === 'card_payment' || item.card_type === 'credit',
    currency: currency ?? item.currency,
  });
}

// One-time repair for cards that were merged into one account: every extra
// card number linked to a credit card account gets its own account again,
// and the charges and payments that came from it move with it. The account
// keeps the card it was given digits for, or else the first card seen on it.
export async function splitMergedCards(): Promise<string[]> {
  const db = await getDb();
  const links = await linksRepo.listCardLinks();
  const accounts = useFinanceStore.getState().accounts;
  const firstSeen = new Map(
    (await db.getAllAsync<{ card_last4: string; first: string }>('SELECT card_last4, MIN(sms_date) AS first FROM sms_imports WHERE card_last4 IS NOT NULL GROUP BY card_last4')).map((r) => [
      r.card_last4,
      r.first,
    ])
  );
  const split: string[] = [];
  for (const account of accounts) {
    if (account.type !== 'credit') continue;
    const digits = links.filter((l) => l.account_id === account.id).map((l) => l.id);
    if (account.card_last4 && !digits.includes(account.card_last4)) digits.push(account.card_last4);
    if (digits.length < 2) continue;
    const keep =
      (account.card_last4 && digits.includes(account.card_last4) ? account.card_last4 : null) ??
      digits.find((d) => account.name.includes(d)) ??
      [...digits].sort((a, b) => (firstSeen.get(a) ?? '9').localeCompare(firstSeen.get(b) ?? '9'))[0];
    for (const d of digits) {
      if (d === keep) continue;
      const sample = await db.getFirstAsync<SmsImport>('SELECT * FROM sms_imports WHERE card_last4 = ? ORDER BY sms_date DESC LIMIT 1', [d]);
      const id = await financeRepo.createAccount({
        name: cardAccountName(sample ? bankName(sample.sender, sample.body) : null, true, d),
        type: 'credit',
        currency: account.currency,
        icon: 'creditcard.fill',
        color: '#AF52DE',
        sort_order: accounts.length + split.length,
        card_last4: d,
      });
      await linksRepo.setCardLink(d, id, 'credit');
      // Move what this card's alerts added. Transactions keep the alert's
      // time as their date, so date plus account finds them.
      const added = await db.getAllAsync<SmsImport>("SELECT * FROM sms_imports WHERE card_last4 = ? AND status = 'added'", [d]);
      for (const item of added) {
        const payment = item.kind === 'card_payment';
        const tx = await db.getFirstAsync<{ id: string }>(
          payment
            ? 'SELECT id FROM transactions WHERE transfer_to_account_id = ? AND date = ? LIMIT 1'
            : 'SELECT id FROM transactions WHERE account_id = ? AND date = ? LIMIT 1',
          [account.id, item.sms_date]
        );
        if (tx) await financeRepo.updateTransaction(tx.id, payment ? { transfer_to_account_id: id } : { account_id: id });
      }
      split.push(d);
    }
    // Pin the card it kept, so other cards can't land on it again.
    if (!account.card_last4) await financeRepo.updateAccount(account.id, { card_last4: keep });
  }
  if (split.length) {
    await Promise.all([useFinanceStore.getState().refreshAccounts(), useFinanceStore.getState().refreshTransactions()]);
    const { homeAccounts, setHomeAccountShown } = useSettingsStore.getState();
    if (homeAccounts) {
      const all = useFinanceStore.getState().accounts;
      for (const d of split) {
        const a = all.find((x) => x.card_last4 === d);
        if (a && !homeAccounts.includes(a.id)) setHomeAccountShown(a.id, true, all.map((x) => x.id));
      }
    }
  }
  return split;
}
