import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/extras.dart' show distanceText;
import '../../app/i18n.dart';
import '../../app/theme.dart';
import '../../data/live_data.dart';
import '../../models/place.dart';
import '../../widgets/common.dart';
import '../../widgets/launchers.dart';

final _wikiNearbyProvider = FutureProvider.autoDispose.family<List<WikiNearby>, (double, double, String)>(
  (ref, k) => fetchWikiNearby(k.$1, k.$2, k.$3),
);
final _photosNearbyProvider = FutureProvider.autoDispose.family<List<CommonsPhoto>, (double, double)>(
  (ref, k) => fetchCommonsNearby(k.$1, k.$2),
);

/// "Around here": Wikipedia articles about things within 1 km, and photos
/// people shared on Wikimedia Commons within 300 m. Loaded only when tapped
/// (saves data), always credited, never presented as this place's own facts.
class AroundCard extends ConsumerStatefulWidget {
  const AroundCard({super.key, required this.place});

  final Place place;

  @override
  ConsumerState<AroundCard> createState() => _AroundCardState();
}

class _AroundCardState extends ConsumerState<AroundCard> {
  bool _wiki = false;
  bool _photos = false;

  @override
  Widget build(BuildContext context) {
    final p = widget.place;
    if (!p.hasLocation) return const SizedBox.shrink();
    final text = Theme.of(context).textTheme;
    final lang = isArabic ? 'ar' : 'en';
    return Card(
      margin: const EdgeInsets.only(bottom: KSpace.sm + 4),
      child: Padding(
        padding: const EdgeInsets.all(KSpace.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(tr('🧭 Around here'), style: text.titleMedium),
            const SizedBox(height: KSpace.xs),
            Wrap(
              spacing: KSpace.sm,
              children: [
                FilterChip(
                  label: Text(tr('📖 On Wikipedia')),
                  selected: _wiki,
                  onSelected: (v) => setState(() => _wiki = v),
                ),
                FilterChip(
                  label: Text(tr('📸 Photos taken nearby')),
                  selected: _photos,
                  onSelected: (v) => setState(() => _photos = v),
                ),
              ],
            ),
            if (_wiki)
              ref
                  .watch(_wikiNearbyProvider((p.lat!, p.lng!, lang)))
                  .when(
                    loading: () => const LinearProgressIndicator(),
                    error: (e, _) => Text(friendlyError(e)),
                    data: (list) => list.isEmpty
                        ? Padding(
                            padding: const EdgeInsets.only(top: KSpace.sm),
                            child: Text(tr('No Wikipedia articles within 1 km.')),
                          )
                        : Column(
                            children: [
                              for (final w in list.take(8))
                                ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  dense: true,
                                  leading: const Icon(Icons.menu_book_outlined),
                                  title: Text(w.title),
                                  subtitle: Text(distanceText(w.meters / 1000)),
                                  onTap: () => openUri(Uri.https('$lang.wikipedia.org', '/', {'curid': '${w.pageId}'})),
                                ),
                              Text(tr('From Wikipedia (CC BY-SA).'), style: text.bodySmall),
                            ],
                          ),
                  ),
            if (_photos)
              ref
                  .watch(_photosNearbyProvider((p.lat!, p.lng!)))
                  .when(
                    loading: () => const LinearProgressIndicator(),
                    error: (e, _) => Text(friendlyError(e)),
                    data: (list) => list.isEmpty
                        ? Padding(
                            padding: const EdgeInsets.only(top: KSpace.sm),
                            child: Text(tr('No shared photos within 300 m yet.')),
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SizedBox(height: KSpace.sm),
                              SizedBox(
                                height: 120,
                                child: ListView.separated(
                                  scrollDirection: Axis.horizontal,
                                  itemCount: list.length,
                                  separatorBuilder: (_, _) => const SizedBox(width: KSpace.sm),
                                  itemBuilder: (_, i) => InkWell(
                                    onTap: () => openUri(Uri.parse(list[i].page)),
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(12),
                                      child: Image.network(
                                        list[i].thumb,
                                        width: 150,
                                        height: 120,
                                        fit: BoxFit.cover,
                                        semanticLabel: tr('Photo taken nearby'),
                                        errorBuilder: (_, _, _) => const SizedBox(width: 150),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                tr(
                                  'Photos people took near here, not always of this place. Tap one for its author and license (Wikimedia Commons).',
                                ),
                                style: text.bodySmall,
                              ),
                            ],
                          ),
                  ),
          ],
        ),
      ),
    );
  }
}
