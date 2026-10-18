import '../fun/place_of_day.dart';
import '../fun/timeline_screen.dart' show OnThisDayCard;
import '../../app/i18n.dart';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/extras.dart';
import '../../app/helpers.dart';
import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../data/live_data.dart' show aqiLabel, uvLabel;
import '../../data/providers.dart';
import '../../models/plan.dart';
import '../../planner/services.dart' show aiResting;
import '../../planner/planner.dart' show compactRadiusKm, planNeeds;
import '../../widgets/common.dart';
import '../profile/about_screen.dart' show appVersion;
import '../profile/theme_sheet.dart';
import '../reviews/challenge_card.dart';

/// The home tab: describe your outing, get a real plan.
class PlanFormScreen extends ConsumerStatefulWidget {
  const PlanFormScreen({super.key, this.initialMallId, this.anchor, this.idea});

  /// Index into [outingIdeas], when opened from an idea card.
  final int? idea;

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
  final Set<String> _needs = {};
  bool _useAi = false;
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
    final idea = widget.idea == null || widget.idea! < 0 || widget.idea! >= outingIdeas.length
        ? null
        : outingIdeas[widget.idea!];
    if (idea != null) {
      _people = idea.people;
      _stops = idea.stops;
      _vibes
        ..clear()
        ..addAll(idea.vibes);
      _time = idea.time;
      _needs.addAll(idea.needs);
      return;
    }
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
      _needs.clear();
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

  /// Saves the form as your own preset (on this phone).
  Future<void> _saveMine() async {
    final controller = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(tr('Name these choices')),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 24,
          decoration: InputDecoration(hintText: tr('e.g. Our usual Friday')),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: Text(tr('Cancel'))),
          FilledButton(onPressed: () => Navigator.pop(c, controller.text.trim()), child: Text(tr('Save'))),
        ],
      ),
    );
    controller.dispose();
    if (name == null || name.isEmpty || !mounted) return;
    if (ref.read(planPresetsProvider).length >= 8 && !ref.read(planPresetsProvider).containsKey(name)) {
      showMessage(context, tr('You can keep up to 8. Remove one first.'));
      return;
    }
    ref.read(planPresetsProvider.notifier).set(name, jsonEncode({
      'people': _people,
      'vibes': _vibes.toList(),
      'time': _time,
      'stops': _stops,
      'onlyOpen': _onlyOpen,
      'skipVisited': _skipVisited,
      'preferFavorites': _preferFavorites,
      'radius': _radius,
      'needs': _needs.toList(),
    }));
    showMessage(context, trf('Saved "{name}". Tap it any time.', {'name': name}));
  }

  void _applyMine(String name) {
    final raw = ref.read(planPresetsProvider)[name];
    if (raw == null) return;
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;
      setState(() {
        _people = (m['people'] as num?)?.toInt() ?? _people;
        final v = ((m['vibes'] as List?) ?? const []).whereType<String>().where(Vibes.all.containsKey);
        if (v.isNotEmpty) {
          _vibes
            ..clear()
            ..addAll(v);
        }
        if (TimesOfDay.all.containsKey(m['time'])) _time = m['time'] as String;
        _stops = (m['stops'] as num?)?.toInt() ?? _stops;
        _onlyOpen = (m['onlyOpen'] as bool?) ?? _onlyOpen;
        _skipVisited = (m['skipVisited'] as bool?) ?? _skipVisited;
        _preferFavorites = (m['preferFavorites'] as bool?) ?? _preferFavorites;
        _radius = (m['radius'] as num?)?.toDouble() ?? _radius;
        _needs
          ..clear()
          ..addAll(((m['needs'] as List?) ?? const []).whereType<String>().where(planNeeds.containsKey));
      });
      showMessage(context, trf('{preset} picked. Change anything, then tap Plan.', {'preset': name}));
    } catch (_) {
      ref.read(planPresetsProvider.notifier).set(name, null);
    }
  }

  Future<void> _generate() async {
    tapFeedback(ref.read(phoneSettingsProvider).haptics);
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
      needs: _needs.toList(),
      nearLat: _mallId == null ? _anchor?.$1 : null,
      nearLng: _mallId == null ? _anchor?.$2 : null,
      nearLabel: _mallId == null ? _anchor?.$3 : null,
      radiusKm: _radius,
    );
    final id = await runPlanGeneration(context, ref, request, useAi: _useAi);
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
          const _TodayStrip(),
          const _IdeaForNow(),
          const OnThisDayCard(),
          const PlaceOfDayCard(),
          const ChallengeCard(),
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
              ActionChip(
                avatar: const Text('💡'),
                label: Text(tr('More ideas')),
                onPressed: () => context.push('/ideas'),
              ),
              for (final name in ref.watch(planPresetsProvider).keys)
                InputChip(
                  avatar: const Text('⭐'),
                  label: Text(name),
                  onPressed: () => _applyMine(name),
                  deleteButtonTooltipMessage: tr('Remove'),
                  onDeleted: () => ref.read(planPresetsProvider.notifier).set(name, null),
                ),
              ActionChip(
                avatar: const Icon(Icons.bookmark_add_outlined, size: 18),
                label: Text(tr('Save my choices')),
                onPressed: _saveMine,
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
              ChoiceChip(
                label: Text(tr('Saturday')),
                selected: _date != null && _date!.weekday == DateTime.saturday && !_isTomorrow(_date),
                showCheckmark: false,
                onSelected: (_) => setState(() {
                  final now = DateTime.now();
                  final sat = nextWeekday(now, DateTime.saturday);
                  _date = sameDay(sat, now) ? null : sat;
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
          _DayFacts(day: _date ?? DateTime.now(), city: ref.watch(cityProvider)),
          _BestDay(
            city: ref.watch(cityProvider),
            onPick: (d) => setState(() => _date = sameDay(d, DateTime.now()) ? null : d),
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
          Row(
            children: [
              _Stepper(
                value: _people,
                min: 1,
                max: 20,
                onChanged: (v) => setState(() => _people = v),
              ),
              const SizedBox(width: KSpace.sm),
              Expanded(
                child: Wrap(
                  spacing: KSpace.xs,
                  children: [
                    for (final n in const [2, 4, 6, 10])
                      ChoiceChip(
                        label: Text('$n'),
                        selected: _people == n,
                        showCheckmark: false,
                        visualDensity: VisualDensity.compact,
                        onSelected: (_) => setState(() => _people = n),
                      ),
                  ],
                ),
              ),
            ],
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
              suffixText: tr('EGP'),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: KSpace.xs),
          Wrap(
            spacing: KSpace.xs,
            children: [
              for (final b in const [200, 500, 1000, 2000])
                ChoiceChip(
                  label: Text(trf('{n} EGP', {'n': b})),
                  selected: _budget.text == '$b',
                  showCheckmark: false,
                  visualDensity: VisualDensity.compact,
                  onSelected: (on) => setState(() => _budget.text = on ? '$b' : ''),
                ),
            ],
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
            title: Text(tr('✨ Let AI pick and write the plan')),
            subtitle: Text(tr('Takes a few seconds. Our own planner is instant and is used if the AI is busy.')),
            value: _useAi,
            onChanged: (v) => setState(() => _useAi = v),
          ),
          SectionTitle(tr('Must have')),
          Wrap(spacing: KSpace.sm, runSpacing: KSpace.sm, children: [
            for (final e in planNeeds.entries)
              FilterChip(
                label: Text(tr(e.value)),
                selected: _needs.contains(e.key),
                onSelected: (on) => setState(() => on ? _needs.add(e.key) : _needs.remove(e.key)),
              ),
          ]),
          if (_needs.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: KSpace.xs),
              child: Text(
                  tr('Only places whose map entry says so, so there are fewer to choose from.'),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: context.k.inkMuted)),
            ),
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
          Wrap(
            spacing: KSpace.xs,
            runSpacing: KSpace.xs,
            children: [
              for (final n in const ['🎂 Birthday', '🦐 No seafood', '♿ Wheelchair user', '👶 With kids', '🥗 Vegetarian', '🚭 No smoking'])
                ActionChip(
                  visualDensity: VisualDensity.compact,
                  label: Text(tr(n)),
                  onPressed: () {
                    final t = tr(n);
                    final cur = _notes.text.trim();
                    if (cur.contains(t)) return;
                    _notes.text = cur.isEmpty ? t : '$cur, $t';
                  },
                ),
            ],
          ),
          const SizedBox(height: KSpace.md),
          _ChoicesSummary(text: [
            _people == 1 ? tr('1 person') : trf('{n} people', {'n': _people}),
            _vibes.map((v) => tr(Vibes.all[v] ?? v)).join(' + '),
            tr(TimesOfDay.all[_time] ?? _time),
            if (_date != null) DateFormat('EEE d MMM').format(_date!),
            if (_mallId != null) tr('🛍️ One mall')
            else if (_anchor != null) '📍 ${_anchor!.$3 == 'you' ? tr('Near me') : _anchor!.$3} · ${trf('{n} km', {'n': _radius.round()})}',
            trf('{n} stops', {'n': _stops}),
            if (_useAi) '✨ AI',
          ].join(' · ')),
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
Future<String?> runPlanGeneration(BuildContext context, WidgetRef ref, PlanRequest request,
    {bool useAi = false}) async {
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
    final id = await ref.read(plansRepositoryProvider).generate(uid, request, useAi: useAi);
    ref.invalidate(plansCountProvider);
    if (useAi && aiResting) {
      messenger.showSnackBar(SnackBar(
          content: Text(tr('AI is resting for now (free daily limit). Our planner made this one.'))));
    }
    return id;
  } catch (e) {
    messenger.showSnackBar(SnackBar(content: Text(friendlyError(e))));
    return null;
  } finally {
    navigator.pop();
  }
}

class _GeneratingDialog extends StatefulWidget {
  const _GeneratingDialog();

  @override
  State<_GeneratingDialog> createState() => _GeneratingDialogState();
}

class _GeneratingDialogState extends State<_GeneratingDialog> {
  static const _steps = [
    'Picking real places and checking the weather',
    'Checking which places are open then',
    'Keeping your stops close together',
    'Almost there…',
  ];
  int _i = 0;
  late final _timer = Stream.periodic(const Duration(milliseconds: 1400), (n) => n + 1)
      .listen((n) => mounted ? setState(() => _i = n.clamp(0, _steps.length - 1)) : null);

  @override
  void initState() {
    super.initState();
    _timer;
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

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
            Text(tr(_steps[_i]),
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
          title: Text(trf("What's new in {v}", {'v': appVersion})),
          subtitle: Text(tr('Surprise plans, indoor backups, memories and more')),
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
    final plans = (ref.watch(recentPlansProvider).value ?? const []).take(5).toList();
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
              label: Text(
                  plans[i].request.date != null
                      ? '${plans[i].title} · ${DateFormat('d MMM').format(plans[i].request.day)}'
                      : plans[i].title,
                  overflow: TextOverflow.ellipsis),
              onPressed: () => context.push('/plan/${plans[i].id}'),
            ),
          ),
        ),
      ],
    );
  }
}

/// One line that sums up the choices before planning.
class _ChoicesSummary extends StatelessWidget {
  const _ChoicesSummary({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(KSpace.md),
      decoration: BoxDecoration(
        color: context.k.accentSoft,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          const Icon(Icons.checklist, size: 20),
          const SizedBox(width: KSpace.sm),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }
}

/// Facts about the outing day: a fixed public holiday, the weekend, and
/// when the sun sets (worked out from the date, not looked up).
class _DayFacts extends StatelessWidget {
  const _DayFacts({required this.day, required this.city});

  final DateTime day;
  final String city;

  @override
  Widget build(BuildContext context) {
    final holiday = egyptHoliday(day);
    final c = cityCenters[city] ?? cityCenters['cairo']!;
    final sun = sunTimes(day, c.$1, c.$2);
    final parts = [
      if (holiday != null) trf('🇪🇬 {name}: a public holiday, places may be busier.', {'name': holiday}),
      if (holiday == null && isEgyptWeekend(day)) tr('🗓️ Weekend: popular places get busy.'),
      if (sun != null) trf('🌇 Sunset at {time}', {'time': hhmmLocal(sun.sunset)}),
    ];
    if (parts.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: KSpace.sm),
      child: Text(parts.join('\n'),
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: context.k.inkMuted)),
    );
  }
}

/// "Best day this week: Saturday (27°, 5% rain)", from the real forecast.
/// Tap it to pick that day. Hidden when offline.
class _BestDay extends ConsumerWidget {
  const _BestDay({required this.city, required this.onPick});

  final String city;
  final ValueChanged<DateTime> onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final week = ref.watch(weekForecastProvider(city)).value ?? const [];
    final best = bestDay(week);
    if (best == null) return const SizedBox.shrink();
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: TextButton.icon(
        icon: const Icon(Icons.wb_sunny_outlined, size: 18),
        label: Text(trf('Best weather this week: {day} ({t}°, {r}% rain)', {
          'day': DateFormat('EEEE').format(best.day),
          't': best.maxC.round(),
          'r': best.rainPct,
        })),
        onPressed: () => onPick(best.day),
      ),
    );
  }
}

/// "Today in Cairo: 31° · 🌇 17:32 · Next prayer Asr 15:05". Weather is
/// the real forecast (hidden offline); the rest is worked out on the phone.
class _TodayStrip extends ConsumerWidget {
  const _TodayStrip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final city = ref.watch(cityProvider);
    final now = DateTime.now();
    final today = (ref.watch(weekForecastProvider(city)).value ?? const <DayForecast>[])
        .where((d) => sameDay(d.day, now))
        .firstOrNull;
    final c = cityCenters[city] ?? cityCenters['cairo']!;
    final sun = sunTimes(now, c.$1, c.$2);
    final pray = prayerTimes(now, c.$1, c.$2);
    final air = ref.watch(airProvider(city)).value;
    final next = pray == null
        ? null
        : [
            (tr('Fajr'), pray.fajr),
            (tr('Dhuhr'), pray.dhuhr),
            (tr('Asr'), pray.asr),
            (tr('Maghrib'), pray.maghrib),
            (tr('Isha'), pray.isha),
          ].where((p) => p.$2.isAfter(now.toUtc())).firstOrNull;
    final parts = [
      if (today != null) trf('{t}° · {r}% rain', {'t': today.maxC.round(), 'r': today.rainPct}),
      if (sun != null && sun.sunset.isAfter(now.toUtc())) trf('🌇 Sunset at {time}', {'time': hhmmLocal(sun.sunset)}),
      if (next != null) trf('🕌 {name} {time}', {'name': next.$1, 'time': hhmmLocal(next.$2)}),
      if (air?.uv case final uv? when uv >= 3) trf('☀️ UV {n} ({label})', {'n': uv.round(), 'label': uvLabel(uv)}),
      if (air?.aqi case final aqi?) trf('🌫️ Air: {label}', {'label': aqiLabel(aqi)}),
    ];
    if (parts.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: KSpace.sm),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => context.push('/tools'),
        child: Text(parts.join('  ·  '),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: context.k.inkMuted)),
      ),
    );
  }
}

/// "Right now: 🌙 Night out" — one idea that suits the day, time and weather.
class _IdeaForNow extends ConsumerWidget {
  const _IdeaForNow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    final today = (ref.watch(weekForecastProvider(ref.watch(cityProvider))).value ?? const <DayForecast>[])
        .where((d) => sameDay(d.day, now))
        .firstOrNull;
    final i = ideaForNow(now, maxTempC: today?.maxC, rainPct: today?.rainPct);
    if (i < 0) return const SizedBox.shrink();
    final idea = outingIdeas[i];
    return Padding(
      padding: const EdgeInsets.only(top: KSpace.sm),
      child: Card(
        child: ListTile(
          leading: Text(idea.emoji, style: const TextStyle(fontSize: 28)),
          title: Text(trf('Right now: {idea}', {'idea': idea.title})),
          subtitle: Text(idea.blurb),
          trailing: FilledButton.tonal(
            onPressed: () => context.push('/new-plan?idea=$i'),
            child: Text(tr('Try it')),
          ),
        ),
      ),
    );
  }
}
