import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { WidgetPreview, requestPinWidget } from 'react-native-android-widget';
import { NavHeader } from '../src/ui/NavHeader';
import { useTheme } from '../src/theme/ThemeProvider';
import { Card } from '../src/ui/Card';
import { Button } from '../src/ui/Button';
import { useUndoStore } from '../src/store/undoStore';
import { widgetBuilder, type WidgetName } from '../src/widgets/renderers';
import { refreshWidgets } from '../src/widgets/refresh';

const GALLERY: { name: WidgetName; title: string; about: string; height: number }[] = [
  {
    name: 'SmartWidget',
    title: 'Smart Stack',
    about: 'Picks what matters right now — a meeting about to start, a prayer not marked yet, a bill due today, what you can still spend, a task reminder, habits in the evening, water when you fall behind — with a one-tap button for it.',
    height: 240,
  },
  { name: 'SpendWidget', title: 'Spending', about: "Today's allowance as a ring, and what's left this week and this month from your plan.", height: 220 },
  { name: 'TasksWidget', title: 'Today', about: 'Overdue and due-today tasks first, then by priority and reminder time. Tap a circle to finish one.', height: 220 },
  { name: 'LifeWidget', title: 'Habits & Water', about: "Tick off today's habits and add a glass of water without opening the app.", height: 200 },
  { name: 'PrayerWidget', title: 'Prayers', about: 'Every prayer time today, the next one ringed, and the current one flagged until you mark it.', height: 130 },
  { name: 'MoneyWidget', title: 'Net worth', about: "Your net worth with a 30-day trend, this month's change, today's spending and the next bill.", height: 170 },
];

type Built = Awaited<ReturnType<typeof widgetBuilder>>;

// Every home-screen widget, previewed with your real data, with a button to
// put it on the home screen.
export default function WidgetsScreen() {
  const { colors, typography, spacing, scheme } = useTheme();
  const { width } = useWindowDimensions();
  const show = useUndoStore((s) => s.show);
  const [built, setBuilt] = useState<Partial<Record<WidgetName, Built>>>({});
  const previewWidth = Math.min(360, width - spacing.lg * 2 - 32);
  const android = Platform.OS === 'android';

  useEffect(() => {
    if (!android) return;
    for (const w of GALLERY) {
      widgetBuilder(w.name, { width: previewWidth, height: w.height })
        .then((b) => setBuilt((prev) => ({ ...prev, [w.name]: b })))
        .catch(() => {});
    }
  }, [android, previewWidth]);

  const pin = async (name: WidgetName, title: string) => {
    try {
      const ok = await requestPinWidget({ widgetName: name });
      if (!ok) show(`Long-press your home screen → Widgets → Anchor · ${title}`);
    } catch {
      show(`Long-press your home screen → Widgets → Anchor · ${title}`);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <NavHeader title="Widgets" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Text style={[typography.subhead, { color: colors.secondaryLabel, marginBottom: spacing.md }]}>
          {android
            ? 'Widgets update as you use Anchor, every half hour, and whenever you leave the app. Every button on them works without opening the app.'
            : 'Home-screen widgets are available on Android.'}
        </Text>
        {android ? (
          <View style={{ marginBottom: spacing.md }}>
            <Button
              title="Refresh all widgets"
              variant="secondary"
              onPress={() => {
                refreshWidgets(GALLERY.map((w) => w.name));
                show('Widgets refreshed');
              }}
            />
          </View>
        ) : null}
        {GALLERY.map((w) => {
          const b = built[w.name];
          return (
            <Card key={w.name} style={{ marginBottom: spacing.md }}>
              <Text style={[typography.headline, { color: colors.label }]}>{w.title}</Text>
              <Text style={[typography.footnote, { color: colors.secondaryLabel, marginTop: 2, marginBottom: spacing.sm }]}>{w.about}</Text>
              {android && b ? (
                <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
                  <WidgetPreview renderWidget={() => b(scheme === 'dark' ? 'dark' : 'light')} width={previewWidth} height={w.height} />
                </View>
              ) : null}
              {android ? <Button title="Add to Home Screen" onPress={() => pin(w.name, w.title)} /> : null}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}
