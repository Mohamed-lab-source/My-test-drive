import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Icon } from './Icon';

interface IconCircleProps {
  name: string;
  color: string;
  size?: number;
}

export function IconCircle({ name, color, size = 36 }: IconCircleProps) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color + '22' },
      ]}
    >
      <Icon name={name} size={size * 0.52} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
