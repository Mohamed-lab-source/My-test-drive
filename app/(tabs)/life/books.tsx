import React, { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { FAB } from '../../../src/ui/FAB';
import { Sheet } from '../../../src/ui/Sheet';
import { TextField } from '../../../src/ui/TextField';
import { Button } from '../../../src/ui/Button';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { EmptyState } from '../../../src/ui/EmptyState';
import { SegmentedControl } from '../../../src/ui/SegmentedControl';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import * as repo from '../../../src/db/repositories/lists';
import { nowIso } from '../../../src/db/client';
import type { Book, BookStatus } from '../../../src/db/types';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { ChipSelector } from '../../../src/ui/ChipSelector';
import { formatDateShort } from '../../../src/utils/date';

const TABS: BookStatus[] = ['reading', 'want', 'finished'];

export default function BooksScreen() {
  const { colors, typography, spacing } = useTheme();
  const [books, setBooks] = useState<Book[]>([]);
  const [tab, setTab] = useState(0);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [pages, setPages] = useState('');
  const { readingGoal, setReadingGoal } = useSettingsStore(useShallow((s) => ({ readingGoal: s.readingGoal, setReadingGoal: s.setReadingGoal })));

  const load = useCallback(() => repo.listBooks().then(setBooks), []);
  useEffect(() => {
    load();
  }, [load]);

  const shown = books.filter((b) => b.status === TABS[tab]);
  const finishedThisYear = books.filter((b) => b.finished_at?.startsWith(String(new Date().getFullYear()))).length;

  const addPages = async (book: Book, n: number) => {
    const read = Math.min(book.total_pages || Infinity, book.pages_read + n);
    const finished = book.total_pages > 0 && read >= book.total_pages;
    await repo.updateBook(book.id, { pages_read: read, ...(finished ? { status: 'finished', finished_at: nowIso() } : {}) });
    if (finished) Alert.alert('Finished!', `You finished "${book.title}".`);
    await load();
  };

  const save = async () => {
    await repo.createBook({ title: title.trim(), author: author.trim() || null, total_pages: Number(pages) || 0, status: TABS[tab] === 'finished' ? 'reading' : TABS[tab] });
    setTitle('');
    setAuthor('');
    setPages('');
    setAdding(false);
    await load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Reading list" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={{ marginBottom: spacing.sm }}>
          <SegmentedControl options={['Reading', 'Want to read', 'Finished']} selectedIndex={tab} onChange={setTab} />
        </View>
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[typography.headline, { color: colors.label }]}>
            {readingGoal > 0
              ? `${finishedThisYear} of ${readingGoal} books this year`
              : `${finishedThisYear} book${finishedThisYear === 1 ? '' : 's'} finished this year`}
          </Text>
          {readingGoal > 0 ? (
            <View style={{ marginVertical: spacing.sm }}>
              <ProgressBar progress={Math.min(1, finishedThisYear / readingGoal)} color={colors.orange} />
              <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
                {(() => {
                  const now = new Date();
                  const dayOfYear = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000);
                  const expected = Math.floor((readingGoal * dayOfYear) / 365);
                  return finishedThisYear >= readingGoal
                    ? 'Goal reached 🎉'
                    : finishedThisYear >= expected
                      ? 'On track'
                      : `${expected - finishedThisYear} behind pace`;
                })()}
              </Text>
            </View>
          ) : null}
          <ChipSelector
            options={[0, 6, 12, 24, 52].map((n) => ({ id: String(n), label: n === 0 ? 'No goal' : `${n} a year` }))}
            selectedId={String(readingGoal)}
            onSelect={(id) => setReadingGoal(Number(id))}
          />
        </Card>
        {shown.length === 0 ? (
          <EmptyState icon="book.fill" title="Nothing here" message="Tap + to add a book." />
        ) : (
          shown.map((b) => (
            <SwipeableRow
              key={b.id}
              actions={[
                {
                  label: 'Delete',
                  color: colors.red,
                  onPress: async () => {
                    await repo.deleteBook(b.id);
                    await load();
                  },
                },
              ]}
            >
              <Card style={{ marginBottom: spacing.sm }}>
                <Text style={[typography.headline, { color: colors.label }]}>{b.title}</Text>
                {b.author ? <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{b.author}</Text> : null}
                {b.status === 'reading' ? (
                  <>
                    {b.total_pages > 0 ? (
                      <View style={{ marginTop: spacing.sm }}>
                        <ProgressBar progress={b.pages_read / b.total_pages} color={colors.orange} />
                        <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>
                          Page {b.pages_read} of {b.total_pages}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>{b.pages_read} pages read</Text>
                    )}
                    <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
                      {[5, 10, 20].map((n) => (
                        <Pressable key={n} onPress={() => addPages(b, n)} style={{ marginRight: spacing.md }}>
                          <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>+{n} pages</Text>
                        </Pressable>
                      ))}
                      <Pressable
                        onPress={async () => {
                          await repo.updateBook(b.id, { status: 'finished', finished_at: nowIso(), pages_read: b.total_pages || b.pages_read });
                          await load();
                        }}
                      >
                        <Text style={[typography.subhead, { color: colors.green, fontWeight: '600' }]}>Finished</Text>
                      </Pressable>
                    </View>
                  </>
                ) : b.status === 'finished' ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <View style={{ flexDirection: 'row' }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Pressable
                          key={n}
                          hitSlop={4}
                          onPress={async () => {
                            await repo.updateBook(b.id, { rating: b.rating === n ? null : n });
                            await load();
                          }}
                        >
                          <Text style={{ fontSize: 22, color: (b.rating ?? 0) >= n ? colors.orange : colors.gray4, marginRight: 4 }}>★</Text>
                        </Pressable>
                      ))}
                    </View>
                    {b.finished_at ? (
                      <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 2 }]}>
                        Finished {formatDateShort(b.finished_at)} · read in{' '}
                        {Math.max(1, Math.round((new Date(b.finished_at).getTime() - new Date(b.created_at).getTime()) / 86400000))} days
                      </Text>
                    ) : null}
                  </View>
                ) : b.status === 'want' ? (
                  <Pressable
                    onPress={async () => {
                      await repo.updateBook(b.id, { status: 'reading' });
                      await load();
                    }}
                    style={{ marginTop: spacing.sm }}
                  >
                    <Text style={[typography.subhead, { color: colors.blue, fontWeight: '600' }]}>Start reading</Text>
                  </Pressable>
                ) : null}
              </Card>
            </SwipeableRow>
          ))
        )}
      </ScrollView>
      <FAB onPress={() => setAdding(true)} />
      <Sheet visible={adding} onClose={() => setAdding(false)}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text style={[typography.title2, { color: colors.label, marginBottom: spacing.md }]}>Add book</Text>
          <TextField label="Title" value={title} onChangeText={setTitle} autoFocus />
          <TextField label="Author" placeholder="Optional" value={author} onChangeText={setAuthor} />
          <TextField label="Pages" placeholder="Optional" keyboardType="number-pad" value={pages} onChangeText={setPages} />
          <Button title="Save" onPress={save} disabled={!title.trim()} style={{ marginBottom: spacing.xl }} />
        </ScrollView>
      </Sheet>
    </View>
  );
}
