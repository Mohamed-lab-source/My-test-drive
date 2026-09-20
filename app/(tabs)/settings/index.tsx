import React, { useState } from 'react';
import { View, Text, ScrollView, Share, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useSettingsStore, type Appearance } from '../../../src/store/settingsStore';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useProductivityStore } from '../../../src/store/productivityStore';
import { useLifeStore } from '../../../src/store/lifeStore';
import { ScreenHeader } from '../../../src/ui/ScreenHeader';
import { Card } from '../../../src/ui/Card';
import { ListRow } from '../../../src/ui/ListRow';
import { IconCircle } from '../../../src/ui/IconCircle';
import { SegmentedControl } from '../../../src/ui/SegmentedControl';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { Sheet } from '../../../src/ui/Sheet';
import { Button } from '../../../src/ui/Button';
import { exportAllData, importAllData, resetAllData } from '../../../src/db/backup';

const APPEARANCE_OPTIONS: Appearance[] = ['system', 'light', 'dark'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'AED', 'SAR', 'EGP', 'MAD', 'TRY'];

export default function SettingsScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { appearance, setAppearance, currency, setCurrency } = useSettingsStore();
  const hydrateFinance = useFinanceStore((s) => s.hydrate);
  const hydrateProductivity = useProductivityStore((s) => s.hydrate);
  const hydrateLife = useLifeStore((s) => s.hydrate);

  const [importVisible, setImportVisible] = useState(false);
  const [importText, setImportText] = useState('');
  const [busy, setBusy] = useState(false);

  const appearanceIndex = APPEARANCE_OPTIONS.indexOf(appearance);

  const handleExport = async () => {
    const json = await exportAllData();
    await Share.share({ message: json, title: 'Anchor backup' });
  };

  const handleImport = async () => {
    setBusy(true);
    try {
      await importAllData(importText);
      await Promise.all([hydrateFinance(), hydrateProductivity(), hydrateLife()]);
      setImportText('');
      setImportVisible(false);
      Alert.alert('Import complete', 'Your data has been restored.');
    } catch (e) {
      Alert.alert('Import failed', 'That did not look like a valid Anchor backup.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    Alert.alert('Reset all data', 'This permanently deletes everything in the app. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await resetAllData();
          await Promise.all([hydrateFinance(), hydrateProductivity(), hydrateLife()]);
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
