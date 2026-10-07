import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../widgets/common.dart';

/// Every mall in the city, with how many places inside it we know about.
class MallsScreen extends ConsumerStatefulWidget {
  const MallsScreen({super.key});

  @override
  ConsumerState<MallsScreen> createState() => _MallsScreenState();
}

class _MallsScreenState extends ConsumerState<MallsScreen> {
  String _q = '';
  bool _byName = false;

  @override
  Widget build(BuildContext context) {
    final city = ref.watch(cityProvider);
    final malls = ref.watch(mallsProvider(city));
    final all = ref.watch(allPlacesProvider).value ?? const <Place>[];
    final counts = <String, int>{};
    for (final p in all) {
      if (p.parentMallId != null) counts[p.parentMallId!] = (counts[p.parentMallId!] ?? 0) + 1;
    }
    return Scaffold(
      appBar: AppBar(title: Text(trf('Malls in {city}', {'city': tr(Cities.all[city] ?? city)}))),
      body: AsyncView<List<Place>>(
        value: malls,
        builder: (list) {
          final shown = list
              .where((m) => m.name.toLowerCase().contains(_q.toLowerCase()) ||
                  (m.area?.toLowerCase().contains(_q.toLowerCase()) ?? false))
              .toList()
            ..sort((a, b) => _byName
                ? a.shownName.toLowerCase().compareTo(b.shownName.toLowerCase())
                : (counts[b.id] ?? 0).compareTo(counts[a.id] ?? 0));
          return ListView(
            padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
            children: [
              TextField(
                decoration: InputDecoration(
                    hintText: tr('Find a mall'), prefixIcon: Icon(Icons.search)),
                onChanged: (v) => setState(() => _q = v),
              ),
              const SizedBox(height: KSpace.sm),
              SegmentedButton<bool>(
                showSelectedIcon: false,
                segments: [
                  ButtonSegment(value: false, label: Text(tr('Most places'))),
                  ButtonSegment(value: true, label: Text(tr('A–Z'))),
                ],
                selected: {_byName},
                onSelectionChanged: (v) => setState(() => _byName = v.first),
              ),
              const SizedBox(height: KSpace.sm),
              Text(trf('{n} malls · most places inside first', {'n': shown.length}),
                  style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: KSpace.sm),
              if (shown.isEmpty)
                EmptyState(emoji: '🛍️', title: tr('No malls match')),
              for (final m in shown)
                Card(
                  child: ListTile(
                    leading: PlaceImage(url: m.photoUrl, emoji: '🛍️', width: 48, height: 48),
                    title: Text(m.shownName),
                    subtitle: Text([
                      if (m.area != null) m.area!,
                      (counts[m.id] ?? 0) == 0
                          ? tr('No places inside listed yet')
                          : '${counts[m.id]} places inside',
                    ].join(' · ')),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/place/${m.id}'),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
