import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/extras.dart' show cityCenters;
import '../../app/i18n.dart';
import '../../app/money.dart';
import '../../app/theme.dart';
import '../../data/money_providers.dart';
import '../../data/money_repository.dart';
import '../../data/providers.dart';
import '../../planner/planner.dart' show haversineKm;
import '../../widgets/common.dart';
import '../../widgets/khroga_map.dart';
import '../../widgets/large_title.dart';

/// Where everyone starts from (rounded to about 1 km), and the fair middle:
/// the spot with the least travel for the group, so nobody goes far from
/// the rest. "Plan an outing near everyone" plans around that spot.
class StartPointsScreen extends ConsumerStatefulWidget {
  const StartPointsScreen({super.key, required this.groupId});

  final String groupId;

  @override
  ConsumerState<StartPointsScreen> createState() => _StartPointsScreenState();
}

class _StartPointsScreenState extends ConsumerState<StartPointsScreen> {
  bool _busy = false;

  Future<void> _useLocation(String uid) async {
    setState(() => _busy = true);
    try {
      final here = await ref.read(locationServiceProvider).current();
      await ref.read(moneyRepositoryProvider).setOrigin(widget.groupId, uid, here.$1, here.$2, tr('Near me'));
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickArea(String uid) async {
    final city = ref.read(cityProvider);
    final areas = await ref.read(areaCentersProvider(city).future);
    if (!mounted) return;
    final picked = await showModalBottomSheet<({String name, double lat, double lng, int count})>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheet) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        builder: (_, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.lg),
          children: [
            Text(tr('Which area do you start from?'), style: Theme.of(sheet).textTheme.titleLarge),
            const SizedBox(height: KSpace.sm),
            for (final a in areas)
              ListTile(
                title: Text(a.name),
                subtitle: Text(trf('{n} places', {'n': a.count})),
                onTap: () => Navigator.pop(sheet, a),
              ),
          ],
        ),
      ),
    );
    if (picked == null) return;
    try {
      await ref.read(moneyRepositoryProvider).setOrigin(widget.groupId, uid, picked.lat, picked.lng, picked.name);
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final group = ref.watch(groupProvider(widget.groupId)).value;
    final uid = ref.watch(uidProvider);
    final origins = (ref.watch(groupOriginsProvider(widget.groupId)).value ?? const <Origin>[])
        .where((o) => group?.memberUids.contains(o.uid) ?? false)
        .toList();
    if (group == null || uid == null) {
      return Scaffold(appBar: AppBar(title: Text(tr('Where we start'))), body: const SkeletonList());
    }
    final profiles = ref.watch(profilesProvider(profilesKey(group.memberUids))).value ?? const {};
    String nameOf(String id) => id == uid ? tr('You') : profiles[id]?.displayName ?? '…';
    final points = [for (final o in origins) (o.lat, o.lng)];
    final center = points.length >= 2 ? fairCenter(points) : null;
    final mine = origins.where((o) => o.uid == uid).firstOrNull;
    final text = Theme.of(context).textTheme;
    final k = context.k;

    String initials(String name) {
      final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
      if (parts.isEmpty) return '?';
      return (parts.first[0] + (parts.length > 1 ? parts.last[0] : '')).toUpperCase();
    }

    return KScaffold(
      title: Text(tr('Where we start')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
        children: [
          if (points.isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(KRadius.sheet),
              child: SizedBox(
                height: 300,
                child: KhrogaMap(pins: [
                  if (center != null) MapPin(lat: center.$1, lng: center.$2, label: tr('The fair middle'), emoji: '🎯'),
                  for (final o in origins)
                    MapPin(lat: o.lat, lng: o.lng, label: nameOf(o.uid), initials: initials(nameOf(o.uid))),
                ]),
              ),
            ),
          const SizedBox(height: KSpace.md),
          HeroCard(
            child: center == null
                ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(tr('Plan close to everyone'), style: text.titleLarge?.copyWith(color: k.onHero)),
                    const SizedBox(height: KSpace.xs),
                    Text(
                      tr('Each person adds where they start from. Khroga finds the fair middle so nobody travels far from the rest.'),
                      style: TextStyle(color: k.onHero.withValues(alpha: 0.9)),
                    ),
                    const SizedBox(height: KSpace.sm),
                    Text(trf('{n} of {m} added so far', {'n': origins.length, 'm': group.memberUids.length}),
                        style: TextStyle(color: k.onHero, fontWeight: FontWeight.w700)),
                  ])
                : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(tr('The fair middle'), style: text.titleLarge?.copyWith(color: k.onHero)),
                    const SizedBox(height: KSpace.xs),
                    Text(
                      trf('The farthest person is about {km} km away (straight line).',
                          {'km': farthestKm(center, points).toStringAsFixed(1)}),
                      style: TextStyle(color: k.onHero.withValues(alpha: 0.9)),
                    ),
                    const SizedBox(height: KSpace.md),
                    FilledButton.icon(
                      style: FilledButton.styleFrom(backgroundColor: k.surface, foregroundColor: k.ink),
                      icon: const Icon(Icons.auto_awesome),
                      label: Text(tr('Plan an outing near everyone')),
                      onPressed: () {
                        // The city whose centre is closest to the middle.
                        final city = cityCenters.entries
                            .reduce((a, b) => haversineKm(center.$1, center.$2, a.value.$1, a.value.$2) <=
                                    haversineKm(center.$1, center.$2, b.value.$1, b.value.$2)
                                ? a
                                : b)
                            .key;
                        ref.read(cityProvider.notifier).set(city);
                        context.push(Uri(path: '/new-plan', queryParameters: {
                          'lat': '${center.$1}',
                          'lng': '${center.$2}',
                          'label': tr('the middle of your group'),
                        }).toString());
                      },
                    ),
                  ]),
          ),
          SectionTitle(tr('My starting point')),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(KSpace.md),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(mine == null ? tr('Not added yet') : mine.label, style: text.titleMedium),
                const SizedBox(height: KSpace.xs),
                Text(tr('Saved rounded to about 1 km, so your exact address stays private. Only your group sees it.'),
                    style: text.bodySmall),
                const SizedBox(height: KSpace.md),
                Wrap(spacing: KSpace.sm, runSpacing: KSpace.sm, children: [
                  OutlinedButton.icon(
                    onPressed: _busy ? null : () => _useLocation(uid),
                    icon: _busy
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.my_location),
                    label: Text(tr('Where I am now')),
                  ),
                  OutlinedButton.icon(
                    onPressed: () => _pickArea(uid),
                    icon: const Icon(Icons.holiday_village_outlined),
                    label: Text(tr('Pick an area')),
                  ),
                  if (mine != null)
                    TextButton(
                      onPressed: () => ref.read(moneyRepositoryProvider).clearOrigin(widget.groupId, uid),
                      child: Text(tr('Remove')),
                    ),
                ]),
              ]),
            ),
          ),
          if (origins.isNotEmpty) ...[
            SectionTitle(trf('Everyone ({n})', {'n': origins.length})),
            MenuGroup(children: [
              for (final o in origins)
                ListTile(
                  leading: CircleAvatar(
                    backgroundColor: k.accentSoft,
                    child: Text(initials(nameOf(o.uid)), style: TextStyle(color: k.accent, fontWeight: FontWeight.w800)),
                  ),
                  title: Text(nameOf(o.uid)),
                  subtitle: Text([
                    o.label,
                    if (center != null)
                      trf('{km} km from the middle', {'km': haversineKm(center.$1, center.$2, o.lat, o.lng).toStringAsFixed(1)}),
                  ].join(' · ')),
                ),
            ]),
          ],
        ],
      ),
    );
  }
}
