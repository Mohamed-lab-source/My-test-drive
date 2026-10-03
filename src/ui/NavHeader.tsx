import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';

interface NavHeaderProps {
  title: string;
  right?: React.ReactNode;
}

export function NavHeader({ title, right }: NavHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, typography, spacing } = useTheme();

  return (
    <View
      style={[
        styles.row,
        {
          paddingTop: insets.top + 6,
          paddingBottom: spacing.sm,
          paddingHorizontal: spacing.sm,
          backgroundColor: colors.systemGroupedBackground,
          borderBottomColor: colors.separator,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
        <Icon name="chevron.left" size={22} color={colors.blue} />
      </Pressable>
      <Text style={[typography.headline, { color: colors.label, flex: 1, textAlign: 'center' }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  back: { width: 44, alignItems: 'flex-start', justifyContent: 'center' },
  right: { width: 44, alignItems: 'flex-end', justifyContent: 'center' },
});
