import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

interface ProgressBarProps {
  progress: number; // 0..1
  color?: string;
  height?: number;
}

export function ProgressBar({ progress, color, height = 8 }: ProgressBarProps) {
  const { colors, radius } = useTheme();
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(1, progress)) * 100, { duration: 500 });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View
      style={[
        styles.track,
        { backgroundColor: colors.fill, height, borderRadius: radius.pill },
      ]}
    >
      <Animated.View
        style={[
          animatedStyle,
          { backgroundColor: color ?? colors.blue, height, borderRadius: radius.pill },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
});
