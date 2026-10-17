import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Share } from 'react-native';
import * as healthRepo from '../../../src/db/repositories/health';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useLifeStore } from '../../../src/store/lifeStore';
import { Card } from '../../../src/ui/Card';
import { TextField } from '../../../src/ui/TextField';
import { Icon } from '../../../src/ui/Icon';
import { Button } from '../../../src/ui/Button';
import { EmptyState } from '../../../src/ui/EmptyState';
import { formatDateKey } from '../../../src/utils/date';
import { todayKey } from '../../../src/db/client';
import type { JournalEntry, JournalMood } from '../../../src/db/types';
import * as journalRepo from '../../../src/db/repositories/journal';
import { SegmentedControl } from '../../../src/ui/SegmentedControl';
import { ChipSelector } from '../../../src/ui/ChipSelector';

const MOODS: { id: JournalMood; emoji: string; label: string }[] = [
  { id: 'great', emoji: '😄', label: 'Great' },
  { id: 'good', emoji: '🙂', label: 'Good' },
  { id: 'okay', emoji: '😐', label: 'Okay' },
  { id: 'low', emoji: '😕', label: 'Low' },
  { id: 'rough', emoji: '😣', label: 'Rough' },
];

const MOOD_SCORE: Record<JournalMood, number> = { great: 5, good: 4, okay: 3, low: 2, rough: 1 };
const TREND_DAYS = 30;
const PROMPTS = [
  'What made you smile today?',
  'What is one thing you learnt today?',
  'Which du\'a was answered for you recently?',
  'What would make tomorrow great?',
  'Who helped you today, and how can you thank them?',
  'What drained your energy today?',
  'What are you proud of this week?',
  'What is worrying you, and what part of it is in your control?',
  'Which prayer felt most present today?',
  'What blessing did you take for granted today?',
  'What is one habit you want to strengthen?',
  'How did you treat your family today?',
  'What did you spend money on that was worth it?',
  'What is one thing you want to let go of?',
  'Where did you see Allah\'s mercy today?',
  'What did you do today just for yourself?',
  'What conversation stayed with you today?',
  'What are you looking forward to?',
  'What would you tell yourself a year ago?',
  'What small win can you celebrate today?',
];
const TREND_HEIGHT = 56;

export default function JournalScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const { journalEntries, setTodayMood } = useLifeStore();
  const todayEntry = useMemo(() => journalEntries.find((e) => e.date === todayKey()), [journalEntries]);

  const [mood, setMood] = useState<JournalMood | null>(todayEntry?.mood ?? null);
  const [note, setNote] = useState(todayEntry?.note ?? '');
  const [gratitude, setGratitude] = useState<string[]>(() => {
    const lines = (todayEntry?.gratitude ?? '').split('\n');
    return [lines[0] ?? '', lines[1] ?? '', lines[2] ?? ''];
  });
  const [saving, setSaving] = useState(false);
  const [promptIndex, setPromptIndex] = useState(() => {
    const now = new Date();
    return Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000) % PROMPTS.length;
  });

  const handleSave = async () => {
    if (!mood) return;
    setSaving(true);
    try {
      const lines = gratitude.map((g) => g.trim()).filter(Boolean);
      await setTodayMood(mood, note || null, lines.length ? lines.join('\n') : null);
    } finally {
      setSaving(false);
    }
  };

  const pastEntries = journalEntries.filter((e) => e.date !== todayKey());
  const [search, setSearch] = useState('');
  const [moodFilter, setMoodFilter] = useState<string>('all');
  const [allEntries, setAllEntries] = useState<JournalEntry[] | null>(null);
  const filtering = search.trim().length > 0 || moodFilter !== 'all';
  // Searching covers the whole journal, not just the recent entries in memory.
  useEffect(() => {
    if (filtering) journalRepo.listJournalEntries(2000).then(setAllEntries);
  }, [filtering, journalEntries]);
  const shownEntries = filtering
    ? (allEntries ?? pastEntries).filter((e) => {
        const q = search.trim().toLowerCase();
        return (
          e.date !== todayKey() &&
          (moodFilter === 'all' || e.mood === moodFilter) &&
          (!q || (e.note ?? '').toLowerCase().includes(q) || (e.gratitude ?? '').toLowerCase().includes(q))
        );
      })
    : pastEntries;
  const [view, setView] = useState(0);
  const [memories, setMemories] = useState<{ label: string; entry: JournalEntry }[]>([]);
  const [gratitudeWall, setGratitudeWall] = useState<JournalEntry[]>([]);
  const [sleepInsight, setSleepInsight] = useState<{ good: number; short: number } | null>(null);

  useEffect(() => {
    const now = new Date();
    const ago = [
      { label: 'A week ago', date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7) },
      { label: 'A month ago', date: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()) },
      { label: 'A year ago', date: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) },
    ].map((a) => ({ label: a.label, key: todayKey(a.date) }));
    journalRepo.getJournalEntries(ago.map((a) => a.key)).then((rows) =>
      setMemories(
        ago
          .map((a) => ({ label: a.label, entry: rows.find((r) => r.date === a.key) }))
          .filter((m): m is { label: string; entry: JournalEntry } => !!m.entry)
      )
    );
    journalRepo.listGratitudeEntries().then(setGratitudeWall);
    // Mood on days after 7h+ sleep vs. shorter nights (sleep is logged on the
    // morning it ends, the same day as that day's mood).
    healthRepo.listSleepSince(todayKey(new Date(Date.now() - 90 * 86400000))).then((sleep) => {
      const hours = new Map(sleep.map((s) => [s.id, s.hours]));
      const good: number[] = [];
      const short: number[] = [];
      for (const e of journalEntries) {
        const h = hours.get(e.date);
        if (h === undefined) continue;
        (h >= 7 ? good : short).push(MOOD_SCORE[e.mood]);
      }
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      setSleepInsight(good.length >= 3 && short.length >= 3 ? { good: avg(good), short: avg(short) } : null);
    });
  }, [journalEntries]);


  const exportJournal = async () => {
    const all = await journalRepo.listJournalEntries(5000);
    const text = all
      .map((e) => {
        const mood = MOODS.find((m) => m.id === e.mood);
        const lines = [`${formatDateKey(e.date)} — ${mood?.emoji ?? ''} ${mood?.label ?? e.mood}`];
        if (e.note) lines.push(e.note);
        if (e.gratitude) lines.push(...e.gratitude.split('\n').map((g) => `🤲 ${g}`));
        return lines.join('\n');
      })
      .join('\n\n');
    Share.share({ message: text || 'No journal entries yet.' });
  };

  const trend = useMemo(() => {
    const byDate = new Map(journalEntries.map((e) => [e.date, e.mood]));
    const now = new Date();
    return Array.from({ length: TREND_DAYS }, (_, i) => {
      const key = todayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (TREND_DAYS - 1 - i)));
      return { key, mood: byDate.get(key) ?? null };
    });
  }, [journalEntries]);
  const logged = trend.filter((d): d is { key: string; mood: JournalMood } => d.mood !== null);
  const avgScore = logged.length ? logged.reduce((sum, d) => sum + MOOD_SCORE[d.mood], 0) / logged.length : null;
  const avgMood = avgScore === null ? null : MOODS[5 - Math.round(avgScore)];
  const moodColor = (m: JournalMood) =>
    m === 'great' ? colors.green : m === 'good' ? colors.mint : m === 'okay' ? colors.yellow : m === 'low' ? colors.orange : colors.red;

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Journal" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.sm }]}>How's today going?</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
            {MOODS.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setMood(m.id)}
                style={{
                  alignItems: 'center',
                  padding: spacing.sm,
                  borderRadius: radius.md,
                  backgroundColor: mood === m.id ? colors.fill : 'transparent',
                }}
              >
                <Text style={{ fontSize: 28 }}>{m.emoji}</Text>
                <Text style={[typography.caption2, { color: colors.secondaryLabel, marginTop: 4 }]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={[typography.subhead, { color: colors.label, flex: 1, fontStyle: 'italic' }]}>💭 {PROMPTS[promptIndex]}</Text>
            <Pressable onPress={() => setNote((n) => (n ? n + '\n\n' : '') + PROMPTS[promptIndex] + '\n')} hitSlop={8} style={{ marginLeft: spacing.sm }}>
              <Text style={[typography.subhead, { color: colors.blue }]}>Use</Text>
            </Pressable>
            <Pressable onPress={() => setPromptIndex((i) => (i + 1) % PROMPTS.length)} hitSlop={8} style={{ marginLeft: spacing.md }}>
              <Icon name="arrow.clockwise" size={16} color={colors.blue} />
            </Pressable>
          </View>
          <TextField placeholder="Anything on your mind? (optional)" value={note} onChangeText={setNote} multiline />
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, textTransform: 'uppercase' }]}>
            Three things I'm grateful for
          </Text>
          {gratitude.map((g, i) => (
            <TextField
              key={i}
              placeholder={`${i + 1}.`}
              value={g}
              onChangeText={(v) => setGratitude((prev) => prev.map((x, j) => (j === i ? v : x)))}
            />
          ))}
          <Button title="Save" onPress={handleSave} disabled={!mood} loading={saving} />
        </Card>

        {logged.length >= 2 ? (
          <Card style={{ marginBottom: spacing.lg }}>
            <Text style={[typography.headline, { color: colors.label }]}>Last 30 days</Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
              {logged.length} check-ins · on average {avgMood?.emoji} {avgMood?.label.toLowerCase()}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: TREND_HEIGHT }}>
              {trend.map((d) => (
                <View key={d.key} style={{ flex: 1, alignItems: 'center' }}>
                  <View
                    style={{
                      width: '70%',
                      borderRadius: 2,
                      height: d.mood ? (MOOD_SCORE[d.mood] / 5) * TREND_HEIGHT : 3,
                      backgroundColor: d.mood ? moodColor(d.mood) : colors.quaternaryFill,
                    }}
                  />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
              <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>{formatDateKey(trend[0].key)}</Text>
              <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>Today</Text>
            </View>
          </Card>
        ) : null}

        {sleepInsight ? (
          <Card style={{ marginBottom: spacing.lg }}>
            <Text style={[typography.headline, { color: colors.label }]}>Sleep & mood</Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
              {sleepInsight.good - sleepInsight.short >= 0.3
                ? `Your mood is noticeably better after 7+ hours of sleep (${sleepInsight.good.toFixed(1)} vs ${sleepInsight.short.toFixed(1)} out of 5).`
                : sleepInsight.short - sleepInsight.good >= 0.3
                  ? `Interestingly, shorter nights haven't hurt your mood (${sleepInsight.short.toFixed(1)} vs ${sleepInsight.good.toFixed(1)} out of 5).`
                  : `Your mood is about the same whether you sleep 7+ hours or less (${sleepInsight.good.toFixed(1)} vs ${sleepInsight.short.toFixed(1)} out of 5).`}
            </Text>
          </Card>
        ) : null}
        {memories.length > 0 ? (
          <Card style={{ marginBottom: spacing.lg }}>
            <Text style={[typography.headline, { color: colors.label, marginBottom: spacing.xs }]}>On this day</Text>
            {memories.map((m) => (
              <View key={m.label} style={{ paddingVertical: 4 }}>
                <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                  {m.label} · {MOODS.find((x) => x.id === m.entry.mood)?.emoji} {MOODS.find((x) => x.id === m.entry.mood)?.label}
                </Text>
                {m.entry.note ? <Text style={[typography.body, { color: colors.label }]}>{m.entry.note}</Text> : null}
                {m.entry.gratitude ? (
                  <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>🤲 {m.entry.gratitude.split('\n').join(' · ')}</Text>
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}

        <View style={{ marginBottom: spacing.sm }}>
          <SegmentedControl options={['Past entries', 'Gratitude wall']} selectedIndex={view} onChange={setView} />
        </View>
        <Pressable onPress={exportJournal} style={{ alignSelf: 'flex-end', marginBottom: spacing.sm }}>
          <Text style={[typography.subhead, { color: colors.blue }]}>Export journal</Text>
        </Pressable>
        {view === 1 ? (
          gratitudeWall.length === 0 ? (
            <EmptyState icon="heart.fill" title="Nothing yet" message="Write three things you're grateful for each day and they'll gather here." />
          ) : (
            <Card>
              <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: spacing.sm }]}>
                {gratitudeWall.reduce((n, e) => n + (e.gratitude?.split('\n').length ?? 0), 0)} blessings counted
              </Text>
              {gratitudeWall.map((e) => (
                <View key={e.id} style={{ marginBottom: spacing.sm }}>
                  <Text style={[typography.caption1, { color: colors.tertiaryLabel }]}>{formatDateKey(e.date)}</Text>
                  {e.gratitude!.split('\n').map((line, i) => (
                    <Text key={i} style={[typography.body, { color: colors.label }]}>
                      🤲 {line}
                    </Text>
                  ))}
                </View>
              ))}
            </Card>
          )
        ) : null}
        {view === 0 ? (
          <>
            <Text style={[typography.title3, { color: colors.label, marginBottom: spacing.sm }]}>Past entries</Text>
            <TextField placeholder="Search your journal" value={search} onChangeText={setSearch} />
            <View style={{ marginBottom: spacing.sm, marginTop: -spacing.xs }}>
              <ChipSelector
                options={[{ id: 'all', label: 'All moods' }, ...MOODS.map((m) => ({ id: m.id, label: `${m.emoji} ${m.label}` }))]}
                selectedId={moodFilter}
                onSelect={setMoodFilter}
              />
            </View>
            {filtering ? (
              <Text style={[typography.caption1, { color: colors.secondaryLabel, marginBottom: spacing.xs }]}>
                {shownEntries.length} entr{shownEntries.length === 1 ? 'y' : 'ies'} found
              </Text>
            ) : null}
            {shownEntries.length === 0 ? (
              <EmptyState icon="text.book.closed.fill" title={filtering ? 'Nothing found' : 'No past entries'} message={filtering ? 'Try other words or another mood.' : 'Your journal history will show up here.'} />
            ) : (
              <Card padded={false}>
                {shownEntries.map((entry, i) => {
                  const moodInfo = MOODS.find((m) => m.id === entry.mood);
                  return (
                    <View
                      key={entry.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: spacing.md,
                        borderBottomWidth: i === shownEntries.length - 1 ? 0 : 0.5,
                        borderBottomColor: colors.separator,
                      }}
                    >
                      <Text style={{ fontSize: 22, marginRight: spacing.sm }}>{moodInfo?.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{formatDateKey(entry.date)}</Text>
                        {entry.note ? <Text style={[typography.body, { color: colors.label }]}>{entry.note}</Text> : null}
                        {entry.gratitude
                          ? entry.gratitude.split('\n').map((line, j) => (
                              <Text key={j} style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>
                                🤲 {line}
                              </Text>
                            ))
                          : null}
                      </View>
                    </View>
                  );
                })}
              </Card>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
