import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from '../utils/haptics';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';

interface ListRowProps {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  showChevron?: boolean;
  isLast?: boolean;
  destructive?: boolean;
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  onLongPress,
  showChevron,
  isLast,
  destructive,
}: ListRowProps) {
  const { colors, typography, spacing } = useTheme();

  const content = (
    <View style={[styles.row, { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minHeight: 50 }]}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.textCol}>
        <Text
          style={[
            typography.body,
            { color: destructive ? colors.red : colors.label },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      {showChevron ? <Icon name="chevron.right" size={15} color={colors.gray2} /> : null}
    </View>
  );

  return (
    <View>
      <Pressable
        onPress={
          onPress
            ? () => {
                Haptics.selectionAsync();
                onPress();
              }
            : undefined
        }
        // iOS highlights a tapped row with a grey wash rather than fading it.
        onLongPress={onLongPress}
        delayLongPress={350}
        style={({ pressed }) => [pressed && (onPress || onLongPress) ? { backgroundColor: colors.tertiaryFill } : null]}
      >
        {content}
      </Pressable>
      {!isLast ? (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.separator,
            marginLeft: leading ? spacing.md + 36 + spacing.sm : spacing.md,
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  leading: { marginRight: 12 },
  textCol: { flex: 1, justifyContent: 'center' },
  trailing: { marginLeft: 8, alignItems: 'flex-end' },
});
