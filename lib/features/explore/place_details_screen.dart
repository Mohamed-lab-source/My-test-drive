import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/local_history.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../widgets/common.dart';
import '../../planner/planner.dart' show similarNearby, nearbyPlaces, haversineKm;
import '../../widgets/launchers.dart';
import 'explore_screen.dart';

class PlaceDetailsScreen extends ConsumerStatefulWidget {
  const PlaceDetailsScreen({super.key, required this.placeId});

  final String placeId;

  @override
  ConsumerState<PlaceDetailsScreen> createState() => _PlaceDetailsScreenState();
}

class _PlaceDetailsScreenState extends ConsumerState<PlaceDetailsScreen> {
  String get placeId => widget.placeId;

  @override
  void initState() {
    super.initState();
    // Remember it for "Recently viewed" (saved on the phone only).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(recentPlacesProvider.notifier).add(placeId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final place = ref.watch(placeProvider(placeId));
    final favorite = ref.watch(favoriteIdsProvider).value?.contains(placeId) ?? false;
    final loaded = place.value;
    return Scaffold(
      appBar: AppBar(
        actions: [
          if (loaded != null)
            IconButton(
              tooltip: 'Share',
              icon: const Icon(Icons.share_outlined),
              onPressed: () => SharePlus.instance.share(ShareParams(text: placeShareText(loaded))),
            ),
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
    final all = ref.watch(allPlacesProvider).value ?? const <Place>[];
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
          _CopyRow(icon: Icons.place_outlined, text: place.address!, what: 'Address'),
        ],
        if (place.phone != null) ...[
          const SizedBox(height: KSpace.sm),
          _CopyRow(icon: Icons.call_outlined, text: place.phone!, what: 'Phone number'),
        ],
        const SizedBox(height: KSpace.sm),
        _HowFar(place: place),
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
                onPressed: () => openDirections(lat: place.lat!, lng: place.lng!, mode: 'walking'),
                icon: const Icon(Icons.directions_walk),
                label: const Text('Walk'),
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
        const SizedBox(height: KSpace.md),
        _VisitedAndNote(place: place),
        if (place.category == 'mall') _MallDirectory(mall: place),
        if (place.category != 'mall') _PlaceList(
          title: 'Similar places nearby',
          places: similarNearby(place, all),
        ),
        _PlaceList(title: "What's nearby (within 500 m)", places: nearbyPlaces(place, all)),
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

/// Text for sharing a place, with a map link when we have its location.
String placeShareText(Place p) {
  final lines = <String>[
    '${Categories.emoji(p.category)} ${p.name}',
    [p.kindLabel ?? Categories.label(p.category), ?p.area].join(' · '),
    ?p.address,
    ?p.phone,
    if (p.hasLocation)
      Uri.https('www.google.com', '/maps/search/', {'api': '1', 'query': '${p.lat},${p.lng}'}).toString(),
    '',
    'Found on Khroga',
  ];
  return lines.join('\n');
}

/// A line of text you can tap to copy (address, phone).
class _CopyRow extends StatelessWidget {
  const _CopyRow({required this.icon, required this.text, required this.what});

  final IconData icon;
  final String text;
  final String what;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: () {
        Clipboard.setData(ClipboardData(text: text));
        showMessage(context, '$what copied');
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 20, color: context.k.inkMuted),
            const SizedBox(width: KSpace.sm),
            Expanded(child: Text(text)),
            Icon(Icons.copy, size: 16, color: context.k.inkMuted),
          ],
        ),
      ),
    );
  }
}

/// "2.4 km from you" — or a button to find out.
class _HowFar extends ConsumerStatefulWidget {
  const _HowFar({required this.place});

  final Place place;

  @override
  ConsumerState<_HowFar> createState() => _HowFarState();
}

class _HowFarState extends ConsumerState<_HowFar> {
  bool _busy = false;

  Future<void> _locate() async {
    setState(() => _busy = true);
    try {
      ref.read(myLocationProvider.notifier).set(await ref.read(locationServiceProvider).current());
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.place;
    if (!p.hasLocation) return const SizedBox.shrink();
    final me = ref.watch(myLocationProvider);
    if (me == null) {
      return Align(
        alignment: Alignment.centerLeft,
        child: TextButton.icon(
          onPressed: _busy ? null : _locate,
          icon: _busy
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.near_me_outlined, size: 18),
          label: const Text('How far is it from me?'),
        ),
      );
    }
    final km = haversineKm(me.$1, me.$2, p.lat!, p.lng!);
    final text = km < 1 ? '${(km * 1000).round()} m' : '${km.toStringAsFixed(1)} km';
    return Row(
      children: [
        Icon(Icons.near_me_outlined, size: 20, color: context.k.inkMuted),
        const SizedBox(width: KSpace.sm),
        Text('$text from you (straight line)'),
      ],
    );
  }
}

/// "Been there" toggle and a private note.
class _VisitedAndNote extends ConsumerWidget {
  const _VisitedAndNote({required this.place});

  final Place place;

  Future<void> _editNote(BuildContext context, WidgetRef ref, String? current) async {
    final uid = ref.read(uidProvider);
    if (uid == null) return;
    final controller = TextEditingController(text: current ?? '');
    final text = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Your private note'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 4,
          maxLength: 500,
          decoration: const InputDecoration(hintText: 'e.g. Ask for the terrace table'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(dialogContext, controller.text),
              child: const Text('Save')),
        ],
      ),
    );
    controller.dispose();
    if (text == null) return;
    try {
      await ref.read(personalRepositoryProvider).saveNote(uid, place.id, text);
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final visited = ref.watch(visitedIdsProvider).value?.contains(place.id) ?? false;
    final note = ref.watch(placeNoteProvider(place.id)).value;
    return Card(
      child: Column(
        children: [
          SwitchListTile(
            secondary: const Text('✅', style: TextStyle(fontSize: 22)),
            title: const Text("I've been here"),
            subtitle: const Text('Keeps a list of places you visited'),
            value: visited,
            onChanged: (v) async {
              final uid = ref.read(uidProvider);
              if (uid == null) return;
              try {
                await ref.read(personalRepositoryProvider).setVisited(uid, place.id, v);
              } catch (e) {
                if (context.mounted) showError(context, e);
              }
            },
          ),
          const Divider(),
          ListTile(
            leading: const Text('📝', style: TextStyle(fontSize: 22)),
            title: Text(note == null ? 'Add a private note' : 'Your note'),
            subtitle: note == null ? const Text('Only you can see it') : Text(note),
            trailing: const Icon(Icons.edit_outlined),
            onTap: () => _editNote(context, ref, note),
          ),
        ],
      ),
    );
  }
}

/// A titled list of places (nearby, similar).
class _PlaceList extends StatelessWidget {
  const _PlaceList({required this.title, required this.places});

  final String title;
  final List<Place> places;

  @override
  Widget build(BuildContext context) {
    if (places.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(title),
        for (final p in places)
          Padding(
            padding: const EdgeInsets.only(bottom: KSpace.sm),
            child: PlaceTile(place: p),
          ),
      ],
    );
  }
}
