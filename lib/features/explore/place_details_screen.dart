import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../widgets/common.dart';
import '../../widgets/launchers.dart';
import 'explore_screen.dart';

class PlaceDetailsScreen extends ConsumerWidget {
  const PlaceDetailsScreen({super.key, required this.placeId});

  final String placeId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final place = ref.watch(placeProvider(placeId));
    final favorite = ref.watch(favoriteIdsProvider).value?.contains(placeId) ?? false;
    return Scaffold(
      appBar: AppBar(
        actions: [
          IconButton(
            tooltip: favorite ? 'Remove from favorites' : 'Add to favorites',
            icon: Icon(favorite ? Icons.favorite : Icons.favorite_border,
                color: favorite ? context.k.accent : null),
            onPressed: () async {
              final uid = ref.read(uidProvider);
              if (uid == null) return;
              try {
                await ref.read(favoritesRepositoryProvider).set(uid, placeId, !favorite);
              } catch (e) {
                if (context.mounted) showError(context, e);
              }
            },
          ),
        ],
      ),
      body: AsyncView<Place?>(
        value: place,
        onRetry: () => ref.invalidate(placeProvider(placeId)),
        builder: (p) => p == null
            ? const EmptyState(emoji: '🤷', title: 'Place not found')
            : _Details(place: p),
      ),
    );
  }
}

class _Details extends ConsumerWidget {
  const _Details({required this.place});

  final Place place;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final facts = place.details;
    final mall = place.parentMallId == null
        ? null
        : ref.watch(placeProvider(place.parentMallId!)).value;

    return ListView(
      padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
      children: [
        _Header(place: place),
        const SizedBox(height: KSpace.md),
        Text(place.name, style: text.headlineMedium),
        if (place.nameAr != null && place.nameAr != place.name)
          Text(place.nameAr!,
              textDirection: TextDirection.rtl,
              style: text.titleMedium?.copyWith(color: context.k.inkMuted)),
        const SizedBox(height: KSpace.sm),
        Wrap(
          spacing: KSpace.sm,
          runSpacing: KSpace.sm,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Pill('${Categories.emoji(place.category)} '
                '${place.kindLabel ?? Categories.label(place.category)}'),
            if (place.area != null) Pill(place.area!),
            if (place.cuisineLabel != null) Pill(place.cuisineLabel!),
            if (facts.brand != null && facts.brand != place.name) Pill(facts.brand!),
            OpenBadge(place: place),
          ],
        ),
        if (mall != null) ...[
          const SizedBox(height: KSpace.md),
          Card(
            child: ListTile(
              leading: const Text('🛍️', style: TextStyle(fontSize: 24)),
              title: Text('Inside ${mall.name}'),
              subtitle: facts.floorLabel == null ? null : Text(facts.floorLabel!),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/place/${mall.id}'),
            ),
          ),
        ] else if (facts.floorLabel != null) ...[
          const SizedBox(height: KSpace.sm),
          Text(facts.floorLabel!, style: text.bodyMedium),
        ],
        if (facts.description != null) ...[
          const SizedBox(height: KSpace.md),
          Text(facts.description!, style: text.bodyLarge),
        ],
        if (place.address != null) ...[
          const SizedBox(height: KSpace.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.place_outlined, size: 20, color: context.k.inkMuted),
              const SizedBox(width: KSpace.sm),
              Expanded(child: Text(place.address!)),
            ],
          ),
        ],
        const SizedBox(height: KSpace.md),
        Wrap(
          spacing: KSpace.sm,
          runSpacing: KSpace.sm,
          children: [
            if (place.hasLocation)
              OutlinedButton.icon(
                onPressed: () => openInMaps(name: place.name, lat: place.lat, lng: place.lng),
                icon: const Icon(Icons.directions_outlined),
                label: const Text('Directions'),
              ),
            if (place.hasLocation)
              OutlinedButton.icon(
                onPressed: () => openUber(name: place.name, lat: place.lat!, lng: place.lng!),
                icon: const Icon(Icons.local_taxi_outlined),
                label: const Text('Uber'),
              ),
            if (place.phone != null)
              OutlinedButton.icon(
                onPressed: () => callPhone(place.phone!),
                icon: const Icon(Icons.call_outlined),
                label: const Text('Call'),
              ),
            if (place.website != null)
              OutlinedButton.icon(
                onPressed: () => openWebsite(place.website!),
                icon: const Icon(Icons.language),
                label: const Text('Website'),
              ),
          ],
        ),
        if (facts.labels.isNotEmpty) ...[
          const SectionTitle('Good to know'),
          Wrap(
            spacing: KSpace.sm,
            runSpacing: KSpace.sm,
            children: [for (final l in facts.labels) Pill(l)],
          ),
        ],
        if (place.openingHours != null) ...[
          const SectionTitle('Opening hours'),
          Text(_friendlyHours(place.openingHours!), style: text.bodyMedium),
          const SizedBox(height: KSpace.xs),
          Text('Hours can change. Call ahead if it matters.', style: text.bodySmall),
        ],
        if (place.category == 'mall') _MallDirectory(mall: place),
        const SizedBox(height: KSpace.lg),
        if (place.osmUrl != null)
          TextButton(
            onPressed: () => openWebsite(place.osmUrl!),
            child: const Text('Something wrong or missing? Fix it on OpenStreetMap'),
          ),
        const OsmCredit(),
      ],
    );
  }

  /// Makes OpenStreetMap's short day names readable ("Mo-Fr" → "Mon–Fri").
  static String _friendlyHours(String raw) {
    const days = {
      'Mo': 'Mon', 'Tu': 'Tue', 'We': 'Wed', 'Th': 'Thu',
      'Fr': 'Fri', 'Sa': 'Sat', 'Su': 'Sun', 'PH': 'Holidays',
    };
    var out = raw;
    days.forEach((k, v) => out = out.replaceAll(RegExp('\\b$k\\b'), v));
    return out
        .replaceAll('24/7', 'Open 24 hours')
        .replaceAll('; ', '\n')
        .replaceAll(';', '\n')
        .replaceAll(' off', ' closed');
  }
}

/// A real photo (from Wikimedia Commons) with its credit, or a calm icon tile.
class _Header extends StatelessWidget {
  const _Header({required this.place});

  final Place place;

  @override
  Widget build(BuildContext context) {
    if (place.photoUrl == null) {
      return Container(
        height: 120,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: context.k.accentSoft,
          borderRadius: BorderRadius.circular(KRadius.card),
        ),
        child: Text(Categories.emoji(place.category), style: const TextStyle(fontSize: 56)),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        PlaceImage(
          url: place.photoUrl,
          emoji: Categories.emoji(place.category),
          height: 220,
          width: double.infinity,
          radius: KRadius.card,
        ),
        if (place.photoPage != null)
          TextButton(
            style: TextButton.styleFrom(
              padding: EdgeInsets.zero,
              minimumSize: const Size(0, 32),
              foregroundColor: context.k.inkMuted,
            ),
            onPressed: () => openWebsite(place.photoPage!),
            child: const Text('Photo: Wikimedia Commons (tap for credit)',
                style: TextStyle(fontSize: 12)),
          ),
      ],
    );
  }
}

/// Everything inside a mall, grouped by type, with floors.
class _MallDirectory extends ConsumerWidget {
  const _MallDirectory({required this.mall});

  final Place mall;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final venues = ref.watch(mallVenuesProvider(mall.id)).value ?? const <Place>[];
    final text = Theme.of(context).textTheme;
    final groups = <String, List<Place>>{};
    for (final v in venues) {
      (groups[v.category] ??= []).add(v);
    }
    final order = Categories.all.keys.where(groups.containsKey).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: KSpace.lg),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: venues.isEmpty
                ? null
                : () {
                    ref.read(cityProvider.notifier).set(mall.city);
                    context.push('/new-plan?mall=${mall.id}');
                  },
            icon: const Icon(Icons.auto_awesome),
            label: const Text('Plan my day here'),
          ),
        ),
        SectionTitle('Inside this mall (${venues.length})'),
        if (venues.isEmpty)
          Text(
            "We don't have the places inside this mall on the map yet.",
            style: text.bodyMedium?.copyWith(color: context.k.inkMuted),
          ),
        for (final cat in order) ...[
          Padding(
            padding: const EdgeInsets.only(top: KSpace.sm, bottom: KSpace.xs),
            child: Text('${Categories.emoji(cat)} ${Categories.label(cat)} (${groups[cat]!.length})',
                style: text.titleMedium),
          ),
          for (final v in (groups[cat]!
            ..sort((a, b) => (a.details.level ?? '~').compareTo(b.details.level ?? '~'))))
            Padding(
              padding: const EdgeInsets.only(bottom: KSpace.sm),
              child: PlaceTile(place: v),
            ),
        ],
      ],
    );
  }
}
