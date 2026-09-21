import React, { useState } from 'react';
import { TextInput, TextInputProps } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeProvider';

// A translucent "glass" field for the dark auth backdrop — brightens and
// gains a soft white border on focus, matching the frosted, high-contrast
// language of the rest of the auth flow.
export function GlassTextField(props: TextInputProps) {
  const { typography, spacing, radius } = useTheme();
  const [focused, setFocused] = useState(false);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(focused ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)', { duration: 180 }),
    borderColor: withTiming(focused ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.12)', { duration: 180 }),
  }));

  return (
    <Animated.View style={[{ borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md }, animatedStyle]}>
      <TextInput
        placeholderTextColor="rgba(255,255,255,0.45)"
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
        style={[typography.body, { height: 52, paddingHorizontal: spacing.md, color: '#FFFFFF' }, props.style]}
      />
    </Animated.View>
  );
}
