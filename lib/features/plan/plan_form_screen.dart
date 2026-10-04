import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/helpers.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/plan.dart';
import '../../widgets/common.dart';
import '../profile/theme_sheet.dart';

/// The home tab: describe your outing, get a real plan.
class PlanFormScreen extends ConsumerStatefulWidget {
  const PlanFormScreen({super.key, this.initialMallId});

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
  final _budget = TextEditingController();
  final _notes = TextEditingController();

  @override
  void initState() {
    super.initState();
    _mallId = widget.initialMallId;
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

  Future<void> _generate() async {
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
        title: const Text('Khroga'),
        actions: [
          IconButton(
            tooltip: 'Look & colors',
            icon: const Icon(Icons.palette_outlined),
            onPressed: () => showThemeSheet(context),
          ),
          IconButton(
            tooltip: 'Saved plans & places',
            icon: const Icon(Icons.bookmark_outline),
            onPressed: () => context.push('/saved'),
          ),
          IconButton(
            tooltip: 'Profile',
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
          Text("Where are we going?", style: text.headlineMedium),
          const SizedBox(height: KSpace.xs),
          Text('Tell us the vibe. We only suggest real places.',
              style: text.bodyMedium?.copyWith(color: context.k.inkMuted)),
          const _NextOutingCard(),
          const SectionTitle('Quick start'),
          Wrap(
            spacing: KSpace.sm,
            runSpacing: KSpace.sm,
            children: [
              for (final preset in _presets)
                ActionChip(
                  label: Text(preset.label),
                  onPressed: () => setState(() {
                    _people = preset.people;
                    _vibes
                      ..clear()
                      ..addAll(preset.vibes);
                    _time = preset.time;
                    _stops = preset.stops;
                    showMessage(context, '${preset.label} picked. Change anything, then tap Plan.');
                  }),
                ),
            ],
          ),
          const SectionTitle('When?'),
          Wrap(
            spacing: KSpace.sm,
            runSpacing: KSpace.sm,
            children: [
              ChoiceChip(
                label: const Text('Today'),
                selected: _date == null,
                showCheckmark: false,
                onSelected: (_) => setState(() => _date = null),
              ),
              ChoiceChip(
                label: const Text('Tomorrow'),
                selected: _isTomorrow(_date),
                showCheckmark: false,
                onSelected: (_) => setState(() {
                  final now = DateTime.now();
                  _date = DateTime(now.year, now.month, now.day + 1);
                }),
              ),
              ChoiceChip(
                label: const Text('Friday'),
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
                    ? 'Pick a day'
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
          const SectionTitle('City'),
          SegmentedButton<String>(
            showSelectedIcon: false,
            segments: [
              for (final e in Cities.all.entries)
                ButtonSegment(value: e.key, label: Text(e.value)),
            ],
            selected: {city},
            onSelectionChanged: (s) {
              ref.read(cityProvider.notifier).set(s.first);
              setState(() => _mallId = null);
            },
          ),
          const SectionTitle('How many people?'),
          _Stepper(
            value: _people,
            min: 1,
            max: 20,
            onChanged: (v) => setState(() => _people = v),
          ),
          const SectionTitle('Vibe'),
          Wrap(
            spacing: KSpace.sm,
            runSpacing: KSpace.sm,
            children: [
              for (final e in Vibes.all.entries)
                FilterChip(
                  label: Text(e.value),
                  selected: _vibes.contains(e.key),
                  showCheckmark: false,
                  onSelected: (on) => setState(() {
                    on ? _vibes.add(e.key) : _vibes.remove(e.key);
                  }),
                ),
            ],
          ),
          const SectionTitle('Time of day'),
          Wrap(
            spacing: KSpace.sm,
            runSpacing: KSpace.sm,
            children: [
              for (final e in TimesOfDay.all.entries)
                ChoiceChip(
                  label: Text(e.value),
                  selected: _time == e.key,
                  showCheckmark: false,
                  onSelected: (_) => setState(() => _time = e.key),
                ),
            ],
          ),
          const SectionTitle('Budget per person (optional)'),
          TextField(
            controller: _budget,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: const InputDecoration(
              hintText: 'e.g. 500',
              suffixText: 'EGP',
            ),
          ),
          const SectionTitle('Number of stops'),
          _Stepper(
            value: _stops,
            min: 1,
            max: 5,
            onChanged: (v) => setState(() => _stops = v),
          ),
          if (malls.isNotEmpty) ...[
            const SectionTitle('Stay inside one mall? (optional)'),
            DropdownButtonFormField<String?>(
              initialValue: mallStillValid ? _mallId : null,
              isExpanded: true,
              items: [
                const DropdownMenuItem(value: null, child: Text('No, anywhere')),
                for (final m in malls)
                  DropdownMenuItem(value: m.id, child: Text(m.name)),
              ],
              onChanged: (v) => setState(() => _mallId = v),
            ),
          ],
          const SectionTitle('Choices'),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Only places open at that time'),
            subtitle: const Text('Uses real opening hours when the map has them'),
            value: _onlyOpen,
            onChanged: (v) => setState(() => _onlyOpen = v),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Prefer my favorite places'),
            value: _preferFavorites,
            onChanged: (v) => setState(() => _preferFavorites = v),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text("Skip places I've been"),
            subtitle: const Text('Discover somewhere new'),
            value: _skipVisited,
            onChanged: (v) => setState(() => _skipVisited = v),
          ),
          const SectionTitle('Anything else? (optional)'),
          TextField(
            controller: _notes,
            maxLines: 2,
            maxLength: 200,
            decoration: const InputDecoration(
              hintText: 'e.g. no seafood, someone uses a wheelchair, birthday…',
            ),
          ),
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
            label: Text(_vibes.isEmpty ? 'Pick at least one vibe' : 'Plan my outing'),
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
    if (uid == null) throw Exception('Please sign in again.');
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
            Text('Building your plan…',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            SizedBox(height: KSpace.xs),
            Text('Picking real places and checking the weather',
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
          title: Text('Next outing: ${g.name}', maxLines: 1, overflow: TextOverflow.ellipsis),
          subtitle: Text(DateFormat('EEE d MMM · h:mm a').format(g.scheduledAt!)),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => context.push('/group/${g.id}'),
        ),
      ),
    );
  }
}
