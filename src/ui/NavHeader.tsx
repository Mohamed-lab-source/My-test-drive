import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

interface NavHeaderProps {
  title: string;
  right?: React.ReactNode;
}

// The iOS navigation bar: a back chevron, a centred title and a translucent
// material with a hairline underneath.
export function NavHeader({ title, right }: NavHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, typography, spacing, scheme } = useTheme();

  return (
    <View style={[styles.row, { paddingTop: insets.top + 4, paddingBottom: 8, paddingHorizontal: spacing.xs }]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={90} tint={scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.systemGroupedBackground }]} />
      )}
      <View style={[styles.hairline, { backgroundColor: colors.separator }]} />
      <PressableScale onPress={() => router.back()} haptic="none" scaleTo={0.88} style={styles.back} hitSlop={12}>
        <Icon name="chevron.left" size={26} color={colors.blue} />
      </PressableScale>
      <Text style={[typography.headline, { color: colors.label, flex: 1, textAlign: 'center' }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  back: { width: 56, height: 36, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 2 },
  right: { minWidth: 56, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 8 },
});
