import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useLifeStore } from '../../../src/store/lifeStore';
import { Card } from '../../../src/ui/Card';
import { ProgressRing } from '../../../src/ui/ProgressRing';
import { TextField } from '../../../src/ui/TextField';
import { Button } from '../../../src/ui/Button';
import { formatDateKey, formatDateShort } from '../../../src/utils/date';
import { estimatePaceCompletionDate } from '../../../src/utils/projection';
import { QURAN_PAGES } from '../../../src/db/types';
import { juzEndPage, juzForPage } from '../../../src/utils/quran';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { useSettingsStore } from '../../../src/store/settingsStore';
import * as lifeRepo from '../../../src/db/repositories/life';
import { todayKey } from '../../../src/db/client';

const GOALS = [0, 2, 4, 5, 10, 20];

const QUICK_PAGES = [1, 2, 5, 10, 20];

export default function QuranScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { quranKhatm, quranLogs, logQuranPages, startNewKhatm } = useLifeStore();
  const [custom, setCustom] = useState('');
  const { quranDailyGoal, setQuranDailyGoal } = useSettingsStore();
  const [byDate, setByDate] = useState<Record<string, number>>({});

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - 400);
    lifeRepo.quranPagesByDateSince(todayKey(since)).then(setByDate);
  }, [quranLogs]);

  const todayPages = byDate[todayKey()] ?? 0;
  // Consecutive days meeting the goal; today only counts once it's met.
  let goalStreak = 0;
  if (quranDailyGoal > 0) {
    const now = new Date();
    for (let i = todayPages >= quranDailyGoal ? 0 : 1; i < 400; i++) {
      const key = todayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
      if ((byDate[key] ?? 0) < quranDailyGoal) break;
      goalStreak++;
    }
  }

  const read = Math.min(QURAN_PAGES, quranLogs.reduce((sum, l) => sum + l.pages, 0));
  const remaining = QURAN_PAGES - read;
  const complete = remaining <= 0;
  const finishDate = complete
    ? null
    : estimatePaceCompletionDate(remaining, quranLogs.map((l) => ({ amount: l.pages, date: l.created_at })));

  const log = async (pages: number) => {
    if (pages <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await logQuranPages(Math.min(pages, remaining));
    if (pages >= remaining) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleNewKhatm = () => {
    Alert.alert('Start a new khatm?', 'Your progress on this one will be kept in history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start', onPress: () => startNewKhatm() },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Quran" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Card style={{ alignItems: 'center', marginBottom: spacing.md }}>
          <Text style={[typography.subhead, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>Khatm #{quranKhatm}</Text>
          <ProgressRing progress={read / QURAN_PAGES} color={colors.green} size={140} label={`${Math.round((read / QURAN_PAGES) * 100)}%`} />
          <Text style={[typography.title3, { color: colors.label, marginTop: spacing.md }]}>
            {complete ? 'Khatm complete — mabrook! 🎉' : `Page ${read} of ${QURAN_PAGES}`}
          </Text>
          {!complete ? (
            <Text style={[typography.subhead, { color: colors.green, marginTop: 4, fontWeight: '600' }]}>
              Next: page {read + 1} · Juz {juzForPage(read + 1)} · {juzEndPage(juzForPage(read + 1)) - read} page
              {juzEndPage(juzForPage(read + 1)) - read === 1 ? '' : 's'} to finish this juz
            </Text>
          ) : null}
          {finishDate ? (
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 4 }]}>
              At this pace, you'll finish around {formatDateShort(finishDate)}
            </Text>
          ) : null}
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label }]}>Daily goal</Text>
          {quranDailyGoal > 0 ? (
            <View style={{ marginVertical: spacing.sm }}>
              <ProgressBar progress={Math.min(1, todayPages / quranDailyGoal)} color={colors.green} />
              <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 4 }]}>
                {todayPages >= quranDailyGoal ? '✅ Done for today' : `${todayPages} of ${quranDailyGoal} pages today`}
                {goalStreak > 0 ? ` · 🔥 ${goalStreak} day${goalStreak === 1 ? '' : 's'} in a row` : ''}
              </Text>
              {quranDailyGoal > 0 && !complete ? (
                <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: 2 }]}>
                  At {quranDailyGoal} pages a day you'd finish this khatm in {Math.ceil(remaining / quranDailyGoal)} days
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginVertical: spacing.xs }]}>
              Set a pages-per-day goal to track a daily streak. 20 pages a day finishes a khatm in a month.
            </Text>
          )}
          <ChipSelector
            options={GOALS.map((g) => ({ id: String(g), label: g === 0 ? 'Off' : `${g} pages` }))}
            selectedId={String(quranDailyGoal)}
            onSelect={(id) => setQuranDailyGoal(Number(id))}
          />
        </Card>

        {complete ? (
          <Button title="Start a new khatm" onPress={() => startNewKhatm()} style={{ marginBottom: spacing.md }} />
        ) : (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm }]}>Log pages read</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
              {QUICK_PAGES.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => log(p)}
                  style={{
                    flex: 1,
                    marginHorizontal: 3,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.md,
                    backgroundColor: colors.fill,
                    alignItems: 'center',
                  }}
                >
                  <Text style={[typography.headline, { color: colors.label }]}>+{p}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <TextField placeholder="Other amount" keyboardType="number-pad" value={custom} onChangeText={setCustom} />
              </View>
              <Button
                title="Log"
                variant="secondary"
                onPress={() => {
                  log(Math.floor(Number(custom) || 0));
                  setCustom('');
                }}
                style={{ marginLeft: spacing.sm, height: 48 }}
              />
            </View>
          </Card>
        )}

        {quranLogs.length > 0 ? (
          <>
            <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>This khatm</Text>
            <Card padded={false}>
              {quranLogs.slice(0, 30).map((l, i, arr) => (
                <View
                  key={l.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    padding: spacing.md,
                    borderBottomWidth: i === arr.length - 1 ? 0 : 0.5,
                    borderBottomColor: colors.separator,
                  }}
                >
                  <Text style={[typography.body, { color: colors.secondaryLabel }]}>{formatDateKey(l.date)}</Text>
                  <Text style={[typography.body, { color: colors.label, fontWeight: '600' }]}>
                    {l.pages} page{l.pages === 1 ? '' : 's'}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {!complete && read > 0 ? (
          <Pressable onPress={handleNewKhatm} style={{ alignSelf: 'center', marginTop: spacing.lg }}>
            <Text style={[typography.subhead, { color: colors.secondaryLabel }]}>Restart from page 1</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
