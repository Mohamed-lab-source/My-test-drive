import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import '../../widgets/large_title.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/helpers.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../planner/planner.dart' show distanceKm;
import '../../widgets/common.dart';

/// Two places' map facts side by side. Unknown stays "Unknown".
class CompareScreen extends ConsumerWidget {
  const CompareScreen({super.key, required this.a, required this.b});

  final String a;
  final String b;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pa = ref.watch(placeProvider(a)).value;
    final pb = ref.watch(placeProvider(b)).value;
    if (pa == null || pb == null) {
      return Scaffold(appBar: AppBar(), body: const Center(child: CircularProgressIndicator()));
    }
    final now = DateTime.now();
    String open(Place p) => p.hours?.statusText(now) ?? 'Unknown';
    final rows = <(String, String, String)>[
      ('Type', pa.kindLabel ?? Categories.label(pa.category), pb.kindLabel ?? Categories.label(pb.category)),
      ('Area', pa.area ?? 'Unknown', pb.area ?? 'Unknown'),
      ('Food', pa.cuisineLabel ?? 'Unknown', pb.cuisineLabel ?? 'Unknown'),
      ('Right now', open(pa), open(pb)),
      ('Today', todaysHours(pa, now) ?? tr('Unknown'), todaysHours(pb, now) ?? tr('Unknown')),
      ('Floor', pa.details.floorLabel ?? tr('Unknown'), pb.details.floorLabel ?? tr('Unknown')),
      ('Wheelchair', factText(pa.details.wheelchair), factText(pb.details.wheelchair)),
      ('Wi-Fi', factText(pa.details.wifi), factText(pb.details.wifi)),
      ('Outdoor seating', factText(pa.details.outdoorSeating), factText(pb.details.outdoorSeating)),
      ('Cards', factText(pa.details.cards), factText(pb.details.cards)),
      ('Delivery', factText(pa.details.delivery), factText(pb.details.delivery)),
      ('Phone', pa.phone ?? 'Unknown', pb.phone ?? 'Unknown'),
      ('Website', pa.website == null ? tr('No') : tr('Yes'), pb.website == null ? tr('No') : tr('Yes')),
    ];
    final km = distanceKm(pa, pb);
    final text = Theme.of(context).textTheme;
    return KScaffold(
      title: Text(tr('Compare')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
        children: [
          Row(
            children: [
              const SizedBox(width: 100),
              for (final p in [pa, pb])
                Expanded(
                  child: Column(
                    children: [
                      PlaceImage(url: p.photoUrl, emoji: Categories.emoji(p.category), width: 64, height: 64),
                      const SizedBox(height: KSpace.xs),
                      Text(p.name,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: text.titleSmall),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: KSpace.md),
          for (final (label, x, y) in rows)
            Container(
              padding: const EdgeInsets.symmetric(vertical: KSpace.sm),
              decoration: BoxDecoration(border: Border(bottom: BorderSide(color: context.k.line))),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(width: 100, child: Text(tr(label), style: text.bodySmall)),
                  Expanded(child: Text(x, textAlign: TextAlign.center)),
                  Expanded(child: Text(y, textAlign: TextAlign.center)),
                ],
              ),
            ),
          if (km != null) ...[
            const SizedBox(height: KSpace.md),
            Text(trf('They are {km} km apart (straight line).', {'km': km.toStringAsFixed(1)}),
                textAlign: TextAlign.center, style: text.bodySmall),
          ],
        ],
      ),
    );
  }
}
