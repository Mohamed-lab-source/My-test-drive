import { create } from 'zustand';
import { useSettingsStore } from '../store/settingsStore';
import { useFinanceStore } from '../store/financeStore';
import * as repo from '../db/repositories/smsImports';
import type { Account, SmsImport } from '../db/types';
import { parseDebitSms } from './parser';
import { isSmsReadingAvailable, readBankSms } from './native';

const FIRST_SCAN_DAYS = 30;

interface SmsState {
  pending: SmsImport[];
  scanning: boolean;
  refresh: () => Promise<void>;
  scan: () => Promise<number>;
  add: (item: SmsImport, categoryId: string | null, accountId: string | null) => Promise<void>;
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

export const useSmsStore = create<SmsState>((set, get) => ({
  pending: [],
  scanning: false,

  refresh: async () => set({ pending: await repo.listSmsImports('pending') }),

  // Reads new bank SMS since the last scan and queues any debits for review.
  scan: async () => {
    const { smsImportEnabled, smsSenders, smsLastScan, setSmsLastScan } = useSettingsStore.getState();
    if (!smsImportEnabled || !isSmsReadingAvailable() || get().scanning) return 0;
    set({ scanning: true });
    try {
      const since = smsLastScan || Date.now() - FIRST_SCAN_DAYS * 86400000;
      const messages = await readBankSms(since, smsSenders);
      let added = 0;
      let newest = since;
      for (const m of messages) {
        newest = Math.max(newest, m.date);
        const parsed = parseDebitSms(m.body);
        if (!parsed) continue;
        const isNew = await repo.insertSmsImport({
          id: `sms-${m.id}-${m.date}`,
          sms_date: new Date(m.date).toISOString(),
          sender: m.address,
          body: m.body,
          amount: parsed.amount,
          currency: parsed.currency,
          merchant: parsed.merchant,
          card_last4: parsed.cardLast4,
          kind: parsed.kind,
        });
        if (isNew) added++;
      }
      setSmsLastScan(newest);
      await get().refresh();
      return added;
    } finally {
      set({ scanning: false });
    }
  },

  add: async (item, categoryId, accountId) => {
    const finance = useFinanceStore.getState();
    const cash = finance.accounts.find((a) => a.type === 'cash' && !a.is_archived && a.id !== accountId);
    // An ATM withdrawal moves money into your wallet rather than spending it.
    const asTransfer = item.kind === 'withdrawal' && !!cash;
    await finance.addTransaction({
      type: asTransfer ? 'transfer' : 'expense',
      amount: item.amount,
      currency: item.currency,
      account_id: accountId,
      transfer_to_account_id: asTransfer ? cash!.id : null,
      category_id: asTransfer ? null : categoryId,
      recurring_id: null,
      note: item.merchant ?? (item.kind === 'withdrawal' ? 'ATM withdrawal' : 'Card payment'),
      date: item.sms_date,
    });
    await repo.setSmsImportStatus(item.id, 'added');
    await get().refresh();
  },

  dismiss: async (id) => {
    await repo.setSmsImportStatus(id, 'dismissed');
    await get().refresh();
  },
}));
