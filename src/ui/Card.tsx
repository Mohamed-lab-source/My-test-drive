import React from 'react';
import { View, ViewProps, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { PressableScale } from './PressableScale';

interface CardProps extends ViewProps {
  inset?: boolean;
  padded?: boolean;
  // Makes the whole card tappable, with the iOS press-down spring.
  onPress?: () => void;
  onLongPress?: () => void;
}

export function Card({ style, inset, padded = true, children, onPress, onLongPress, ...rest }: CardProps) {
  const { colors, radius, spacing, shadow } = useTheme();
  const cardStyle: StyleProp<ViewStyle> = [
    {
      backgroundColor: colors.secondarySystemGroupedBackground,
      borderRadius: inset ? 0 : radius.lg,
      borderCurve: 'continuous',
      padding: padded ? spacing.md : 0,
    },
    !inset && shadow.card,
    style,
  ];
  if (onPress || onLongPress) {
    return (
      <PressableScale onPress={onPress} onLongPress={onLongPress} style={cardStyle} {...(rest as object)}>
        {children}
      </PressableScale>
    );
  }
  return (
    <View style={cardStyle} {...rest}>
      {children}
    </View>
  );
}
