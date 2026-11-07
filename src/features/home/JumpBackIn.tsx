import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { useSettingsStore } from '../../store/settingsStore';
import { DESTINATIONS } from '../../navigation/destinations';
import { IconCircle } from '../../ui/IconCircle';
import { PressableScale } from '../../ui/PressableScale';

// The screens you used last, like Siri Suggestions on the iPhone: one tap
// back to wherever you were.
export function JumpBackIn() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const recent = useSettingsStore((s) => s.recentScreens).filter((p) => DESTINATIONS[p]);
  if (recent.length < 2) return null;
  const palette = colors as unknown as Record<string, string>;
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[typography.title3, { color: colors.label, paddingHorizontal: spacing.lg, marginBottom: spacing.sm }]}>Jump back in</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg - 6 }}>
        {recent.map((path) => {
          const d = DESTINATIONS[path];
          return (
            <PressableScale key={path} onPress={() => router.push(path as never)} scaleTo={0.9} style={{ width: 76, alignItems: 'center', marginHorizontal: 2 }}>
              <IconCircle name={d.icon} color={palette[d.color] ?? colors.blue} size={54} filled />
              <Text style={[typography.caption1, { color: colors.label, marginTop: 6, fontWeight: '500' }]} numberOfLines={1}>
                {d.label}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}
