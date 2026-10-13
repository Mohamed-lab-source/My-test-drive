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
import '../../models/plan.dart';
import '../../widgets/common.dart';
import '../../widgets/share_card.dart';

enum _Span { thisMonth, lastMonth, thisYear }

/// "My month on Khroga": your own outings in a shareable story, plus what
/// kind of outing person you are. Only from your account.
class RecapScreen extends ConsumerStatefulWidget {
  const RecapScreen({super.key});

  @override
  ConsumerState<RecapScreen> createState() => _RecapScreenState();
}

class _RecapScreenState extends ConsumerState<RecapScreen> {
  _Span _span = _Span.thisMonth;

  (DateTime, DateTime, String) _range(DateTime now) => switch (_span) {
    _Span.thisMonth => (
      DateTime(now.year, now.month),
      DateTime(now.year, now.month + 1),
      DateFormat.yMMMM().format(now),
    ),
    _Span.lastMonth => (
      DateTime(now.year, now.month - 1),
      DateTime(now.year, now.month),
      DateFormat.yMMMM().format(DateTime(now.year, now.month - 1)),
    ),
    _Span.thisYear => (DateTime(now.year), DateTime(now.year + 1), '${now.year}'),
  };

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    // One page of 50 plans, only while this screen is open.
    final plans = ref.watch(historyPlansProvider(50)).value ?? const <OutingPlan>[];
    final visited = ref.watch(visitedDatedProvider).value ?? const <(Place, DateTime?)>[];
    final (from, to, label) = _range(DateTime.now());
    final r = recapOf(from, to, plans, visited);
    final type = outerTypeFor([for (final (p, _) in visited) p], plans.expand((p) => p.request.vibes).toList());

    final lines = <(String, String, String?)>[
      ('🗺️', trf('{n} plans made', {'n': r.plans}), r.stops > 0 ? trf('{n} stops', {'n': r.stops}) : null),
      ('✅', trf('{n} new places', {'n': r.newPlaces}), null),
      if (r.km >= 1) ('📏', trf('About {n} km between stops', {'n': r.km.round()}), tr('Straight-line distance')),
      if (r.topArea != null) ('🏘️', trf('Top area: {area}', {'area': r.topArea!}), null),
      if (r.topCategory != null)
        (
          Categories.emoji(r.topCategory!),
          trf('Favorite kind: {kind}', {'kind': Categories.label(r.topCategory!)}),
          null,
        ),
      if (r.topVibe != null) ('✨', trf('Top vibe: {vibe}', {'vibe': tr(Vibes.all[r.topVibe!] ?? r.topVibe!)}), null),
      if (r.busiestDay != null)
        (
          '📅',
          trf('Favorite day to plan: {day}', {'day': DateFormat.EEEE().format(DateTime(2024, 1, r.busiestDay!))}),
          null,
        ),
    ];

    return Scaffold(
      appBar: AppBar(title: Text(tr('My recap'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
        children: [
          SegmentedButton<_Span>(
            showSelectedIcon: false,
            segments: [
              ButtonSegment(value: _Span.thisMonth, label: Text(tr('This month'))),
              ButtonSegment(value: _Span.lastMonth, label: Text(tr('Last month'))),
              ButtonSegment(value: _Span.thisYear, label: Text(tr('This year'))),
            ],
            selected: {_span},
            onSelectionChanged: (s) => setState(() => _span = s.first),
          ),
          const SizedBox(height: KSpace.md),
          if (r.isEmpty)
            EmptyState(
              emoji: '🌱',
              title: trf('Nothing in {when} yet', {'when': label}),
              message: tr('Make a plan or mark places you\'ve been, and your recap fills in here.'),
              actionLabel: tr('Make a plan'),
              onAction: () => context.go('/plan'),
            )
          else ...[
            Center(
              child: SizedBox(
                width: 300,
                child: StoryCard(emoji: '🎉', title: trf('My {when} on Khroga', {'when': label}), lines: lines),
              ),
            ),
            const SizedBox(height: KSpace.md),
            FilledButton.icon(
              onPressed: () => sharePictureCard(
                context,
                StoryCard(emoji: '🎉', title: trf('My {when} on Khroga', {'when': label}), lines: lines),
                appInviteText(),
              ),
              icon: const Icon(Icons.ios_share),
              label: Text(tr('Share my recap')),
            ),
          ],
          SectionTitle(tr('Your outing personality')),
          if (type == null)
            Card(
              child: ListTile(
                leading: const Text('🔮', style: TextStyle(fontSize: 28)),
                title: Text(tr('Mark 3 places you\'ve been to find out')),
                subtitle: Text(tr('Tap "Been there" on a place page.')),
              ),
            )
          else
            Card(
              child: Padding(
                padding: const EdgeInsets.all(KSpace.md),
                child: Column(
                  children: [
                    Text(type.emoji, style: const TextStyle(fontSize: 56)),
                    Text(type.title, style: text.headlineSmall, textAlign: TextAlign.center),
                    const SizedBox(height: KSpace.xs),
                    Text(type.line, style: text.bodyMedium, textAlign: TextAlign.center),
                    const SizedBox(height: KSpace.sm),
                    Text(tr('From the places you\'ve been and the vibes you plan.'), style: text.bodySmall),
                    TextButton.icon(
                      onPressed: () => sharePictureCard(
                        context,
                        StoryCard(
                          emoji: type.emoji,
                          title: trf("I'm {type}", {'type': type.title}),
                          subtitle: type.line,
                          lines: [('🔮', tr('What kind of outing person are you?'), tr('Find out on Khroga'))],
                        ),
                        appInviteText(),
                      ),
                      icon: const Icon(Icons.ios_share),
                      label: Text(tr('Share')),
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
