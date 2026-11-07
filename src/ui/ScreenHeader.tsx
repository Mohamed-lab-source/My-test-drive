import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { useLargeTitleZoom } from './CollapsingHeader';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  // Pass the screen's scroll position for the iOS pull-to-zoom title.
  scrollY?: SharedValue<number>;
}

export function ScreenHeader({ title, subtitle, trailing, scrollY }: ScreenHeaderProps) {
  const { colors, typography, spacing } = useTheme();
  const zoom = useLargeTitleZoom(scrollY);
  return (
    <View style={[styles.row, { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm }]}>
      <Animated.View style={[{ flex: 1, transformOrigin: 'left bottom' }, zoom]}>
        {subtitle ? (
          <Text style={[typography.footnote, { color: colors.secondaryLabel, textTransform: 'uppercase', fontWeight: '600', letterSpacing: 0.4 }]}>
            {subtitle}
          </Text>
        ) : null}
        <Text style={[typography.largeTitle, { color: colors.label }]}>{title}</Text>
      </Animated.View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
});
