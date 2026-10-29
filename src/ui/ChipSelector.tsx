import React, { useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import * as Haptics from '../utils/haptics';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';

export interface ChipOption {
  id: string;
  label: string;
  color?: string;
  icon?: string;
}

interface ChipSelectorProps {
  options: ChipOption[];
  selectedId?: string | null;
  // For picking several: the chosen ids (onSelect toggles one).
  selectedIds?: string[];
  onSelect: (id: string) => void;
  // Wrap onto several lines instead of scrolling sideways.
  wrap?: boolean;
}

export function ChipSelector({ options, selectedId = null, selectedIds, onSelect, wrap = false }: ChipSelectorProps) {
  const { colors, typography, radius, spacing } = useTheme();
  const scroller = useRef<ScrollView>(null);
  // Bring the chosen chip into view once, e.g. "25th" in a row of days.
  const scrolled = useRef(false);
  const chips = options.map((opt) => {
    const selected = selectedIds ? selectedIds.includes(opt.id) : opt.id === selectedId;
    const color = opt.color ?? colors.blue;
    return (
      <PressableScale
        key={opt.id}
        haptic="none"
        scaleTo={0.94}
        onPress={() => {
          Haptics.selectionAsync();
          onSelect(opt.id);
        }}
        onLayout={
          !wrap && selected && !scrolled.current
            ? (e) => {
                scrolled.current = true;
                const x = e.nativeEvent.layout.x;
                if (x > 200) scroller.current?.scrollTo({ x: x - 120, animated: false });
              }
            : undefined
        }
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: selected ? color : colors.tertiaryFill,
          borderRadius: radius.pill,
          paddingHorizontal: 14,
          paddingVertical: 8,
          marginRight: 8,
          marginBottom: wrap ? 8 : 0,
        }}
      >
        {opt.icon ? (
          <Icon name={opt.icon} size={14} color={selected ? '#fff' : colors.secondaryLabel} />
        ) : null}
        <Text
          style={[
            typography.subhead,
            { color: selected ? '#fff' : colors.label, marginLeft: opt.icon ? 6 : 0, fontWeight: selected ? '600' : '400' },
          ]}
        >
          {opt.label}
        </Text>
      </PressableScale>
    );
  });
  if (wrap) return <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{chips}</View>;
  return (
    <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: spacing.md }}>
      {chips}
    </ScrollView>
  );
}
