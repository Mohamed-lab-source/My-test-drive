import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/i18n.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../widgets/common.dart';
import '../../widgets/confetti.dart';
import '../../widgets/launchers.dart';

/// Mystery mode: hand the phone to your friends or date and reveal the plan
/// one stop at a time. Only the time and kind of place show until you tap.
class MysteryPlanScreen extends ConsumerStatefulWidget {
  const MysteryPlanScreen({super.key, required this.planId});

  final String planId;

  @override
  ConsumerState<MysteryPlanScreen> createState() => _MysteryPlanScreenState();
}

class _MysteryPlanScreenState extends ConsumerState<MysteryPlanScreen> {
  int _shown = 0;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(tr('Mystery outing'))),
      body: AsyncView<OutingPlan?>(
        value: ref.watch(planProvider(widget.planId)),
        builder: (plan) {
          if (plan == null) return EmptyState(emoji: '🔍', title: tr('This plan is gone'));
          final stops = plan.stops;
          final allOut = _shown >= stops.length;
          return ListView(
            padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
            children: [
              Text(
                allOut
                    ? tr('That\'s the whole outing. Have fun!')
                    : tr('Tap the next card to find out where you\'re going.'),
                style: text.bodyMedium?.copyWith(color: context.k.inkMuted),
              ),
              if (allOut) const Confetti(height: 120),
              const SizedBox(height: KSpace.sm),
              for (final (i, s) in stops.indexed)
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 350),
                  transitionBuilder: (child, a) => ScaleTransition(scale: a, child: child),
                  child: i < _shown
                      ? Card(
                          key: ValueKey('open$i'),
                          child: ListTile(
                            leading: Text(Categories.emoji(s.category), style: const TextStyle(fontSize: 30)),
                            title: Text(s.name, style: text.titleMedium),
                            subtitle: Text(
                              [
                                if (s.startTime != null) s.startTime!,
                                Categories.label(s.category),
                                if (s.area != null) s.area!,
                              ].join(' · '),
                            ),
                            trailing: s.lat == null
                                ? null
                                : IconButton(
                                    tooltip: tr('Directions'),
                                    icon: const Icon(Icons.directions),
                                    onPressed: () => openDirections(lat: s.lat!, lng: s.lng!),
                                  ),
                            onTap: () => context.push('/place/${s.placeId}'),
                          ),
                        )
                      : Card(
                          key: ValueKey('closed$i'),
                          color: i == _shown ? context.k.accent : context.k.surface,
                          child: ListTile(
                            enabled: i == _shown,
                            leading: Text(i == _shown ? '🎁' : '🔒', style: const TextStyle(fontSize: 30)),
                            title: Text(
                              trf('Stop {n}', {'n': i + 1}),
                              style: text.titleMedium?.copyWith(color: i == _shown ? context.k.onAccent : null),
                            ),
                            subtitle: Text(
                              [if (s.startTime != null) s.startTime!, tr('Tap to reveal')].join(' · '),
                              style: TextStyle(color: i == _shown ? context.k.onAccent : null),
                            ),
                            onTap: i == _shown ? () => setState(() => _shown++) : null,
                          ),
                        ),
                ),
              if (!allOut && _shown > 0)
                TextButton(onPressed: () => setState(() => _shown = stops.length), child: Text(tr('Show everything'))),
            ],
          );
        },
      ),
    );
  }
}
