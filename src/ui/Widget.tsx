import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Card } from './Card';
import { Icon } from './Icon';

// A small Home Screen widget: a tinted symbol and caption at the top, one
// big figure, and a line of context underneath.
export function Widget({
  icon,
  tint,
  title,
  value,
  caption,
  accessory,
  onPress,
}: {
  icon: string;
  tint: string;
  title: string;
  value: React.ReactNode;
  caption?: string;
  accessory?: React.ReactNode;
  onPress?: () => void;
}) {
  const { colors, typography, radius } = useTheme();
  return (
    <Card onPress={onPress} style={{ flex: 1, minHeight: 148, borderRadius: radius.xl, justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Icon name={icon} size={16} color={tint} />
        <Text style={[typography.footnote, { color: tint, fontWeight: '700', marginLeft: 6, flex: 1 }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          {typeof value === 'string' ? (
            <Text style={[typography.title1, { color: colors.label, fontVariant: ['tabular-nums'] }]} numberOfLines={1} adjustsFontSizeToFit>
              {value}
            </Text>
          ) : (
            value
          )}
          {caption ? (
            <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]} numberOfLines={2}>
              {caption}
            </Text>
          ) : null}
        </View>
        {accessory}
      </View>
    </Card>
  );
}
