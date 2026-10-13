import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/fun.dart';
import '../../app/i18n.dart';
import '../../app/share_texts.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../widgets/confetti.dart';
import '../../widgets/share_card.dart';
import 'badges_screen.dart' show funPrefsProvider;

/// Places you marked "Been there" this month.
List<Place> visitedThisMonth(List<(Place, DateTime?)> visited, DateTime now) => [
  for (final (p, t) in visited)
    if (t != null && t.year == now.year && t.month == now.month) p,
];

/// A 3×3 card of kinds of places to try this month (the same card for
/// everyone), ticked by the places you mark "Been there". Plus your own
/// goal of new places this month.
class BingoScreen extends ConsumerWidget {
  const BingoScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final now = DateTime.now();
    final card = bingoFor(now);
    final visited = ref.watch(visitedDatedProvider).value ?? const <(Place, DateTime?)>[];
    final month = visitedThisMonth(visited, now);
    final done = bingoDone(card, month);
    final lines = bingoLines(done);
    final ticks = done.where((d) => d).length;
    final goal = int.tryParse(ref.watch(funPrefsProvider)['goal.${now.year}-${now.month}'] ?? '') ?? 0;
    final monthName = DateFormat.MMMM().format(now);

    return Scaffold(
      appBar: AppBar(
        title: Text(trf('{month} bingo', {'month': monthName})),
        actions: [
          IconButton(
            tooltip: tr('Share as a picture'),
            icon: const Icon(Icons.ios_share),
            onPressed: () => sharePictureCard(
              context,
              StoryCard(
                emoji: '🎯',
                title: trf('{month} bingo', {'month': monthName}),
                subtitle: trf('{a} of 9 done · {b} lines', {'a': ticks, 'b': lines}),
                lines: [for (final (i, s) in card.indexed) (done[i] ? '✅' : s.emoji, s.label, null)],
              ),
              appInviteText(),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
        children: [
          Text(
            tr('Visit a place of each kind this month. Tap "Been there" on its page to tick it.'),
            style: text.bodyMedium?.copyWith(color: context.k.inkMuted),
          ),
          const SizedBox(height: KSpace.md),
          Stack(
            children: [
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: KSpace.sm,
                crossAxisSpacing: KSpace.sm,
                children: [
                  for (final (i, s) in card.indexed)
                    Material(
                      color: done[i] ? context.k.accent : context.k.surface,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(color: done[i] ? context.k.accent : context.k.line),
                      ),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: done[i] ? null : () => context.go('/explore'),
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(done[i] ? '✅' : s.emoji, style: const TextStyle(fontSize: 28)),
                              const SizedBox(height: 4),
                              Text(
                                s.label,
                                textAlign: TextAlign.center,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: text.bodySmall?.copyWith(
                                  color: done[i] ? context.k.onAccent : context.k.ink,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              if (lines > 0) const Confetti(height: 260),
            ],
          ),
          const SizedBox(height: KSpace.sm),
          Text(
            lines > 0
                ? trf('Bingo! {n} lines done 🎉', {'n': lines})
                : trf('{n} of 9 done. Get 3 in a row for a bingo.', {'n': ticks}),
            style: text.titleMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: KSpace.lg),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(KSpace.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(tr('My goal this month'), style: text.titleMedium),
                  const SizedBox(height: KSpace.xs),
                  if (goal == 0)
                    Text(tr('How many new places do you want to visit this month?'), style: text.bodyMedium)
                  else ...[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: (month.length / goal).clamp(0, 1).toDouble(),
                        minHeight: 12,
                        color: context.k.accent,
                        backgroundColor: context.k.accentSoft,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      month.length >= goal
                          ? trf('Goal reached: {a} of {b} 🎉', {'a': month.length, 'b': goal})
                          : trf('{a} of {b} new places', {'a': month.length, 'b': goal}),
                      style: text.bodyMedium,
                    ),
                  ],
                  const SizedBox(height: KSpace.sm),
                  Wrap(
                    spacing: KSpace.sm,
                    children: [
                      for (final n in [3, 5, 8, 12])
                        ChoiceChip(
                          label: Text('$n'),
                          selected: goal == n,
                          showCheckmark: false,
                          onSelected: (_) => ref
                              .read(funPrefsProvider.notifier)
                              .set('goal.${now.year}-${now.month}', goal == n ? null : '$n'),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
