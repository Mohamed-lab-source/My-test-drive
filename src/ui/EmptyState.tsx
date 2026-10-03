import React from 'react';
import { View, Text } from 'react-native';
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
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.fill,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.md,
        }}
      >
        <Icon name={icon} size={30} color={colors.secondaryLabel} />
      </View>
      <Text style={[typography.headline, { color: colors.label, textAlign: 'center' }]}>{title}</Text>
      {message ? (
        <Text
          style={[
            typography.subhead,
            { color: colors.secondaryLabel, textAlign: 'center', marginTop: 4 },
          ]}
        >
          {message}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </View>
  );
}
