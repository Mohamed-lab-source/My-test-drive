import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Share } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Card } from '../../../src/ui/Card';
import { FAB } from '../../../src/ui/FAB';
import { Sheet } from '../../../src/ui/Sheet';
import { Button } from '../../../src/ui/Button';
import { Icon } from '../../../src/ui/Icon';
import { TextField } from '../../../src/ui/TextField';
import { EmptyState } from '../../../src/ui/EmptyState';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { showUndoDelete } from '../../../src/ui/undo';
import * as repo from '../../../src/db/repositories/lists';
import { formatRelativeDay } from '../../../src/utils/date';
import type { Note } from '../../../src/db/types';

const CHECK = /^\s*\[( |x|X)\]\s*/;

export default function NotesScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const [notes, setNotes] = useState<Note[]>([]);
  const [editing, setEditing] = useState<Note | 'new' | null>(null);
  const [body, setBody] = useState('');

  const toggleLine = async (n: Note, index: number) => {
    const lines = n.body.split('\n');
    lines[index] = lines[index].replace(CHECK, (_m, x: string) => (x.toLowerCase() === 'x' ? '[ ] ' : '[x] '));
    await repo.updateNote(n.id, { body: lines.join('\n') });
    await load();
  };
  const [query, setQuery] = useState('');

  const load = useCallback(() => repo.listNotes().then(setNotes), []);
  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? notes.filter((n) => n.body.toLowerCase().includes(q)) : notes;
  }, [notes, query]);

  const open = (n: Note | 'new') => {
    setBody(n === 'new' ? '' : n.body);
    setEditing(n);
  };

  const save = async () => {
    const text = body.trim();
    if (editing === 'new') {
      if (text) await repo.createNote(text);
    } else if (editing) {
      if (text) await repo.updateNote(editing.id, { body: text });
      else await repo.deleteNote(editing.id);
    }
    setEditing(null);
    await load();
  };

  const remove = async (n: Note) => {
    await repo.deleteNote(n.id);
    await load();
    showUndoDelete('notes', n, 'Note deleted', load);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader
        title="Notes"
        right={
          notes.length ? (
            <Pressable onPress={() => Share.share({ message: notes.map((n) => n.body.trim()).join('\n\n———\n\n'), title: 'Anchor notes' })} hitSlop={8}>
              <Text style={[typography.subhead, { color: colors.blue }]}>Export</Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {notes.length > 3 ? <TextField placeholder="Search notes" value={query} onChangeText={setQuery} /> : null}
        {shown.length === 0 ? (
          <EmptyState icon="doc.text.fill" title={notes.length ? 'No matches' : 'No notes yet'} message="Tap + to jot something down." />
        ) : (
          shown.map((n) => {
            const [first, ...rest] = n.body.split('\n');
            return (
              <SwipeableRow
                key={n.id}
                actions={[
                  { label: 'Share', color: colors.blue, onPress: () => Share.share({ message: n.body }) },
                  { label: 'Delete', color: colors.red, onPress: () => remove(n) },
                ]}
              >
                <Pressable onPress={() => open(n)}>
                  <Card style={{ marginBottom: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.headline, { color: colors.label }]} numberOfLines={1}>
                          {first}
                        </Text>
                        {rest.some((l) => CHECK.test(l)) ? (
                          // "[ ] milk" lines become tappable checkboxes right on the card.
                          rest.map((line, li) => {
                            const m = line.match(CHECK);
                            if (!m) return null;
                            const checked = m[1].toLowerCase() === 'x';
                            return (
                              <Pressable key={li} onPress={() => toggleLine(n, li + 1)} hitSlop={4} style={{ flexDirection: 'row', marginTop: 4 }}>
                                <Text style={{ color: checked ? colors.green : colors.secondaryLabel, marginRight: 6 }}>{checked ? '☑' : '☐'}</Text>
                                <Text style={[typography.footnote, { color: checked ? colors.tertiaryLabel : colors.label, textDecorationLine: checked ? 'line-through' : 'none', flex: 1 }]}>
                                  {line.replace(CHECK, '')}
                                </Text>
                              </Pressable>
                            );
                          })
                        ) : rest.join(' ').trim() ? (
                          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]} numberOfLines={2}>
                            {rest.join(' ').trim()}
                          </Text>
                        ) : null}
                        <Text style={[typography.caption2, { color: colors.tertiaryLabel, marginTop: 4 }]}>{formatRelativeDay(n.updated_at)}</Text>
                      </View>
                      <Pressable
                        onPress={async () => {
                          await repo.updateNote(n.id, { pinned: n.pinned ? 0 : 1 });
                          await load();
                        }}
                        hitSlop={10}
                      >
                        <Icon name={n.pinned ? 'star.fill' : 'star'} size={18} color={n.pinned ? colors.yellow : colors.tertiaryLabel} />
                      </Pressable>
                    </View>
                  </Card>
                </Pressable>
              </SwipeableRow>
            );
          })
        )}
      </ScrollView>
      <FAB onPress={() => open('new')} />
      <Sheet visible={!!editing} onClose={save}>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Write a note… The first line is its title. Start a line with [ ] for a checkbox."
            placeholderTextColor={colors.placeholderText}
            multiline
            autoFocus
            style={[
              typography.body,
              {
                color: colors.label,
                minHeight: 200,
                maxHeight: 360,
                textAlignVertical: 'top',
                backgroundColor: colors.tertiarySystemGroupedBackground,
                borderRadius: radius.md,
                padding: spacing.md,
                marginBottom: spacing.md,
              },
            ]}
          />
          <Button title="Done" onPress={save} style={{ marginBottom: spacing.xl }} />
        </View>
      </Sheet>
    </View>
  );
}
