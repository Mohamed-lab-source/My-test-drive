import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/helpers.dart' show tapFeedback, timeAgo;
import '../../app/i18n.dart';
import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../data/crowd_repository.dart';
import '../../data/providers.dart';
import '../../models/crowd.dart';
import '../../models/place.dart';
import '../../planner/planner.dart' show haversineKm;
import '../../widgets/common.dart';

/// "How busy is it now?": what Khroga users at the place said in the last
/// 2 hours, and three buttons to say it yourself. Real reports only; when
/// nobody has said anything, it says so.
class CrowdCard extends ConsumerWidget {
  const CrowdCard({super.key, required this.place});

  final Place place;

  Future<void> _report(BuildContext context, WidgetRef ref, String level) async {
    final user = ref.read(authStateProvider).value;
    if (user == null) return;
    if (user.isAnonymous) {
      showMessage(context, tr('Sign in with Google (Profile) to tell others how busy it is.'));
      return;
    }
    final here = ref.read(myLocationProvider);
    if (here != null && place.hasLocation && haversineKm(here.$1, here.$2, place.lat!, place.lng!) > 1.0) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (d) => AlertDialog(
          title: Text(tr('Are you there now?')),
          content: Text(tr('You seem to be more than 1 km away. Only report when you can see how busy it is.')),
          actions: [
            TextButton(onPressed: () => Navigator.pop(d, false), child: Text(tr('Cancel'))),
            FilledButton(onPressed: () => Navigator.pop(d, true), child: Text(tr("I'm here"))),
          ],
        ),
      );
      if (ok != true) return;
    }
    try {
      await ref.read(crowdRepositoryProvider).report(user.uid, place.id, level);
      tapFeedback(ref.read(phoneSettingsProvider).haptics);
      ref.invalidate(crowdNowProvider(place.id));
      if (context.mounted) showMessage(context, tr('Thanks! That helps everyone heading there.'));
    } on CrowdTooSoon catch (e) {
      if (context.mounted) {
        showMessage(context, trf('You told us a moment ago. You can update it in {n} min.', {'n': e.minutes}));
      }
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (place.category == 'shop') return const SizedBox.shrink();
    final text = Theme.of(context).textTheme;
    final now = DateTime.now();
    final crowd = ref.watch(crowdNowProvider(place.id)).value;
    final recent = crowd != null && crowd.isRecent(now);
    return Card(
      margin: const EdgeInsets.only(bottom: KSpace.sm + 4),
      child: Padding(
        padding: const EdgeInsets.all(KSpace.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('👥', style: TextStyle(fontSize: 22)),
                const SizedBox(width: KSpace.sm),
                Expanded(child: Text(tr('How busy is it now?'), style: text.titleMedium)),
              ],
            ),
            const SizedBox(height: KSpace.xs),
            Text(
              recent
                  ? '${crowdSummary(crowd)} · ${trf('last {when}', {'when': timeAgo(crowd.last ?? now, now)})}'
                  : tr('Nobody has said in the last 2 hours.'),
              style: text.bodyMedium,
            ),
            if (recent) ...[
              const SizedBox(height: KSpace.xs),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: SizedBox(
                  height: 8,
                  child: Row(
                    children: [
                      for (final (l, shade) in [('quiet', 0.35), ('normal', 0.65), ('busy', 1.0)])
                        if (crowd.count(l) > 0)
                          Expanded(
                            flex: crowd.count(l),
                            child: ColoredBox(color: context.k.accent.withValues(alpha: shade)),
                          ),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: KSpace.sm),
            Text(tr("Here now? Tell others:"), style: text.bodySmall?.copyWith(color: context.k.inkMuted)),
            const SizedBox(height: 4),
            Wrap(
              spacing: KSpace.sm,
              runSpacing: KSpace.xs,
              children: [
                for (final e in crowdLevels.entries)
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(shape: const StadiumBorder()),
                    onPressed: () => _report(context, ref, e.key),
                    child: Text(tr(e.value)),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              tr('From Khroga users at the place. No names are shown.'),
              style: text.bodySmall?.copyWith(color: context.k.inkMuted),
            ),
          ],
        ),
      ),
    );
  }
}
