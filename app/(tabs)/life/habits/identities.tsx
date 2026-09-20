import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { NavHeader } from '../../../../src/ui/NavHeader';
import { useTheme } from '../../../../src/theme/ThemeProvider';
import { Card } from '../../../../src/ui/Card';
import { EmptyState } from '../../../../src/ui/EmptyState';
import { FAB } from '../../../../src/ui/FAB';
import { SwipeableRow } from '../../../../src/ui/SwipeableRow';
import { ProgressRing } from '../../../../src/ui/ProgressRing';
import { useHabitsStore } from '../../../../src/store/habitsStore';
import { identityVoteCount } from '../../../../src/domain/habits/analytics';
import { AddIdentitySheet } from '../../../../src/features/habits/AddIdentitySheet';

export default function IdentitiesScreen() {
  const { colors, typography, spacing } = useTheme();
  const { identities, habits, checkins, deleteIdentity } = useHabitsStore();
  const [addVisible, setAddVisible] = useState(false);

  const active = identities.filter((i) => !i.archived);

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Identities" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {active.length === 0 ? (
          <EmptyState
            icon="person.2.fill"
            title="No identities yet"
            message='Habits stick best when tied to who you want to become — e.g. "a healthy person."'
          />
        ) : (
          active.map((identity) => {
            const votes = identityVoteCount(identity.id, habits, checkins);
            const linkedHabits = habits.filter((h) => h.identityId === identity.id && !h.archived);
            return (
              <SwipeableRow key={identity.id} actions={[{ label: 'Delete', color: colors.red, onPress: () => deleteIdentity(identity.id) }]}>
                <Card style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
                  <ProgressRing progress={Math.min(1, votes / 100)} color={colors.purple} size={52} label={`${votes}`} />
                  <View style={{ marginLeft: spacing.md, flex: 1 }}>
                    <Text style={[typography.headline, { color: colors.label }]}>{identity.statement}</Text>
                    {identity.why ? (
                      <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]}>{identity.why}</Text>
                    ) : null}
                    <Text style={[typography.caption1, { color: colors.tertiaryLabel, marginTop: 2 }]}>
                      {linkedHabits.length} habit{linkedHabits.length === 1 ? '' : 's'} · {votes} votes cast
                    </Text>
                  </View>
                </Card>
              </SwipeableRow>
            );
          })
        )}
      </ScrollView>
      <FAB onPress={() => setAddVisible(true)} />
      <AddIdentitySheet visible={addVisible} onClose={() => setAddVisible(false)} />
    </View>
  );
}
