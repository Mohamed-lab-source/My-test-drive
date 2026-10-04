import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/plan.dart';
import '../../widgets/common.dart';

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
  int _stops = 3;
  String? _mallId;
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
            tooltip: 'Saved plans',
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
          Text("Where are we going?", style: text.headlineMedium),
          const SizedBox(height: KSpace.xs),
          Text('Tell us the vibe. We only suggest real places.',
              style: text.bodyMedium?.copyWith(color: KColors.inkMuted)),
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
          const SectionTitle('When?'),
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
    return const Dialog(
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
                style: TextStyle(color: KColors.inkMuted)),
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
