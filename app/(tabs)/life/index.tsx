import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { useFinanceStore } from '../../../src/store/financeStore';
import { useLifeStore } from '../../../src/store/lifeStore';
import { ScreenHeader } from '../../../src/ui/ScreenHeader';
import { Card } from '../../../src/ui/Card';
import { ProgressRing } from '../../../src/ui/ProgressRing';
import { Icon } from '../../../src/ui/Icon';
import { PrayerTracker } from '../../../src/features/life/PrayerTracker';
import { WishlistRow } from '../../../src/features/life/WishlistRow';
import { QadaCard } from '../../../src/features/life/QadaCard';
import { PrayerHistory } from '../../../src/features/life/PrayerHistory';
import { EmptyState } from '../../../src/ui/EmptyState';
import { IconCircle } from '../../../src/ui/IconCircle';
import { formatMoney } from '../../../src/utils/money';

function LifeLink({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: 'center',
        backgroundColor: colors.secondarySystemGroupedBackground,
        borderRadius: 16,
        paddingVertical: spacing.sm,
        marginHorizontal: 4,
      }}
    >
      <IconCircle name={icon} color={color} size={40} />
      <Text
        style={[typography.caption1, { color: colors.label, marginTop: 6, fontWeight: '600' }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function LifeScreen() {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { savingsGoals } = useFinanceStore();
  const { wishlist } = useLifeStore();

  const topGoal = savingsGoals.find((g) => !g.is_completed) ?? savingsGoals[0];
  const activeIdeas = wishlist.filter((w) => w.status !== 'purchased' && w.status !== 'dropped');

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 140 }}>
        <ScreenHeader title="Life" subtitle="Faith, goals & ideas" />

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <PrayerTracker />
        </View>

        <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg - 4, marginBottom: spacing.sm }}>
          <LifeLink icon="flame.fill" label="Habits" color={colors.orange} onPress={() => router.push('/life/habits')} />
          <LifeLink icon="text.book.closed.fill" label="Journal" color={colors.indigo} onPress={() => router.push('/life/journal')} />
          <LifeLink icon="hands.sparkles.fill" label="Tasbih" color={colors.mint} onPress={() => router.push('/life/tasbih')} />
          <LifeLink icon="book.fill" label="Quran" color={colors.green} onPress={() => router.push('/life/quran')} />
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg - 4, marginBottom: spacing.sm }}>
          <LifeLink icon="moon.fill" label="Fasting" color={colors.purple} onPress={() => router.push('/life/fasting')} />
          <LifeLink icon="gift.fill" label="Occasions" color={colors.pink} onPress={() => router.push('/life/occasions')} />
          <LifeLink icon="safari.fill" label="Prayer times" color={colors.teal} onPress={() => router.push('/life/prayer-times')} />
          <LifeLink icon="sun.haze.fill" label="Adhkar" color={colors.yellow} onPress={() => router.push('/life/adhkar')} />
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg - 4, marginBottom: spacing.sm }}>
          <LifeLink icon="calendar.badge.clock" label="Hijri calendar" color={colors.brown} onPress={() => router.push('/life/hijri-calendar')} />
          <LifeLink icon="drop.fill" label="Health" color={colors.cyan} onPress={() => router.push('/life/health')} />
          <LifeLink icon="sparkles" label="Sunnah prayers" color={colors.green} onPress={() => router.push('/life/sunnah-prayers')} />
          <LifeLink icon="bookmark.fill" label="Reading" color={colors.orange} onPress={() => router.push('/life/books')} />
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg - 4, marginBottom: spacing.md }}>
          <LifeLink icon="hourglass" label="Countdowns" color={colors.indigo} onPress={() => router.push('/life/countdowns')} />
          <LifeLink icon="doc.text.fill" label="Notes" color={colors.gray} onPress={() => router.push('/life/notes')} />
          <LifeLink icon="heart.fill" label="Medications" color={colors.red} onPress={() => router.push('/life/medications')} />
          <View style={{ flex: 1, marginHorizontal: 4 }} />
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <PrayerHistory />
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <QadaCard />
        </View>

        {topGoal ? (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            <Pressable onPress={() => router.push('/money/savings')}>
              <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ProgressRing
                  progress={topGoal.target_amount > 0 ? topGoal.current_amount / topGoal.target_amount : 0}
                  color={topGoal.color}
                  size={56}
                />
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>Savings goal</Text>
                  <Text style={[typography.headline, { color: colors.label }]}>{topGoal.name}</Text>
                  <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                    {formatMoney(topGoal.current_amount, topGoal.currency)} of {formatMoney(topGoal.target_amount, topGoal.currency)}
                  </Text>
                </View>
                <Icon name="chevron.right" size={16} color={colors.tertiaryLabel} />
              </Card>
            </Pressable>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={[typography.title3, { color: colors.label }]}>Wishlist & Ideas</Text>
            <Pressable onPress={() => router.push('/life/wishlist')}>
              <Text style={[typography.subhead, { color: colors.blue }]}>See all</Text>
            </Pressable>
          </View>
          {activeIdeas.length === 0 ? (
            <Card>
              <EmptyState
                icon="lightbulb.fill"
                title="No ideas yet"
                message="Capture things you want, gift ideas, or plans for later."
              />
            </Card>
          ) : (
            <Card padded={false}>
              {activeIdeas.slice(0, 5).map((item, i, arr) => (
                <WishlistRow key={item.id} item={item} isLast={i === arr.length - 1} />
              ))}
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
