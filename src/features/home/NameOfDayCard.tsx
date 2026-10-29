import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { nameOfTheDay } from '../../content/names';

export function NameOfDayCard() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const n = nameOfTheDay();
  return (
    <Pressable onPress={() => router.push('/life/names')} style={{ marginBottom: spacing.md }}>
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Name of the day</Text>
          <Text style={[typography.headline, { color: colors.label }]}>{n.name}</Text>
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{n.meaning}</Text>
        </View>
        <Text style={{ fontSize: 30, color: colors.green }}>{n.arabic}</Text>
      </Card>
    </Pressable>
  );
}
