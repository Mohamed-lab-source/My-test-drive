import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';

interface EmptyStateProps {
  icon: string;
  title: string;
  message?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  const { colors, typography, spacing } = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(350)} style={{ alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl }}>
      <Animated.View
        entering={ZoomIn.springify().damping(14).stiffness(180)}
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: colors.blue + '18',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.md,
        }}
      >
        <Icon name={icon} size={34} color={colors.blue} />
      </Animated.View>
      <Text style={[typography.title3, { color: colors.label, textAlign: 'center' }]}>{title}</Text>
      {message ? (
        <Text style={[typography.subhead, { color: colors.secondaryLabel, textAlign: 'center', marginTop: 6, maxWidth: 320 }]}>{message}</Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </Animated.View>
  );
}
