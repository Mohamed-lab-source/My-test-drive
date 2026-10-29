import React from 'react';
import { View } from 'react-native';
import { Icon } from './Icon';

interface IconCircleProps {
  name: string;
  color: string;
  size?: number;
  // Settings-style: a white glyph on a solid rounded square.
  filled?: boolean;
}

export function IconCircle({ name, color, size = 36, filled }: IconCircleProps) {
  if (filled) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.26,
          borderCurve: 'continuous',
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={name} size={size * 0.58} color="#FFFFFF" />
      </View>
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + '24',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={name} size={size * 0.52} color={color} />
    </View>
  );
}
