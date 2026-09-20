import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../src/ui/NavHeader';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useProductivityStore } from '../../../src/store/productivityStore';
import { Card } from '../../../src/ui/Card';
import { IconCircle } from '../../../src/ui/IconCircle';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FAB } from '../../../src/ui/FAB';
import { SwipeableRow } from '../../../src/ui/SwipeableRow';
import { formatDateLong, formatTime } from '../../../src/utils/date';
import { AddMeetingSheet } from '../../../src/features/tasks/AddMeetingSheet';

export default function MeetingsScreen() {
  const { colors, typography, spacing } = useTheme();
  const { meetings, removeMeeting } = useProductivityStore();
  const [addVisible, setAddVisible] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Meetings" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {meetings.length === 0 ? (
          <EmptyState icon="calendar" title="No meetings scheduled" />
        ) : (
          meetings.map((m) => (
            <SwipeableRow key={m.id} actions={[{ label: 'Delete', color: colors.red, onPress: () => removeMeeting(m.id) }]}>
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
              </Card>
            </SwipeableRow>
          ))
        )}
      </ScrollView>
      <FAB onPress={() => setAddVisible(true)} />
      <AddMeetingSheet visible={addVisible} onClose={() => setAddVisible(false)} />
    </View>
  );
}
