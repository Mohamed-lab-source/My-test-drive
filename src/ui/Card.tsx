import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface CardProps extends ViewProps {
  inset?: boolean;
  padded?: boolean;
}

export function Card({ style, inset, padded = true, children, ...rest }: CardProps) {
  const { colors, radius, spacing, shadow } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.secondarySystemGroupedBackground,
          borderRadius: inset ? 0 : radius.lg,
          padding: padded ? spacing.md : 0,
        },
        !inset && shadow.card,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

export const styles = StyleSheet.create({});
