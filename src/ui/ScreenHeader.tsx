import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, trailing }: ScreenHeaderProps) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View
      style={[
        styles.row,
        { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[typography.largeTitle, { color: colors.label }]}>{title}</Text>
        {subtitle ? (
          <Text style={[typography.subhead, { color: colors.secondaryLabel, marginTop: 2 }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
});
