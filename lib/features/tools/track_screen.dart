import 'package:flutter/material.dart';
import '../../widgets/large_title.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app/i18n.dart';
import '../../app/pocket.dart' show roughSteps, roughKcal;
import '../../app/live.dart';
import '../../app/theme.dart';
import '../../data/live_share.dart';
import '../../widgets/common.dart';
import '../../widgets/khroga_map.dart';
import '../../widgets/motion.dart';

/// Track my outing: records the route you walk or drive while Khroga is
/// open, with distance and time. Saved only on this phone.
class TrackScreen extends ConsumerWidget {
  const TrackScreen({super.key, this.title});

  /// The outing's name, when started from a plan.
  final String? title;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final track = ref.watch(trackProvider);
    final saved = ref.watch(savedTracksProvider);
    final text = Theme.of(context).textTheme;
    final c = ref.read(trackProvider.notifier);
    final trail = [for (final p in track.points) (p.lat, p.lng)];
    return KScaffold(
      title: Text(tr('Track my outing')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
        children: [
          FadeSlideIn(
            child: HeroCard(
              child: track.running
                  ? _LiveStats(track: track)
                  : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(tr('Record your route'),
                          style: text.headlineSmall?.copyWith(color: context.k.onHero)),
                      const SizedBox(height: KSpace.xs),
                      Text(
                        tr('See how far you went and where. Keeps recording while Khroga is open, '
                            'and stays only on this phone.'),
                        style: TextStyle(color: context.k.onHero.withValues(alpha: 0.9)),
                      ),
                    ]),
            ),
          ),
          if (track.running && trail.isNotEmpty) ...[
            const SizedBox(height: KSpace.md),
            ClipRRect(
              borderRadius: BorderRadius.circular(KRadius.sheet),
              child: SizedBox(height: 280, child: KhrogaMap(pins: const [], trail: trail, me: trail.last, zoom: 16)),
            ),
          ],
          const SizedBox(height: KSpace.md),
          GradientButton(
            icon: track.running ? Icons.stop_circle_outlined : Icons.play_arrow_rounded,
            label: track.running ? tr('Stop and save') : tr('Start tracking'),
            onPressed: () async {
              try {
                if (track.running) {
                  final t = await c.stop(title: title);
                  if (context.mounted) {
                    showMessage(context,
                        t == null ? tr('Too short to save.') : trf('Saved: {km} km', {'km': t.km.toStringAsFixed(2)}));
                  }
                } else {
                  await c.start();
                }
              } catch (e) {
                if (context.mounted) showError(context, e);
              }
            },
          ),
          SectionTitle(tr('Your routes')),
          if (saved.isEmpty)
            Text(tr('Routes you record show up here.'), style: text.bodyMedium)
          else
            for (final (i, t) in saved.indexed)
              FadeSlideIn(
                index: i,
                child: Card(
                  margin: const EdgeInsets.only(bottom: KSpace.sm + 4),
                  clipBehavior: Clip.antiAlias,
                  child: ListTile(
                    leading: const IconTile(Icons.route),
                    title: Text(t.title ?? DateFormat('EEE d MMM · HH:mm').format(t.started)),
                    subtitle: Text([
                      trf('{km} km', {'km': t.km.toStringAsFixed(2)}),
                      trackDuration(t.duration),
                      if (averageKmh(t.points) case final v?) trf('{v} km/h', {'v': v.toStringAsFixed(1)}),
                    ].join(' · ')),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _showTrack(context, ref, t),
                  ),
                ),
              ),
        ],
      ),
    );
  }

  void _showTrack(BuildContext context, WidgetRef ref, SavedTrack t) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.lg),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(t.title ?? DateFormat('EEE d MMM · HH:mm').format(t.started),
              style: Theme.of(sheet).textTheme.titleLarge),
          const SizedBox(height: KSpace.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(KRadius.card),
            child: SizedBox(
              height: 320,
              child: KhrogaMap(pins: const [], trail: [for (final p in t.points) (p.lat, p.lng)]),
            ),
          ),
          const SizedBox(height: KSpace.sm),
          Text([
            trf('{km} km', {'km': t.km.toStringAsFixed(2)}),
            trackDuration(t.duration),
          ].join(' · ')),
          const SizedBox(height: KSpace.md),
          OutlinedButton.icon(
            onPressed: () {
              ref.read(trackProvider.notifier).delete(t.started);
              Navigator.pop(sheet);
            },
            icon: const Icon(Icons.delete_outline),
            label: Text(tr('Delete this route')),
          ),
        ]),
      ),
    );
  }
}

/// Distance, time and speed, updated every second while recording.
class _LiveStats extends StatelessWidget {
  const _LiveStats({required this.track});

  final TrackState track;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return StreamBuilder<int>(
      stream: Stream.periodic(const Duration(seconds: 1), (i) => i),
      builder: (context, _) {
        final elapsed = DateTime.now().difference(track.started!);
        Widget stat(String value, String label) => Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(value,
                    style: TextStyle(
                      fontFamily: KFont.dots,
                      fontFamilyFallback: KFont.dotsFallback,
                      fontWeight: FontWeight.w900,
                      fontSize: 28,
                      color: k.onHero,
                    )),
                Text(label, style: TextStyle(color: k.onHero.withValues(alpha: 0.85), fontSize: 13)),
              ]),
            );
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tr('🔴 Recording'), style: TextStyle(color: k.onHero, fontWeight: FontWeight.w700)),
          const SizedBox(height: KSpace.md),
          Row(children: [
            stat(trailKm(track.points).toStringAsFixed(2), tr('km')),
            stat(trackDuration(elapsed), tr('time')),
            stat(averageKmh(track.points)?.toStringAsFixed(1) ?? '–', tr('km/h')),
          ]),
          const SizedBox(height: KSpace.sm),
          Text(
            trf('About {steps} steps and {kcal} kcal so far (rough)',
                {'steps': roughSteps(trailKm(track.points)), 'kcal': roughKcal(trailKm(track.points))}),
            style: TextStyle(color: k.onHero.withValues(alpha: 0.85), fontSize: 13),
          ),
        ]);
      },
    );
  }
}
