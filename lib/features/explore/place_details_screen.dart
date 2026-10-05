import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/helpers.dart';
import '../../app/local_history.dart';
import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../widgets/common.dart';
import '../../planner/planner.dart'
    show similarNearby, nearbyPlaces, haversineKm, addStop, otherBranches;
import 'lists_screen.dart' show newListDialog;
import '../../widgets/khroga_map.dart';
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
        if (place.hasLocation) ...[
          const SizedBox(height: KSpace.sm),
          _CopyRow(
              icon: Icons.my_location,
              text: '${place.lat!.toStringAsFixed(5)}, ${place.lng!.toStringAsFixed(5)}',
              what: 'Coordinates'),
        ],
        if (place.hasLocation) ...[
          const SizedBox(height: KSpace.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(KRadius.card),
            child: SizedBox(
              height: 170,
              child: KhrogaMap(
                zoom: 16,
                pins: [
                  MapPin(
                    lat: place.lat!,
                    lng: place.lng!,
                    label: place.name,
                    emoji: Categories.emoji(place.category),
                    onTap: () => openInMaps(name: place.name, lat: place.lat, lng: place.lng),
                  ),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: KSpace.sm),
        _HowFar(place: place),
        if (place.hasLocation && place.category != 'shop') ...[
          const SizedBox(height: KSpace.sm),
          FilledButton.tonalIcon(
            onPressed: () {
              ref.read(cityProvider.notifier).set(place.city);
              context.push(Uri(path: '/new-plan', queryParameters: {
                'lat': '${place.lat}',
                'lng': '${place.lng}',
                'label': place.name,
              }).toString());
            },
            icon: const Icon(Icons.auto_awesome),
            label: const Text('Plan an outing around here'),
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
            if (wazeUrl(place) != null)
              OutlinedButton.icon(
                onPressed: () => openUri(wazeUrl(place)!),
                icon: const Icon(Icons.navigation_outlined),
                label: const Text('Waze'),
              ),
            OutlinedButton.icon(
              onPressed: () => openUri(googleSearchUrl(place)),
              icon: const Icon(Icons.travel_explore),
              label: const Text('Reviews & menus on Google'),
            ),
            if (wikidataUrl(place) != null)
              OutlinedButton.icon(
                onPressed: () => openUri(wikidataUrl(place)!),
                icon: const Icon(Icons.menu_book_outlined),
                label: const Text('Wikipedia / Wikidata'),
              ),
            if (whatsappUrl(place.phone) != null)
              OutlinedButton.icon(
                onPressed: () => openUri(whatsappUrl(place.phone)!),
                icon: const Icon(Icons.chat_outlined),
                label: const Text('WhatsApp'),
              ),
            if (streetViewUrl(place) != null)
              OutlinedButton.icon(
                onPressed: () => openUri(streetViewUrl(place)!),
                icon: const Icon(Icons.streetview),
                label: const Text('Street View'),
              ),
            OutlinedButton.icon(
              onPressed: () => _addToList(context, ref, place),
              icon: const Icon(Icons.bookmark_add_outlined),
              label: const Text('Add to a list'),
            ),
            OutlinedButton.icon(
              onPressed: () => _compare(context, ref, place),
              icon: const Icon(Icons.compare_arrows),
              label: const Text('Compare'),
            ),
            OutlinedButton.icon(
              onPressed: () => _addToPlan(context, ref, place),
              icon: const Icon(Icons.playlist_add),
              label: const Text('Add to a plan'),
            ),
            OutlinedButton.icon(
              onPressed: () => _sendToGroup(context, ref, place),
              icon: const Icon(Icons.forum_outlined),
              label: const Text('Send to a group'),
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
          if (place.hours?.weekTable() case final table?)
            _HoursTable(table: table)
          else
            Text(_friendlyHours(place.openingHours!), style: text.bodyMedium),
          const SizedBox(height: KSpace.xs),
          Text('Hours can change. Call ahead if it matters.', style: text.bodySmall),
        ],
        const SizedBox(height: KSpace.md),
        _CheckInCard(place: place),
        _VisitedAndNote(place: place),
        _MyRating(place: place),
        if (place.category == 'mall') _MallDirectory(mall: place),
        if (place.category != 'mall') _PlaceList(
          title: 'Similar places nearby',
          places: similarNearby(place, all),
        ),
        _PlaceList(title: "What's nearby (within 500 m)", places: nearbyPlaces(place, all)),
        _PlaceList(title: 'Other branches', places: otherBranches(place, all)),
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
        GestureDetector(
          onTap: () => _showPhoto(context, place),
          child: PlaceImage(
          url: place.photoUrl,
          emoji: Categories.emoji(place.category),
          height: 220,
          width: double.infinity,
          radius: KRadius.card,
        ),
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

/// Everything inside a mall, grouped by type or by floor, with search.
class _MallDirectory extends ConsumerStatefulWidget {
  const _MallDirectory({required this.mall});

  final Place mall;

  @override
  ConsumerState<_MallDirectory> createState() => _MallDirectoryState();
}

class _MallDirectoryState extends ConsumerState<_MallDirectory> {
  bool _byFloor = false;
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final mall = widget.mall;
    final allVenues = ref.watch(mallVenuesProvider(mall.id)).value ?? const <Place>[];
    final q = _q.trim().toLowerCase();
    final venues = q.isEmpty
        ? allVenues
        : allVenues
            .where((v) =>
                v.name.toLowerCase().contains(q) ||
                (v.kind?.toLowerCase().contains(q) ?? false) ||
                (v.cuisine?.toLowerCase().contains(q) ?? false))
            .toList();
    final text = Theme.of(context).textTheme;
    final Map<String, List<Place>> groups;
    if (_byFloor) {
      groups = byFloor(venues);
    } else {
      final byType = <String, List<Place>>{};
      for (final v in venues) {
        (byType[v.category] ??= []).add(v);
      }
      groups = {
        for (final cat in Categories.all.keys.where(byType.containsKey))
          '${Categories.emoji(cat)} ${Categories.label(cat)}': byType[cat]!
            ..sort((a, b) => (a.details.level ?? '~').compareTo(b.details.level ?? '~')),
      };
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: KSpace.lg),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: allVenues.isEmpty
                ? null
                : () {
                    ref.read(cityProvider.notifier).set(mall.city);
                    context.push('/new-plan?mall=${mall.id}');
                  },
            icon: const Icon(Icons.auto_awesome),
            label: const Text('Plan my day here'),
          ),
        ),
        SectionTitle('Inside this mall (${allVenues.length})'),
        if (allVenues.isEmpty)
          Text(
            "We don't have the places inside this mall on the map yet.",
            style: text.bodyMedium?.copyWith(color: context.k.inkMuted),
          )
        else ...[
          TextField(
            decoration: const InputDecoration(
                hintText: 'Search this mall', prefixIcon: Icon(Icons.search), isDense: true),
            onChanged: (v) => setState(() => _q = v),
          ),
          const SizedBox(height: KSpace.sm),
          SegmentedButton<bool>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: false, label: Text('By type')),
              ButtonSegment(value: true, label: Text('By floor')),
            ],
            selected: {_byFloor},
            onSelectionChanged: (v) => setState(() => _byFloor = v.first),
          ),
        ],
        for (final e in groups.entries) ...[
          Padding(
            padding: const EdgeInsets.only(top: KSpace.sm, bottom: KSpace.xs),
            child: Text('${e.key} (${e.value.length})', style: text.titleMedium),
          ),
          for (final v in e.value)
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
        Expanded(
          child: Text('$text from you (straight line)'
              '${km <= 3 ? ' · about ${walkingMinutes(km)} min walk' : ''}'),
        ),
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

/// The week's opening hours as a table, today in bold.
class _HoursTable extends StatelessWidget {
  const _HoursTable({required this.table});

  final List<(String, String)> table;

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now().weekday - 1;
    return Column(
      children: [
        for (final (i, (day, hours)) in table.indexed)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(
              children: [
                SizedBox(
                  width: 64,
                  child: Text(i == today ? '$day •' : day,
                      style: TextStyle(
                          fontWeight: i == today ? FontWeight.w800 : FontWeight.w500,
                          color: i == today ? context.k.accent : context.k.ink)),
                ),
                Expanded(
                  child: Text(hours,
                      style: TextStyle(
                          fontWeight: i == today ? FontWeight.w700 : FontWeight.w400,
                          color: hours == 'Closed' ? context.k.inkMuted : context.k.ink)),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// Your own star rating, saved on this phone only and shown only to you.
class _MyRating extends ConsumerWidget {
  const _MyRating({required this.place});

  final Place place;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stars = ref.watch(myRatingsProvider)[place.id] ?? 0;
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: KSpace.md, vertical: KSpace.sm),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Your rating', style: TextStyle(fontWeight: FontWeight.w600)),
                  Text('Only you can see it, on this phone',
                      style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
            for (var i = 1; i <= 5; i++)
              IconButton(
                visualDensity: VisualDensity.compact,
                tooltip: '$i star${i == 1 ? '' : 's'}',
                onPressed: () =>
                    ref.read(myRatingsProvider.notifier).set(place.id, stars == i ? null : i),
                icon: Icon(i <= stars ? Icons.star_rounded : Icons.star_outline_rounded,
                    color: i <= stars ? context.k.accent : context.k.inkMuted),
              ),
          ],
        ),
      ),
    );
  }
}

/// Adds this place as the last stop of one of your recent plans.
Future<void> _addToPlan(BuildContext context, WidgetRef ref, Place place) async {
  final uid = ref.read(uidProvider);
  if (uid == null) return;
  final plans = (await ref.read(allPlansProvider.future))
      .where((p) => p.stops.length < 5 && !p.stops.any((s) => s.placeId == place.id))
      .take(15)
      .toList();
  if (!context.mounted) return;
  if (plans.isEmpty) {
    showMessage(context, 'No plan with room for another stop. Make a plan first.');
    return;
  }
  final picked = await showModalBottomSheet<OutingPlan>(
    context: context,
    useSafeArea: true,
    builder: (sheetContext) => ListView(
      shrinkWrap: true,
      padding: const EdgeInsets.all(KSpace.md),
      children: [
        Text('Add to which plan?', style: Theme.of(sheetContext).textTheme.titleLarge),
        const SizedBox(height: KSpace.sm),
        for (final p in plans)
          ListTile(
            leading: const Icon(Icons.map_outlined),
            title: Text(p.title),
            subtitle: Text('${p.stops.length} stops'),
            onTap: () => Navigator.pop(sheetContext, p),
          ),
      ],
    ),
  );
  if (picked == null) return;
  try {
    await ref.read(plansRepositoryProvider).updateStops(uid, picked.id, addStop(picked.stops, place));
    if (context.mounted) showMessage(context, 'Added to "${picked.title}"');
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}

/// Posts this place (name, area, map link) into one of your group chats.
Future<void> _sendToGroup(BuildContext context, WidgetRef ref, Place place) async {
  final uid = ref.read(uidProvider);
  if (uid == null) return;
  final groups = await ref.read(myGroupsProvider.future);
  if (!context.mounted) return;
  if (groups.isEmpty) {
    showMessage(context, "You're not in any group yet.");
    return;
  }
  final picked = await showModalBottomSheet<String>(
    context: context,
    useSafeArea: true,
    builder: (sheetContext) => ListView(
      shrinkWrap: true,
      padding: const EdgeInsets.all(KSpace.md),
      children: [
        Text('Send to which group?', style: Theme.of(sheetContext).textTheme.titleLarge),
        const SizedBox(height: KSpace.sm),
        for (final g in groups)
          ListTile(
            leading: const Icon(Icons.forum_outlined),
            title: Text(g.name),
            onTap: () => Navigator.pop(sheetContext, g.id),
          ),
      ],
    ),
  );
  if (picked == null) return;
  try {
    await ref.read(groupsRepositoryProvider).sendMessage(
          groupId: picked,
          uid: uid,
          name: ref.read(myProfileProvider).value?.displayName ?? 'Someone',
          text: placeChatText(place),
        );
    if (context.mounted) showMessage(context, 'Sent to the group');
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}

/// The photo full screen; pinch to zoom.
void _showPhoto(BuildContext context, Place place) {
  if (place.photoUrl == null) return;
  showDialog<void>(
    context: context,
    builder: (dialogContext) => Dialog.fullscreen(
      backgroundColor: Colors.black,
      child: Stack(
        children: [
          Positioned.fill(
            child: InteractiveViewer(
              maxScale: 5,
              child: Image.network(place.photoUrl!, fit: BoxFit.contain),
            ),
          ),
          SafeArea(
            child: IconButton.filled(
              tooltip: 'Close',
              onPressed: () => Navigator.pop(dialogContext),
              icon: const Icon(Icons.close),
            ),
          ),
        ],
      ),
    ),
  );
}

/// Adds or removes this place from one of your lists.
Future<void> _addToList(BuildContext context, WidgetRef ref, Place place) async {
  await showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    builder: (sheetContext) => Consumer(builder: (context, ref, _) {
      final lists = ref.watch(placeListsProvider);
      return ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.all(KSpace.md),
        children: [
          Text('Add to a list', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: KSpace.sm),
          for (final e in lists.entries)
            CheckboxListTile(
              title: Text(e.key),
              value: e.value.contains(place.id),
              onChanged: (_) => ref.read(placeListsProvider.notifier).toggle(e.key, place.id),
            ),
          ListTile(
            leading: const Icon(Icons.add),
            title: const Text('New list'),
            onTap: () async {
              final name = await newListDialog(context, ref);
              if (name != null) ref.read(placeListsProvider.notifier).toggle(name, place.id);
            },
          ),
        ],
      );
    }),
  );
}

/// Pick another place (recently viewed, favorites, similar) to compare with.
Future<void> _compare(BuildContext context, WidgetRef ref, Place place) async {
  final all = await ref.read(allPlacesProvider.future);
  final byId = {for (final p in all) p.id: p};
  final ids = <String>{
    ...ref.read(recentPlacesProvider),
    ...?ref.read(favoriteIdsProvider).value,
    ...similarNearby(place, all).map((p) => p.id),
  }..remove(place.id);
  final options = [for (final id in ids) ?byId[id]].take(30).toList();
  if (!context.mounted) return;
  if (options.isEmpty) {
    showMessage(context, 'Open another place first, then compare.');
    return;
  }
  final picked = await showModalBottomSheet<Place>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    builder: (sheetContext) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      builder: (_, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.all(KSpace.md),
        children: [
          Text('Compare with…', style: Theme.of(sheetContext).textTheme.titleLarge),
          const SizedBox(height: KSpace.sm),
          for (final p in options)
            ListTile(
              leading: Text(Categories.emoji(p.category), style: const TextStyle(fontSize: 22)),
              title: Text(p.name),
              subtitle: Text(p.area ?? Categories.label(p.category)),
              onTap: () => Navigator.pop(sheetContext, p),
            ),
        ],
      ),
    ),
  );
  if (picked != null && context.mounted) {
    context.push(Uri(path: '/compare', queryParameters: {'a': place.id, 'b': picked.id}).toString());
  }
}

/// "I'm here": tells your friends where you are for 24 hours, and shows
/// which friends checked in here today.
class _CheckInCard extends ConsumerWidget {
  const _CheckInCard({required this.place});

  final Place place;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mine = ref.watch(myCheckInProvider).value;
    final hereNow = mine != null && mine.placeId == place.id && mine.isFresh(DateTime.now());
    final friendsHere = (ref.watch(friendsCheckInsProvider).value ?? const [])
        .where((c) => c.placeId == place.id)
        .toList();
    final friendCount = ref.watch(friendUidsProvider).length;
    return Card(
      child: Column(
        children: [
          ListTile(
            leading: const Text('📍', style: TextStyle(fontSize: 22)),
            title: Text(hereNow ? "You're checked in here" : "I'm here"),
            subtitle: Text(hereNow
                ? 'Your friends can see it for 24 hours'
                : friendCount == 0
                    ? 'Marks it as been there. Add friends to share where you are.'
                    : 'Let your $friendCount friend${friendCount == 1 ? '' : 's'} see where you are (24 hours)'),
            trailing: hereNow
                ? TextButton(
                    onPressed: () async {
                      final uid = ref.read(uidProvider);
                      if (uid == null) return;
                      try {
                        await ref.read(checkInsRepositoryProvider).remove(uid);
                      } catch (e) {
                        if (context.mounted) showError(context, e);
                      }
                    },
                    child: const Text('Remove'),
                  )
                : FilledButton(
                    onPressed: () async {
                      final uid = ref.read(uidProvider);
                      if (uid == null) return;
                      try {
                        await ref.read(checkInsRepositoryProvider).checkIn(
                              uid: uid,
                              name: ref.read(myProfileProvider).value?.displayName ?? 'A friend',
                              place: place,
                              friendUids: ref.read(friendUidsProvider),
                            );
                        await ref.read(personalRepositoryProvider).setVisited(uid, place.id, true);
                        if (context.mounted) showMessage(context, 'Checked in. Have fun!');
                      } catch (e) {
                        if (context.mounted) showError(context, e);
                      }
                    },
                    child: const Text('Check in'),
                  ),
          ),
          if (friendsHere.isNotEmpty) ...[
            const Divider(),
            ListTile(
              leading: const Text('👯', style: TextStyle(fontSize: 22)),
              title: Text('${friendsHere.length} friend${friendsHere.length == 1 ? '' : 's'} here today'),
              subtitle: Text(friendsHere.map((c) => c.name).join(', ')),
            ),
          ],
        ],
      ),
    );
  }
}
