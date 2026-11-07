import React from 'react';
import { Text, Pressable, Share } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { hadithOfTheDay } from '../../content/hadith';

// One short hadith a day; long-press to share it.
export function HadithCard() {
  const { colors, typography, spacing } = useTheme();
  const h = hadithOfTheDay();
  return (
    <Pressable onLongPress={() => Share.share({ message: `“${h.text}”\n— The Prophet ﷺ (${h.source})` })} style={{ marginBottom: spacing.md }}>
      <Card>
        <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>Hadith of the day</Text>
        <Text style={[typography.body, { color: colors.label, marginTop: 4, fontStyle: 'italic' }]}>“{h.text}”</Text>
        <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 4 }]}>— The Prophet ﷺ · {h.source}</Text>
      </Card>
    </Pressable>
  );
}
