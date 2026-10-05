import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/helpers.dart';
import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/plan.dart';
import '../../planner/planner.dart' show compactRadiusKm;
import '../../widgets/common.dart';
import '../profile/about_screen.dart' show appVersion;
import '../profile/theme_sheet.dart';

/// The home tab: describe your outing, get a real plan.
class PlanFormScreen extends ConsumerStatefulWidget {
  const PlanFormScreen({super.key, this.initialMallId, this.anchor});

  /// Set when opened from a place's "Plan an outing around here".
  final (double, double, String)? anchor;

  /// Set when opened from a mall's "Plan my day here".
  final String? initialMallId;

  @override
  ConsumerState<PlanFormScreen> createState() => _PlanFormScreenState();
}

class _PlanFormScreenState extends ConsumerState<PlanFormScreen> {
  int _people = 2;
  final Set<String> _vibes = {'chill'};
  String _time = 'evening';
  DateTime? _date; // null = today
  int _stops = 3;
  String? _mallId;
  bool _skipVisited = false;
  bool _preferFavorites = true;
  bool _onlyOpen = true;
  (double, double, String)? _anchor;
  double _radius = PlanRequest.defaultRadiusKm;
  bool _locating = false;

  Future<void> _pickArea(String city) async {
    final areas = await ref.read(areaCentersProvider(city).future);
    if (!mounted) return;
    if (areas.isEmpty) {
      showMessage(context, tr("We don't have areas for this city yet."));
      return;
    }
    final picked = await showModalBottomSheet<({String name, double lat, double lng, int count})>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      builder: (_) => _AreaPicker(areas: areas),
    );
    if (picked != null) setState(() => _anchor = (picked.lat, picked.lng, picked.name));
  }

  Future<void> _useMyLocation(bool on) async {
    if (!on) {
      setState(() => _anchor = null);
      return;
    }
    setState(() => _locating = true);
    try {
      final here = await ref.read(locationServiceProvider).current();
      ref.read(myLocationProvider.notifier).set(here);
      if (mounted) setState(() => _anchor = (here.$1, here.$2, 'you'));
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }
  final _budget = TextEditingController();
  final _notes = TextEditingController();

  @override
  void initState() {
    super.initState();
    _mallId = widget.initialMallId;
    _anchor = widget.anchor;
    // Remember the last choices (saved on the phone).
    final last = ref.read(lastPlanChoicesProvider);
    _people = int.tryParse(last['people'] ?? '') ?? _people;
    _stops = int.tryParse(last['stops'] ?? '') ?? _stops;
    final vibes = (last['vibes'] ?? '').split(',').where(Vibes.all.containsKey).toList();
    if (vibes.isNotEmpty) {
      _vibes
        ..clear()
        ..addAll(vibes);
    }
    final hour = DateTime.now().hour;
    _time = hour < 11
        ? 'morning'
        : hour < 16
            ? 'afternoon'
            : hour < 21
                ? 'evening'
                : 'night';
  }

  @override
  void dispose() {
    _budget.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _reset() {
    _budget.clear();
    _notes.clear();
    setState(() {
      _people = 2;
      _vibes
        ..clear()
        ..add('chill');
      _stops = 3;
      _date = null;
      _mallId = null;
      _anchor = null;
      _radius = PlanRequest.defaultRadiusKm;
    });
  }

  /// Random vibe, then plan straight away.
  Future<void> _surprisePlan() async {
    final keys = Vibes.all.keys.toList()..shuffle();
    setState(() {
      _vibes
        ..clear()
        ..addAll(keys.take(2));
    });
    await _generate();
  }

  Future<void> _generate() async {
    final last = ref.read(lastPlanChoicesProvider.notifier);
    last.set('people', '$_people');
    last.set('stops', '$_stops');
    last.set('vibes', _vibes.join(','));
    final request = PlanRequest(
      city: ref.read(cityProvider),
      groupSize: _people,
      vibes: _vibes.toList(),
      timeOfDay: _time,
      budgetPerPerson: int.tryParse(_budget.text.trim()),
      stops: _stops,
      mallId: _mallId,
      notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      date: _date == null ? null : DateFormat('yyyy-MM-dd').format(_date!),
      excludePlaceIds: _skipVisited
          ? (ref.read(visitedIdsProvider).value ?? const <String>[]).take(100).toList()
          : const [],
      preferPlaceIds: _preferFavorites
          ? (ref.read(favoriteIdsProvider).value ?? const <String>[]).take(50).toList()
          : const [],
      onlyOpen: _onlyOpen,
      nearLat: _mallId == null ? _anchor?.$1 : null,
      nearLng: _mallId == null ? _anchor?.$2 : null,
      nearLabel: _mallId == null ? _anchor?.$3 : null,
      radiusKm: _radius,
    );
    final id = await runPlanGeneration(context, ref, request);
    if (id != null && mounted) context.push('/plan/$id');
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final city = ref.watch(cityProvider);
    final malls = ref.watch(mallsProvider(city)).value ?? const [];
    final mallStillValid = malls.any((m) => m.id == _mallId);

    return Scaffold(
      appBar: AppBar(
        title: Text(tr('Khroga')),
        actions: [
          IconButton(
            tooltip: tr('Look & colors'),
            icon: const Icon(Icons.palette_outlined),
            onPressed: () => showThemeSheet(context),
          ),
          IconButton(
            tooltip: tr('Saved plans & places'),
            icon: const Icon(Icons.bookmark_outline),
            onPressed: () => context.push('/saved'),
          ),
          IconButton(
            tooltip: tr('Profile'),
            icon: const Icon(Icons.person_outline),
            onPressed: () => context.push('/profile'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, 120),
        children: [
          Text(greeting(DateTime.now().hour, ref.watch(myProfileProvider).value?.displayName),
              style: text.titleMedium?.copyWith(color: context.k.accent)),
          Text(tr("Where are we going?"), style: text.headlineMedium),
          const SizedBox(height: KSpace.xs),
          Text(tr('Tell us the vibe. We only suggest real places.'),
              style: text.bodyMedium?.copyWith(color: context.k.inkMuted)),
          const _WhatsNewCard(),
          const _NextOutingCard(),
          const _RecentPlans(),
          SectionTitle(tr('Quick start'),
              trailing: TextButton(onPressed: _reset, child: Text(tr('Reset')))),
          Wrap(
            spacing: KSpace.sm,
            runSpacing: KSpace.sm,
            children: [
              ActionChip(
                avatar: const Text('🎲'),
                label: Text(tr('Surprise plan')),
                onPressed: _surprisePlan,
              ),
              for (final preset in _presets)
                ActionChip(
                  label: Text(tr(preset.label)),
                  onPressed: () => setState(() {
                    _people = preset.people;
                    _vibes
                      ..clear()
                      ..addAll(preset.vibes);
                    _time = preset.time;
                    _stops = preset.stops;
                    showMessage(context, trf('{preset} picked. Change anything, then tap Plan.', {'preset': tr(preset.label)}));
                  }),
                ),
            ],
          ),
          SectionTitle(tr('When?')),
          Wrap(
            spacing: KSpace.sm,
            runSpacing: KSpace.sm,
            children: [
              ChoiceChip(
                label: Text(tr('Today')),
                selected: _date == null,
                showCheckmark: false,
                onSelected: (_) => setState(() => _date = null),
              ),
              ChoiceChip(
                label: Text(tr('Tomorrow')),
                selected: _isTomorrow(_date),
                showCheckmark: false,
                onSelected: (_) => setState(() {
                  final now = DateTime.now();
                  _date = DateTime(now.year, now.month, now.day + 1);
                }),
              ),
              ChoiceChip(
                label: Text(tr('Friday')),
                selected: _date != null && _date!.weekday == DateTime.friday && !_isTomorrow(_date),
                showCheckmark: false,
                onSelected: (_) => setState(() {
                  final now = DateTime.now();
                  final fri = nextWeekday(now, DateTime.friday);
                  _date = sameDay(fri, now) ? null : fri;
                }),
              ),
              ActionChip(
                avatar: const Icon(Icons.event_outlined, size: 18),
                label: Text(_date == null || _isTomorrow(_date)
                    ? tr('Pick a day')
                    : DateFormat('EEE d MMM').format(_date!)),
                onPressed: () async {
                  final now = DateTime.now();
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _date ?? now,
                    firstDate: DateTime(now.year, now.month, now.day),
                    lastDate: now.add(const Duration(days: 60)),
                  );
                  if (picked != null) setState(() => _date = picked);
                },
              ),
            ],
          ),
          SectionTitle(tr('City')),
          SegmentedButton<String>(
            showSelectedIcon: false,
            segments: [
              for (final e in Cities.all.entries)
                ButtonSegment(value: e.key, label: Text(tr(e.value))),
            ],
            selected: {city},
            onSelectionChanged: (s) {
              ref.read(cityProvider.notifier).set(s.first);
              setState(() {
                _mallId = null;
                if (_anchor?.$3 != 'you') _anchor = null;
              });
            },
          ),
          SectionTitle(trf('Where in {city}?', {'city': tr(Cities.all[city] ?? city)})),
          Wrap(
            spacing: KSpace.sm,
            runSpacing: KSpace.sm,
            children: [
              ChoiceChip(
                label: Text(tr('Anywhere')),
                selected: _anchor == null,
                showCheckmark: false,
                onSelected: (_) => setState(() => _anchor = null),
              ),
              ChoiceChip(
                avatar: _locating
                    ? const SizedBox(
                        width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.near_me_outlined, size: 18),
                label: Text(tr('Near me')),
                selected: _anchor?.$3 == 'you',
                showCheckmark: false,
                onSelected: _locating ? null : (on) => _useMyLocation(on),
              ),
              ChoiceChip(
                avatar: const Icon(Icons.location_city, size: 18),
                label: Text(_anchor != null && _anchor!.$3 != 'you' ? _anchor!.$3 : tr('Pick an area')),
                selected: _anchor != null && _anchor!.$3 != 'you',
                showCheckmark: false,
                onSelected: (_) => _pickArea(city),
              ),
            ],
          ),
          const SizedBox(height: KSpace.sm),
          if (_anchor == null)
            Text(
                trf('Stops will still be close to each other (within about {n} km).',
                    {'n': compactRadiusKm.round()}),
                style: text.bodySmall)
          else ...[
            Text(tr('How far are you willing to go?'), style: text.bodySmall),
            const SizedBox(height: KSpace.xs),
            Wrap(
              spacing: KSpace.sm,
              children: [
                for (final r in const [1.0, 2.0, 3.0, 5.0, 8.0])
                  ChoiceChip(
                    label: Text(trf('{n} km', {'n': r.round()})),
                    selected: _radius == r,
                    showCheckmark: false,
                    onSelected: (_) => setState(() => _radius = r),
                  ),
              ],
            ),
          ],
          SectionTitle(tr('How many people?')),
          _Stepper(
            value: _people,
            min: 1,
            max: 20,
            onChanged: (v) => setState(() => _people = v),
          ),
          SectionTitle(tr('Vibe')),
          Wrap(
            spacing: KSpace.sm,
            runSpacing: KSpace.sm,
            children: [
              for (final e in Vibes.all.entries)
                FilterChip(
                  label: Text(tr(e.value)),
                  selected: _vibes.contains(e.key),
                  showCheckmark: false,
                  onSelected: (on) => setState(() {
                    on ? _vibes.add(e.key) : _vibes.remove(e.key);
                  }),
                ),
            ],
          ),
          SectionTitle(tr('Time of day')),
          Wrap(
            spacing: KSpace.sm,
            runSpacing: KSpace.sm,
            children: [
              for (final e in TimesOfDay.all.entries)
                ChoiceChip(
                  label: Text(tr(e.value)),
                  selected: _time == e.key,
                  showCheckmark: false,
                  onSelected: (_) => setState(() => _time = e.key),
                ),
            ],
          ),
          SectionTitle(tr('Budget per person (optional)')),
          TextField(
            controller: _budget,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: InputDecoration(
              hintText: tr('e.g. 500'),
              suffixText: 'EGP',
            ),
          ),
          SectionTitle(tr('Number of stops')),
          _Stepper(
            value: _stops,
            min: 1,
            max: 5,
            onChanged: (v) => setState(() => _stops = v),
          ),
          if (malls.isNotEmpty) ...[
            SectionTitle(tr('Stay inside one mall? (optional)')),
            DropdownButtonFormField<String?>(
              initialValue: mallStillValid ? _mallId : null,
              isExpanded: true,
              items: [
                DropdownMenuItem(value: null, child: Text(tr('No, anywhere'))),
                for (final m in malls)
                  DropdownMenuItem(value: m.id, child: Text(m.name)),
              ],
              onChanged: (v) => setState(() => _mallId = v),
            ),
          ],
          SectionTitle(tr('Choices')),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(tr('Only places open at that time')),
            subtitle: Text(tr('Uses real opening hours when the map has them')),
            value: _onlyOpen,
            onChanged: (v) => setState(() => _onlyOpen = v),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(tr('Prefer my favorite places')),
            value: _preferFavorites,
            onChanged: (v) => setState(() => _preferFavorites = v),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(tr("Skip places I've been")),
            subtitle: Text(tr('Discover somewhere new')),
            value: _skipVisited,
            onChanged: (v) => setState(() => _skipVisited = v),
          ),
          SectionTitle(tr('Anything else? (optional)')),
          TextField(
            controller: _notes,
            maxLines: 2,
            maxLength: 200,
            decoration: InputDecoration(
              hintText: tr('e.g. no seafood, someone uses a wheelchair, birthday…'),
            ),
          ),
          const SizedBox(height: KSpace.md),
          Text('💡 ${tipOfTheDay(DateTime.now())}',
              style: text.bodySmall?.copyWith(color: context.k.inkMuted)),
        ],
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: Padding(
        padding: const EdgeInsets.symmetric(horizontal: KSpace.md),
        child: SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: _vibes.isEmpty ? null : _generate,
            icon: const Icon(Icons.auto_awesome),
            label: Text(_vibes.isEmpty ? tr('Pick at least one vibe') : tr('Plan my outing')),
          ),
        ),
      ),
    );
  }
}

/// Shows a friendly loading dialog while the server builds the plan.
/// Returns the new plan id, or null if it failed (an error is shown).
Future<String?> runPlanGeneration(
    BuildContext context, WidgetRef ref, PlanRequest request) async {
  final navigator = Navigator.of(context, rootNavigator: true);
  final messenger = ScaffoldMessenger.of(context);
  showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => const PopScope(canPop: false, child: _GeneratingDialog()),
  );
  try {
    final uid = ref.read(uidProvider);
    if (uid == null) throw Exception(tr('Please sign in again.'));
    return await ref.read(plansRepositoryProvider).generate(uid, request);
  } catch (e) {
    messenger.showSnackBar(SnackBar(content: Text(friendlyError(e))));
    return null;
  } finally {
    navigator.pop();
  }
}

class _GeneratingDialog extends StatelessWidget {
  const _GeneratingDialog();

  @override
  Widget build(BuildContext context) {
    return Dialog(
      child: Padding(
        padding: EdgeInsets.all(KSpace.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: KSpace.md),
            Text(tr('Building your plan…'),
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            SizedBox(height: KSpace.xs),
            Text(tr('Picking real places and checking the weather'),
                textAlign: TextAlign.center,
                style: TextStyle(color: context.k.inkMuted)),
          ],
        ),
      ),
    );
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({
    required this.value,
    required this.min,
    required this.max,
    required this.onChanged,
  });

  final int value;
  final int min;
  final int max;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton.outlined(
          onPressed: value > min ? () => onChanged(value - 1) : null,
          icon: const Icon(Icons.remove),
        ),
        SizedBox(
          width: 56,
          child: Text('$value',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge),
        ),
        IconButton.outlined(
          onPressed: value < max ? () => onChanged(value + 1) : null,
          icon: const Icon(Icons.add),
        ),
      ],
    );
  }
}

bool _isTomorrow(DateTime? d) {
  if (d == null) return false;
  final t = DateTime.now().add(const Duration(days: 1));
  return d.year == t.year && d.month == t.month && d.day == t.day;
}

class _Preset {
  const _Preset(this.label, this.people, this.vibes, this.time, this.stops);
  final String label;
  final int people;
  final List<String> vibes;
  final String time;
  final int stops;
}

const _presets = [
  _Preset('💕 Date night', 2, ['romantic', 'foodie'], 'evening', 2),
  _Preset('👨‍👩‍👧 Family day', 4, ['family'], 'afternoon', 3),
  _Preset('👯 Friends hangout', 5, ['active', 'chill'], 'evening', 3),
  _Preset('🌧️ Rainy / hot day', 3, ['shopping', 'chill'], 'afternoon', 3),
  _Preset('🏛️ Culture trip', 2, ['culture'], 'morning', 3),
  _Preset('🌙 Late night', 4, ['nightlife', 'foodie'], 'night', 2),
];

/// Your next group outing, with a countdown. Hidden when there's none.
class _NextOutingCard extends ConsumerWidget {
  const _NextOutingCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final g = ref.watch(nextOutingProvider);
    if (g == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: KSpace.md),
      child: Card(
        child: ListTile(
          leading: const Text('🎉', style: TextStyle(fontSize: 26)),
          title: Text(trf('Next outing: {name}', {'name': g.name}), maxLines: 1, overflow: TextOverflow.ellipsis),
          subtitle: Text(DateFormat('EEE d MMM · h:mm a').format(g.scheduledAt!)),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => context.push('/group/${g.id}'),
        ),
      ),
    );
  }
}

/// "What's new in this version", until you open it once.
class _WhatsNewCard extends ConsumerWidget {
  const _WhatsNewCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final seen = ref.watch(appSettingsProvider.select((s) => s.seenVersion));
    if (seen == appVersion) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: KSpace.md),
      child: Card(
        child: ListTile(
          leading: const Text('🎁', style: TextStyle(fontSize: 26)),
          title: Text("What's new in $appVersion"),
          subtitle: Text(tr('Arabic, maps, check-ins and more')),
          trailing: IconButton(
            tooltip: tr('Hide'),
            icon: const Icon(Icons.close),
            onPressed: () => ref.read(appSettingsProvider.notifier).markSeen(appVersion),
          ),
          onTap: () {
            ref.read(appSettingsProvider.notifier).markSeen(appVersion);
            context.push('/whats-new');
          },
        ),
      ),
    );
  }
}

/// Pick an area of the city (with how many places it has), searchable.
class _AreaPicker extends StatefulWidget {
  const _AreaPicker({required this.areas});

  final List<({String name, double lat, double lng, int count})> areas;

  @override
  State<_AreaPicker> createState() => _AreaPickerState();
}

class _AreaPickerState extends State<_AreaPicker> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final shown =
        widget.areas.where((a) => a.name.toLowerCase().contains(_q.trim().toLowerCase())).toList();
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      builder: (_, controller) => ListView(
        controller: controller,
        children: [
          Padding(
            padding: const EdgeInsets.all(KSpace.md),
            child: TextField(
              autofocus: true,
              decoration: InputDecoration(
                  hintText: tr('Find an area, e.g. Zamalek'), prefixIcon: Icon(Icons.search)),
              onChanged: (v) => setState(() => _q = v),
            ),
          ),
          if (shown.isEmpty)
            Padding(padding: EdgeInsets.all(KSpace.md), child: Text(tr('No area with that name.'))),
          for (final a in shown)
            ListTile(
              leading: const Icon(Icons.place_outlined),
              title: Text(a.name),
              trailing: Text(trf('{n} places', {'n': a.count}), style: TextStyle(color: context.k.inkMuted)),
              onTap: () => Navigator.pop(context, a),
            ),
        ],
      ),
    );
  }
}

/// Your last few plans, one tap away.
class _RecentPlans extends ConsumerWidget {
  const _RecentPlans();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plans = (ref.watch(allPlansProvider).value ?? const []).take(5).toList();
    if (plans.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(tr('Recent plans')),
        SizedBox(
          height: 40,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: plans.length,
            separatorBuilder: (_, _) => const SizedBox(width: KSpace.sm),
            itemBuilder: (_, i) => ActionChip(
              avatar: const Icon(Icons.map_outlined, size: 18),
              label: Text(plans[i].title, overflow: TextOverflow.ellipsis),
              onPressed: () => context.push('/plan/${plans[i].id}'),
            ),
          ),
        ),
      ],
    );
  }
}
