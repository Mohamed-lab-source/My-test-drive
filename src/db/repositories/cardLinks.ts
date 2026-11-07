import { allRows, getRow, insertRow, updateRow, deleteRow } from '../helpers';
import type { CardLink } from '../types';

// Which Anchor account a card/account number from bank SMS belongs to.
export const listCardLinks = () => allRows<CardLink>('card_links', 'id ASC');

export async function setCardLink(digits: string, accountId: string, cardType: CardLink['card_type']): Promise<void> {
  if (await getRow('card_links', digits)) await updateRow('card_links', digits, { account_id: accountId, card_type: cardType });
  else await insertRow('card_links', { id: digits, account_id: accountId, card_type: cardType });
}

export const deleteCardLink = (digits: string) => deleteRow('card_links', digits);
