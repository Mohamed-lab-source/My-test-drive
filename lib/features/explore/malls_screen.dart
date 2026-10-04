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
      appBar: AppBar(title: Text('Malls in ${Cities.all[city] ?? city}')),
      body: AsyncView<List<Place>>(
        value: malls,
        builder: (list) {
          final shown = list
              .where((m) => m.name.toLowerCase().contains(_q.toLowerCase()) ||
                  (m.area?.toLowerCase().contains(_q.toLowerCase()) ?? false))
              .toList()
            ..sort((a, b) => (counts[b.id] ?? 0).compareTo(counts[a.id] ?? 0));
          return ListView(
            padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
            children: [
              TextField(
                decoration: const InputDecoration(
                    hintText: 'Find a mall', prefixIcon: Icon(Icons.search)),
                onChanged: (v) => setState(() => _q = v),
              ),
              const SizedBox(height: KSpace.sm),
              Text('${shown.length} malls · most places inside first',
                  style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: KSpace.sm),
              if (shown.isEmpty)
                const EmptyState(emoji: '🛍️', title: 'No malls match'),
              for (final m in shown)
                Card(
                  child: ListTile(
                    leading: PlaceImage(url: m.photoUrl, emoji: '🛍️', width: 48, height: 48),
                    title: Text(m.name),
                    subtitle: Text([
                      if (m.area != null) m.area!,
                      (counts[m.id] ?? 0) == 0
                          ? 'No places inside listed yet'
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
