import React, { useState } from 'react';
import { View, Text, Pressable, Share, Alert } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { TextField } from '../../ui/TextField';
import { useSettingsStore } from '../../store/settingsStore';
import { useSmsStore } from '../../sms/smsStore';
import { readBankSms } from '../../sms/native';
import { explainSms, looseParse, parseCardPaymentSms, parseCreditSms, parseDebitSms } from '../../sms/parser';
import { insertSmsImport } from '../../db/repositories/smsImports';
import { formatMoney } from '../../utils/money';
import { formatRelativeDay } from '../../utils/date';

const parseAny = (body: string, credits: boolean) =>
  parseCardPaymentSms(body) ?? parseDebitSms(body) ?? (credits ? parseCreditSms(body) : null);

// Bank messages from the last 30 days that Anchor did NOT import, with the
// reason — so a charge it missed (like an online/Uber payment in a new
// wording) can still be added, or shared so the reader can be improved.
export function SkippedMessagesCard() {
  const { colors, typography, spacing } = useTheme();
  const { smsSenders, smsReadCredits } = useSettingsStore();
  const refresh = useSmsStore((s) => s.refresh);
  const [items, setItems] = useState<{ id: string; date: number; address: string; body: string; reason: string; canAdd: boolean }[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const msgs = await readBankSms(Date.now() - 30 * 86400000, smsSenders, 300);
      setItems(
        msgs
          .filter((m) => !parseAny(m.body, smsReadCredits))
          .map((m) => {
            const why = explainSms(m.body);
            return { id: m.id, date: m.date, address: m.address, body: m.body, reason: why.reason, canAdd: !!why.amount };
          })
          .sort((a, b) => b.date - a.date)
      );
    } finally {
      setLoading(false);
    }
  };

  const addAnyway = async (m: { id: string; date: number; address: string; body: string }) => {
    const p = looseParse(m.body);
    if (!p) return;
    const isNew = await insertSmsImport({
      id: `sms-${m.id}-${m.date}`,
      sms_date: new Date(m.date).toISOString(),
      sender: m.address,
      body: m.body,
      amount: p.amount,
      currency: p.currency,
      merchant: p.merchant,
      card_last4: p.cardLast4,
      kind: 'purchase',
      card_type: p.cardType,
      balance: null,
      balance_currency: null,
    });
    await refresh();
    Alert.alert(isNew ? 'Sent to review' : 'Already imported', isNew ? `${formatMoney(p.amount, p.currency)} is now in the inbox above.` : 'This message is already in Anchor.');
  };

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={[typography.headline, { color: colors.label }]}>Messages Anchor skipped</Text>
      <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 2 }]}>
        Bank texts from the last 30 days that weren't imported, and why. Add any that are real charges.
      </Text>
      {items === null ? (
        <Pressable onPress={load} disabled={loading} style={{ marginTop: spacing.sm }}>
          <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>{loading ? 'Reading…' : 'Show skipped messages'}</Text>
        </Pressable>
      ) : items.length === 0 ? (
        <Text style={[typography.subhead, { color: colors.green, marginTop: spacing.sm }]}>Nothing skipped — every bank text was read.</Text>
      ) : (
        items.slice(0, 40).map((m) => (
          <View key={`${m.id}-${m.date}`} style={{ marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.separator }}>
            <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
              {m.address} · {formatRelativeDay(new Date(m.date).toISOString())}
            </Text>
            <Text style={[typography.footnote, { color: colors.label, marginTop: 2 }]} numberOfLines={4}>
              {m.body}
            </Text>
            <Text style={[typography.caption1, { color: colors.orange, marginTop: 2 }]}>{m.reason}</Text>
            <View style={{ flexDirection: 'row', marginTop: 4 }}>
              {m.canAdd ? (
                <Pressable onPress={() => addAnyway(m)} hitSlop={6} style={{ marginRight: spacing.lg }}>
                  <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Add as expense</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => Share.share({ message: m.body })} hitSlop={6}>
                <Text style={[typography.subhead, { color: colors.blue }]}>Share text</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

// Paste any bank SMS to see exactly how Anchor reads it.
export function TestMessageCard() {
  const { colors, typography, spacing } = useTheme();
  const smsReadCredits = useSettingsStore((s) => s.smsReadCredits);
  const [text, setText] = useState('');
  const parsed = text.trim() ? parseAny(text, true) : null;
  const why = text.trim() && !parsed ? explainSms(text) : null;

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm }]}>Test a message</Text>
      <TextField placeholder="Paste a bank SMS here" value={text} onChangeText={setText} multiline />
      {parsed ? (
        <View style={{ marginTop: -spacing.sm }}>
          <Text style={[typography.subhead, { color: colors.green, fontWeight: '600' }]}>
            ✓ {parsed.kind === 'credit' ? 'Money in' : parsed.kind === 'card_payment' ? 'Card payment' : 'Spending'}:{' '}
            {formatMoney(parsed.amount, parsed.currency)}
          </Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
            Merchant: {parsed.merchant ?? '—'} · Card: {parsed.cardLast4 ? `••${parsed.cardLast4}` : '—'} ·{' '}
            {parsed.cardType === 'credit' ? '💳 Credit card' : parsed.cardType === 'debit' ? '🏦 Debit' : 'Card type not stated'}
          </Text>
          {parsed.kind === 'credit' && !smsReadCredits ? (
            <Text style={[typography.caption1, { color: colors.orange }]}>Money in is only imported with "Read money in too" on.</Text>
          ) : null}
        </View>
      ) : why ? (
        <Text style={[typography.subhead, { color: colors.orange, marginTop: -spacing.sm }]}>✗ {why.reason}</Text>
      ) : null}
    </Card>
  );
}
