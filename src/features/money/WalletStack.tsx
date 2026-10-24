import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { GradientCard } from '../../ui/GradientCard';
import { PressableScale } from '../../ui/PressableScale';
import { Icon } from '../../ui/Icon';
import { Appear } from '../../ui/Appear';
import { shade } from '../../theme/shade';
import type { Account } from '../../db/types';

const PEEK = 62;
const CARD_HEIGHT = 196;

const TYPE_LABEL: Record<string, string> = { bank: 'Bank account', credit: 'Credit card', savings: 'Savings', cash: 'Cash', investment: 'Investments' };

// Accounts as a Wallet-style stack of cards: each one peeks out above the
// next, and the front card shows its full details.
export function WalletStack({
  accounts,
  balance,
  onOpen,
}: {
  accounts: Account[];
  balance: (amount: number, currency: string) => string;
  onOpen: (a: Account) => void;
}) {
  const { typography } = useTheme();
  if (!accounts.length) return null;
  return (
    <View style={{ height: CARD_HEIGHT + (accounts.length - 1) * PEEK }}>
      {accounts.map((a, i) => {
        const front = i === accounts.length - 1;
        const owed = Math.max(0, -a.balance);
        const base = /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : '#007AFF';
        return (
          <Appear key={a.id} index={i + 1} style={{ position: 'absolute', left: 0, right: 0, top: i * PEEK }}>
            <PressableScale onPress={() => onOpen(a)} scaleTo={0.98}>
              <GradientCard colors={[shade(base, 0.12), shade(base, -0.42)]} style={{ height: CARD_HEIGHT, paddingTop: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={a.icon} size={17} color="#FFFFFF" />
                  </View>
                  <Text style={[typography.headline, { color: '#FFFFFF', marginLeft: 10, flex: 1 }]} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Text style={[typography.headline, { color: '#FFFFFF', fontVariant: ['tabular-nums'] }]}>
                    {a.type === 'credit' ? balance(owed, a.currency) : balance(a.balance, a.currency)}
                  </Text>
                </View>
                {front ? (
                  <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <Text style={[typography.footnote, { color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', fontWeight: '600', letterSpacing: 0.6 }]}>
                      {a.type === 'credit' ? 'Owed' : TYPE_LABEL[a.type] ?? 'Balance'}
                    </Text>
                    <Text style={[typography.title1, { color: '#FFFFFF', fontVariant: ['tabular-nums'] }]} numberOfLines={1} adjustsFontSizeToFit>
                      {a.type === 'credit' ? balance(owed, a.currency) : balance(a.balance, a.currency)}
                    </Text>
                    {a.type === 'credit' && a.credit_limit ? (
                      <View style={{ marginTop: 8, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                        <View style={{ width: `${Math.min(100, (owed / a.credit_limit) * 100)}%`, height: 5, backgroundColor: '#FFFFFF' }} />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </GradientCard>
            </PressableScale>
          </Appear>
        );
      })}
    </View>
  );
}
