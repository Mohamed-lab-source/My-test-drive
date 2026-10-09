import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/extras.dart';
import '../../app/helpers.dart';
import '../../app/share_texts.dart';
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
import '../../widgets/share_card.dart';
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
            PopupMenuButton<String>(
              tooltip: tr('Share'),
              icon: const Icon(Icons.share_outlined),
              onSelected: (v) => v == 'picture'
                  ? sharePictureCard(context, _placeStoryCard(loaded), placeShareText(loaded))
                  : SharePlus.instance.share(ShareParams(text: placeShareText(loaded))),
              itemBuilder: (_) => [
                PopupMenuItem(value: 'picture', child: Text(tr('Share as a picture'))),
                PopupMenuItem(value: 'text', child: Text(tr('Share as text'))),
              ],
            ),
          IconButton(
            tooltip: favorite ? tr('Remove from favorites') : tr('Add to favorites'),
            icon: Icon(favorite ? Icons.favorite : Icons.favorite_border,
                color: favorite ? context.k.accent : null),
            onPressed: () async {
              final uid = ref.read(uidProvider);
              if (uid == null) return;
              tapFeedback(ref.read(phoneSettingsProvider).haptics);
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
            ? EmptyState(emoji: '🤷', title: tr('Place not found'))
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
        GestureDetector(
          onLongPress: () {
            Clipboard.setData(ClipboardData(text: place.name));
            showMessage(context, tr('Name copied'));
          },
          child: Text(place.shownName, style: text.headlineMedium),
        ),
        if (todaysHours(place, DateTime.now()) case final today?)
          Text(trf('Today: {hours}', {'hours': tr(today)}), style: text.bodyMedium?.copyWith(color: context.k.inkMuted)),
        if (place.otherName != null)
          Text(place.otherName!, style: text.titleMedium?.copyWith(color: context.k.inkMuted)),
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
              title: Text(trf('Inside {name}', {'name': mall.name})),
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
          _PlaceMap(place: place),
        ],
        const SizedBox(height: KSpace.sm),
        _HowFar(place: place),
        _DayNote(place: place),
        if (place.area != null)
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton.icon(
              icon: const Icon(Icons.holiday_village_outlined, size: 18),
              label: Text(trf('More in {area}', {'area': place.area!})),
              onPressed: () =>
                  context.push('/area/${place.city}/${Uri.encodeComponent(place.area!)}'),
            ),
          ),
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
            label: Text(tr('Plan an outing around here')),
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
                label: Text(tr('Directions')),
              ),
            if (place.hasLocation)
              OutlinedButton.icon(
                onPressed: () => openDirections(lat: place.lat!, lng: place.lng!, mode: 'walking'),
                icon: const Icon(Icons.directions_walk),
                label: Text(tr('Walk')),
              ),
            if (place.hasLocation)
              OutlinedButton.icon(
                onPressed: () => openUber(name: place.name, lat: place.lat!, lng: place.lng!),
                icon: const Icon(Icons.local_taxi_outlined),
                label: Text(tr('Uber')),
              ),
            if (place.phone != null)
              OutlinedButton.icon(
                onPressed: () => callPhone(place.phone!),
                icon: const Icon(Icons.call_outlined),
                label: Text(tr('Call')),
              ),
            if (place.website != null)
              OutlinedButton.icon(
                onPressed: () => openWebsite(place.website!),
                icon: const Icon(Icons.language),
                label: Text(websiteDomain(place.website) ?? 'Website'),
              ),
            if (wazeUrl(place) != null)
              OutlinedButton.icon(
                onPressed: () => openUri(wazeUrl(place)!),
                icon: const Icon(Icons.navigation_outlined),
                label: Text(tr('Waze')),
              ),
            OutlinedButton.icon(
              onPressed: () => openUri(googleSearchUrl(place)),
              icon: const Icon(Icons.travel_explore),
              label: Text(tr('Reviews & menus on Google')),
            ),
            if (wikidataUrl(place) != null)
              OutlinedButton.icon(
                onPressed: () => openUri(wikidataUrl(place)!),
                icon: const Icon(Icons.menu_book_outlined),
                label: Text(tr('Wikipedia / Wikidata')),
              ),
            if (whatsappUrl(place.phone) != null)
              OutlinedButton.icon(
                onPressed: () => openUri(whatsappUrl(place.phone)!),
                icon: const Icon(Icons.chat_outlined),
                label: Text(tr('WhatsApp')),
              ),
            if (transitUrl(place) != null)
              OutlinedButton.icon(
                onPressed: () => openUri(transitUrl(place)!),
                icon: const Icon(Icons.directions_bus_outlined),
                label: Text(tr('Transit')),
              ),
            if (place.hasLocation)
              OutlinedButton.icon(
                onPressed: () {
                  Clipboard.setData(ClipboardData(
                      text: Uri.https('www.google.com', '/maps/search/',
                          {'api': '1', 'query': '${place.lat},${place.lng}'}).toString()));
                  showMessage(context, tr('Map link copied'));
                },
                icon: const Icon(Icons.link),
                label: Text(tr('Copy map link')),
              ),
            if (streetViewUrl(place) != null)
              OutlinedButton.icon(
                onPressed: () => openUri(streetViewUrl(place)!),
                icon: const Icon(Icons.streetview),
                label: Text(tr('Street View')),
              ),
            OutlinedButton.icon(
              onPressed: () => _addToList(context, ref, place),
              icon: const Icon(Icons.bookmark_add_outlined),
              label: Text(tr('Add to a list')),
            ),
            OutlinedButton.icon(
              onPressed: () => _compare(context, ref, place),
              icon: const Icon(Icons.compare_arrows),
              label: Text(tr('Compare')),
            ),
            OutlinedButton.icon(
              onPressed: () => _addToPlan(context, ref, place),
              icon: const Icon(Icons.playlist_add),
              label: Text(tr('Add to a plan')),
            ),
            OutlinedButton.icon(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: placeInfoText(place)));
                showMessage(context, tr('All info copied'));
              },
              icon: const Icon(Icons.content_copy),
              label: Text(tr('Copy all info')),
            ),
            if (geoUrl(place) != null)
              OutlinedButton.icon(
                onPressed: () => openUri(geoUrl(place)!),
                icon: const Icon(Icons.map_outlined),
                label: Text(tr('Other map app')),
              ),
            OutlinedButton.icon(
              onPressed: () async {
                final now = DateTime.now();
                final day = await showDatePicker(
                    context: context,
                    initialDate: now,
                    firstDate: DateTime(now.year, now.month, now.day),
                    lastDate: now.add(const Duration(days: 365)));
                if (day == null || !context.mounted) return;
                final t = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 19, minute: 0));
                if (t == null) return;
                await openUri(visitCalendarUrl(place, DateTime(day.year, day.month, day.day, t.hour, t.minute)));
              },
              icon: const Icon(Icons.event_available),
              label: Text(tr('Add a visit to my calendar')),
            ),
            OutlinedButton.icon(
              onPressed: () => _sendToGroup(context, ref, place),
              icon: const Icon(Icons.forum_outlined),
              label: Text(tr('Send to a group')),
            ),
          ],
        ),
        if (facts.labels.isNotEmpty) ...[
          SectionTitle(tr('Good to know')),
          Wrap(
            spacing: KSpace.sm,
            runSpacing: KSpace.sm,
            children: [for (final l in facts.labels) Pill(l)],
          ),
        ],
        if (place.hours?.minutesUntilClose(DateTime.now()) case final m? when m <= 60) ...[
          const SizedBox(height: KSpace.sm),
          Pill(trf('⚠️ Closes in {n} min', {'n': m}),
              color: Theme.of(context).colorScheme.errorContainer,
              textColor: Theme.of(context).colorScheme.onErrorContainer),
        ],
        if (categoryTip(place.category) case final tip?) ...[
          const SizedBox(height: KSpace.md),
          Text('💡 $tip', style: text.bodyMedium?.copyWith(color: context.k.inkMuted)),
        ],
        if (place.openingHours != null) ...[
          SectionTitle(tr('Opening hours')),
          if (place.hours?.weekTable() case final table?)
            _HoursTable(table: table)
          else
            Text(_friendlyHours(place.openingHours!), style: text.bodyMedium),
          const SizedBox(height: KSpace.xs),
          Text(tr('Hours can change. Call ahead if it matters.'), style: text.bodySmall),
        ],
        const SizedBox(height: KSpace.md),
        _CheckInCard(place: place),
        _VisitedAndNote(place: place),
        _MyRating(place: place),
        if (place.category == 'mall') _MallDirectory(mall: place),
        if (place.category != 'mall') _PlaceList(
          title: tr('Similar places nearby'),
          places: similarNearby(place, all),
          from: place,
        ),
        _PlaceList(
            title: tr("What's nearby (within 500 m)"),
            places: nearbyPlaces(place, all, limit: 20),
            from: place,
            filters: true),
        _PlaceList(title: tr('Other branches'), places: otherBranches(place, all), from: place),
        const SizedBox(height: KSpace.lg),
        if (osmNoteUrl(place) != null)
          TextButton.icon(
            onPressed: () => openUri(osmNoteUrl(place)!),
            icon: const Icon(Icons.flag_outlined),
            label: Text(tr('Closed or wrong? Tell OpenStreetMap')),
          ),
        if (place.osmUrl != null)
          TextButton(
            onPressed: () => openWebsite(place.osmUrl!),
            child: Text(tr('Something wrong or missing? Fix it on OpenStreetMap')),
          ),
        Text(
          buildDate.isEmpty
              ? tr('Map facts are refreshed weekly from OpenStreetMap and Overture Maps.')
              : trf('Map facts from {date}, refreshed weekly.', {'date': buildDate}),
          textAlign: TextAlign.center,
          style: text.bodySmall,
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
            child: Text(tr('Photo: Wikimedia Commons (tap for credit)'),
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
  bool _openOnly = false;
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final mall = widget.mall;
    final allVenues = ref.watch(mallVenuesProvider(mall.id)).value ?? const <Place>[];
    final q = _q.trim().toLowerCase();
    final now = DateTime.now();
    final venues = (q.isEmpty
        ? allVenues
        : allVenues
            .where((v) =>
                v.name.toLowerCase().contains(q) ||
                (v.kind?.toLowerCase().contains(q) ?? false) ||
                (v.cuisine?.toLowerCase().contains(q) ?? false))
            .toList())
        .where((v) => !_openOnly || v.isOpenAt(now) == true)
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
            label: Text(tr('Plan my day here')),
          ),
        ),
        SectionTitle(trf('Inside this mall ({n})', {'n': allVenues.length})),
        if (allVenues.isEmpty)
          Text(
            tr("We don't have the places inside this mall on the map yet."),
            style: text.bodyMedium?.copyWith(color: context.k.inkMuted),
          )
        else ...[
          TextField(
            decoration: InputDecoration(
                hintText: tr('Search this mall'), prefixIcon: Icon(Icons.search), isDense: true),
            onChanged: (v) => setState(() => _q = v),
          ),
          const SizedBox(height: KSpace.sm),
          FilterChip(
            avatar: const Icon(Icons.schedule, size: 18),
            label: Text(tr('Open now')),
            selected: _openOnly,
            showCheckmark: false,
            onSelected: (v) => setState(() => _openOnly = v),
          ),
          const SizedBox(height: KSpace.sm),
          SegmentedButton<bool>(
            showSelectedIcon: false,
            segments: [
              ButtonSegment(value: false, label: Text(tr('By type'))),
              ButtonSegment(value: true, label: Text(tr('By floor'))),
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
    tr('Found on Khroga') + placeLinkLine(p.id),
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
        showMessage(context, trf('{what} copied', {'what': tr(what)}));
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 20, color: context.k.inkMuted),
            const SizedBox(width: KSpace.sm),
            Expanded(
              child: Text(text,
                  // Phone numbers and coordinates read left-to-right even in Arabic.
                  textDirection: RegExp(r'^[+\d\s().,-]+$').hasMatch(text) ? TextDirection.ltr : null),
            ),
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
          label: Text(tr('How far is it from me?')),
        ),
      );
    }
    final km = haversineKm(me.$1, me.$2, p.lat!, p.lng!);
    final text = '${distanceText(km)} ${compassDirection(me.$1, me.$2, p.lat!, p.lng!)}';
    return Row(
      children: [
        Icon(Icons.near_me_outlined, size: 20, color: context.k.inkMuted),
        const SizedBox(width: KSpace.sm),
        Expanded(
          child: Text(trf('{d} of you (straight line)', {'d': text}) +
              (km <= 3 ? trf(' · about {n} min walk', {'n': walkingMinutes(km)}) : '')),
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
        title: Text(tr('Your private note')),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 4,
          maxLength: 500,
          decoration: InputDecoration(hintText: tr('e.g. Ask for the terrace table')),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: Text(tr('Cancel'))),
          FilledButton(
              onPressed: () => Navigator.pop(dialogContext, controller.text),
              child: Text(tr('Save'))),
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
            title: Text(tr("I've been here")),
            subtitle: Text(tr('Keeps a list of places you visited')),
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
            title: Text(note == null ? tr('Add a private note') : tr('Your note')),
            subtitle: note == null ? Text(tr('Only you can see it')) : Text(note),
            trailing: const Icon(Icons.edit_outlined),
            onTap: () => _editNote(context, ref, note),
          ),
        ],
      ),
    );
  }
}

/// A titled list of places (nearby, similar).
class _PlaceList extends StatefulWidget {
  const _PlaceList({required this.title, required this.places, this.from, this.filters = false});

  final String title;
  final List<Place> places;

  /// Distances on the tiles are measured from this place.
  final Place? from;

  /// Show category chips to narrow the list.
  final bool filters;

  @override
  State<_PlaceList> createState() => _PlaceListState();
}

class _PlaceListState extends State<_PlaceList> {
  String? _cat;
  bool _all = false;

  @override
  Widget build(BuildContext context) {
    if (widget.places.isEmpty) return const SizedBox.shrink();
    final cats = widget.places.map((p) => p.category).toSet().toList();
    final list = widget.places.where((p) => _cat == null || p.category == _cat).toList();
    final shown = _all ? list : list.take(8).toList();
    final f = widget.from;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(widget.title),
        if (widget.filters && cats.length > 1)
          Wrap(
            spacing: KSpace.xs,
            runSpacing: KSpace.xs,
            children: [
              ChoiceChip(
                label: Text(tr('All')),
                selected: _cat == null,
                showCheckmark: false,
                onSelected: (_) => setState(() => _cat = null),
              ),
              for (final c in cats)
                ChoiceChip(
                  label: Text('${Categories.emoji(c)} ${Categories.label(c)}'),
                  selected: _cat == c,
                  showCheckmark: false,
                  onSelected: (_) => setState(() => _cat = c),
                ),
            ],
          ),
        if (widget.filters && cats.length > 1) const SizedBox(height: KSpace.sm),
        for (final p in shown)
          Padding(
            padding: const EdgeInsets.only(bottom: KSpace.sm),
            child: PlaceTile(place: p, from: f != null && f.hasLocation ? (f.lat!, f.lng!) : null),
          ),
        if (!_all && list.length > 8)
          TextButton(onPressed: () => setState(() => _all = true), child: Text(trf('Show all {n}', {'n': list.length}))),
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
                          color: hours == tr('Closed') ? context.k.inkMuted : context.k.ink)),
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
                  Text(tr('Your rating'), style: TextStyle(fontWeight: FontWeight.w600)),
                  Text(tr('Only you can see it, on this phone'),
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
  final plans = (await ref.read(recentPlansProvider.future))
      .where((p) => p.stops.length < 5 && !p.stops.any((s) => s.placeId == place.id))
      .take(15)
      .toList();
  if (!context.mounted) return;
  if (plans.isEmpty) {
    showMessage(context, tr('No plan with room for another stop. Make a plan first.'));
    return;
  }
  final picked = await showModalBottomSheet<OutingPlan>(
    context: context,
    useSafeArea: true,
    builder: (sheetContext) => ListView(
      shrinkWrap: true,
      padding: const EdgeInsets.all(KSpace.md),
      children: [
        Text(tr('Add to which plan?'), style: Theme.of(sheetContext).textTheme.titleLarge),
        const SizedBox(height: KSpace.sm),
        for (final p in plans)
          ListTile(
            leading: const Icon(Icons.map_outlined),
            title: Text(p.title),
            subtitle: Text(trf('{n} stops', {'n': p.stops.length})),
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
    showMessage(context, tr("You're not in any group yet."));
    return;
  }
  final picked = await showModalBottomSheet<String>(
    context: context,
    useSafeArea: true,
    builder: (sheetContext) => ListView(
      shrinkWrap: true,
      padding: const EdgeInsets.all(KSpace.md),
      children: [
        Text(tr('Send to which group?'), style: Theme.of(sheetContext).textTheme.titleLarge),
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
          text: placeChatText(place) + placeLinkLine(place.id),
        );
    if (context.mounted) showMessage(context, tr('Sent to the group'));
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
              tooltip: tr('Close'),
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
          Text(tr('Add to a list'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: KSpace.sm),
          for (final e in lists.entries)
            CheckboxListTile(
              title: Text(e.key),
              value: e.value.contains(place.id),
              onChanged: (_) => ref.read(placeListsProvider.notifier).toggle(e.key, place.id),
            ),
          ListTile(
            leading: const Icon(Icons.add),
            title: Text(tr('New list')),
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
    showMessage(context, tr('Open another place first, then compare.'));
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
          Text(tr('Compare with…'), style: Theme.of(sheetContext).textTheme.titleLarge),
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
                ? tr('Your friends can see it for 24 hours')
                : friendCount == 0
                    ? tr('Marks it as been there. Add friends to share where you are.')
                    : trf('Let your {n} friends see where you are (24 hours)', {'n': friendCount})),
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
                    child: Text(tr('Remove')),
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
                        tapFeedback(ref.read(phoneSettingsProvider).haptics);
                        if (context.mounted) showMessage(context, tr('Checked in. Have fun!'));
                      } catch (e) {
                        if (context.mounted) showError(context, e);
                      }
                    },
                    child: Text(tr('Check in')),
                  ),
          ),
          if (friendsHere.isNotEmpty) ...[
            const Divider(),
            ListTile(
              leading: const Text('👯', style: TextStyle(fontSize: 22)),
              title: Text(trf('{n} friends here today', {'n': friendsHere.length})),
              subtitle: Text(friendsHere.map((c) => c.name).join(', ')),
            ),
          ],
        ],
      ),
    );
  }
}

/// The small map on a place page, loaded only when asked for (saves mobile
/// data and the free map allowance).
class _PlaceMap extends StatefulWidget {
  const _PlaceMap({required this.place});

  final Place place;

  @override
  State<_PlaceMap> createState() => _PlaceMapState();
}

class _PlaceMapState extends State<_PlaceMap> {
  bool _show = false;

  @override
  Widget build(BuildContext context) {
    final place = widget.place;
    if (!_show) {
      return OutlinedButton.icon(
        onPressed: () => setState(() => _show = true),
        icon: const Icon(Icons.map_outlined),
        label: Text(tr('Show on map')),
      );
    }
    return ClipRRect(
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
    );
  }
}

/// Today's sunset (for outdoor places) and a fixed public holiday, if any.
/// Both are worked out from the date and the place's real coordinates.
class _DayNote extends StatelessWidget {
  const _DayNote({required this.place});

  final Place place;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final holiday = egyptHoliday(now);
    final outdoor = place.category == 'park' || place.category == 'sight' || place.details.outdoorSeating == true;
    final sun = outdoor && place.hasLocation ? sunTimes(now, place.lat!, place.lng!) : null;
    final lines = [
      if (sun != null && sun.sunset.isAfter(now))
        trf('🌇 Sunset here today at {time}', {'time': hhmmLocal(sun.sunset)}),
      if (holiday != null) trf('🇪🇬 Today is {name}: hours may differ.', {'name': holiday}),
    ];
    if (lines.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: KSpace.xs),
      child: Text(lines.join('\n'),
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: context.k.inkMuted)),
    );
  }
}

/// A place as a story-size picture card (map facts only).
Widget _placeStoryCard(Place p) {
  final today = todaysHours(p, DateTime.now());
  return StoryCard(
    emoji: Categories.emoji(p.category),
    title: p.shownName,
    subtitle: [p.kindLabel ?? Categories.label(p.category), ?p.area].join(' · '),
    lines: [
      if (today != null) ('🕒', trf('Today: {hours}', {'hours': tr(today)}), null),
      if (p.cuisineLabel != null) ('🍽️', p.cuisineLabel!, null),
      for (final l in p.details.labels.take(3)) (l.characters.first, l.characters.skip(1).toString().trim(), null),
      if (p.address != null) ('📍', p.address!, null),
    ],
  );
}
