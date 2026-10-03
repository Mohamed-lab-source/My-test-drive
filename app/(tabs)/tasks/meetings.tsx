import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform, Linking, Alert } from 'react-native';
import { Icon } from '../../../src/ui/Icon';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useProductivityStore } from '../../../src/store/productivityStore';
import { Card } from '../../../src/ui/Card';
import { IconCircle } from '../../../src/ui/IconCircle';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { showUndoDelete } from '../../../src/ui/undo';
import { formatDateLong, formatTime } from '../../../src/utils/date';
import { AddMeetingSheet } from '../../../src/features/tasks/AddMeetingSheet';

// A link (video call) opens directly; anything else is searched in Maps.
function openLocation(location: string) {
  const url = /^https?:\/\//i.test(location)
    ? location
    : Platform.OS === 'ios'
      ? `http://maps.apple.com/?q=${encodeURIComponent(location)}`
      : `geo:0,0?q=${encodeURIComponent(location)}`;
  Linking.openURL(url).catch(() => Alert.alert('Could not open', location));
}

export default function MeetingsScreen() {
  const { colors, typography, spacing } = useTheme();
  const { meetings, removeMeeting, refreshMeetings } = useProductivityStore();
  const [addVisible, setAddVisible] = useState(false);
  const [editing, setEditing] = useState<(typeof meetings)[number] | null>(null);

  const handleDelete = async (meeting: (typeof meetings)[number]) => {
    await removeMeeting(meeting.id);
    showUndoDelete('meetings', meeting, 'Meeting deleted', refreshMeetings);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Meetings" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {meetings.length === 0 ? (
          <EmptyState icon="calendar" title="No meetings scheduled" />
        ) : (
          meetings.map((m) => (
            <SwipeableRow key={m.id} actions={[{ label: 'Delete', color: colors.red, onPress: () => handleDelete(m) }]}>
              <Pressable onPress={() => setEditing(m)}>
                <Card style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
                  <IconCircle name="calendar" color={colors.indigo} />
                  <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                    <Text style={[typography.headline, { color: colors.label }]}>{m.title}</Text>
                    <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                      {formatDateLong(m.start_at)} · {formatTime(m.start_at)}
                    </Text>
                    {m.location ? (
                      <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: 2 }]}>{m.location}</Text>
                    ) : null}
                  </View>
                  {m.location ? (
                    <Pressable onPress={() => openLocation(m.location!)} hitSlop={10} style={{ marginLeft: spacing.sm }}>
                      <Icon name={/^https?:\/\//i.test(m.location) ? 'link' : 'map.fill'} size={22} color={colors.blue} />
                    </Pressable>
                  ) : null}
                </Card>
              </Pressable>
            </SwipeableRow>
          ))
        )}
      </ScrollView>
      <FAB onPress={() => setAddVisible(true)} />
      <AddMeetingSheet visible={addVisible} onClose={() => setAddVisible(false)} />
      <AddMeetingSheet visible={!!editing} editing={editing} onClose={() => setEditing(null)} />
    </View>
  );
}
