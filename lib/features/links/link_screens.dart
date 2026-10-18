import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/i18n.dart';
import '../../app/links.dart';
import '../../app/review.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../planner/planner.dart' show withDistances, describeStop;
import '../../widgets/common.dart';

/// Opened from a group invite link: shows the code and joins on tap.
class JoinLinkScreen extends ConsumerWidget {
  const JoinLinkScreen({super.key, required this.code});

  final String code;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(tr('Group invite'))),
      body: Padding(
        padding: const EdgeInsets.all(KSpace.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('🎉', style: TextStyle(fontSize: 56), textAlign: TextAlign.center),
            const SizedBox(height: KSpace.md),
            Text(tr("You're invited to a Khroga group"), style: text.headlineSmall, textAlign: TextAlign.center),
            const SizedBox(height: KSpace.sm),
            Text(trf('Invite code: {code}', {'code': code}), style: text.bodyLarge, textAlign: TextAlign.center),
            const SizedBox(height: KSpace.lg),
            BusyButton(
              label: tr('Join the group'),
              icon: Icons.group_add_outlined,
              onPressed: () async {
                final uid = ref.read(uidProvider);
                if (uid == null) return;
                try {
                  final id = await ref.read(groupsRepositoryProvider).join(uid, code);
                  happyMoment(ref);
                  if (context.mounted) context.pushReplacement('/group/$id');
                } catch (e) {
                  if (context.mounted) showError(context, e);
                }
              },
            ),
            TextButton(onPressed: () => context.go('/plan'), child: Text(tr('Not now'))),
          ],
        ),
      ),
    );
  }
}

/// Opened from someone's "Add me on Khroga" link.
class AddFriendLinkScreen extends ConsumerWidget {
  const AddFriendLinkScreen({super.key, required this.uid});

  final String uid;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(uidProvider);
    final isGuest = ref.watch(authStateProvider).value?.isAnonymous ?? true;
    final profile = ref.watch(profilesProvider(uid));
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(tr('Add a friend'))),
      body: AsyncView(
        value: profile,
        builder: (map) {
          final p = map[uid];
          if (p == null) {
            return EmptyState(emoji: '🤷', title: tr('That Khroga account no longer exists.'));
          }
          return Padding(
            padding: const EdgeInsets.all(KSpace.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(child: Avatar(profile: p, size: 88)),
                const SizedBox(height: KSpace.md),
                Text(p.displayName, style: text.headlineSmall, textAlign: TextAlign.center),
                if (p.username != null) Text('@${p.username}', textAlign: TextAlign.center, style: text.bodyMedium),
                const SizedBox(height: KSpace.lg),
                if (me == uid)
                  Text(tr("That's your own code 🙂"), textAlign: TextAlign.center)
                else if (isGuest)
                  Text(tr('Sign in with Google in Profile to add friends.'), textAlign: TextAlign.center)
                else
                  BusyButton(
                    label: tr('Send friend request'),
                    icon: Icons.person_add_alt_1,
                    onPressed: () async {
                      try {
                        await ref.read(socialRepositoryProvider).sendRequest(me!, uid);
                        if (context.mounted) {
                          showMessage(context, trf('Friend request sent to {name}', {'name': p.displayName}));
                          context.go('/friends');
                        }
                      } catch (e) {
                        if (context.mounted) showError(context, e);
                      }
                    },
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Opened from a shared plan link. Places come from our own data; ids we
/// don't know are left out.
class SharedPlanScreen extends ConsumerStatefulWidget {
  const SharedPlanScreen({super.key, required this.uri});

  final Uri uri;

  @override
  ConsumerState<SharedPlanScreen> createState() => _SharedPlanScreenState();
}

class _SharedPlanScreenState extends ConsumerState<SharedPlanScreen> {
  /// How many stops are revealed (a mystery link starts with none).
  late int _shown = isMysteryLink(widget.uri) ? 0 : 99;

  @override
  Widget build(BuildContext context) {
    final uri = widget.uri;
    final shared = parsePlanLink(Uri(path: '/s', query: uri.query));
    final all = ref.watch(allPlacesProvider);
    return Scaffold(
      appBar: AppBar(title: Text(_shown == 0 ? tr('🎁 A surprise outing') : tr('A plan for you'))),
      body: shared == null
          ? EmptyState(emoji: '🔗', title: tr("This link doesn't work"))
          : AsyncView<List<Place>>(
              value: all,
              builder: (places) {
                final byId = {for (final p in places) p.id: p};
                final found = [
                  for (final s in shared.stops)
                    if (byId[s.placeId] != null) (s, byId[s.placeId]!),
                ];
                final missing = shared.stops.length - found.length;
                if (found.isEmpty) {
                  return EmptyState(
                    emoji: '🗺️',
                    title: tr("We couldn't find these places"),
                    message: tr('Update Khroga to get the newest places, then open the link again.'),
                  );
                }
                final stops = withDistances([
                  for (final (s, p) in found)
                    PlanStop(
                      placeId: p.id,
                      name: p.name,
                      category: p.category,
                      area: p.area,
                      lat: p.lat,
                      lng: p.lng,
                      cuisine: p.cuisineLabel,
                      startTime: s.time,
                      durationMinutes: s.minutes,
                      why: describeStop(p),
                    ),
                ]);
                final title = shared.title.isEmpty ? tr('Shared outing') : shared.title;
                final text = Theme.of(context).textTheme;
                return ListView(
                  padding: const EdgeInsets.all(KSpace.md),
                  children: [
                    Text(title, style: text.headlineSmall),
                    if (shared.date != null && DateTime.tryParse(shared.date!) != null)
                      Text('📅 ${DateFormat('EEEE d MMM').format(DateTime.parse(shared.date!))}'),
                    const SizedBox(height: KSpace.sm),
                    if (_shown < stops.length)
                      Padding(
                        padding: const EdgeInsets.only(bottom: KSpace.sm),
                        child: Text(tr('Someone planned this for you. Tap the gift to reveal each stop.')),
                      ),
                    for (var i = 0; i < stops.length; i++)
                      if (i >= _shown)
                        Card(
                          color: i == _shown ? context.k.accent : null,
                          child: ListTile(
                            leading: Text(i == _shown ? '🎁' : '🔒', style: const TextStyle(fontSize: 26)),
                            title: Text(
                              trf('Stop {n}', {'n': i + 1}),
                              style: TextStyle(color: i == _shown ? context.k.onAccent : null),
                            ),
                            subtitle: Text(
                              [?stops[i].startTime, tr('Tap to reveal')].join(' · '),
                              style: TextStyle(color: i == _shown ? context.k.onAccent : null),
                            ),
                            onTap: i == _shown ? () => setState(() => _shown++) : null,
                          ),
                        )
                      else
                        Card(
                          child: ListTile(
                            leading: CircleAvatar(child: Text('${i + 1}')),
                            title: Text('${Categories.emoji(stops[i].category)} ${found[i].$2.shownName}'),
                            subtitle: Text([?stops[i].startTime, ?stops[i].area].join(' · ')),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => context.push('/place/${stops[i].placeId}'),
                          ),
                        ),
                    if (missing > 0)
                      Padding(
                        padding: const EdgeInsets.only(top: KSpace.sm),
                        child: Text(
                          trf('{n} stops are not in your version of Khroga, so we left them out.', {'n': missing}),
                        ),
                      ),
                    const SizedBox(height: KSpace.md),
                    BusyButton(
                      label: tr('Save to my plans'),
                      icon: Icons.bookmark_add_outlined,
                      onPressed: () async {
                        final uid = ref.read(uidProvider);
                        if (uid == null) return;
                        try {
                          final id = await ref
                              .read(plansRepositoryProvider)
                              .saveShared(
                                uid,
                                OutingPlan(
                                  id: '',
                                  title: title,
                                  summary: '',
                                  stops: stops,
                                  source: 'local',
                                  request: PlanRequest(
                                    city: shared.city,
                                    groupSize: 2,
                                    vibes: const ['chill'],
                                    timeOfDay: 'evening',
                                    stops: stops.length,
                                    date: shared.date,
                                  ),
                                ),
                              );
                          if (context.mounted) context.pushReplacement('/plan/$id');
                        } catch (e) {
                          if (context.mounted) showError(context, e);
                        }
                      },
                    ),
                  ],
                );
              },
            ),
    );
  }
}
