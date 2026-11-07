import { allRows, deleteRow, getRow, insertRow, updateRow } from '../helpers';
import type { MerchantRule } from '../types';

// Rules are keyed by the merchant text exactly as the bank sends it.
export const ruleKey = (merchant: string) => merchant.trim().toLowerCase();

export const listMerchantRules = () => allRows<MerchantRule>('merchant_rules', 'display ASC');

export async function setMerchantRule(merchant: string, display: string, categoryId: string | null): Promise<void> {
  const id = ruleKey(merchant);
  if (await getRow('merchant_rules', id)) await updateRow('merchant_rules', id, { display, category_id: categoryId });
  else await insertRow('merchant_rules', { id, display, category_id: categoryId });
}

export const deleteMerchantRule = (id: string) => deleteRow('merchant_rules', id);
