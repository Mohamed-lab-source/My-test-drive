import 'dart:math' as math;

import 'package:flutter/material.dart';
import '../../widgets/large_title.dart';
import '../../widgets/motion.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/extras.dart';
import '../../app/fun.dart' show makeTeams, conversationStarters, emergencyNumbers, phrasebook, splitByItems;
import '../../widgets/launchers.dart' show callPhone;
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import '../../widgets/common.dart' show showMessage, SectionTitle;
import 'more_tools.dart';
import '../../app/helpers.dart' show billTotal, walkingMinutes, tapFeedback, normalizeSearch;
import '../../app/i18n.dart';
import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';

/// Little helpers for outings: decide for us, coin flip, who pays, sunset
/// times and public holidays. All of it works offline.
class ToolsScreen extends StatelessWidget {
  const ToolsScreen({super.key});

  /// Every tool: section, emoji, short name, and the tool itself (opened in a sheet).
  static List<(String, String, String, Widget)> _tools() {
    final play = tr('Decide and play'), money = tr('Money'), time = tr('Time and place'), info = tr('Good to know');
    return [
      (play, '🎯', tr('Decide for us'), const _DecideCard()),
      (play, '🪙', tr('Flip a coin'), const _CoinCard()),
      (play, '🙋', tr('Who pays? Who picks?'), const _WhoCard()),
      (play, '🧑‍🤝‍🧑', tr('Make teams'), const _TeamsCard()),
      (play, '🎲', tr('Roll the dice'), const _DiceCard()),
      (play, '🔢', tr('Pick a number'), const PickNumberCard()),
      (play, '🔀', tr('Turn order'), const TurnOrderCard()),
      (play, '🍾', tr('Spin the bottle'), const BottleCard()),
      (play, '✊', tr('Rock paper scissors'), const RpsCard()),
      (play, '🤔', tr('Would you rather…'), const WouldYouRatherCard()),
      (play, '🎭', tr('Charades'), const CharadesCard()),
      (play, '💬', tr('Conversation starters'), const _StarterCard()),
      (play, '🏆', tr('Score keeper'), const ScoreCard()),
      (play, '⏱️', tr('Game timer'), const GameTimerCard()),
      (play, '⏲️', tr('Stopwatch'), const StopwatchCard()),
      (play, '🏷️', tr('Group name ideas'), const GroupNamesCard()),
      (money, '🧾', tr('Split a bill'), const _SplitCard()),
      (money, '🧮', tr('Split by what each ordered'), const _SplitByItemsCard()),
      (money, '💁', tr('Tip calculator'), const TipCard()),
      (money, '🚗', tr('Car trip split'), const CarSplitCard()),
      (time, '🚶', tr('How long to walk?'), const _WalkCard()),
      (time, '👟', tr('Steps for a walk'), const WalkStatsCard()),
      (time, '🚪', tr('When should I leave?'), const LeaveAtCard()),
      (time, '🌤️', tr('Weather this week'), const _WeekCard()),
      (time, '🌇', tr('Sunrise and sunset today'), const _SunCard()),
      (time, '🕌', tr('Prayer times today'), const _PrayerCard()),
      (time, '🧭', tr('Qibla direction'), const QiblaCard()),
      (time, '🌙', tr('Hijri date'), const HijriCard()),
      (time, '⏳', tr('Coming up'), const _CountdownCard()),
      (time, '📆', tr('My countdowns'), const MyDatesCard()),
      (time, '➕', tr('My plus code'), const PlusCodeCard()),
      (info, '🇪🇬', tr('Holidays'), const _HolidaysCard()),
      (info, '🗣️', tr('Arabic phrases'), const _PhrasebookCard()),
      (info, '📏', tr('Unit converter'), const ConvertCard()),
      (info, '🆘', tr('Emergency numbers'), const _EmergencyCard()),
    ];
  }

  static void _open(BuildContext context, Widget tool) => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (sheet) => DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.75,
          minChildSize: 0.4,
          maxChildSize: 0.95,
          builder: (_, controller) => ListView(
            controller: controller,
            padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
            children: [tool],
          ),
        ),
      );

  @override
  Widget build(BuildContext context) => const _ToolsBody();
}

/// The grid: search, your starred tools, the ones you opened lately, then
/// every tool by section. Stars and "lately" are kept on this phone.
class _ToolsBody extends ConsumerStatefulWidget {
  const _ToolsBody();

  @override
  ConsumerState<_ToolsBody> createState() => _ToolsBodyState();
}

class _ToolsBodyState extends ConsumerState<_ToolsBody> {
  String _query = '';

  List<String> _listPref(String key) =>
      (ref.watch(pocketPrefsProvider)[key] ?? '').split('|').where((s) => s.isNotEmpty).toList();

  void _opened(String name, Widget tool) {
    final recent = [name, ..._listPref('tools.recent').where((n) => n != name)].take(4).join('|');
    final pref = ref.read(pocketPrefsProvider.notifier);
    pref.set('tools.recent', recent);
    final key = tool.runtimeType.toString();
    final seen = _listPref('tools.seen');
    if (!seen.contains(key)) pref.set('tools.seen', [...seen, key].join('|'));
  }

  /// Tools added in 2.0 get a small "New" mark until you open them once.
  static const _newTools = {
    'PickNumberCard', 'TurnOrderCard', 'BottleCard', 'RpsCard', 'WouldYouRatherCard', 'CharadesCard',
    'ScoreCard', 'GameTimerCard', 'StopwatchCard', 'GroupNamesCard', 'TipCard', 'CarSplitCard',
    'WalkStatsCard', 'LeaveAtCard', 'QiblaCard', 'HijriCard', 'MyDatesCard', 'PlusCodeCard', 'ConvertCard',
  };

  void _toggleStar(String name) {
    final stars = _listPref('tools.stars');
    final next = stars.contains(name) ? (stars..remove(name)) : [...stars, name];
    ref.read(pocketPrefsProvider.notifier).set('tools.stars', next.join('|'));
    showMessage(context, stars.contains(name) ? tr('Removed from starred tools') : tr('Added to starred tools'));
  }

  @override
  Widget build(BuildContext context) {
    final tools = ToolsScreen._tools();
    final k = context.k;
    final text = Theme.of(context).textTheme;
    final stars = _listPref('tools.stars');
    final recent = _listPref('tools.recent');
    final seen = _listPref('tools.seen');
    final q = normalizeSearch(_query);
    final shown = q.isEmpty ? tools : tools.where((t) => normalizeSearch(t.$3).contains(q)).toList();
    final sections = <String, List<(String, String, String, Widget)>>{};
    if (q.isEmpty) {
      final starred = [for (final n in stars) ...tools.where((t) => t.$3 == n)];
      final lately = [for (final n in recent) ...tools.where((t) => t.$3 == n && !stars.contains(n))];
      if (starred.isNotEmpty) sections[tr('Starred')] = starred;
      if (lately.isNotEmpty) sections[tr('Used lately')] = lately;
    }
    for (final t in shown) {
      (sections[q.isEmpty ? t.$1 : tr('Results')] ??= []).add(t);
    }

    Widget tile((String, String, String, Widget) t, double w, int i) => FadeSlideIn(
          index: i < 9 ? i : 0,
          child: SizedBox(
            width: w,
            height: 70 + 42 * MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 2.2),
            child: Pressable(
              child: Card(
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () {
                    _opened(t.$3, t.$4);
                    ToolsScreen._open(context, t.$4);
                  },
                  onLongPress: () => _toggleStar(t.$3),
                  child: Stack(children: [
                    Padding(
                      padding: const EdgeInsets.all(KSpace.sm),
                      child: Center(
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          Container(
                            width: 46,
                            height: 46,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: k.surfaceHigh, borderRadius: BorderRadius.circular(14)),
                            child: Text(t.$2, style: const TextStyle(fontSize: 24)),
                          ),
                          const SizedBox(height: 6),
                          Text(t.$3,
                              textAlign: TextAlign.center,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: text.labelMedium?.copyWith(height: 1.2)),
                        ]),
                      ),
                    ),
                    if (_newTools.contains(t.$4.runtimeType.toString()) &&
                        !seen.contains(t.$4.runtimeType.toString()))
                      PositionedDirectional(
                        top: 6,
                        start: 6,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: ShapeDecoration(color: k.signal, shape: const StadiumBorder()),
                          child: Text(tr('New'),
                              style: const TextStyle(color: Color(0xFFFFFFFF), fontSize: 10, fontWeight: FontWeight.w700)),
                        ),
                      ),
                    if (stars.contains(t.$3))
                      PositionedDirectional(
                        top: 6,
                        end: 6,
                        child: Icon(Icons.star_rounded, size: 16, color: k.signal),
                      ),
                  ]),
                ),
              ),
            ),
          ),
        );

    return KScaffold(
      title: Text(tr('Outing tools')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
        children: [
          TextField(
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search),
              hintText: trf('Search {n} tools', {'n': tools.length}),
              isDense: true,
            ),
            onChanged: (v) => setState(() => _query = v),
          ),
          const SizedBox(height: KSpace.sm),
          Text(tr('Tap a tool to open it. Press and hold to star it.'), style: text.bodySmall),
          if (shown.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: KSpace.lg),
              child: Text(tr('No tool with that name.'), textAlign: TextAlign.center),
            ),
          for (final e in sections.entries) ...[
            SectionTitle(e.key),
            LayoutBuilder(builder: (context, c) {
              final perRow = c.maxWidth > 520 ? 4 : 3;
              final w = (c.maxWidth - (perRow - 1) * KSpace.sm) / perRow;
              return Wrap(spacing: KSpace.sm, runSpacing: KSpace.sm, children: [
                for (final (i, t) in e.value.indexed) tile(t, w, i),
              ]);
            }),
          ],
        ],
      ),
    );
  }
}

class _ToolCard extends StatelessWidget {
  const _ToolCard({required this.emoji, required this.title, required this.child});

  final String emoji;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(top: KSpace.md),
        child: Padding(
          padding: const EdgeInsets.all(KSpace.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Text(emoji, style: const TextStyle(fontSize: 24)),
                const SizedBox(width: KSpace.sm),
                Expanded(child: Text(title, style: Theme.of(context).textTheme.titleMedium)),
              ]),
              const SizedBox(height: KSpace.sm),
              child,
            ],
          ),
        ),
      );
}

enum _From { favorites, lists, openNow, notVisited }

/// "We can't decide": a random real place from your favorites, your lists,
/// places open now, or places you haven't been to.
class _DecideCard extends ConsumerStatefulWidget {
  const _DecideCard();

  @override
  ConsumerState<_DecideCard> createState() => _DecideCardState();
}

class _DecideCardState extends ConsumerState<_DecideCard> {
  _From _from = _From.favorites;
  String? _category;
  Place? _picked;
  String? _empty;
  final _random = math.Random();

  Future<void> _spin() async {
    tapFeedback(ref.read(phoneSettingsProvider).haptics);
    final city = ref.read(cityProvider);
    final now = DateTime.now();
    List<Place> pool;
    switch (_from) {
      case _From.favorites:
        pool = await ref.read(favoritePlacesProvider.future);
      case _From.lists:
        final ids = ref.read(placeListsProvider).values.expand((l) => l).toSet();
        final all = await ref.read(allPlacesProvider.future);
        pool = all.where((p) => ids.contains(p.id)).toList();
      case _From.openNow:
        pool = (await ref.read(placesInCityProvider(city).future))
            .where((p) => p.category != 'shop' && p.isOpenAt(now) == true)
            .toList();
      case _From.notVisited:
        final been = (ref.read(visitedIdsProvider).value ?? const <String>[]).toSet();
        pool = (await ref.read(placesInCityProvider(city).future))
            .where((p) => p.category != 'shop' && !been.contains(p.id) && p.quality >= 2)
            .toList();
    }
    if (_category != null) pool = pool.where((p) => p.category == _category).toList();
    if (!mounted) return;
    setState(() {
      _picked = randomOf(pool, _random);
      _empty = _picked == null ? tr('Nothing to pick from yet. Try another choice.') : null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final labels = {
      _From.favorites: tr('My favorites'),
      _From.lists: tr('My lists'),
      _From.openNow: tr('Open now'),
      _From.notVisited: tr("Places I haven't been"),
    };
    return _ToolCard(
      emoji: '🎯',
      title: tr("Decide for us"),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(spacing: KSpace.sm, runSpacing: KSpace.sm, children: [
            for (final f in _From.values)
              ChoiceChip(
                label: Text(labels[f]!),
                selected: _from == f,
                showCheckmark: false,
                onSelected: (_) => setState(() => _from = f),
              ),
          ]),
          const SizedBox(height: KSpace.sm),
          DropdownButton<String?>(
            value: _category,
            isExpanded: true,
            items: [
              DropdownMenuItem(value: null, child: Text(tr('Any kind of place'))),
              for (final e in Categories.all.keys)
                DropdownMenuItem(value: e, child: Text('${Categories.emoji(e)} ${Categories.label(e)}')),
            ],
            onChanged: (v) => setState(() => _category = v),
          ),
          const SizedBox(height: KSpace.sm),
          FilledButton.icon(
            icon: const Icon(Icons.casino_outlined),
            label: Text(_picked == null ? tr('Pick one') : tr('Pick again')),
            onPressed: _spin,
          ),
          if (_empty != null)
            Padding(padding: const EdgeInsets.only(top: KSpace.sm), child: Text(_empty!)),
          if (_picked != null)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Text(Categories.emoji(_picked!.category), style: const TextStyle(fontSize: 28)),
              title: Text(_picked!.shownName),
              subtitle: Text([_picked!.kindLabel ?? Categories.label(_picked!.category), ?_picked!.area]
                  .join(' · ')),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/place/${_picked!.id}'),
            ),
        ],
      ),
    );
  }
}

class _CoinCard extends ConsumerStatefulWidget {
  const _CoinCard();

  @override
  ConsumerState<_CoinCard> createState() => _CoinCardState();
}

class _CoinCardState extends ConsumerState<_CoinCard> {
  String? _side;
  int _flips = 0;
  int _heads = 0;

  @override
  Widget build(BuildContext context) => _ToolCard(
        emoji: '🪙',
        title: tr('Flip a coin'),
        child: Row(children: [
          FilledButton.tonal(
            onPressed: () {
              tapFeedback(ref.read(phoneSettingsProvider).haptics);
              setState(() {
                _flips++;
                final heads = math.Random().nextBool();
                if (heads) _heads++;
                _side = heads ? tr('Heads') : tr('Tails');
              });
            },
            child: Text(tr('Flip')),
          ),
          const SizedBox(width: KSpace.md),
          if (_side != null)
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 250),
              child: Text('$_side!',
                  key: ValueKey(_flips), style: Theme.of(context).textTheme.headlineSmall),
            ),
          const Spacer(),
          if (_flips > 1)
            Text(trf('Heads {h} · Tails {t}', {'h': _heads, 't': _flips - _heads}),
                style: Theme.of(context).textTheme.bodySmall),
        ]),
      );
}

/// Everyone pays for what they ordered, plus a fair share of service, tax
/// and tip. Only the numbers you type.
class _SplitByItemsCard extends StatefulWidget {
  const _SplitByItemsCard();

  @override
  State<_SplitByItemsCard> createState() => _SplitByItemsCardState();
}

class _SplitByItemsCardState extends State<_SplitByItemsCard> {
  final _rows = <(TextEditingController, TextEditingController)>[
    (TextEditingController(), TextEditingController()),
    (TextEditingController(), TextEditingController()),
  ];
  int _extra = 0;

  @override
  void dispose() {
    for (final (a, b) in _rows) {
      a.dispose();
      b.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final ordered = <String, double>{
      for (final (i, (name, amount)) in _rows.indexed)
        if (double.tryParse(amount.text.replaceAll(',', '').trim()) case final a? when a > 0)
          (name.text.trim().isEmpty ? trf('Person {n}', {'n': i + 1}) : name.text.trim()): a,
    };
    final shares = splitByItems(ordered, _extra.toDouble());
    final total = shares.values.fold(0.0, (s, v) => s + v);
    return _ToolCard(
      emoji: '🧾',
      title: tr('Split by what each ordered'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        for (final (i, (name, amount)) in _rows.indexed)
          Row(children: [
            Expanded(
              flex: 3,
              child: TextField(
                controller: name,
                decoration: InputDecoration(hintText: trf('Person {n}', {'n': i + 1}), isDense: true),
                onChanged: (_) => setState(() {}),
              ),
            ),
            const SizedBox(width: KSpace.sm),
            Expanded(
              flex: 2,
              child: TextField(
                controller: amount,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(suffixText: 'EGP', isDense: true),
                onChanged: (_) => setState(() {}),
              ),
            ),
          ]),
        if (_rows.length < 12)
          TextButton.icon(
            onPressed: () => setState(() => _rows.add((TextEditingController(), TextEditingController()))),
            icon: const Icon(Icons.person_add_alt),
            label: Text(tr('Add a person')),
          ),
        Wrap(spacing: KSpace.sm, children: [
          for (final p in [0, 12, 14, 26, 30])
            ChoiceChip(
              label: Text(p == 0 ? tr('Nothing extra') : '+$p%'),
              selected: _extra == p,
              showCheckmark: false,
              onSelected: (_) => setState(() => _extra = p),
            ),
        ]),
        Text(tr('Extras = service, tax and tip on the bill (12% service + 14% VAT = 26%).'), style: text.bodySmall),
        if (shares.isNotEmpty) ...[
          const SizedBox(height: KSpace.sm),
          for (final e in shares.entries) Text('${e.key}: ${trf('{n} EGP', {'n': e.value.ceil()})}', style: text.bodyLarge),
          Text(trf('Total: {n} EGP', {'n': total.ceil()}), style: text.titleMedium),
        ],
      ]),
    );
  }
}

/// Egypt's emergency numbers, one tap to call.
class _EmergencyCard extends StatelessWidget {
  const _EmergencyCard();

  @override
  Widget build(BuildContext context) => _ToolCard(
        emoji: '🆘',
        title: tr('Emergency numbers'),
        child: Wrap(spacing: KSpace.sm, runSpacing: KSpace.sm, children: [
          for (final (emoji, name, number) in emergencyNumbers)
            ActionChip(
              avatar: Text(emoji),
              label: Text('${tr(name)} · $number'),
              onPressed: () => callPhone(number),
            ),
        ]),
      );
}

/// Everyday Egyptian Arabic for visitors, with how to say it.
class _PhrasebookCard extends StatefulWidget {
  const _PhrasebookCard();

  @override
  State<_PhrasebookCard> createState() => _PhrasebookCardState();
}

class _PhrasebookCardState extends State<_PhrasebookCard> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return _ToolCard(
      emoji: '🗣️',
      title: tr('Egyptian Arabic phrases'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        for (final (en, ar, say) in _open ? phrasebook : phrasebook.take(4))
          ListTile(
            contentPadding: EdgeInsets.zero,
            dense: true,
            title: Text(ar, style: text.titleMedium),
            subtitle: Text('$en · $say'),
            trailing: IconButton(
              tooltip: tr('Copy'),
              icon: const Icon(Icons.copy, size: 18),
              onPressed: () {
                Clipboard.setData(ClipboardData(text: ar));
                showMessage(context, tr('Copied'));
              },
            ),
          ),
        TextButton(
          onPressed: () => setState(() => _open = !_open),
          child: Text(_open ? tr('Show less') : trf('Show all {n}', {'n': phrasebook.length})),
        ),
      ]),
    );
  }
}

/// Split friends into teams for games (bowling, quizzes, football…).
class _TeamsCard extends ConsumerStatefulWidget {
  const _TeamsCard();

  @override
  ConsumerState<_TeamsCard> createState() => _TeamsCardState();
}

class _TeamsCardState extends ConsumerState<_TeamsCard> {
  final _names = TextEditingController();
  int _teams = 2;
  List<List<String>> _result = const [];

  @override
  void dispose() {
    _names.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final names = _names.text.split(RegExp(r'[,\n،]')).map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
    return _ToolCard(
      emoji: '🧑‍🤝‍🧑',
      title: tr('Make teams'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        TextField(
          controller: _names,
          decoration: InputDecoration(hintText: tr('Names, separated by commas')),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: KSpace.sm),
        Wrap(spacing: KSpace.sm, runSpacing: KSpace.xs, children: [
          for (final n in [2, 3, 4])
            ChoiceChip(
              label: Text(trf('{n} teams', {'n': n})),
              selected: _teams == n,
              showCheckmark: false,
              onSelected: (_) => setState(() => _teams = n),
            ),
        ]),
        const SizedBox(height: KSpace.sm),
        FilledButton.tonal(
          onPressed: names.length < 2
              ? null
              : () {
                  tapFeedback(ref.read(phoneSettingsProvider).haptics);
                  setState(() => _result = makeTeams(names, _teams, math.Random()));
                },
          child: Text(tr('Shuffle teams')),
        ),
        for (final (i, team) in _result.indexed)
          Padding(
            padding: const EdgeInsets.only(top: KSpace.xs),
            child: Text('${trf('Team {n}', {'n': i + 1})}: ${team.join(', ')}'),
          ),
      ]),
    );
  }
}

/// Roll one or two dice.
class _DiceCard extends ConsumerStatefulWidget {
  const _DiceCard();

  @override
  ConsumerState<_DiceCard> createState() => _DiceCardState();
}

class _DiceCardState extends ConsumerState<_DiceCard> {
  static const _faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  List<int> _roll = const [];
  int _count = 2;

  @override
  Widget build(BuildContext context) => _ToolCard(
        emoji: '🎲',
        title: tr('Roll the dice'),
        child: Row(children: [
          FilledButton.tonal(
            onPressed: () {
              tapFeedback(ref.read(phoneSettingsProvider).haptics);
              final r = math.Random();
              setState(() => _roll = [for (var i = 0; i < _count; i++) r.nextInt(6)]);
            },
            child: Text(tr('Roll')),
          ),
          const SizedBox(width: KSpace.sm),
          TextButton(
            onPressed: () => setState(() {
              _count = _count % 3 + 1;
              _roll = const [];
            }),
            child: Text(_count == 1 ? tr('1 die') : trf('{n} dice', {'n': _count})),
          ),
          const Spacer(),
          if (_roll.isNotEmpty)
            Text(
              '${_roll.map((i) => _faces[i]).join(' ')}  ${_roll.fold<int>(0, (s, i) => s + i + 1)}',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
        ]),
      );
}

/// Questions to get people talking at the table.
class _StarterCard extends StatefulWidget {
  const _StarterCard();

  @override
  State<_StarterCard> createState() => _StarterCardState();
}

class _StarterCardState extends State<_StarterCard> {
  int? _i;

  @override
  Widget build(BuildContext context) => _ToolCard(
        emoji: '💬',
        title: tr('Conversation starters'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (_i != null)
            Padding(
              padding: const EdgeInsets.only(bottom: KSpace.sm),
              child: Text(tr(conversationStarters[_i!]), style: Theme.of(context).textTheme.titleMedium),
            ),
          FilledButton.tonal(
            onPressed: () => setState(() {
              var next = math.Random().nextInt(conversationStarters.length);
              if (next == _i) next = (next + 1) % conversationStarters.length;
              _i = next;
            }),
            child: Text(_i == null ? tr('Give us a question') : tr('Another one')),
          ),
        ]),
      );
}

/// Pick a person at random: who pays, who chooses, who drives.
class _WhoCard extends ConsumerStatefulWidget {
  const _WhoCard();

  @override
  ConsumerState<_WhoCard> createState() => _WhoCardState();
}

class _WhoCardState extends ConsumerState<_WhoCard> {
  final _names = TextEditingController();
  String? _who;

  @override
  void dispose() {
    _names.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _ToolCard(
        emoji: '🙋',
        title: tr('Who pays? Who picks?'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          TextField(
            controller: _names,
            decoration: InputDecoration(
              hintText: tr('Names, separated by commas'),
            ),
          ),
          const SizedBox(height: KSpace.sm),
          FilledButton.tonal(
            onPressed: () {
              final names = _names.text
                  .split(RegExp('[,،\n]'))
                  .map((s) => s.trim())
                  .where((s) => s.isNotEmpty)
                  .toList();
              tapFeedback(ref.read(phoneSettingsProvider).haptics);
              setState(() => _who = names.length < 2
                  ? tr('Type at least two names.')
                  : trf('It\'s {name}! 🎉', {'name': randomOf(names, math.Random())!}));
            },
            child: Text(tr('Pick someone')),
          ),
          if (_who != null)
            Padding(
              padding: const EdgeInsets.only(top: KSpace.sm),
              child: Text(_who!, style: Theme.of(context).textTheme.titleLarge),
            ),
        ]),
      );
}

/// Walking time for a distance (a rough guide, about 4.5 km/h).
class _WalkCard extends StatefulWidget {
  const _WalkCard();

  @override
  State<_WalkCard> createState() => _WalkCardState();
}

class _WalkCardState extends State<_WalkCard> {
  double _km = 1;

  @override
  Widget build(BuildContext context) => _ToolCard(
        emoji: '🚶',
        title: tr('How long to walk?'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Slider(
            value: _km,
            min: 0.2,
            max: 6,
            divisions: 29,
            label: distanceText(_km),
            onChanged: (v) => setState(() => _km = v),
          ),
          Text(trf('{km}: about {time} on foot (rough guide)',
              {'km': distanceText(_km), 'time': durationText(walkingMinutes(_km))})),
        ]),
      );
}

/// Sunrise and sunset today, worked out from the date and each city's spot.
class _SunCard extends StatelessWidget {
  const _SunCard();

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    return _ToolCard(
      emoji: '🌇',
      title: tr('Sunrise and sunset today'),
      child: Column(children: [
        for (final e in cityCenters.entries)
          if (sunTimes(now, e.value.$1, e.value.$2) case final sun?)
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              title: Text(tr(Cities.all[e.key] ?? e.key)),
              trailing: Text('🌅 ${hhmmLocal(sun.sunrise)}   🌇 ${hhmmLocal(sun.sunset)}'),
            ),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: Text(tr('Golden hour is about the last hour before sunset.'),
              style: Theme.of(context).textTheme.bodySmall),
        ),
      ]),
    );
  }
}

class _HolidaysCard extends StatelessWidget {
  const _HolidaysCard();

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final list = [...egyptHolidaysOf(now.year), ...egyptHolidaysOf(now.year + 1)]
        .where((h) => daysUntilText(h.$1, now) != null)
        .take(7)
        .toList();
    return _ToolCard(
      emoji: '🇪🇬',
      title: tr('Coming public holidays'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        for (final (day, name) in list)
          ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            title: Text(name),
            subtitle: Text(DateFormat('EEE d MMM y').format(day)),
            trailing: Text(daysUntilText(day, now) ?? ''),
          ),
        Text(
            tr('Fixed-date holidays only. Islamic holidays follow the moon and are announced each '
                'year, and some holidays are moved to a Thursday.'),
            style: Theme.of(context).textTheme.bodySmall),
      ]),
    );
  }
}

/// The week's weather for your city, with the most comfortable day marked.
class _WeekCard extends ConsumerWidget {
  const _WeekCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final city = ref.watch(cityProvider);
    final week = ref.watch(weekForecastProvider(city));
    return _ToolCard(
      emoji: '🌤️',
      title: trf('Weather this week in {city}', {'city': tr(Cities.all[city] ?? city)}),
      child: week.when(
        loading: () => const LinearProgressIndicator(),
        error: (_, _) => Text(tr("Couldn't get the forecast. Check your internet.")),
        data: (days) {
          if (days.isEmpty) return Text(tr("Couldn't get the forecast. Check your internet."));
          final best = bestDay(days);
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (final d in days)
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: Text(d.rainPct >= 40 ? '🌧️' : d.maxC >= 35 ? '🥵' : '☀️',
                    style: const TextStyle(fontSize: 20)),
                title: Text(DateFormat('EEEE d MMM').format(d.day) +
                    (identical(d, best) ? '  ⭐' : '')),
                trailing: Text(trf('{t}° · {r}% rain', {'t': d.maxC.round(), 'r': d.rainPct})),
              ),
            Text(tr('⭐ = the most comfortable day (least rain, mildest heat).'),
                style: Theme.of(context).textTheme.bodySmall),
            Text(tr('Forecast: Open-Meteo'), style: Theme.of(context).textTheme.bodySmall),
          ]);
        },
      ),
    );
  }
}

/// Prayer times today, worked out for your city (Egyptian method).
class _PrayerCard extends ConsumerWidget {
  const _PrayerCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final city = ref.watch(cityProvider);
    final c = cityCenters[city] ?? cityCenters['cairo']!;
    final now = DateTime.now();
    final t = prayerTimes(now, c.$1, c.$2);
    if (t == null) return const SizedBox.shrink();
    final rows = [
      (tr('Fajr'), t.fajr),
      (tr('Sunrise'), t.sunrise),
      (tr('Dhuhr'), t.dhuhr),
      (tr('Asr'), t.asr),
      (tr('Maghrib'), t.maghrib),
      (tr('Isha'), t.isha),
    ];
    final next = rows.where((r) => r.$2.isAfter(now.toUtc())).firstOrNull;
    return _ToolCard(
      emoji: '🕌',
      title: trf('Prayer times today in {city}', {'city': tr(Cities.all[city] ?? city)}),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        for (final (name, time) in rows)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(children: [
              Expanded(
                child: Text(name,
                    style: identical(next?.$2, time)
                        ? TextStyle(color: context.k.accent, fontWeight: FontWeight.w700)
                        : null),
              ),
              Text(hhmmLocal(time)),
            ]),
          ),
        const SizedBox(height: KSpace.xs),
        Text(tr('Worked out with the Egyptian method. Your mosque may differ by a minute or two.'),
            style: Theme.of(context).textTheme.bodySmall),
      ]),
    );
  }
}

/// Your next group outing and your next plan with a date, with a countdown.
class _CountdownCard extends ConsumerWidget {
  const _CountdownCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    final group = ref.watch(nextOutingProvider);
    final plans = (ref.watch(recentPlansProvider).value ?? const <OutingPlan>[])
        .where((p) => p.request.date != null && daysUntilText(p.request.day, now) != null)
        .toList()
      ..sort((a, b) => a.request.day.compareTo(b.request.day));
    final plan = plans.firstOrNull;
    if (group == null && plan == null) return const SizedBox.shrink();
    return _ToolCard(
      emoji: '⏳',
      title: tr('Coming up'),
      child: Column(children: [
        if (group != null)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Text('🎉', style: TextStyle(fontSize: 22)),
            title: Text(group.name),
            subtitle: Text(DateFormat('EEE d MMM · HH:mm').format(group.scheduledAt!)),
            trailing: Text(daysUntilText(group.scheduledAt!, now) ?? ''),
            onTap: () => context.push('/group/${group.id}'),
          ),
        if (plan != null)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Text('🗺️', style: TextStyle(fontSize: 22)),
            title: Text(plan.title),
            subtitle: Text(DateFormat('EEE d MMM').format(plan.request.day)),
            trailing: Text(daysUntilText(plan.request.day, now) ?? ''),
            onTap: () => context.push('/plan/${plan.id}'),
          ),
      ]),
    );
  }
}

/// Split a bill you typed in: service and VAT the way Egyptian bills add
/// them, then per person. We never guess prices; you type the total.
class _SplitCard extends StatefulWidget {
  const _SplitCard();

  @override
  State<_SplitCard> createState() => _SplitCardState();
}

class _SplitCardState extends State<_SplitCard> {
  final _amount = TextEditingController();
  int _people = 2;
  bool _service = true;
  bool _vat = true;
  int _tip = 0;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final amount = double.tryParse(latinDigits(_amount.text.trim()).replaceAll(',', '.')) ?? 0;
    final total = billTotal(amount, servicePct: _service ? 12 : 0, vatPct: _vat ? 14 : 0, tipPct: _tip);
    return _ToolCard(
      emoji: '🧾',
      title: tr('Split a bill'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        TextField(
          controller: _amount,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(hintText: tr('Amount on the menu (EGP)')),
          onChanged: (_) => setState(() {}),
        ),
        Row(children: [
          Text(tr('People')),
          IconButton(
            tooltip: tr('Fewer'),
            onPressed: _people > 1 ? () => setState(() => _people--) : null,
            icon: const Icon(Icons.remove_circle_outline),
          ),
          Text('$_people', style: Theme.of(context).textTheme.titleMedium),
          IconButton(
            tooltip: tr('More'),
            onPressed: _people < 30 ? () => setState(() => _people++) : null,
            icon: const Icon(Icons.add_circle_outline),
          ),
        ]),
        Wrap(spacing: KSpace.sm, runSpacing: KSpace.sm, children: [
          FilterChip(
            label: Text(tr('12% service')),
            selected: _service,
            onSelected: (v) => setState(() => _service = v),
          ),
          FilterChip(
            label: Text(tr('14% VAT')),
            selected: _vat,
            onSelected: (v) => setState(() => _vat = v),
          ),
          for (final t in const [0, 5, 10])
            ChoiceChip(
              label: Text(t == 0 ? tr('No tip') : trf('{n}% tip', {'n': t})),
              selected: _tip == t,
              showCheckmark: false,
              onSelected: (_) => setState(() => _tip = t),
            ),
        ]),
        if (amount > 0) ...[
          const SizedBox(height: KSpace.sm),
          Text(trf('Total {total} EGP · {each} EGP each', {
            'total': total.toStringAsFixed(0),
            'each': (total / _people).toStringAsFixed(0),
          }), style: Theme.of(context).textTheme.titleMedium),
        ],
      ]),
    );
  }
}
