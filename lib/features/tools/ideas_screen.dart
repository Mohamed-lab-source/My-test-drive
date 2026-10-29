import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/extras.dart';
import '../../app/i18n.dart';
import '../../app/theme.dart';
import '../../models/plan.dart';

/// Ready-made outing ideas. Tapping one fills in the plan form; the places
/// are still picked from real data when you tap "Plan my outing".
class IdeasScreen extends StatelessWidget {
  const IdeasScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(tr('Outing ideas'))),
      body: GridView.builder(
        padding: const EdgeInsets.all(KSpace.md),
        gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
          maxCrossAxisExtent: 260,
          mainAxisSpacing: KSpace.sm,
          crossAxisSpacing: KSpace.sm,
          // Taller cards when the phone uses bigger text.
          childAspectRatio: 0.95 / MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 2.2),
        ),
        itemCount: outingIdeas.length,
        itemBuilder: (context, i) {
          final idea = outingIdeas[i];
          return Card(
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () => context.push('/new-plan?idea=$i'),
              child: Padding(
                padding: const EdgeInsets.all(KSpace.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(idea.emoji, style: const TextStyle(fontSize: 30)),
                    const SizedBox(height: KSpace.xs),
                    Text(idea.title, style: text.titleMedium, maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Expanded(
                      child: Text(idea.blurb,
                          style: text.bodySmall?.copyWith(color: context.k.inkMuted),
                          overflow: TextOverflow.fade),
                    ),
                    Text(
                      [
                        tr(TimesOfDay.all[idea.time] ?? idea.time),
                        trf('{n} stops', {'n': idea.stops}),
                        trf('{n} people', {'n': idea.people}),
                      ].join(' · '),
                      style: text.labelSmall?.copyWith(color: context.k.accent),
                      maxLines: 2,
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
