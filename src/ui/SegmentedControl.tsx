import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';

interface SegmentedControlProps {
  options: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

export function SegmentedControl({ options, selectedIndex, onChange }: SegmentedControlProps) {
  const { colors, typography, radius, spacing } = useTheme();
  const [width, setWidth] = useState(0);
  const segmentWidth = width / options.length;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(segmentWidth * selectedIndex, { duration: 220 }) }],
    width: segmentWidth,
  }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.container,
        { backgroundColor: colors.fill, borderRadius: radius.md, padding: 2 },
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
              backgroundColor: colors.secondarySystemGroupedBackground,
              borderRadius: radius.sm,
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowOffset: { width: 0, height: 1 },
              shadowRadius: 2,
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
