import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface BadgeProps {
  text: string;
  color?: string;
  variant?: 'filled' | 'subtle';
}

export function Badge({ text, color, variant = 'subtle' }: BadgeProps) {
  const { colors, typography, radius } = useTheme();
  const c = color ?? colors.blue;
  return (
    <View
      style={{
        backgroundColor: variant === 'filled' ? c : c + '22',
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={[
          typography.caption1,
          { color: variant === 'filled' ? '#FFFFFF' : c, fontWeight: '600' },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}
