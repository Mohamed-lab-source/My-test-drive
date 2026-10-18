import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/extras.dart' show reviewTextProblem;
import '../../app/i18n.dart';
import '../profile/community_rules.dart';
import '../../app/local_prefs.dart';
import '../../app/review.dart' show happyMoment;
import '../../app/share_texts.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/review.dart';
import '../../models/social.dart';
import '../../widgets/common.dart';
import '../../widgets/share_card.dart';
import 'challenge_card.dart';

/// The newest reviews of a place, plus each reviewer's numbers (for levels).
final placeReviewsProvider = FutureProvider.autoDispose.family<(List<Review>, Map<String, ReviewerStats>), String>((
  ref,
  placeId,
) async {
  final repo = ref.watch(reviewsRepositoryProvider);
  final list = await repo.latest(placeId);
  final stats = list.isEmpty ? const <String, ReviewerStats>{} : await repo.reviewerStatsFor(list.map((r) => r.uid));
  return (list, stats);
});

final myReviewsProvider = FutureProvider.autoDispose<List<Review>>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Future.value(const []);
  return ref.watch(reviewsRepositoryProvider).mine(uid);
});

/// Stars as text, e.g. "★★★★☆".
String starsText(int n) => '${'★' * n}${'☆' * (5 - n)}';

/// The reviews part of a place page: Khroga stars, write/edit, and the
/// newest reviews on request (to keep database reads low).
class PlaceReviewsSection extends ConsumerStatefulWidget {
  const PlaceReviewsSection({super.key, required this.place});

  final Place place;

  @override
  ConsumerState<PlaceReviewsSection> createState() => _PlaceReviewsSectionState();
}

class _PlaceReviewsSectionState extends ConsumerState<PlaceReviewsSection> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final stats = ref.watch(placeStatsProvider(widget.place.id)).value;
    final avg = stats?.average;
    return Card(
      margin: const EdgeInsets.only(top: KSpace.md),
      child: Padding(
        padding: const EdgeInsets.all(KSpace.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(tr('Khroga reviews'), style: text.titleMedium)),
                if (avg != null)
                  Text(
                    '★ ${avg.toStringAsFixed(1)}',
                    style: text.titleMedium?.copyWith(color: context.k.accent, fontWeight: FontWeight.w800),
                  ),
              ],
            ),
            Text(
              stats == null || stats.count == 0
                  ? tr('No reviews yet. Be the first and earn points!')
                  : trf('{n} reviews from Khroga users', {'n': stats.count}),
              style: text.bodySmall?.copyWith(color: context.k.inkMuted),
            ),
            const SizedBox(height: KSpace.sm),
            Wrap(
              spacing: KSpace.sm,
              runSpacing: KSpace.sm,
              children: [
                FilledButton.icon(
                  icon: const Icon(Icons.rate_review_outlined),
                  label: Text(tr('Write a review')),
                  onPressed: () => context.push('/review/${Uri.encodeComponent(widget.place.id)}'),
                ),
                if ((stats?.count ?? 0) > 0)
                  OutlinedButton(
                    onPressed: () => setState(() => _open = !_open),
                    child: Text(_open ? tr('Hide reviews') : tr('Read reviews')),
                  ),
              ],
            ),
            if (_open) _ReviewList(place: widget.place),
          ],
        ),
      ),
    );
  }
}

enum _Sort { newest, best, worst }

class _ReviewList extends ConsumerStatefulWidget {
  const _ReviewList({required this.place});

  final Place place;

  @override
  ConsumerState<_ReviewList> createState() => _ReviewListState();
}

class _ReviewListState extends ConsumerState<_ReviewList> {
  _Sort _sort = _Sort.newest;
  bool _wordsOnly = false;

  Place get place => widget.place;

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(placeReviewsProvider(place.id));
    final blocked = ref.watch(blockedUsersProvider);
    final text = Theme.of(context).textTheme;
    return AsyncView(
      value: data,
      onRetry: () => ref.invalidate(placeReviewsProvider(place.id)),
      builder: (d) {
        final (all, stats) = d;
        final list = all.where((r) => !blocked.containsKey(r.uid)).toList();
        final shown = list.where((r) => !_wordsOnly || r.text.trim().isNotEmpty).toList();
        if (_sort == _Sort.best) shown.sort((a, b) => b.stars.compareTo(a.stars));
        if (_sort == _Sort.worst) shown.sort((a, b) => a.stars.compareTo(b.stars));
        final again = answerCounts(list, 'again');
        final againTotal = (again['yes'] ?? 0) + (again['no'] ?? 0);
        final goodFor = answerCounts(list, 'goodFor').entries.toList()..sort((a, b) => b.value.compareTo(a.value));
        final spend = typicalSpend(list);
        final goodForQ = reviewQuestionsFor(place.category).where((q) => q.key == 'goodFor').firstOrNull;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: KSpace.sm),
            if (againTotal > 0) Text(trf('👍 {n} of {t} would go again', {'n': again['yes'] ?? 0, 't': againTotal})),
            if (goodFor.isNotEmpty && goodForQ != null)
              Text(
                trf('👥 Most say it\'s good for: {list}', {
                  'list': goodFor.take(3).map((e) => tr(goodForQ.options[e.key] ?? e.key)).join(', '),
                }),
              ),
            if (spend != null)
              Text(
                trf('💵 Most spent {range} per person ({n} of {t} reviews)', {
                  'range': tr(spendOptions[spend.$1]!),
                  'n': spend.$2,
                  't': spend.$3,
                }),
              ),
            if (list.length >= 20) Text(tr('Showing the newest 20 reviews.'), style: text.bodySmall),
            if (list.length >= 2)
              Wrap(
                spacing: KSpace.sm,
                children: [
                  for (final (s, label) in [
                    (_Sort.newest, tr('Newest')),
                    (_Sort.best, tr('Highest')),
                    (_Sort.worst, tr('Lowest')),
                  ])
                    ChoiceChip(
                      label: Text(label),
                      selected: _sort == s,
                      showCheckmark: false,
                      onSelected: (_) => setState(() => _sort = s),
                    ),
                  FilterChip(
                    label: Text(tr('With words')),
                    selected: _wordsOnly,
                    onSelected: (v) => setState(() => _wordsOnly = v),
                  ),
                ],
              ),
            for (final r in shown) _ReviewTile(review: r, stats: stats[r.uid], place: place),
          ],
        );
      },
    );
  }
}

class _ReviewTile extends ConsumerWidget {
  const _ReviewTile({required this.review, required this.stats, required this.place});

  final Review review;
  final ReviewerStats? stats;
  final Place place;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final me = ref.watch(uidProvider);
    final questions = {for (final q in reviewQuestionsFor(review.category)) q.key: q};
    return Padding(
      padding: const EdgeInsets.only(top: KSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(radius: 16, child: Text(review.name.isEmpty ? '?' : review.name.characters.first)),
              const SizedBox(width: KSpace.sm),
              Expanded(
                child: InkWell(
                  onTap: () => context.push('/person/${review.uid}'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(review.name, style: text.titleSmall),
                      if (stats != null)
                        Text(guideTitle(stats!), style: text.labelSmall?.copyWith(color: context.k.accent)),
                    ],
                  ),
                ),
              ),
              if (review.uid != me)
                PopupMenuButton<String>(
                  onSelected: (v) async {
                    if (v == 'block') {
                      ref.read(blockedUsersProvider.notifier).set(review.uid, review.name);
                      return;
                    }
                    try {
                      await ref
                          .read(safetyRepositoryProvider)
                          .reportReview(
                            by: me ?? '',
                            review: review,
                            reason: v == 'fake' ? 'Fake or spam' : 'Rude or hateful',
                          );
                      if (context.mounted) {
                        showMessage(context, tr('Thanks. We\'ll look at it.'));
                      }
                    } catch (e) {
                      if (context.mounted) showError(context, e);
                    }
                  },
                  itemBuilder: (_) => [
                    PopupMenuItem(value: 'fake', child: Text(tr('Report: fake or spam'))),
                    PopupMenuItem(value: 'rude', child: Text(tr('Report: rude or hateful'))),
                    PopupMenuItem(value: 'block', child: Text(tr('Block this person'))),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            [
              starsText(review.stars),
              if (review.updatedAt != null) DateFormat('d MMM y').format(review.updatedAt!),
            ].join('  ·  '),
            style: TextStyle(color: context.k.accent),
          ),
          if (review.text.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(review.text)),
          if (review.answers.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final e in review.answers.entries)
                    if (questions[e.key] case final q?)
                      Pill('${q.text} ${e.value.split(',').map((a) => tr(q.options[a] ?? a)).join(', ')}'),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Write or change your review: stars, quick questions, a few words.
class ReviewFormScreen extends ConsumerStatefulWidget {
  const ReviewFormScreen({super.key, required this.placeId});

  final String placeId;

  @override
  ConsumerState<ReviewFormScreen> createState() => _ReviewFormScreenState();
}

class _ReviewFormScreenState extends ConsumerState<ReviewFormScreen> {
  int _stars = 0;
  final Map<String, Set<String>> _answers = {};
  final _text = TextEditingController();
  bool _loaded = false;
  bool _existing = false;
  bool _leaving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final uid = ref.read(uidProvider);
    if (uid != null) {
      try {
        final r = await ref.read(reviewsRepositoryProvider).myReview(widget.placeId, uid);
        if (r != null) {
          _existing = true;
          _stars = r.stars;
          _text.text = r.text;
          for (final e in r.answers.entries) {
            _answers[e.key] = e.value.split(',').where((s) => s.isNotEmpty).toSet();
          }
        }
      } catch (_) {}
    }
    if (mounted) setState(() => _loaded = true);
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Map<String, String> get _answerMap => {
    for (final e in _answers.entries)
      if (e.value.isNotEmpty) e.key: e.value.join(','),
  };

  Review _draft(Place p) => Review(
    placeId: p.id,
    uid: '',
    name: '',
    stars: _stars.clamp(1, 5),
    category: p.category,
    text: _text.text.trim(),
    answers: _answerMap,
  );

  Future<void> _submit(Place place) async {
    final uid = ref.read(uidProvider);
    final name = ref.read(myProfileProvider).value?.displayName ?? '';
    if (uid == null) return;
    if (name.isEmpty) {
      showMessage(context, tr('Add your name in Profile first; reviews show it.'));
      return;
    }
    if (_stars == 0) {
      showMessage(context, tr('Tap the stars first.'));
      return;
    }
    if (reviewTextProblem(_text.text) case final problem?) {
      showMessage(context, problem);
      return;
    }
    if (!await ensureCommunityRules(context, ref)) return;
    try {
      final (before, after) = await ref
          .read(reviewsRepositoryProvider)
          .save(uid: uid, name: name, place: place, stars: _stars, text: _text.text, answers: _answerMap);
      ref.invalidate(placeStatsProvider(place.id));
      ref.invalidate(placeReviewsProvider(place.id));
      ref.invalidate(myReviewerStatsProvider);
      ref.invalidate(myWeekReviewsProvider);
      happyMoment(ref);
      if (!mounted) return;
      await _celebrate(before, after);
      if (mounted) {
        setState(() => _leaving = true);
        context.pop();
      }
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _celebrate(ReviewerStats before, ReviewerStats after) {
    final gained = after.points - before.points;
    final oldTier = tierFor(before.points), newTier = tierFor(after.points);
    final newBadges = expertBadgesFor(after).where((b) => !expertBadgesFor(before).contains(b)).toList();
    final next = nextTier(after.points);
    final levelUp = newTier.minPoints > oldTier.minPoints;
    return showDialog<void>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(
          levelUp
              ? trf('{emoji} You\'re now a {tier}!', {'emoji': newTier.emoji, 'tier': newTier.name})
              : tr('Thanks for your review!'),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (gained > 0) Text(trf('+{n} points · {total} in total', {'n': gained, 'total': after.points})),
            if (gained <= 0) Text(trf('{total} points in total', {'total': after.points})),
            for (final b in newBadges) Text(trf('{emoji} New badge: {name}', {'emoji': b.emoji, 'name': b.name})),
            if (next != null)
              Text(
                trf('{n} more points to {tier}', {'n': next.$2, 'tier': next.$1.name}),
                style: Theme.of(c).textTheme.bodySmall,
              ),
          ],
        ),
        actions: [
          if (levelUp || newBadges.isNotEmpty)
            TextButton(
              onPressed: () {
                Navigator.pop(c);
                sharePictureCard(context, guideStoryCard(after), appInviteText());
              },
              child: Text(tr('Share')),
            ),
          FilledButton(onPressed: () => Navigator.pop(c), child: Text(tr('Done'))),
        ],
      ),
    );
  }

  Future<void> _delete() async {
    final uid = ref.read(uidProvider);
    if (uid == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(tr('Delete your review?')),
        content: Text(tr('Its points are removed too.')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr('Cancel'))),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr('Delete'))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(reviewsRepositoryProvider).delete(uid, widget.placeId);
      ref.invalidate(placeStatsProvider(widget.placeId));
      ref.invalidate(placeReviewsProvider(widget.placeId));
      ref.invalidate(myReviewerStatsProvider);
      if (mounted) {
        setState(() => _leaving = true);
        context.pop();
      }
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final place = ref.watch(placeProvider(widget.placeId));
    final isGuest = ref.watch(authStateProvider).value?.isAnonymous ?? true;
    final text = Theme.of(context).textTheme;
    final dirty = _loaded && (_stars > 0 || _text.text.trim().isNotEmpty || _answers.values.any((v) => v.isNotEmpty));
    return PopScope(
      canPop: !dirty || _leaving,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final leave = await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            title: Text(tr('Leave without posting?')),
            content: Text(tr('Your review isn\'t posted yet. If you leave, your answers are lost.')),
            actions: [
              TextButton(onPressed: () => Navigator.pop(c, true), child: Text(tr('Leave'))),
              FilledButton(onPressed: () => Navigator.pop(c, false), child: Text(tr('Keep writing'))),
            ],
          ),
        );
        if (leave == true && context.mounted) {
          setState(() => _leaving = true);
          context.pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(_existing ? tr('Edit your review') : tr('Write a review')),
          actions: [
            if (_existing)
              IconButton(tooltip: tr('Delete'), icon: const Icon(Icons.delete_outline), onPressed: _delete),
          ],
        ),
        body: AsyncView<Place?>(
          value: place,
          builder: (p) {
            if (p == null) {
              return EmptyState(emoji: '🤷', title: tr('Place not found'));
            }
            if (isGuest) {
              return EmptyState(
                emoji: '✍️',
                title: tr('Sign in to write reviews'),
                message: tr('Reviews show your name, so they need a Google account. Sign in from Profile.'),
              );
            }
            if (!_loaded) {
              return const Center(child: CircularProgressIndicator());
            }
            final draft = _draft(p);
            return ListView(
              padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, 120),
              children: [
                Text(p.shownName, style: text.headlineSmall),
                Text(
                  [p.kindLabel ?? Categories.label(p.category), ?p.area].join(' · '),
                  style: text.bodyMedium?.copyWith(color: context.k.inkMuted),
                ),
                const SizedBox(height: KSpace.md),
                Text(tr('Your rating'), style: text.titleMedium),
                Row(
                  children: [
                    for (var i = 1; i <= 5; i++)
                      IconButton(
                        iconSize: 38,
                        tooltip: trf('{n} stars', {'n': i}),
                        onPressed: () => setState(() => _stars = i),
                        icon: Icon(
                          i <= _stars ? Icons.star_rounded : Icons.star_outline_rounded,
                          color: context.k.accent,
                        ),
                      ),
                  ],
                ),
                for (final q in reviewQuestionsFor(p.category)) ...[
                  const SizedBox(height: KSpace.sm),
                  Text(q.text, style: text.titleSmall),
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: KSpace.sm,
                    runSpacing: KSpace.sm,
                    children: [
                      for (final o in q.options.entries)
                        q.multi
                            ? FilterChip(
                                label: Text(tr(o.value)),
                                selected: _answers[q.key]?.contains(o.key) ?? false,
                                onSelected: (on) => setState(() {
                                  final s = _answers.putIfAbsent(q.key, () => {});
                                  on ? s.add(o.key) : s.remove(o.key);
                                }),
                              )
                            : ChoiceChip(
                                label: Text(tr(o.value)),
                                selected: _answers[q.key]?.contains(o.key) ?? false,
                                showCheckmark: false,
                                onSelected: (on) => setState(() => _answers[q.key] = on ? {o.key} : {}),
                              ),
                    ],
                  ),
                ],
                const SizedBox(height: KSpace.md),
                TextField(
                  controller: _text,
                  maxLines: 5,
                  maxLength: 1000,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    labelText: tr('Tell others about it (optional)'),
                    hintText: tr('What did you like? What should people know before going?'),
                  ),
                ),
                Card(
                  color: context.k.accentSoft,
                  child: ListTile(
                    leading: const Text('🏆', style: TextStyle(fontSize: 24)),
                    title: Text(trf('This review earns {n} points', {'n': draft.points})),
                    subtitle: Text(
                      draft.isDetailed
                          ? tr('Detailed review: double points!')
                          : tr('Answer 3+ questions and write 50+ letters for double points.'),
                    ),
                  ),
                ),
                const SizedBox(height: KSpace.sm),
                Text(
                  tr('Reviews are public with your name. Be honest and kind; no ads or personal details.'),
                  style: text.bodySmall,
                ),
                const SizedBox(height: KSpace.md),
                BusyButton(
                  label: _existing ? tr('Update review') : tr('Post review'),
                  icon: Icons.send,
                  onPressed: () => _submit(p),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Your level as a story-size picture.
Widget guideStoryCard(ReviewerStats s) {
  final tier = tierFor(s.points);
  return StoryCard(
    emoji: tier.emoji,
    title: trf("I'm a {tier} on Khroga", {'tier': tier.name}),
    subtitle: trf('{n} points', {'n': s.points}),
    lines: [
      ('✍️', trf('{n} reviews', {'n': s.total}), null),
      for (final b in expertBadgesFor(s)) (b.emoji, b.name, null),
    ],
  );
}

/// Your guide level, badges, reviews, and how you compare with friends.
class GuideScreen extends ConsumerWidget {
  const GuideScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final stats = ref.watch(myReviewerStatsProvider);
    final mine = ref.watch(myReviewsProvider);
    final places = ref.watch(allPlacesProvider).value ?? const <Place>[];
    final byId = {for (final p in places) p.id: p};
    return Scaffold(
      appBar: AppBar(
        title: Text(tr('Khroga Guide')),
        actions: [
          if (stats.value != null)
            IconButton(
              tooltip: tr('Share as a picture'),
              icon: const Icon(Icons.ios_share),
              onPressed: () => sharePictureCard(context, guideStoryCard(stats.value!), appInviteText()),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(myReviewerStatsProvider);
          ref.invalidate(myReviewsProvider);
        },
        child: AsyncView<ReviewerStats>(
          value: stats,
          builder: (s) {
            final tier = tierFor(s.points);
            final next = nextTier(s.points);
            final progress = next == null ? 1.0 : (s.points - tier.minPoints) / (next.$1.minPoints - tier.minPoints);
            return ListView(
              padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(KSpace.md),
                    child: Column(
                      children: [
                        Text(tier.emoji, style: const TextStyle(fontSize: 52)),
                        Text(tier.name, style: text.headlineSmall),
                        Text(trf('{n} points · {r} reviews', {'n': s.points, 'r': s.total})),
                        const SizedBox(height: KSpace.sm),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: LinearProgressIndicator(value: progress.clamp(0, 1), minHeight: 10),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          next == null
                              ? tr('You reached the top level!')
                              : trf('{n} more points to {tier}', {'n': next.$2, 'tier': next.$1.name}),
                          style: text.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
                const ChallengeCard(),
                SectionTitle(tr('Levels')),
                for (final t in guideTiers)
                  ListTile(
                    dense: true,
                    leading: Text(t.emoji, style: const TextStyle(fontSize: 22)),
                    title: Text(
                      t.name,
                      style: t == tier ? TextStyle(color: context.k.accent, fontWeight: FontWeight.w800) : null,
                    ),
                    trailing: Text(trf('{n} points', {'n': t.minPoints})),
                  ),
                SectionTitle(tr('Expert badges')),
                Text(
                  tr('Earn one when enough of your reviews (and at least half of them) are about one kind of place.'),
                  style: text.bodySmall,
                ),
                for (final b in expertBadges)
                  ListTile(
                    dense: true,
                    leading: Text(b.emoji, style: const TextStyle(fontSize: 22)),
                    title: Text(b.name),
                    subtitle: Text(
                      trf('{n} of {t} reviews', {'n': reviewsFor(b, s).clamp(0, b.needed), 't': b.needed}),
                    ),
                    trailing: expertBadgesFor(s).contains(b)
                        ? Icon(Icons.verified, color: context.k.accent)
                        : const Icon(Icons.lock_outline),
                  ),
                SectionTitle(tr('How to earn points')),
                Text(
                  tr(
                    '• 10 points for every review\n• 10 more for a detailed one: 3+ answers and 50+ letters\n'
                    '• One review per place; you can update it any time',
                  ),
                ),
                const _FriendsBoard(),
                SectionTitle(tr('Your reviews')),
                mine.when(
                  loading: () => const LinearProgressIndicator(),
                  error: (e, _) => Text(friendlyError(e)),
                  data: (list) => list.isEmpty
                      ? Text(tr('No reviews yet. Open any place you\'ve been to and tap "Write a review".'))
                      : Column(
                          children: [
                            for (final r in list)
                              ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: Text(Categories.emoji(r.category), style: const TextStyle(fontSize: 22)),
                                title: Text(byId[r.placeId]?.shownName ?? tr('A place no longer on the map')),
                                subtitle: Text(starsText(r.stars)),
                                trailing: Text(trf('+{n}', {'n': r.points})),
                                onTap: byId[r.placeId] == null ? null : () => context.push('/place/${r.placeId}'),
                              ),
                          ],
                        ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// You and your friends, by points.
class _FriendsBoard extends ConsumerWidget {
  const _FriendsBoard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final uid = ref.watch(uidProvider);
    final friends = ref.watch(friendUidsProvider);
    if (uid == null || friends.isEmpty) return const SizedBox.shrink();
    final ids = [uid, ...friends.take(29)];
    final stats = ref.watch(_boardProvider(profilesKey(ids)));
    final profiles = ref.watch(profilesProvider(profilesKey(ids))).value ?? const <String, PublicProfile>{};
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(tr('You and your friends')),
        stats.when(
          loading: () => const LinearProgressIndicator(),
          error: (e, _) => Text(friendlyError(e)),
          data: (m) {
            final rows = [for (final id in ids) (id, m[id] ?? const ReviewerStats())]
              ..sort((a, b) => b.$2.points.compareTo(a.$2.points));
            return Column(
              children: [
                for (var i = 0; i < rows.length; i++)
                  ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(radius: 14, child: Text('${i + 1}')),
                    title: Text(
                      rows[i].$1 == uid ? tr('You') : (profiles[rows[i].$1]?.displayName ?? '…'),
                      style: rows[i].$1 == uid ? const TextStyle(fontWeight: FontWeight.w800) : null,
                    ),
                    subtitle: Text(guideTitle(rows[i].$2)),
                    trailing: Text(trf('{n} points', {'n': rows[i].$2.points})),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

final _boardProvider = FutureProvider.autoDispose.family<Map<String, ReviewerStats>, String>(
  (ref, key) =>
      key.isEmpty ? Future.value(const {}) : ref.watch(reviewsRepositoryProvider).reviewerStatsFor(key.split(',')),
);
