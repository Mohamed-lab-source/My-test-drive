import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface TextFieldProps extends TextInputProps {
  label?: string;
}

export function TextField({ label, style, onFocus, onBlur, ...rest }: TextFieldProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? (
        <Text style={[typography.footnote, { color: colors.secondaryLabel, marginBottom: 6, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.3 }]}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.placeholderText}
        style={[
          typography.body,
          styles.input,
          {
            color: colors.label,
            // A translucent grey fill reads on both white cards and the grey page.
            backgroundColor: colors.tertiaryFill,
            borderRadius: radius.md,
            borderCurve: 'continuous',
            paddingHorizontal: spacing.md,
            // A quiet accent outline while typing.
            borderWidth: 1.5,
            borderColor: focused ? colors.blue + '99' : 'transparent',
          },
          style,
        ]}
        selectionColor={colors.blue}
        cursorColor={colors.blue}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { height: 48 },
});
