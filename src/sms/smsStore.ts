import { create } from 'zustand';
import { useSettingsStore } from '../store/settingsStore';
import { useFinanceStore } from '../store/financeStore';
import * as repo from '../db/repositories/smsImports';
import * as rulesRepo from '../db/repositories/merchantRules';
import * as linksRepo from '../db/repositories/cardLinks';
import type { Account, CardLink, MerchantRule, RecurringRule, SmsImport } from '../db/types';
import { parseCardPaymentSms, parseCreditSms, parseDebitSms, parseReportedBalance } from './parser';
import { convertToBase } from '../db/repositories/fx';
import { useUndoStore } from '../store/undoStore';
import { configureSmsAlerts, isSmsReadingAvailable, readBankSms } from './native';
import { bankName, cardLabel } from './banks';
import { notifyNow } from '../notifications/scheduler';

const FIRST_SCAN_DAYS = 30;

interface SmsState {
  pending: SmsImport[];
  rules: Record<string, MerchantRule>;
  loadRules: () => Promise<void>;
  links: Record<string, CardLink>;
  loadLinks: () => Promise<void>;
  scanning: boolean;
  refresh: () => Promise<void>;
  // days: rescan that far back instead of continuing from the last scan.
  scan: (days?: number) => Promise<number>;
  // ruleId: this charge is a bill's payment — link it and move the bill on.
  add: (item: SmsImport, categoryId: string | null, accountId: string | null, opts?: { silent?: boolean; ruleId?: string }) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
}

// The account debits are posted from: the chosen one, else the default
// account, else the first bank account.
export function smsTargetAccount(accounts: Account[]): Account | null {
  const { smsAccountId, defaultAccountId } = useSettingsStore.getState();
  const open = accounts.filter((a) => !a.is_archived);
  return (
    open.find((a) => a.id === smsAccountId) ??
    open.find((a) => a.id === defaultAccountId) ??
    open.find((a) => a.type === 'bank') ??
    open[0] ??
    null
  );
}

// Where an imported SMS should be posted: the account its card number is
// linked to, else (for a credit-card charge) your credit card account, else
// the default bank account. Card payments come *from* the bank account.
export function accountForImport(item: SmsImport, accounts: Account[], links: Record<string, CardLink>): Account | null {
  const open = accounts.filter((a) => !a.is_archived);
  if (item.kind !== 'card_payment' && item.card_last4) {
    const linked = open.find((a) => a.id === links[item.card_last4!]?.account_id);
    if (linked) return linked;
    // An account named with the card's digits ("CIB Credit Card ••4521").
    const named = open.find((a) => a.name.includes(item.card_last4!));
    if (named) return named;
  }
  if (item.kind !== 'card_payment' && item.card_type === 'credit') {
    // Prefer a credit card account from the same bank over any credit card.
    const bank = bankName(item.sender, item.body)?.toLowerCase();
    const sameBank = bank ? open.find((a) => a.type === 'credit' && a.name.toLowerCase().includes(bank)) : undefined;
    const card = sameBank ?? open.find((a) => a.type === 'credit');
    if (card) return card;
  }
  if (item.card_type === 'debit' || item.kind === 'card_payment') {
    const bank = smsTargetAccount(accounts);
    if (bank && bank.type !== 'credit') return bank;
    return open.find((a) => a.type === 'bank') ?? bank;
  }
  return smsTargetAccount(accounts);
}

// The credit card a payment SMS is paying off.
// A due bill (recurring expense) this charge probably pays: amount within 3%
// and due within a week either side of the message.
export function billFor(item: SmsImport, rules: RecurringRule[]): RecurringRule | null {
  if (item.kind === 'credit' || item.kind === 'card_payment') return null;
  const t = new Date(item.sms_date).getTime();
  return (
    rules.find(
      (r) =>
        r.is_active &&
        !r.is_paused &&
        r.type === 'expense' &&
        r.currency === item.currency &&
        Math.abs(r.amount - item.amount) <= r.amount * 0.03 &&
        Math.abs(new Date(r.next_due_date).getTime() - t) <= 7 * 86400000
    ) ?? null
  );
}

export function creditCardFor(item: SmsImport, accounts: Account[], links: Record<string, CardLink>): Account | null {
  const open = accounts.filter((a) => !a.is_archived && a.type === 'credit');
  if (item.card_last4) {
    const linked = open.find((a) => a.id === links[item.card_last4!]?.account_id);
    if (linked) return linked;
    const named = open.find((a) => a.name.includes(item.card_last4!));
    if (named) return named;
  }
  const bank = bankName(item.sender, item.body)?.toLowerCase();
  return (bank ? open.find((a) => a.name.toLowerCase().includes(bank)) : undefined) ?? open[0] ?? null;
}

// A foreign-currency charge converted into the account's currency with your
// saved rate, when the account uses your main currency and a rate exists.
function convertForAccount(amount: number, from: string, account: Account | undefined): { amount: number; currency: string; converted: boolean } {
  if (!account || from === account.currency) return { amount, currency: from, converted: false };
  const { currency: base } = useSettingsStore.getState();
  const rates = useFinanceStore.getState().fxRates;
  if (account.currency === base && rates.some((r) => r.currency === from)) {
    return { amount: convertToBase(amount, from, base, rates), currency: base, converted: true };
  }
  return { amount, currency: from, converted: false };
}

// Pushes the current settings to the native SMS receiver.
export function syncSmsAlertConfig(): void {
  const { smsImportEnabled, smsInstantAlerts, smsSenders } = useSettingsStore.getState();
  configureSmsAlerts(smsImportEnabled && smsInstantAlerts, smsSenders);
}

// A merchant you've already confirmed (and its category): a saved merchant
// rule first, then your history.
function knownMerchantCategory(merchant: string | null): string | null {
  if (!merchant) return null;
  const rule = useSmsStore.getState().rules[rulesRepo.ruleKey(merchant)];
  if (rule?.category_id) return rule.category_id;
  const m = merchant.toLowerCase();
  const past = useFinanceStore
    .getState()
    .transactions.find((t) => t.type === 'expense' && t.category_id && t.note?.toLowerCase() === m);
  return past?.category_id ?? null;
}

export const useSmsStore = create<SmsState>((set, get) => ({
  pending: [],
  rules: {},
  links: {},
  scanning: false,

  loadLinks: async () => {
    const list = await linksRepo.listCardLinks();
    set({ links: Object.fromEntries(list.map((l) => [l.id, l])) });
  },

  loadRules: async () => {
    const list = await rulesRepo.listMerchantRules();
    set({ rules: Object.fromEntries(list.map((r) => [r.id, r])) });
  },

  // Re-reads pending items with the current parser first, so a parser fix
  // also corrects debits that were imported (wrongly) before it.
  refresh: async () => {
    await get().loadLinks();
    for (const item of await repo.listSmsImports('pending')) {
      const parsed =
        item.kind === 'credit'
          ? parseCreditSms(item.body)
          : item.kind === 'card_payment'
            ? parseCardPaymentSms(item.body)
            : parseDebitSms(item.body);
      if (!parsed) continue;
      const balance = parseReportedBalance(item.body);
      if (
        parsed.cardType !== (item.card_type ?? null) ||
        parsed.amount !== item.amount ||
        parsed.currency !== item.currency ||
        parsed.merchant !== item.merchant ||
        parsed.cardLast4 !== item.card_last4 ||
        (balance?.amount ?? null) !== (item.balance ?? null)
      ) {
        await repo.updateSmsImportParsed(item.id, {
          amount: parsed.amount,
          currency: parsed.currency,
          merchant: parsed.merchant,
          card_last4: parsed.cardLast4,
          kind: parsed.kind,
          card_type: parsed.cardType,
          balance: balance?.amount ?? null,
          balance_currency: balance?.currency ?? null,
        });
      }
    }
    set({ pending: await repo.listSmsImports('pending') });
  },

  // Reads new bank SMS since the last scan and queues any debits for review.
  scan: async (days) => {
    const { smsImportEnabled, smsSenders, smsLastScan, setSmsLastScan, smsReadCredits, smsAutoAddKnown } =
      useSettingsStore.getState();
    await get().loadRules();
    if (!smsImportEnabled || !isSmsReadingAvailable() || get().scanning) return 0;
    set({ scanning: true });
    try {
      const since = days ? Date.now() - days * 86400000 : smsLastScan || Date.now() - FIRST_SCAN_DAYS * 86400000;
      const messages = await readBankSms(since, smsSenders);
      let added = 0;
      let newest = since;
      const newCards = new Map<string, string>();
      for (const m of messages) {
        newest = Math.max(newest, m.date);
        const parsed = parseCardPaymentSms(m.body) ?? parseDebitSms(m.body) ?? (smsReadCredits ? parseCreditSms(m.body) : null);
        if (!parsed) continue;
        // Merchants you chose to always ignore (e.g. your own transfers).
        if (parsed.merchant && useSettingsStore.getState().smsIgnored.includes(parsed.merchant.toLowerCase())) continue;
        const row = {
          id: `sms-${m.id}-${m.date}`,
          sms_date: new Date(m.date).toISOString(),
          sender: m.address,
          body: m.body,
          amount: parsed.amount,
          currency: parsed.currency,
          merchant: parsed.merchant,
          card_last4: parsed.cardLast4,
          kind: parsed.kind,
          card_type: parsed.cardType,
          balance: parseReportedBalance(m.body)?.amount ?? null,
          balance_currency: parseReportedBalance(m.body)?.currency ?? null,
        };
        // A card number Anchor has never seen: worth telling you about.
        if (parsed.cardLast4 && !get().links[parsed.cardLast4] && !newCards.has(parsed.cardLast4) && !(await repo.hasSeenCard(parsed.cardLast4))) {
          newCards.set(parsed.cardLast4, cardLabel(bankName(m.address, m.body), parsed.cardLast4));
        }
        const isNew = await repo.insertSmsImport(row);
        if (!isNew) continue;
        added++;
        // Merchants you've confirmed before skip the inbox entirely.
        const known =
          parsed.kind === 'purchase' || parsed.kind === 'debit' ? knownMerchantCategory(parsed.merchant) : null;
        if (smsAutoAddKnown && known) {
          const item: SmsImport = { ...row, status: 'pending', created_at: '' };
          const account = accountForImport(item, useFinanceStore.getState().accounts, get().links);
          await get().add(item, known, account?.id ?? null, { silent: true });
        }
      }
      setSmsLastScan(Math.max(newest, useSettingsStore.getState().smsLastScan));
      if (newCards.size) {
        const names = [...newCards.values()];
        notifyNow(
          newCards.size === 1 ? `New card spotted: ${names[0]}` : `${newCards.size} new cards spotted`,
          `${newCards.size === 1 ? '' : names.join(', ') + '. '}Tap to see its spending and link it to an account.`,
          '/money/cards'
        ).catch(() => {});
      }
      await get().refresh();
      return added;
    } finally {
      set({ scanning: false });
    }
  },

  add: async (item, categoryId, accountId, opts) => {
    const finance = useFinanceStore.getState();
    const account = finance.accounts.find((a) => a.id === accountId);
    // Remember which account this card/account number belongs to.
    if (item.card_last4 && account && item.kind !== 'card_payment' && get().links[item.card_last4]?.account_id !== account.id) {
      await linksRepo.setCardLink(item.card_last4, account.id, account.type === 'credit' ? 'credit' : 'debit');
      await get().loadLinks();
    }
    const offerUndo = (transactionId: string, label: string) => {
      if (opts?.silent) return;
      useUndoStore.getState().show(label, async () => {
        await useFinanceStore.getState().removeTransaction(transactionId);
        await repo.setSmsImportStatus(item.id, 'pending');
        await get().refresh();
      });
    };

    if (item.kind === 'card_payment') {
      const card = creditCardFor(item, finance.accounts, get().links);
      if (!card) throw new Error('NO_CREDIT_CARD');
      const id = await finance.addTransaction({
        type: 'transfer',
        amount: item.amount,
        currency: item.currency,
        account_id: accountId,
        transfer_to_account_id: card.id,
        category_id: null,
        recurring_id: null,
        note: `${card.name} payment`,
        date: item.sms_date,
      });
      await repo.setSmsImportStatus(item.id, 'added');
      await get().refresh();
      offerUndo(id, 'Card payment added');
      return;
    }
    const money = convertForAccount(item.amount, item.currency, account);
    const fxNote = money.converted ? ` (${item.currency} ${(item.amount / 100).toFixed(2)})` : '';
    const cash = finance.accounts.find((a) => a.type === 'cash' && !a.is_archived && a.id !== accountId);
    // An ATM withdrawal moves money into your wallet rather than spending it.
    const asTransfer = item.kind === 'withdrawal' && !!cash;
    const isCredit = item.kind === 'credit';
    if (isCredit) {
      const income = finance.categories.filter((c) => c.kind !== 'expense');
      const salary = income.find((c) => /salary|راتب/i.test(c.name));
      const id = await finance.addTransaction({
        type: 'income',
        amount: money.amount,
        currency: money.currency,
        account_id: accountId,
        transfer_to_account_id: null,
        category_id: categoryId ?? (item.merchant === 'Salary' ? salary?.id : income.find((c) => /other/i.test(c.name))?.id) ?? null,
        recurring_id: null,
        note: (item.merchant ?? 'Money received') + fxNote,
        date: item.sms_date,
      });
      await repo.setSmsImportStatus(item.id, 'added');
      await get().refresh();
      offerUndo(id, 'Income added');
      return;
    }
    const bill = opts?.ruleId ? finance.recurringRules.find((r) => r.id === opts.ruleId) : undefined;
    const id = await finance.addTransaction({
      type: asTransfer ? 'transfer' : 'expense',
      amount: money.amount,
      currency: money.currency,
      account_id: accountId,
      transfer_to_account_id: asTransfer ? cash!.id : null,
      category_id: asTransfer ? null : bill?.category_id ?? categoryId,
      recurring_id: bill?.id ?? null,
      note:
        (item.merchant ? get().rules[rulesRepo.ruleKey(item.merchant)]?.display : null) ??
        item.merchant ??
        (item.kind === 'withdrawal' ? 'ATM withdrawal' : 'Card payment') + fxNote,
      date: item.sms_date,
    });
    await repo.setSmsImportStatus(item.id, 'added');
    // The bill is paid: move it to its next due date without posting again.
    if (bill) await finance.skipRecurring(bill);
    // Keep a merchant rule's category in step with what was just chosen.
    const rule = item.merchant ? get().rules[rulesRepo.ruleKey(item.merchant)] : undefined;
    if (rule && categoryId && rule.category_id !== categoryId && !asTransfer) {
      await rulesRepo.setMerchantRule(item.merchant!, rule.display, categoryId);
      await get().loadRules();
    }
    await get().refresh();
    offerUndo(id, asTransfer ? 'Withdrawal added' : 'Expense added');
  },

  dismiss: async (id) => {
    await repo.setSmsImportStatus(id, 'dismissed');
    await get().refresh();
  },
}));
