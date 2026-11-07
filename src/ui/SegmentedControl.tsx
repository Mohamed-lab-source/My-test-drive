import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from '../utils/haptics';
import { useTheme } from '../theme/ThemeProvider';

interface SegmentedControlProps {
  options: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

export function SegmentedControl({ options, selectedIndex, onChange }: SegmentedControlProps) {
  const { colors, typography, radius, spacing, scheme } = useTheme();
  const [width, setWidth] = useState(0);
  const segmentWidth = width / options.length;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(segmentWidth * selectedIndex, { damping: 22, stiffness: 260, mass: 0.7 }) }],
    width: segmentWidth,
  }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.container,
        { backgroundColor: colors.tertiaryFill, borderRadius: radius.sm + 2, padding: 2 },
      ]}
    >
      {width > 0 ? (
        <Animated.View
          style={[
            animatedStyle,
            {
              position: 'absolute',
              top: 2,
              bottom: 2,
              left: 0,
              backgroundColor: scheme === 'dark' ? '#636366' : '#FFFFFF',
              borderRadius: radius.sm,
              borderCurve: 'continuous',
              boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.12), 0px 3px 1px rgba(0, 0, 0, 0.04)',
            },
          ]}
        />
      ) : null}
      {options.map((opt, i) => (
        <Pressable
          key={opt}
          style={[styles.segment, { paddingVertical: spacing.xs }]}
          onPress={() => {
            Haptics.selectionAsync();
            onChange(i);
          }}
        >
          <Text
            style={[
              typography.subhead,
              {
                color: i === selectedIndex ? colors.label : colors.secondaryLabel,
                fontWeight: i === selectedIndex ? '600' : '400',
              },
            ]}
          >
            {opt}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row' },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
