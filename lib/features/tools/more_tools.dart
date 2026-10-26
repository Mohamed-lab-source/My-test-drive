import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData, HapticFeedback, SystemSound, SystemSoundType;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/extras.dart' show cityCenters, compassDirection, daysUntilText;
import '../../app/helpers.dart' show tapFeedback;
import '../../app/i18n.dart';
import '../../app/local_prefs.dart';
import '../../app/pocket.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../widgets/common.dart' show showMessage, showError;

/// 2.0 tools. Everything here works on the phone only: no Firestore, and the
/// only numbers used are the ones you type (or your phone's location).

/// The frame every tool sits in (emoji + title + body).
class ToolCard extends StatelessWidget {
  const ToolCard({super.key, required this.emoji, required this.title, required this.child, this.note});

  final String emoji;
  final String title;
  final String? note;
  final Widget child;

  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(top: KSpace.md),
        child: Padding(
          padding: const EdgeInsets.all(KSpace.md),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text(emoji, style: const TextStyle(fontSize: 24)),
              const SizedBox(width: KSpace.sm),
              Expanded(child: Text(title, style: Theme.of(context).textTheme.titleMedium)),
            ]),
            const SizedBox(height: KSpace.sm),
            child,
            if (note != null) ...[
              const SizedBox(height: KSpace.sm),
              Text(note!, style: Theme.of(context).textTheme.bodySmall),
            ],
          ]),
        ),
      );
}

double? _num(String s) => double.tryParse(s.replaceAll(',', '').replaceAll('٫', '.').trim());

String _money(double v) => NumberFormat('#,##0.##').format(v);

Widget _field(TextEditingController c, String label, VoidCallback onChanged, {String? suffix}) => TextField(
      controller: c,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(labelText: label, suffixText: suffix),
      onChanged: (_) => onChanged(),
    );

Widget _big(BuildContext context, String s) =>
    Text(s, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800));

/// "Copy" for a result line, to paste in the group chat.
class _CopyResult extends StatelessWidget {
  const _CopyResult({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => Align(
        alignment: AlignmentDirectional.centerStart,
        child: TextButton.icon(
          icon: const Icon(Icons.copy, size: 18),
          label: Text(tr('Copy for the group')),
          onPressed: () {
            Clipboard.setData(ClipboardData(text: text));
            showMessage(context, tr('Copied'));
          },
        ),
      );
}

// ---------------------------------------------------------------- tip

class TipCard extends StatefulWidget {
  const TipCard({super.key});

  @override
  State<TipCard> createState() => _TipCardState();
}

class _TipCardState extends State<TipCard> {
  final _bill = TextEditingController();
  int _pct = 10;
  int _people = 2;
  bool _round = false;

  @override
  void dispose() {
    _bill.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bill = _num(_bill.text) ?? 0;
    final r = tipShare(bill, _pct.toDouble(), _people);
    final each = _round ? (r.each / 5).ceil() * 5.0 : r.each;
    return ToolCard(
      emoji: '💁',
      title: tr('Tip calculator'),
      note: tr('Only the numbers you type.'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _field(_bill, tr('Bill total'), () => setState(() {}), suffix: tr('EGP')),
        const SizedBox(height: KSpace.sm),
        Wrap(spacing: KSpace.xs, children: [
          for (final p in [0, 5, 10, 12, 15, 20])
            ChoiceChip(
              label: Text('$p%'),
              selected: _pct == p,
              showCheckmark: false,
              onSelected: (_) => setState(() => _pct = p),
            ),
        ]),
        Row(children: [
          Text(tr('People')),
          IconButton(
              tooltip: tr('Fewer'),
              onPressed: _people > 1 ? () => setState(() => _people--) : null,
              icon: const Icon(Icons.remove_circle_outline)),
          Text('$_people', style: Theme.of(context).textTheme.titleMedium),
          IconButton(
              tooltip: tr('More'),
              onPressed: _people < 30 ? () => setState(() => _people++) : null,
              icon: const Icon(Icons.add_circle_outline)),
        ]),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(tr('Round each share up to 5')),
          value: _round,
          onChanged: (v) => setState(() => _round = v),
        ),
        if (bill > 0) ...[
          Text(trf('Tip: {tip} · Total: {total}', {'tip': _money(r.tip), 'total': _money(r.total)})),
          const SizedBox(height: 4),
          _big(context, trf('{amount} each', {'amount': _money(each)})),
          _CopyResult(text: trf('Total {total} · {amount} each ({n} people)',
              {'total': _money(r.total), 'amount': _money(each), 'n': _people})),
        ],
      ]),
    );
  }
}

// ---------------------------------------------------------------- car

class CarSplitCard extends StatefulWidget {
  const CarSplitCard({super.key});

  @override
  State<CarSplitCard> createState() => _CarSplitCardState();
}

class _CarSplitCardState extends State<CarSplitCard> {
  final _km = TextEditingController();
  final _use = TextEditingController(text: '8');
  final _price = TextEditingController();
  final _extra = TextEditingController();
  int _people = 4;

  @override
  void dispose() {
    for (final c in [_km, _use, _price, _extra]) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final km = _num(_km.text), use = _num(_use.text), price = _num(_price.text);
    final r = km == null || use == null || price == null
        ? null
        : carSplit(km: km, litresPer100: use, pricePerLitre: price, people: _people, extra: _num(_extra.text) ?? 0);
    void up() => setState(() {});
    return ToolCard(
      emoji: '🚗',
      title: tr('Car trip split'),
      note: tr("Type your car's own numbers and today's fuel price. Nothing is guessed."),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _field(_km, tr('Distance there and back'), up, suffix: tr('km')),
        _field(_use, tr('Fuel use per 100 km'), up, suffix: tr('litres')),
        _field(_price, tr('Fuel price per litre'), up, suffix: tr('EGP')),
        _field(_extra, tr('Parking and tolls (optional)'), up, suffix: tr('EGP')),
        Row(children: [
          Text(tr('Riders')),
          IconButton(
              tooltip: tr('Fewer'),
              onPressed: _people > 1 ? () => setState(() => _people--) : null,
              icon: const Icon(Icons.remove_circle_outline)),
          Text('$_people', style: Theme.of(context).textTheme.titleMedium),
          IconButton(
              tooltip: tr('More'),
              onPressed: _people < 8 ? () => setState(() => _people++) : null,
              icon: const Icon(Icons.add_circle_outline)),
        ]),
        if (r != null) ...[
          Text(trf('{l} litres · {cost} in total', {'l': r.litres.toStringAsFixed(1), 'cost': _money(r.cost)})),
          const SizedBox(height: 4),
          _big(context, trf('{amount} each', {'amount': _money(r.each)})),
          _CopyResult(text: trf('Car trip: {cost} in total · {amount} each ({n} riders)',
              {'cost': _money(r.cost), 'amount': _money(r.each), 'n': _people})),
        ],
      ]),
    );
  }
}

// ---------------------------------------------------------------- scores

class ScoreCard extends ConsumerStatefulWidget {
  const ScoreCard({super.key});

  @override
  ConsumerState<ScoreCard> createState() => _ScoreCardState();
}

class _ScoreCardState extends ConsumerState<ScoreCard> {
  final _name = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scores = ref.watch(scoresProvider);
    final pref = ref.read(scoresProvider.notifier);
    final players = scores.entries.toList()
      ..sort((a, b) => (int.tryParse(b.value) ?? 0).compareTo(int.tryParse(a.value) ?? 0));
    final top = players.isEmpty ? null : int.tryParse(players.first.value);
    void add() {
      final n = _name.text.trim();
      if (n.isEmpty || scores.containsKey(n) || scores.length >= 12) return;
      pref.set(n, '0');
      _name.clear();
    }

    return ToolCard(
      emoji: '🏆',
      title: tr('Score keeper'),
      note: tr('Saved on this phone until you clear it.'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: TextField(
              controller: _name,
              maxLength: 20,
              decoration: InputDecoration(labelText: tr('Player name'), counterText: ''),
              onSubmitted: (_) => add(),
            ),
          ),
          IconButton(tooltip: tr('Add player'), onPressed: add, icon: const Icon(Icons.person_add_alt)),
        ]),
        for (final e in players)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Text(top != null && top > 0 && e.value == '$top' ? '👑' : '🙂',
                style: const TextStyle(fontSize: 22)),
            title: Text(e.key),
            trailing: Row(mainAxisSize: MainAxisSize.min, children: [
              IconButton(
                tooltip: tr('Minus one'),
                icon: const Icon(Icons.remove),
                onPressed: () => pref.set(e.key, '${(int.tryParse(e.value) ?? 0) - 1}'),
              ),
              SizedBox(
                width: 36,
                child: Text(e.value, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge),
              ),
              IconButton(
                tooltip: tr('Plus one'),
                icon: const Icon(Icons.add),
                onPressed: () {
                  tapFeedback(ref.read(phoneSettingsProvider).haptics);
                  pref.set(e.key, '${(int.tryParse(e.value) ?? 0) + 1}');
                },
              ),
            ]),
            onLongPress: () => pref.set(e.key, null),
          ),
        if (players.isNotEmpty)
          Wrap(spacing: KSpace.sm, children: [
            TextButton(
              onPressed: () {
                for (final e in players) {
                  pref.set(e.key, '0');
                }
              },
              child: Text(tr('Reset scores')),
            ),
            TextButton(
              onPressed: () {
                for (final e in players) {
                  pref.set(e.key, null);
                }
              },
              child: Text(tr('Remove everyone')),
            ),
            _CopyResult(text: [tr('Scores'), for (final e in players) '${e.key}: ${e.value}'].join('\n')),
          ]),
        if (players.isNotEmpty)
          Text(tr('Press and hold a player to remove them.'), style: Theme.of(context).textTheme.bodySmall),
      ]),
    );
  }
}

// ---------------------------------------------------------------- timers

class GameTimerCard extends ConsumerStatefulWidget {
  const GameTimerCard({super.key});

  @override
  ConsumerState<GameTimerCard> createState() => _GameTimerCardState();
}

class _GameTimerCardState extends ConsumerState<GameTimerCard> {
  int _total = 60;
  int _left = 60;
  Timer? _timer;

  void _start() {
    _timer?.cancel();
    if (_left <= 0) _left = _total;
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _left--);
      if (_left <= 0) {
        t.cancel();
        HapticFeedback.heavyImpact();
        SystemSound.play(SystemSoundType.alert);
      }
    });
    setState(() {});
  }

  void _stop() => setState(() => _timer?.cancel());

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final running = _timer?.isActive ?? false;
    final k = context.k;
    return ToolCard(
      emoji: '⏱️',
      title: tr('Game timer'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Wrap(spacing: KSpace.xs, children: [
          for (final s in [30, 60, 90, 120, 300])
            ChoiceChip(
              label: Text(clockText(Duration(seconds: s))),
              selected: _total == s,
              showCheckmark: false,
              onSelected: (_) => setState(() {
                _timer?.cancel();
                _total = s;
                _left = s;
              }),
            ),
        ]),
        const SizedBox(height: KSpace.md),
        Center(
          child: Text(
            clockText(Duration(seconds: _left.clamp(0, 99999))),
            style: TextStyle(
              fontFamily: KFont.dots,
              fontFamilyFallback: KFont.dotsFallback,
              fontWeight: FontWeight.w900,
              fontSize: 64,
              color: _left <= 5 && running ? k.signal : k.ink,
            ),
          ),
        ),
        if (_left <= 0) Center(child: Text(tr("Time's up!"), style: Theme.of(context).textTheme.titleLarge)),
        const SizedBox(height: KSpace.sm),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          FilledButton.icon(
            onPressed: running ? _stop : _start,
            icon: Icon(running ? Icons.pause : Icons.play_arrow),
            label: Text(running ? tr('Pause') : tr('Start')),
          ),
          const SizedBox(width: KSpace.sm),
          OutlinedButton(
            onPressed: () => setState(() {
              _timer?.cancel();
              _left = _total;
            }),
            child: Text(tr('Reset')),
          ),
        ]),
      ]),
    );
  }
}

class StopwatchCard extends StatefulWidget {
  const StopwatchCard({super.key});

  @override
  State<StopwatchCard> createState() => _StopwatchCardState();
}

class _StopwatchCardState extends State<StopwatchCard> {
  final _watch = Stopwatch();
  final _laps = <Duration>[];
  Timer? _tick;

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  void _toggle() {
    if (_watch.isRunning) {
      _watch.stop();
      _tick?.cancel();
    } else {
      _watch.start();
      _tick = Timer.periodic(const Duration(milliseconds: 200), (_) {
        if (mounted) setState(() {});
      });
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) => ToolCard(
        emoji: '⏲️',
        title: tr('Stopwatch'),
        child: Column(children: [
          Text(
            clockText(_watch.elapsed),
            style: TextStyle(
              fontFamily: KFont.dots,
              fontFamilyFallback: KFont.dotsFallback,
              fontWeight: FontWeight.w900,
              fontSize: 56,
              color: context.k.ink,
            ),
          ),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            FilledButton(onPressed: _toggle, child: Text(_watch.isRunning ? tr('Stop') : tr('Start'))),
            const SizedBox(width: KSpace.sm),
            OutlinedButton(
              onPressed: _watch.isRunning
                  ? () => setState(() => _laps.insert(0, _watch.elapsed))
                  : () => setState(() {
                        _watch.reset();
                        _laps.clear();
                      }),
              child: Text(_watch.isRunning ? tr('Lap') : tr('Reset')),
            ),
          ]),
          for (final (i, l) in _laps.indexed)
            ListTile(
              dense: true,
              title: Text(trf('Lap {n}', {'n': _laps.length - i})),
              trailing: Text(clockText(l)),
            ),
        ]),
      );
}

// ---------------------------------------------------------------- games

class RpsCard extends ConsumerStatefulWidget {
  const RpsCard({super.key});

  @override
  ConsumerState<RpsCard> createState() => _RpsCardState();
}

class _RpsCardState extends ConsumerState<RpsCard> {
  static const _moves = ['✊', '✋', '✌️'];
  int? _me, _phone;
  int _wins = 0, _losses = 0;

  void _play(int m) {
    tapFeedback(ref.read(phoneSettingsProvider).haptics);
    final p = math.Random().nextInt(3);
    setState(() {
      _me = m;
      _phone = p;
      final r = rpsWinner(m, p);
      if (r == 1) _wins++;
      if (r == -1) _losses++;
    });
  }

  @override
  Widget build(BuildContext context) {
    final r = _me == null ? null : rpsWinner(_me!, _phone!);
    return ToolCard(
      emoji: '✊',
      title: tr('Rock paper scissors'),
      child: Column(children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
          for (final (i, m) in _moves.indexed)
            IconButton.filledTonal(
              iconSize: 36,
              tooltip: [tr('Rock'), tr('Paper'), tr('Scissors')][i],
              onPressed: () => _play(i),
              icon: Text(m, style: const TextStyle(fontSize: 32)),
            ),
        ]),
        if (r != null) ...[
          const SizedBox(height: KSpace.sm),
          Text('${_moves[_me!]}  ${tr('vs')}  ${_moves[_phone!]}', style: const TextStyle(fontSize: 34)),
          Text(r == 1 ? tr('You win!') : r == -1 ? tr('The phone wins!') : tr("It's a draw"),
              style: Theme.of(context).textTheme.titleMedium),
          Text(trf('You {w} · Phone {l}', {'w': _wins, 'l': _losses})),
        ],
      ]),
    );
  }
}

class WouldYouRatherCard extends StatefulWidget {
  const WouldYouRatherCard({super.key});

  @override
  State<WouldYouRatherCard> createState() => _WouldYouRatherCardState();
}

class _WouldYouRatherCardState extends State<WouldYouRatherCard> {
  late final _list = shuffled(wouldYouRather());
  int _i = 0;

  @override
  Widget build(BuildContext context) {
    final (a, b) = _list[_i % _list.length];
    final text = Theme.of(context).textTheme;
    return ToolCard(
      emoji: '🤔',
      title: tr('Would you rather…'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(a, textAlign: TextAlign.center, style: text.titleLarge),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: KSpace.xs),
          child: Text(tr('or'), textAlign: TextAlign.center, style: text.bodySmall),
        ),
        Text(b, textAlign: TextAlign.center, style: text.titleLarge),
        const SizedBox(height: KSpace.md),
        FilledButton.tonal(onPressed: () => setState(() => _i++), child: Text(tr('Next question'))),
      ]),
    );
  }
}

class CharadesCard extends StatefulWidget {
  const CharadesCard({super.key});

  @override
  State<CharadesCard> createState() => _CharadesCardState();
}

class _CharadesCardState extends State<CharadesCard> {
  late final _words = charadesWords();
  late String _cat = _words.keys.first;
  String? _word;
  bool _hidden = true;

  @override
  Widget build(BuildContext context) => ToolCard(
        emoji: '🎭',
        title: tr('Charades'),
        note: tr('Show the word only to the person acting it out.'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Wrap(spacing: KSpace.xs, runSpacing: KSpace.xs, children: [
            for (final c in _words.keys)
              ChoiceChip(
                label: Text(c),
                selected: _cat == c,
                showCheckmark: false,
                onSelected: (_) => setState(() {
                  _cat = c;
                  _word = null;
                }),
              ),
          ]),
          const SizedBox(height: KSpace.md),
          if (_word != null)
            GestureDetector(
              onTap: () => setState(() => _hidden = !_hidden),
              child: Container(
                padding: const EdgeInsets.all(KSpace.lg),
                decoration: BoxDecoration(
                    color: context.k.surfaceHigh, borderRadius: BorderRadius.circular(KRadius.card)),
                child: Text(_hidden ? tr('Tap to see the word') : _word!,
                    textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall),
              ),
            ),
          const SizedBox(height: KSpace.sm),
          FilledButton.tonal(
            onPressed: () => setState(() {
              final list = _words[_cat]!;
              var next = list[math.Random().nextInt(list.length)];
              if (next == _word && list.length > 1) next = list[(list.indexOf(next) + 1) % list.length];
              _word = next;
              _hidden = true;
            }),
            child: Text(_word == null ? tr('Get a word') : tr('Next word')),
          ),
        ]),
      );
}

class PickNumberCard extends ConsumerStatefulWidget {
  const PickNumberCard({super.key});

  @override
  ConsumerState<PickNumberCard> createState() => _PickNumberCardState();
}

class _PickNumberCardState extends ConsumerState<PickNumberCard> {
  int _max = 10;
  int? _n;

  @override
  Widget build(BuildContext context) => ToolCard(
        emoji: '🔢',
        title: tr('Pick a number'),
        child: Column(children: [
          Row(children: [
            Text(trf('From 1 to {n}', {'n': _max})),
            Expanded(
              child: Slider(
                value: _max.toDouble(),
                min: 2,
                max: 100,
                divisions: 98,
                label: '$_max',
                onChanged: (v) => setState(() {
                  _max = v.round();
                  _n = null;
                }),
              ),
            ),
          ]),
          if (_n != null)
            Text('$_n',
                style: TextStyle(
                  fontFamily: KFont.dots,
                  fontFamilyFallback: KFont.dotsFallback,
                  fontWeight: FontWeight.w900,
                  fontSize: 64,
                  color: context.k.ink,
                )),
          FilledButton.tonal(
            onPressed: () {
              tapFeedback(ref.read(phoneSettingsProvider).haptics);
              setState(() => _n = math.Random().nextInt(_max) + 1);
            },
            child: Text(tr('Pick')),
          ),
        ]),
      );
}

/// Names in, shuffled order out: turns, seats, who goes first.
class TurnOrderCard extends StatefulWidget {
  const TurnOrderCard({super.key});

  @override
  State<TurnOrderCard> createState() => _TurnOrderCardState();
}

class _TurnOrderCardState extends State<TurnOrderCard> {
  final _names = TextEditingController();
  List<String> _order = const [];

  @override
  void dispose() {
    _names.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ToolCard(
        emoji: '🔀',
        title: tr('Turn order'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          TextField(
            controller: _names,
            minLines: 1,
            maxLines: 3,
            decoration: InputDecoration(labelText: tr('Names, separated by commas')),
          ),
          const SizedBox(height: KSpace.sm),
          FilledButton.tonal(
            onPressed: () => setState(() {
              final names =
                  _names.text.split(RegExp(r'[,،\n]')).map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
              _order = shuffled(names);
            }),
            child: Text(tr('Shuffle')),
          ),
          for (final (i, n) in _order.indexed)
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(radius: 14, child: Text('${i + 1}')),
              title: Text(n),
            ),
        ]),
      );
}

class BottleCard extends ConsumerStatefulWidget {
  const BottleCard({super.key});

  @override
  ConsumerState<BottleCard> createState() => _BottleCardState();
}

class _BottleCardState extends ConsumerState<BottleCard> {
  double _turns = 0;

  @override
  Widget build(BuildContext context) {
    final reduce = ref.watch(phoneSettingsProvider.select((s) => s.reduceMotion));
    return ToolCard(
      emoji: '🍾',
      title: tr('Spin the bottle'),
      note: tr('Put the phone in the middle of the table.'),
      child: Column(children: [
        SizedBox(
          height: 180,
          child: Center(
            child: AnimatedRotation(
              turns: _turns,
              duration: reduce ? Duration.zero : const Duration(milliseconds: 2200),
              curve: Curves.easeOutCubic,
              child: Icon(Icons.navigation, size: 140, color: context.k.ink),
            ),
          ),
        ),
        FilledButton.tonal(
          onPressed: () {
            tapFeedback(ref.read(phoneSettingsProvider).haptics);
            setState(() => _turns += 3 + math.Random().nextDouble() * 3);
          },
          child: Text(tr('Spin')),
        ),
      ]),
    );
  }
}

class GroupNamesCard extends StatefulWidget {
  const GroupNamesCard({super.key});

  @override
  State<GroupNamesCard> createState() => _GroupNamesCardState();
}

class _GroupNamesCardState extends State<GroupNamesCard> {
  late final _names = shuffled(groupNameIdeas());
  int _i = 0;

  @override
  Widget build(BuildContext context) => ToolCard(
        emoji: '🏷️',
        title: tr('Group name ideas'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(_names[_i % _names.length],
              textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: KSpace.sm),
          Wrap(alignment: WrapAlignment.center, spacing: KSpace.sm, runSpacing: KSpace.xs, children: [
            FilledButton.tonal(onPressed: () => setState(() => _i++), child: Text(tr('Another one'))),
            TextButton.icon(
              icon: const Icon(Icons.copy, size: 18),
              label: Text(tr('Copy')),
              onPressed: () {
                Clipboard.setData(ClipboardData(text: _names[_i % _names.length]));
                showMessage(context, tr('Copied'));
              },
            ),
          ]),
        ]),
      );
}

// ---------------------------------------------------------------- time & place

/// Where am I: your phone's location, or the city centre when you'd rather not.
Future<(double, double, bool)> _here(WidgetRef ref) async {
  try {
    final p = await ref.read(locationServiceProvider).current();
    return (p.$1, p.$2, true);
  } catch (_) {
    final c = cityCenters[ref.read(cityProvider)] ?? cityCenters['cairo']!;
    return (c.$1, c.$2, false);
  }
}

class QiblaCard extends ConsumerStatefulWidget {
  const QiblaCard({super.key});

  @override
  ConsumerState<QiblaCard> createState() => _QiblaCardState();
}

class _QiblaCardState extends ConsumerState<QiblaCard> {
  (double, bool, double, double)? _result;
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final r = _result;
    return ToolCard(
      emoji: '🧭',
      title: tr('Qibla direction'),
      note: tr('Calculated from your location. Hold the phone flat and use a compass app to point north.'),
      child: Column(children: [
        if (r != null) ...[
          Transform.rotate(
            angle: r.$1 * math.pi / 180,
            child: Icon(Icons.navigation, size: 110, color: context.k.ink),
          ),
          _big(context, trf('{deg}° from north ({dir})',
              {'deg': r.$1.round(), 'dir': compassDirection(r.$3, r.$4, 21.4225, 39.8262)})),
          if (!r.$2) Text(tr('From the city centre (location was off).')),
          const SizedBox(height: KSpace.sm),
        ],
        FilledButton.tonal(
          onPressed: _busy
              ? null
              : () async {
                  setState(() => _busy = true);
                  final h = await _here(ref);
                  if (!mounted) return;
                  setState(() {
                    _busy = false;
                    _result = (qiblaBearing(h.$1, h.$2), h.$3, h.$1, h.$2);
                  });
                },
          child: Text(r == null ? tr('Find the qibla') : tr('Again')),
        ),
      ]),
    );
  }
}

class HijriCard extends StatelessWidget {
  const HijriCard({super.key});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final h = hijriDate(now);
    final toRamadan = h.month == 9 ? 0 : daysUntilHijriMonth(now, 9);
    return ToolCard(
      emoji: '🌙',
      title: tr('Hijri date'),
      note: tr('Calculated, so it can be a day off from the official date (which follows the moon sighting).'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _big(context, hijriText(now)),
        Text(DateFormat('EEEE d MMMM y').format(now)),
        const SizedBox(height: KSpace.sm),
        Text(h.month == 9
            ? tr('Ramadan Kareem! 🌙')
            : trf('Ramadan starts in about {n} days', {'n': toRamadan})),
        Text(trf('Eid al-Fitr in about {n} days', {'n': daysUntilHijri(now, 10, 1)})),
        Text(trf('Eid al-Adha in about {n} days', {'n': daysUntilHijri(now, 12, 10)})),
      ]),
    );
  }
}

class WalkStatsCard extends StatefulWidget {
  const WalkStatsCard({super.key});

  @override
  State<WalkStatsCard> createState() => _WalkStatsCardState();
}

class _WalkStatsCardState extends State<WalkStatsCard> {
  double _km = 2;

  @override
  Widget build(BuildContext context) => ToolCard(
        emoji: '👟',
        title: tr('Steps for a walk'),
        note: tr('Rough: about 1,300 steps and 55 kcal per km. Everyone is different.'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text(trf('{km} km', {'km': _km.toStringAsFixed(1)})),
            Expanded(
              child: Slider(
                value: _km,
                min: 0.5,
                max: 15,
                divisions: 29,
                onChanged: (v) => setState(() => _km = v),
              ),
            ),
          ]),
          _big(context, trf('about {n} steps', {'n': NumberFormat('#,###').format(roughSteps(_km))})),
          Text(trf('about {n} kcal · about {m} min walking',
              {'n': roughKcal(_km), 'm': (_km / 4.5 * 60).round()})),
        ]),
      );
}

class PlusCodeCard extends ConsumerStatefulWidget {
  const PlusCodeCard({super.key});

  @override
  ConsumerState<PlusCodeCard> createState() => _PlusCodeCardState();
}

class _PlusCodeCardState extends ConsumerState<PlusCodeCard> {
  String? _code;
  bool _busy = false;

  @override
  Widget build(BuildContext context) => ToolCard(
        emoji: '➕',
        title: tr('My plus code'),
        note: tr('A short code for exactly where you are. Paste it in Google Maps to find the spot.'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (_code != null) ...[
            SelectableText(_code!, style: Theme.of(context).textTheme.headlineSmall),
            Wrap(children: [
              TextButton.icon(
                icon: const Icon(Icons.copy, size: 18),
                label: Text(tr('Copy')),
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: _code!));
                  showMessage(context, tr('Copied'));
                },
              ),
              TextButton.icon(
                icon: const Icon(Icons.ios_share, size: 18),
                label: Text(tr('Share')),
                onPressed: () => SharePlus.instance.share(ShareParams(text: trf('I am here: {code}', {'code': _code!}))),
              ),
            ]),
          ],
          FilledButton.tonal(
            onPressed: _busy
                ? null
                : () async {
                    setState(() => _busy = true);
                    try {
                      final p = await ref.read(locationServiceProvider).current();
                      if (mounted) setState(() => _code = plusCode(p.$1, p.$2));
                    } catch (e) {
                      if (context.mounted) showError(context, e);
                    } finally {
                      if (mounted) setState(() => _busy = false);
                    }
                  },
            child: Text(_code == null ? tr('Get my code') : tr('Update')),
          ),
        ]),
      );
}

/// Your own countdowns (a birthday, a trip), saved on this phone.
class MyDatesCard extends ConsumerStatefulWidget {
  const MyDatesCard({super.key});

  @override
  ConsumerState<MyDatesCard> createState() => _MyDatesCardState();
}

class _MyDatesCardState extends ConsumerState<MyDatesCard> {
  final _name = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    final name = _name.text.trim();
    if (name.isEmpty) return;
    final now = DateTime.now();
    final day = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 7)),
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: now.add(const Duration(days: 3650)),
    );
    if (day == null) return;
    ref.read(myDatesProvider.notifier).set(name, DateFormat('yyyy-MM-dd').format(day));
    _name.clear();
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final dates = [
      for (final e in ref.watch(myDatesProvider).entries)
        if (DateTime.tryParse(e.value) case final d?) (e.key, d),
    ]..sort((a, b) => a.$2.compareTo(b.$2));
    return ToolCard(
      emoji: '📆',
      title: tr('My countdowns'),
      note: tr('Saved on this phone only.'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: TextField(
              controller: _name,
              maxLength: 30,
              decoration: InputDecoration(labelText: tr("What's coming? (e.g. my birthday)"), counterText: ''),
            ),
          ),
          IconButton(tooltip: tr('Pick the day'), onPressed: _add, icon: const Icon(Icons.event)),
        ]),
        for (final (name, day) in dates)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(name),
            subtitle: Text(DateFormat('EEE d MMM y').format(day)),
            trailing: Text(daysUntilText(day, now) ?? tr('Passed'),
                style: Theme.of(context).textTheme.titleMedium),
            onLongPress: () => ref.read(myDatesProvider.notifier).set(name, null),
          ),
        if (dates.isNotEmpty)
          Text(tr('Press and hold one to remove it.'), style: Theme.of(context).textTheme.bodySmall),
      ]),
    );
  }
}

class ConvertCard extends StatefulWidget {
  const ConvertCard({super.key});

  @override
  State<ConvertCard> createState() => _ConvertCardState();
}

class _ConvertCardState extends State<ConvertCard> {
  final _v = TextEditingController(text: '1');
  int _kind = 0; // 0 km→mi, 1 mi→km, 2 °C→°F, 3 °F→°C

  @override
  void dispose() {
    _v.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final v = _num(_v.text);
    final labels = [tr('km → miles'), tr('miles → km'), tr('°C → °F'), tr('°F → °C')];
    final out = v == null
        ? null
        : switch (_kind) {
            0 => '${(v * 0.621371).toStringAsFixed(2)} mi',
            1 => '${(v / 0.621371).toStringAsFixed(2)} km',
            2 => '${(v * 9 / 5 + 32).toStringAsFixed(1)} °F',
            _ => '${((v - 32) * 5 / 9).toStringAsFixed(1)} °C',
          };
    return ToolCard(
      emoji: '📏',
      title: tr('Unit converter'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Wrap(spacing: KSpace.xs, runSpacing: KSpace.xs, children: [
          for (final (i, l) in labels.indexed)
            ChoiceChip(
                label: Text(l),
                selected: _kind == i,
                showCheckmark: false,
                onSelected: (_) => setState(() => _kind = i)),
        ]),
        _field(_v, tr('Value'), () => setState(() {})),
        if (out != null) ...[const SizedBox(height: KSpace.sm), _big(context, out)],
      ]),
    );
  }
}

/// Meeting at a time, it takes X minutes to get there: when to leave.
class LeaveAtCard extends StatefulWidget {
  const LeaveAtCard({super.key});

  @override
  State<LeaveAtCard> createState() => _LeaveAtCardState();
}

class _LeaveAtCardState extends State<LeaveAtCard> {
  TimeOfDay _meet = const TimeOfDay(hour: 19, minute: 0);
  int _travel = 30;
  int _buffer = 10;

  @override
  Widget build(BuildContext context) {
    final meetMin = _meet.hour * 60 + _meet.minute;
    final leave = (meetMin - _travel - _buffer) % 1440;
    final leaveText = '${(leave ~/ 60).toString().padLeft(2, '0')}:${(leave % 60).toString().padLeft(2, '0')}';
    return ToolCard(
      emoji: '🚪',
      title: tr('When should I leave?'),
      note: tr('Use the travel time your maps app shows.'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(tr('We meet at')),
          trailing: Text(_meet.format(context), style: Theme.of(context).textTheme.titleMedium),
          onTap: () async {
            final t = await showTimePicker(context: context, initialTime: _meet);
            if (t != null) setState(() => _meet = t);
          },
        ),
        Text(trf('Travel time: {n} min', {'n': _travel})),
        Slider(
            value: _travel.toDouble(),
            min: 5,
            max: 120,
            divisions: 23,
            onChanged: (v) => setState(() => _travel = v.round())),
        Text(trf('Extra just in case: {n} min', {'n': _buffer})),
        Slider(
            value: _buffer.toDouble(),
            min: 0,
            max: 45,
            divisions: 9,
            onChanged: (v) => setState(() => _buffer = v.round())),
        _big(context, trf('Leave at {t}', {'t': leaveText})),
      ]),
    );
  }
}

/// Home: your nearest countdowns (from "My countdowns"), when you have any.
class MyDatesStrip extends ConsumerWidget {
  const MyDatesStrip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dates = [
      for (final e in ref.watch(myDatesProvider).entries)
        if (DateTime.tryParse(e.value) case final d? when !d.isBefore(today)) (e.key, d),
    ]..sort((a, b) => a.$2.compareTo(b.$2));
    if (dates.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: KSpace.sm),
      child: Card(
        child: ListTile(
          leading: const Text('📆', style: TextStyle(fontSize: 24)),
          title: Text(dates.take(2).map((d) => '${d.$1}: ${daysUntilText(d.$2, now) ?? ''}').join('  ·  ')),
          subtitle: Text(tr('My countdowns')),
        ),
      ),
    );
  }
}
