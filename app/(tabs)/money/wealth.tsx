import React, { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { SegmentedControl } from '../../../src/ui/SegmentedControl';
import { useWealth } from '../../../src/features/wealth/useWealth';
import { OverviewTab } from '../../../src/features/wealth/OverviewTab';
import { SaveTab } from '../../../src/features/wealth/SaveTab';
import { BackupTab } from '../../../src/features/wealth/BackupTab';
import { InvestTab } from '../../../src/features/wealth/InvestTab';

const TABS = ['overview', 'save', 'backup', 'invest'];

// Wealth: save more, keep backup money, and invest the rest well.
export default function WealthScreen() {
  const { colors, spacing } = useTheme();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState(Math.max(0, TABS.indexOf(params.tab ?? 'overview')));
  useEffect(() => {
    if (params.tab && TABS.includes(params.tab)) setTab(TABS.indexOf(params.tab));
  }, [params.tab]);
  const w = useWealth();

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Wealth" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={{ marginBottom: spacing.md }}>
          <SegmentedControl options={['Overview', 'Save', 'Backup', 'Invest']} selectedIndex={tab} onChange={setTab} />
        </View>
        {tab === 0 ? <OverviewTab w={w} onTab={setTab} /> : tab === 1 ? <SaveTab w={w} /> : tab === 2 ? <BackupTab w={w} /> : <InvestTab w={w} />}
      </ScrollView>
    </View>
  );
}
