import React from 'react';
import { Switch as RNSwitch, Platform, type SwitchProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

// iOS green-on, grey-off toggles on every platform.
export function Switch(props: SwitchProps) {
  const { colors } = useTheme();
  return (
    <RNSwitch
      trackColor={{ false: colors.gray4, true: colors.green }}
      thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
      ios_backgroundColor={colors.gray4}
      {...props}
    />
  );
}
