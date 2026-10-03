import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { verseOfTheDay } from '../../content/verses';

export function VerseCard() {
  const { colors, typography, spacing } = useTheme();
  const verse = verseOfTheDay();
  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
        <Icon name="book.fill" size={14} color={colors.green} />
        <Text style={[typography.caption1, { color: colors.green, marginLeft: 6, fontWeight: '600', textTransform: 'uppercase' }]}>
          Verse of the day
        </Text>
      </View>
      <Text style={[typography.body, { color: colors.label, fontStyle: 'italic' }]}>“{verse.text}”</Text>
      <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 4 }]}>{verse.ref}</Text>
    </Card>
  );
}
