import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/i18n.dart';
import '../../app/live.dart';
import '../../app/theme.dart';
import '../../data/live_share.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/social.dart';
import '../../planner/planner.dart' show haversineKm;
import '../../widgets/common.dart';
import '../../widgets/khroga_map.dart';
import '../../widgets/motion.dart';

/// The group's live map: who is sharing their location, how far each person
/// is from the meeting point (rough), "On my way" / "I'm here", and a fair
/// meeting spot in the middle of everyone.
class LiveMapScreen extends ConsumerWidget {
  const LiveMapScreen({super.key, required this.groupId});

  final String groupId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final group = ref.watch(groupProvider(groupId)).value;
    final uid = ref.watch(uidProvider);
    final share = ref.watch(liveShareProvider);
    final mine = share.groupId == groupId;
    final now = DateTime.now();
    final spots = (ref.watch(groupLiveProvider(groupId)).value ?? const <LiveSpot>[])
        .where((s) => s.isLive(now) && s.uid != uid && (group?.memberUids.contains(s.uid) ?? false))
        .toList();
    final meet = group?.meetPlaceId == null ? null : ref.watch(placeProvider(group!.meetPlaceId!)).value;
    final meetAt = meet != null && meet.hasLocation ? (meet.lat!, meet.lng!) : null;
    final text = Theme.of(context).textTheme;
    final k = context.k;

    String initials(String name) {
      final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
      if (parts.isEmpty) return '?';
      return (parts.first[0] + (parts.length > 1 ? parts.last[0] : '')).toUpperCase();
    }

    String away(double lat, double lng) {
      if (meetAt == null) return '';
      final km = haversineKm(lat, lng, meetAt.$1, meetAt.$2);
      if (hasArrived(km)) return tr('At the meeting point');
      return trf('{km} km from the meeting point · about {n} min (rough)',
          {'km': km.toStringAsFixed(1), 'n': roughEtaMinutes(km)});
    }

    final pins = [
      if (meetAt != null) MapPin(lat: meetAt.$1, lng: meetAt.$2, label: meet!.shownName, emoji: '🚩'),
      for (final s in spots) MapPin(lat: s.lat, lng: s.lng, label: s.name, initials: initials(s.name)),
    ];

    return Scaffold(
      appBar: AppBar(title: Text(tr('Live map'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
        children: [
          FadeSlideIn(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(KRadius.sheet),
              child: SizedBox(
                height: 320,
                child: pins.isEmpty && !(mine && share.me != null)
                    ? Container(
                        color: k.surfaceHigh,
                        alignment: Alignment.center,
                        padding: const EdgeInsets.all(KSpace.lg),
                        child: Text(tr('Nobody is sharing yet. Share yours and your group sees you here.'),
                            textAlign: TextAlign.center, style: text.bodyMedium),
                      )
                    : KhrogaMap(pins: pins, me: mine ? share.me : null, zoom: 14),
              ),
            ),
          ),
          const SizedBox(height: KSpace.md),
          if (mine) _SharingCard(share: share, meetLabel: meet?.shownName) else _StartCard(groupId: groupId, meet: meetAt),
          SectionTitle(trf('Sharing now ({n})', {'n': spots.length + (mine ? 1 : 0)})),
          if (spots.isEmpty && !mine)
            Text(tr('When someone in the group shares, they show up here.'), style: text.bodyMedium)
          else
            MenuGroup(children: [
              if (mine && share.me != null)
                ListTile(
                  leading: CircleAvatar(backgroundColor: k.accentSoft, child: Icon(Icons.person, color: k.accent)),
                  title: Text(tr('You')),
                  subtitle: Text(away(share.me!.$1, share.me!.$2).isEmpty ? _statusLabel(share.status) : away(share.me!.$1, share.me!.$2)),
                  trailing: Text(_statusEmoji(share.status), style: const TextStyle(fontSize: 22)),
                ),
              for (final s in spots)
                ListTile(
                  leading: CircleAvatar(
                    backgroundColor: k.accentSoft,
                    child: Text(initials(s.name), style: TextStyle(color: k.accent, fontWeight: FontWeight.w800)),
                  ),
                  title: Text(s.name),
                  subtitle: Text([
                    if (s.status != null) _statusLabel(s.status),
                    if (away(s.lat, s.lng).isNotEmpty) away(s.lat, s.lng),
                    trf('updated {n} min ago', {'n': now.difference(s.updatedAt).inMinutes}),
                  ].join(' · ')),
                  trailing: Text(_statusEmoji(s.status), style: const TextStyle(fontSize: 22)),
                ),
            ]),
          if (group != null) ...[
            SectionTitle(tr('Meet in the middle')),
            _MiddleCard(
              group: group,
              points: [
                for (final s in spots) (s.lat, s.lng),
                if (mine && share.me != null) share.me!,
              ],
            ),
          ],
          const SizedBox(height: KSpace.md),
          Text(
            tr('Only your group sees your spot, only while you share and Khroga is open. '
                'It stops by itself and is deleted when you stop.'),
            style: text.bodySmall,
          ),
        ],
      ),
    );
  }
}

String _statusLabel(String? s) => switch (s) {
      'way' => tr('On my way'),
      'here' => tr("I'm here"),
      _ => tr('Sharing'),
    };

String _statusEmoji(String? s) => switch (s) {
      'way' => '🚶',
      'here' => '📍',
      _ => '🟢',
    };

/// Before sharing: explains what happens, then lets you pick for how long.
class _StartCard extends ConsumerWidget {
  const _StartCard({required this.groupId, required this.meet});

  final String groupId;
  final (double, double)? meet;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return HeroCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tr('Share my live location'),
              style: Theme.of(context).textTheme.titleLarge?.copyWith(color: context.k.onHero)),
          const SizedBox(height: KSpace.xs),
          Text(tr('Your group sees where you are on this map, so nobody gets lost on the way.'),
              style: TextStyle(color: context.k.onHero.withValues(alpha: 0.9))),
          const SizedBox(height: KSpace.md),
          Wrap(spacing: KSpace.sm, runSpacing: KSpace.sm, children: [
            for (final m in liveDurations)
              ActionChip(
                backgroundColor: context.k.surface,
                label: Text(m < 60 ? trf('{n} min', {'n': m}) : trf('{n} h', {'n': m ~/ 60})),
                onPressed: () async {
                  try {
                    await ref.read(liveShareProvider.notifier).start(groupId, m, meet: meet);
                  } catch (e) {
                    if (context.mounted) showError(context, e);
                  }
                },
              ),
          ]),
        ],
      ),
    );
  }
}

/// While sharing: your status, time left and a stop button.
class _SharingCard extends ConsumerWidget {
  const _SharingCard({required this.share, required this.meetLabel});

  final LiveShare share;
  final String? meetLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final left = share.until?.difference(DateTime.now());
    final c = ref.read(liveShareProvider.notifier);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(KSpace.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              const Text('🟢', style: TextStyle(fontSize: 18)),
              const SizedBox(width: KSpace.sm),
              Expanded(
                child: Text(
                  left == null ? tr('Sharing your location') : trf('Sharing for {t} more', {'t': trackDuration(left)}),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
            ]),
            const SizedBox(height: KSpace.sm),
            SegmentedButton<String>(
              showSelectedIcon: false,
              segments: [
                ButtonSegment(value: 'way', label: Text(tr('On my way'))),
                ButtonSegment(value: 'here', label: Text(tr("I'm here"))),
              ],
              selected: {share.status ?? 'way'},
              onSelectionChanged: (v) => c.setStatus(v.first),
            ),
            if (meetLabel != null) ...[
              const SizedBox(height: KSpace.sm),
              Text(trf('"I\'m here" turns on by itself near {place}.', {'place': meetLabel!}),
                  style: Theme.of(context).textTheme.bodySmall),
            ],
            const SizedBox(height: KSpace.md),
            OutlinedButton.icon(
              onPressed: c.stop,
              icon: const Icon(Icons.location_off_outlined),
              label: Text(tr('Stop sharing')),
            ),
          ],
        ),
      ),
    );
  }
}

/// A fair meeting spot: real places near the middle of everyone sharing.
class _MiddleCard extends ConsumerWidget {
  const _MiddleCard({required this.group, required this.points});

  final Group group;
  final List<(double, double)> points;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    if (points.length < 2) {
      return Text(tr('When two or more people share, Khroga suggests real places halfway between you.'),
          style: text.bodyMedium);
    }
    final mid = fairMidpoint(points)!;
    final all = ref.watch(allPlacesProvider).value ?? const <Place>[];
    final spots = meetingSpots(all, mid);
    if (spots.isEmpty) return Text(tr('No good meeting places on the map near the middle.'), style: text.bodyMedium);
    final uid = ref.watch(uidProvider);
    final isOwner = uid != null && group.isOwner(uid);
    return MenuGroup(children: [
      for (final p in spots.take(5))
        ListTile(
          leading: Text(Categories.emoji(p.category), style: const TextStyle(fontSize: 24)),
          title: Text(p.shownName),
          subtitle: Text([
            p.kindLabel ?? Categories.label(p.category),
            trf('{km} km from the middle', {'km': haversineKm(mid.$1, mid.$2, p.lat!, p.lng!).toStringAsFixed(1)}),
          ].join(' · ')),
          onTap: () => context.push('/place/${p.id}'),
          trailing: isOwner
              ? TextButton(
                  onPressed: () async {
                    try {
                      await ref.read(groupsRepositoryProvider).setMeetingPoint(group.id, placeId: p.id, placeName: p.name);
                      if (context.mounted) showMessage(context, trf('Meeting point: {place}', {'place': p.shownName}));
                    } catch (e) {
                      if (context.mounted) showError(context, e);
                    }
                  },
                  child: Text(tr('Meet here')),
                )
              : TextButton(
                  onPressed: () async {
                    final me = ref.read(myProfileProvider).value;
                    if (uid == null) return;
                    try {
                      await ref.read(groupsRepositoryProvider).sendMessage(
                            groupId: group.id,
                            uid: uid,
                            name: me?.displayName ?? '',
                            text: trf('📍 How about meeting at {place}? It\'s about halfway for everyone.',
                                {'place': p.shownName}),
                          );
                      if (context.mounted) showMessage(context, tr('Suggested in the chat'));
                    } catch (e) {
                      if (context.mounted) showError(context, e);
                    }
                  },
                  child: Text(tr('Suggest')),
                ),
        ),
    ]);
  }
}
