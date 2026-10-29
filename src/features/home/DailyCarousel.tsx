import React, { useState } from 'react';
import { View, ScrollView, useWindowDimensions } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

// Several "of the day" cards (verse, Name, hadith, insight) in one swipeable
// row instead of a long stack, with page dots.
export function DailyCarousel({ children }: { children: React.ReactNode }) {
  const { colors, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const pages = React.Children.toArray(children).filter(Boolean);
  const [page, setPage] = useState(0);
  const pageWidth = Math.min(width, 700) - spacing.lg * 2;
  if (!pages.length) return null;
  return (
    <View style={{ marginBottom: spacing.md }}>
      <ScrollView
        horizontal
        snapToInterval={pageWidth + spacing.sm}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / (pageWidth + spacing.sm)))}
        onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / (pageWidth + spacing.sm)))}
        scrollEventThrottle={64}
      >
        {pages.map((p, i) => (
          <View key={i} style={{ width: pageWidth, marginRight: i === pages.length - 1 ? 0 : spacing.sm }}>
            {p}
          </View>
        ))}
      </ScrollView>
      {pages.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: -4 }}>
          {pages.map((_, i) => (
            <View
              key={i}
              style={{ width: i === page ? 16 : 6, height: 6, borderRadius: 3, marginHorizontal: 3, backgroundColor: i === page ? colors.label : colors.tertiaryLabel }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
