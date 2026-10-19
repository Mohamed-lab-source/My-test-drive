import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface MenuAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

// A bottom action list (Android alerts only show three buttons).
export function ActionMenu({ visible, title, actions, onClose }: { visible: boolean; title?: string; actions: MenuAction[]; onClose: () => void }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', padding: spacing.md }}>
        <View style={{ backgroundColor: colors.secondarySystemGroupedBackground, borderRadius: 14, overflow: 'hidden', marginBottom: spacing.sm }}>
          {title ? (
            <Text style={[typography.footnote, { color: colors.secondaryLabel, textAlign: 'center', padding: spacing.sm }]} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
          {actions.map((a, i) => (
            <Pressable
              key={a.label}
              onPress={() => {
                onClose();
                a.onPress();
              }}
              style={({ pressed }) => ({
                paddingVertical: 14,
                alignItems: 'center',
                borderTopWidth: title || i > 0 ? 0.5 : 0,
                borderTopColor: colors.separator,
                backgroundColor: pressed ? colors.tertiaryFill : 'transparent',
              })}
            >
              <Text style={[typography.body, { color: a.destructive ? colors.red : colors.blue }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={onClose} style={{ backgroundColor: colors.secondarySystemGroupedBackground, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
          <Text style={[typography.headline, { color: colors.blue }]}>Cancel</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
