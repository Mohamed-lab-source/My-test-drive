import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../widgets/common.dart';

class SavedPlansScreen extends ConsumerWidget {
  const SavedPlansScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plans = ref.watch(savedPlansProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Saved plans')),
      body: AsyncView<List<OutingPlan>>(
        value: plans,
        builder: (list) => list.isEmpty
            ? const EmptyState(
                emoji: '🔖',
                title: 'No saved plans yet',
                message: 'Tap "Save" on a plan you like and it will show up here.',
              )
            : ListView.separated(
                padding: const EdgeInsets.all(KSpace.md),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(height: KSpace.sm),
                itemBuilder: (_, i) => _SavedPlanTile(plan: list[i]),
              ),
      ),
    );
  }
}

class _SavedPlanTile extends StatelessWidget {
  const _SavedPlanTile({required this.plan});

  final OutingPlan plan;

  @override
  Widget build(BuildContext context) {
    final emojis = plan.stops.map((s) => Categories.emoji(s.category)).join(' ');
    final date = plan.createdAt == null
        ? ''
        : DateFormat.MMMd().format(plan.createdAt!);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: KSpace.md, vertical: KSpace.sm),
        title: Text(plan.title,
            style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text('$emojis   ${plan.stops.length} stops · $date'),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.push('/plan/${plan.id}'),
      ),
    );
  }
}
