import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../../ui/Icon';
import type { Nudge } from './engine';

// One suggestion: its emoji on a tinted circle, what it's about, and a
// menu to dismiss it for today or turn its kind off.
export function NudgeRow({ nudge, onMenu, compact, isLast }: { nudge: Nudge; onMenu?: () => void; compact?: boolean; isLast?: boolean }) {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const tint = (colors as unknown as Record<string, string>)[nudge.tone] ?? colors.blue;
  return (
    <Pressable
      onPress={() => (nudge.route ? router.push(nudge.route as never) : onMenu?.())}
      onLongPress={onMenu}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`${nudge.title}. ${nudge.detail}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: compact ? 9 : spacing.sm,
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: colors.separator,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ width: compact ? 34 : 40, height: compact ? 34 : 40, borderRadius: 12, backgroundColor: tint + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: compact ? 17 : 20 }}>{nudge.emoji}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        <Text style={[compact ? typography.subhead : typography.headline, { color: colors.label, fontWeight: '600' }]} numberOfLines={compact ? 1 : 2}>
          {nudge.title}
        </Text>
        <Text style={[compact ? typography.caption1 : typography.footnote, { color: colors.secondaryLabel, marginTop: 1 }]} numberOfLines={compact ? 1 : 3}>
          {nudge.detail}
        </Text>
      </View>
      {onMenu && !compact ? (
        <Pressable onPress={onMenu} hitSlop={10} accessibilityLabel="More" style={{ padding: 6 }}>
          <Icon name="ellipsis" size={18} color={colors.tertiaryLabel} />
        </Pressable>
      ) : nudge.route ? (
        <Icon name="chevron.right" size={14} color={colors.tertiaryLabel} />
      ) : null}
    </Pressable>
  );
}
