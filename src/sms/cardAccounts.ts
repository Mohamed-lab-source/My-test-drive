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

// An account made for one card: any credit card, or one named after its
// digits like "HSBC Debit ••1234".
export function isCardAccount(a: Account): boolean {
  return a.type === 'credit' || /••\s?\d{3,4}/.test(a.name);
}

// The digits an account is named after ("Visa ••1234" → "1234").
function nameDigits(a: Account): string | null {
  return a.name.match(/••\s?(\d{3,4})/)?.[1] ?? null;
}

export type CardKind = 'credit' | 'debit' | null;

export function cardAccountName(bank: string | null, kind: CardKind, digits: string | null): string {
  const what = kind === 'credit' ? 'Credit Card' : kind === 'debit' ? 'Debit' : 'Card';
  return `${bank ?? (kind === 'credit' ? 'My' : 'Bank')} ${what}${digits ? ` ••${digits}` : ''}`;
}

// A new account for one card, linked to its digits and shown on Home.
export async function createCardAccount(opts: { digits: string | null; bank: string | null; kind: CardKind; currency: string }): Promise<Account | null> {
  const id = await financeRepo.createAccount({
    name: cardAccountName(opts.bank, opts.kind, opts.digits),
    type: opts.kind === 'credit' ? 'credit' : 'bank',
    currency: opts.currency,
    icon: 'creditcard.fill',
    color: opts.kind === 'credit' ? '#AF52DE' : '#007AFF',
    sort_order: useFinanceStore.getState().accounts.length,
    card_last4: opts.digits,
  });
  if (opts.digits) await linksRepo.setCardLink(opts.digits, id, opts.kind === 'credit' ? 'credit' : 'debit');
  await useFinanceStore.getState().refreshAccounts();
  showOnHome(id);
  return useFinanceStore.getState().accounts.find((a) => a.id === id) ?? null;
}

function showOnHome(id: string) {
  const { homeAccounts, setHomeAccountShown } = useSettingsStore.getState();
  if (homeAccounts && !homeAccounts.includes(id)) setHomeAccountShown(id, true, useFinanceStore.getState().accounts.map((a) => a.id));
}

// The card account for an SMS with digits nobody owns yet.
export function createCardAccountFor(item: SmsImport): Promise<Account | null> {
  return createCardAccount({
    digits: item.card_last4,
    bank: bankName(item.sender, item.body),
    kind: item.kind === 'card_payment' ? 'credit' : item.card_type ?? null,
    currency: item.currency,
  });
}

interface Hit {
  item: SmsImport;
  txId: string;
  // The account the charge sits on (for a card payment, the card it paid).
  accountId: string;
  payment: boolean;
}

export interface SplitResult {
  // Card numbers moved to their own account, and how many charges moved.
  cards: string[];
  moved: number;
}

// Repair for cards that were merged into one account. It works from the
// charges themselves: each added bank alert is matched to its transaction,
// and a card's charges sitting on an account that belongs to a different
// card move to that card's own account (an existing one with its digits, or
// a new one). A card account keeps the card it was given digits for, or the
// first card seen on it; a bank account keeps its debit cards and only
// loses credit card charges.
export async function splitMergedCards(): Promise<SplitResult> {
  const db = await getDb();
  const linkRows = await linksRepo.listCardLinks();
  const accounts = useFinanceStore.getState().accounts.filter((a) => !a.is_archived);
  const added = await db.getAllAsync<SmsImport>("SELECT * FROM sms_imports WHERE status = 'added' AND card_last4 IS NOT NULL ORDER BY sms_date ASC");

  // Each alert's transaction: the same moment (within two minutes) and,
  // where there's a choice, the same amount.
  const used = new Set<string>();
  const hits: Hit[] = [];
  for (const item of added) {
    const t = new Date(item.sms_date).getTime();
    if (!Number.isFinite(t)) continue;
    const payment = item.kind === 'card_payment';
    const rows = await db.getAllAsync<{ id: string; account_id: string | null; transfer_to_account_id: string | null; amount: number }>(
      `SELECT id, account_id, transfer_to_account_id, amount FROM transactions WHERE date >= ? AND date <= ?${payment ? " AND type = 'transfer'" : ''}`,
      [new Date(t - 120000).toISOString(), new Date(t + 120000).toISOString()]
    );
    const free = rows.filter((r) => !used.has(r.id));
    const tx = free.find((r) => r.amount === item.amount) ?? (free.length === 1 ? free[0] : undefined);
    const accountId = tx ? (payment ? tx.transfer_to_account_id : tx.account_id) : null;
    if (!tx || !accountId) continue;
    used.add(tx.id);
    hits.push({ item, txId: tx.id, accountId, payment });
  }

  const firstSeen = new Map<string, string>();
  for (const h of hits) if (!firstSeen.has(h.item.card_last4!)) firstSeen.set(h.item.card_last4!, h.item.sms_date);

  const result: SplitResult = { cards: [], moved: 0 };
  const owners = new Map<string, string>();
  for (const account of accounts) {
    const on = hits.filter((h) => h.accountId === account.id);
    const linked = linkRows.filter((l) => l.account_id === account.id);
    const digits = new Set<string>([...on.map((h) => h.item.card_last4!), ...linked.map((l) => l.id)]);
    if (account.card_last4) digits.add(account.card_last4);
    if (digits.size < 2) continue;
    const card = isCardAccount(account);
    const keep =
      account.card_last4 ??
      nameDigits(account) ??
      (card ? [...digits].sort((a, b) => (firstSeen.get(a) ?? '9').localeCompare(firstSeen.get(b) ?? '9'))[0] : null);
    for (const d of digits) {
      if (d === keep) continue;
      const mine = on.filter((h) => h.item.card_last4 === d);
      const credit =
        mine.some((h) => h.payment || h.item.card_type === 'credit') || (!mine.length && linked.some((l) => l.id === d && l.card_type === 'credit'));
      // A bank account's own debit cards stay on it.
      if (!card && !credit) continue;
      let target = owners.get(d) ?? accounts.find((a) => a.id !== account.id && (a.card_last4 === d || nameDigits(a) === d))?.id;
      if (!target) {
        const sample = mine[mine.length - 1]?.item ?? (await db.getFirstAsync<SmsImport>('SELECT * FROM sms_imports WHERE card_last4 = ? ORDER BY sms_date DESC LIMIT 1', [d]));
        const kind: CardKind = credit || account.type === 'credit' ? 'credit' : sample?.card_type ?? 'debit';
        target = await financeRepo.createAccount({
          name: cardAccountName(sample ? bankName(sample.sender, sample.body) : null, kind, d),
          type: kind === 'credit' ? 'credit' : 'bank',
          currency: account.currency,
          icon: 'creditcard.fill',
          color: kind === 'credit' ? '#AF52DE' : '#007AFF',
          sort_order: accounts.length + result.cards.length,
          card_last4: d,
        });
      }
      owners.set(d, target);
      await linksRepo.setCardLink(d, target, credit || account.type === 'credit' ? 'credit' : 'debit');
      for (const h of mine) {
        await financeRepo.updateTransaction(h.txId, h.payment ? { transfer_to_account_id: target } : { account_id: target });
        result.moved++;
      }
      result.cards.push(d);
    }
    // Pin the card it kept, so other cards can't land on it again.
    if (card && keep && !account.card_last4) await financeRepo.updateAccount(account.id, { card_last4: keep });
  }

  if (result.cards.length) {
    await Promise.all([useFinanceStore.getState().refreshAccounts(), useFinanceStore.getState().refreshTransactions()]);
    for (const id of new Set(owners.values())) showOnHome(id);
  }
  return result;
}

export function splitMessage(r: SplitResult): string {
  const cards = r.cards.length === 1 ? `Card ••${r.cards[0]} now has its own account` : `${r.cards.length} cards now have their own accounts`;
  return r.moved ? `${cards} (${r.moved} charge${r.moved === 1 ? '' : 's'} moved)` : cards;
}
