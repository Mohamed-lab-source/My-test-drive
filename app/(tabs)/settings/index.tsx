import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Share, Alert, TextInput, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useSettingsStore, type Appearance } from '../../../src/store/settingsStore';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useProductivityStore } from '../../../src/store/productivityStore';
import { useLifeStore } from '../../../src/store/lifeStore';
import { useHabitsStore } from '../../../src/store/habitsStore';
import { ScreenHeader } from '../../../src/ui/ScreenHeader';
import { Card } from '../../../src/ui/Card';
import { ListRow } from '../../../src/ui/ListRow';
import { IconCircle } from '../../../src/ui/IconCircle';
import { SegmentedControl } from '../../../src/ui/SegmentedControl';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { Sheet } from '../../../src/ui/Sheet';
import { Button } from '../../../src/ui/Button';
import { TextField } from '../../../src/ui/TextField';
import { exportAllData, importAllData, resetAllData } from '../../../src/db/backup';
import { exportTransactionsCsv } from '../../../src/db/csvExport';
import { requestNotificationPermission } from '../../../src/notifications/scheduler';
import { isBiometricLockEnabled, setBiometricLockEnabled, isBiometricAvailable } from '../../../src/auth/biometricLock';
import { useAuth } from '../../../src/auth/AuthProvider';

function FxRateRow({ currency, baseCurrency }: { currency: string; baseCurrency: string }) {
  const { colors, spacing } = useTheme();
  const existing = useFinanceStore((s) => s.fxRates.find((r) => r.currency === currency));
  const setFxRate = useFinanceStore((s) => s.setFxRate);
  const [value, setValue] = useState(existing ? String(existing.rate_to_base) : '');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
      <Text style={{ color: colors.label, flex: 1 }}>
        1 {currency} = ? {baseCurrency}
      </Text>
      <TextField
        placeholder="rate"
        keyboardType="decimal-pad"
        value={value}
        onChangeText={setValue}
        onBlur={() => {
          const n = Number(value);
          if (n > 0) setFxRate(currency, n);
        }}
        style={{ width: 100, height: 40 }}
      />
    </View>
  );
}

const APPEARANCE_OPTIONS: Appearance[] = ['system', 'light', 'dark'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'AED', 'SAR', 'EGP', 'MAD', 'TRY'];

export default function SettingsScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { appearance, setAppearance, currency, setCurrency, notificationsEnabled, setNotificationsEnabled } =
    useSettingsStore();
  const { user, signOut } = useAuth();
  const accounts = useFinanceStore((s) => s.accounts);
  const hydrateFinance = useFinanceStore((s) => s.hydrate);
  const hydrateProductivity = useProductivityStore((s) => s.hydrate);
  const hydrateLife = useLifeStore((s) => s.hydrate);
  const hydrateHabits = useHabitsStore((s) => s.hydrate);

  const foreignCurrencies = useMemo(
    () => Array.from(new Set(accounts.map((a) => a.currency))).filter((c) => c !== currency),
    [accounts, currency]
  );

  const [importVisible, setImportVisible] = useState(false);
  const [importText, setImportText] = useState('');
  const [busy, setBusy] = useState(false);
  const [biometricOn, setBiometricOn] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    isBiometricLockEnabled().then(setBiometricOn);
    isBiometricAvailable().then(setBiometricAvailable);
  }, []);

  const appearanceIndex = APPEARANCE_OPTIONS.indexOf(appearance);

  const handleExport = async () => {
    const json = await exportAllData();
    await Share.share({ message: json, title: 'Anchor backup' });
  };

  const handleExportCsv = async () => {
    const csv = await exportTransactionsCsv();
    await Share.share({ message: csv, title: 'Anchor transactions.csv' });
  };

  const handleImport = async () => {
    setBusy(true);
    try {
      await importAllData(importText);
      await Promise.all([hydrateFinance(), hydrateProductivity(), hydrateLife(), hydrateHabits()]);
      setImportText('');
      setImportVisible(false);
      Alert.alert('Import complete', 'Your data has been restored.');
    } catch (e) {
      Alert.alert('Import failed', 'That did not look like a valid Anchor backup.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission needed', 'Enable notifications for Anchor in your device Settings to get reminders.');
      }
    } else {
      setNotificationsEnabled(false);
    }
  };

  const handleToggleBiometric = async (value: boolean) => {
    await setBiometricLockEnabled(value);
    setBiometricOn(value);
  };

  const handleReset = () => {
    Alert.alert('Reset all data', 'This permanently deletes everything in the app. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await resetAllData();
          await Promise.all([hydrateFinance(), hydrateProductivity(), hydrateLife(), hydrateHabits()]);
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 140 }}>
        <ScreenHeader title="Settings" />

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs, textTransform: 'uppercase' }]}>
            Account
          </Text>
          <Card padded={false}>
            <ListRow
              title={user?.name || 'Anchor account'}
              subtitle={user?.email}
              leading={<IconCircle name="person.fill" color={colors.indigo} size={32} />}
            />
            <ListRow title="Sign out" destructive isLast onPress={signOut} />
          </Card>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs, textTransform: 'uppercase' }]}>
            Appearance
          </Text>
          <Card>
            <SegmentedControl
              options={['System', 'Light', 'Dark']}
              selectedIndex={appearanceIndex}
              onChange={(i) => setAppearance(APPEARANCE_OPTIONS[i])}
            />
          </Card>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs, textTransform: 'uppercase' }]}>
            Currency
          </Text>
          <Card>
            <ChipSelector
              options={CURRENCIES.map((c) => ({ id: c, label: c }))}
              selectedId={currency}
              onSelect={setCurrency}
            />
          </Card>
        </View>

        {foreignCurrencies.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs, textTransform: 'uppercase' }]}>
              Exchange rates
            </Text>
            <Card>
              <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
                Set a manual rate so accounts in other currencies count toward net worth.
              </Text>
              {foreignCurrencies.map((c) => (
                <FxRateRow key={c} currency={c} baseCurrency={currency} />
              ))}
            </Card>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs, textTransform: 'uppercase' }]}>
            Notifications & Security
          </Text>
          <Card padded={false}>
            <ListRow
              title="Reminders"
              subtitle="Meeting and bill-due notifications"
              isLast={!biometricAvailable}
              leading={<IconCircle name="bell.fill" color={colors.red} size={32} />}
              trailing={<Switch value={notificationsEnabled} onValueChange={handleToggleNotifications} />}
            />
            {biometricAvailable ? (
              <ListRow
                title="Biometric lock"
                subtitle="Require Face ID / fingerprint to open Anchor"
                isLast
                leading={<IconCircle name="lock.fill" color={colors.gray} size={32} />}
                trailing={<Switch value={biometricOn} onValueChange={handleToggleBiometric} />}
              />
            ) : null}
          </Card>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs, textTransform: 'uppercase' }]}>
            Manage
          </Text>
          <Card padded={false}>
            <ListRow
              title="Categories"
              leading={<IconCircle name="chart.pie.fill" color={colors.blue} size={32} />}
              showChevron
              onPress={() => router.push('/settings/categories')}
            />
          </Card>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.xs, textTransform: 'uppercase' }]}>
            Data
          </Text>
          <Card padded={false}>
            <ListRow
              title="Export backup"
              leading={<IconCircle name="square.and.arrow.up" color={colors.green} size={32} />}
              onPress={handleExport}
            />
            <ListRow
              title="Export transactions (CSV)"
              leading={<IconCircle name="doc.text.fill" color={colors.teal} size={32} />}
              onPress={handleExportCsv}
            />
            <ListRow
              title="Restore from backup"
              leading={<IconCircle name="square.and.arrow.down" color={colors.orange} size={32} />}
              onPress={() => setImportVisible(true)}
            />
            <ListRow
              title="Reset all data"
              destructive
              isLast
              leading={<IconCircle name="trash.fill" color={colors.red} size={32} />}
              onPress={handleReset}
            />
          </Card>
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text style={[typography.caption1, { color: colors.tertiaryLabel, textAlign: 'center' }]}>
            Anchor · everything stays on this device
          </Text>
        </View>
      </ScrollView>

      <Sheet visible={importVisible} onClose={() => setImportVisible(false)}>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>Restore backup</Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
            Paste the JSON you previously exported.
          </Text>
          <TextInput
            multiline
            value={importText}
            onChangeText={setImportText}
            placeholder="{ ...backup json... }"
            placeholderTextColor={colors.placeholderText}
            style={{
              minHeight: 160,
              backgroundColor: colors.tertiarySystemGroupedBackground,
              borderRadius: radius.md,
              padding: spacing.sm,
              color: colors.label,
              marginBottom: spacing.md,
              textAlignVertical: 'top',
            }}
          />
          <Button title="Restore" onPress={handleImport} disabled={!importText.trim()} loading={busy} />
        </View>
      </Sheet>
    </View>
  );
}
