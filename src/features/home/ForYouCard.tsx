import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../ui/Card';
import { useForYou } from '../foryou/useForYou';
import { NudgeRow } from '../foryou/NudgeRow';

// The top three "For you" suggestions on Home.
export function ForYouCard() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const { nudges } = useForYou();
  if (!nudges.length) return null;
  const top = nudges.slice(0, 3);
  return (
    <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
      <Card style={{ paddingVertical: 6 }}>
        <Pressable onPress={() => router.push('/for-you')} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 4, paddingBottom: 2 }}>
          <Text style={[typography.headline, { color: colors.label, flex: 1 }]}>✨ For you</Text>
          <Text style={[typography.subhead, { color: colors.blue }]}>{nudges.length > 3 ? `All ${nudges.length}` : 'Open'}</Text>
        </Pressable>
        {top.map((n, k) => (
          <NudgeRow key={n.id} nudge={n} compact isLast={k === top.length - 1} />
        ))}
      </Card>
    </View>
  );
}
