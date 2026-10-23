import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n.dart';
import '../../app/money.dart';
import '../../app/theme.dart';
import '../../data/money_providers.dart';
import '../../data/money_repository.dart';
import '../../data/providers.dart';
import '../../models/plan.dart';
import '../../models/social.dart';
import '../../widgets/common.dart';
import '../../widgets/large_title.dart';
import '../../widgets/launchers.dart' show openUri;

/// The outing's money: what everyone ordered (prices typed from the menu or
/// receipt), who collects, and what each person sends them with InstaPay.
class MoneyScreen extends ConsumerWidget {
  const MoneyScreen({super.key, required this.groupId});

  final String groupId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final group = ref.watch(groupProvider(groupId)).value;
    final uid = ref.watch(uidProvider);
    final settings = ref.watch(moneySettingsProvider(groupId)).value ?? const MoneySettings();
    final orders = ref.watch(groupOrdersProvider(groupId)).value ?? const <OrderItem>[];
    final paid = ref.watch(groupPaidProvider(groupId)).value ?? const <String, double>{};
    if (group == null || uid == null) {
      return Scaffold(appBar: AppBar(title: Text(tr('Money'))), body: const SkeletonList());
    }
    final profiles = ref.watch(profilesProvider(profilesKey(group.memberUids))).value ?? const {};
    String nameOf(String id) =>
        id == uid ? tr('You') : profiles[id]?.displayName ?? orders.where((o) => o.uid == id).firstOrNull?.name ?? '…';
    final shares = sharesFor(orders, group.memberUids, settings.extraPct);
    final collector = settings.collectorUid;
    final iCollect = collector == uid;
    final canEditExtras = iCollect || group.isOwner(uid);
    final text = Theme.of(context).textTheme;
    final k = context.k;
    final mine = amountToSend(shares[uid] ?? 0);
    final people = [
      for (final m in group.memberUids)
        if ((shares[m] ?? 0) > 0) m,
    ];
    final sendersTotal = [
      for (final m in people)
        if (m != collector) amountToSend(shares[m]!),
    ].fold(0, (a, b) => a + b);
    final sentTotal = [
      for (final m in people)
        if (m != collector && paid.containsKey(m)) amountToSend(shares[m]!),
    ].fold(0, (a, b) => a + b);

    return KScaffold(
      title: Text(tr('Money')),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: Padding(
        padding: const EdgeInsets.symmetric(horizontal: KSpace.md),
        child: SizedBox(
          width: double.infinity,
          child: GradientButton(
            icon: Icons.add,
            label: tr('Add what I ordered'),
            onPressed: () => _addOrder(context, ref, group, uid),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, 120),
        children: [
          HeroCard(
            child: collector == null
                ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(tr('Who collects the money?'), style: text.titleLarge?.copyWith(color: k.onHero)),
                    const SizedBox(height: KSpace.xs),
                    Text(tr('One person pays the bill. Everyone sends them their part with InstaPay.'),
                        style: TextStyle(color: k.onHero.withValues(alpha: 0.9))),
                    const SizedBox(height: KSpace.md),
                    FilledButton(
                      style: FilledButton.styleFrom(backgroundColor: k.surface, foregroundColor: k.ink),
                      onPressed: () => _collectSheet(context, ref, group, uid, settings),
                      child: Text(tr("I'll collect")),
                    ),
                  ])
                : iCollect
                    ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(tr("You're collecting"), style: text.titleMedium?.copyWith(color: k.onHero)),
                        const SizedBox(height: KSpace.sm),
                        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                          DotNumber(sentTotal, size: 40, color: k.onHero),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 6, left: 6, right: 6),
                            child: Text(trf('of {n} EGP sent to you', {'n': sendersTotal}),
                                style: TextStyle(color: k.onHero.withValues(alpha: 0.85))),
                          ),
                        ]),
                        const SizedBox(height: KSpace.sm),
                        Text(settings.payTo ?? settings.payLink ?? '',
                            style: TextStyle(color: k.onHero.withValues(alpha: 0.85))),
                      ])
                    : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(
                          mine == 0
                              ? trf('{name} collects. Add what you ordered to see your part.',
                                  {'name': settings.collectorName ?? ''})
                              : trf('You send {name}', {'name': settings.collectorName ?? ''}),
                          style: text.titleMedium?.copyWith(color: k.onHero),
                        ),
                        if (mine > 0) ...[
                          const SizedBox(height: KSpace.sm),
                          Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                            DotNumber(mine, size: 44, color: k.onHero),
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8, left: 6, right: 6),
                              child: Text(tr('EGP'), style: TextStyle(color: k.onHero, fontWeight: FontWeight.w700)),
                            ),
                          ]),
                          const SizedBox(height: KSpace.md),
                          FilledButton.icon(
                            style: FilledButton.styleFrom(backgroundColor: k.surface, foregroundColor: k.ink),
                            onPressed: () => payWithInstapay(context, settings, mine),
                            icon: const Icon(Icons.send_rounded),
                            label: Text(tr('Pay with InstaPay')),
                          ),
                          const SizedBox(height: KSpace.sm),
                          SwitchListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(tr("I've sent it"), style: TextStyle(color: k.onHero)),
                            value: paid.containsKey(uid),
                            onChanged: (v) => ref
                                .read(moneyRepositoryProvider)
                                .setPaid(groupId, uid, v ? mine.toDouble() : null)
                                .catchError((Object e) {
                              if (context.mounted) showError(context, e);
                            }),
                          ),
                        ],
                      ]),
          ),
          if (collector != null)
            Padding(
              padding: const EdgeInsets.only(top: KSpace.sm),
              child: Wrap(spacing: KSpace.sm, children: [
                if (iCollect)
                  TextButton(
                    onPressed: () => _collectSheet(context, ref, group, uid, settings),
                    child: Text(tr('Edit my InstaPay details')),
                  ),
                if (iCollect || group.isOwner(uid))
                  TextButton(
                    onPressed: () => ref.read(moneyRepositoryProvider).clearCollector(groupId, settings.extraPct),
                    child: Text(iCollect ? tr('Stop collecting') : tr('Choose someone else')),
                  ),
              ]),
            ),
          SectionTitle(tr('Service & tax')),
          Wrap(spacing: KSpace.sm, runSpacing: KSpace.sm, children: [
            for (final (pct, label) in [(0.0, 'None'), (12.0, '12% service'), (14.0, '14% VAT'), (26.0, '26% (both)')])
              ChoiceChip(
                label: Text(tr(label)),
                selected: settings.extraPct == pct,
                showCheckmark: false,
                onSelected: canEditExtras
                    ? (_) => ref.read(moneyRepositoryProvider).setExtra(groupId, settings, pct)
                    : null,
              ),
          ]),
          if (!canEditExtras)
            Padding(
              padding: const EdgeInsets.only(top: KSpace.xs),
              child: Text(tr('The collector or the organizer sets this, from the receipt.'), style: text.bodySmall),
            ),
          SectionTitle(trf('What we ordered · {n} EGP', {'n': amountToSend(billTotal(orders, settings.extraPct))})),
          if (orders.isEmpty)
            Text(tr('Nothing yet. Everyone adds what they ordered, with the price from the menu or receipt.'),
                style: text.bodyMedium)
          else ...[
            for (final who in [...group.memberUids.where((m) => orders.any((o) => o.uid == m && !o.shared))])
              Padding(
                padding: const EdgeInsets.only(bottom: KSpace.sm),
                child: MenuGroup(title: nameOf(who), children: [
                  for (final o in orders.where((o) => o.uid == who && !o.shared))
                    _OrderRow(order: o, groupId: groupId, canDelete: o.uid == uid || group.isOwner(uid)),
                ]),
              ),
            if (orders.any((o) => o.shared))
              MenuGroup(title: tr('For the table (split between everyone)'), children: [
                for (final o in orders.where((o) => o.shared))
                  _OrderRow(order: o, groupId: groupId, canDelete: o.uid == uid || group.isOwner(uid)),
              ]),
          ],
          if (people.isNotEmpty) ...[
            SectionTitle(tr('Who sends what')),
            MenuGroup(children: [
              for (final m in people)
                ListTile(
                  title: Text(nameOf(m)),
                  subtitle: Text(m == collector
                      ? tr('Collector: their own part')
                      : paid.containsKey(m)
                          ? tr('Said they sent it ✓')
                          : tr('Not sent yet')),
                  trailing: Text(trf('{n} EGP', {'n': amountToSend(shares[m]!)}),
                      style: text.titleMedium?.copyWith(
                          color: paid.containsKey(m) || m == collector ? k.inkMuted : k.ink)),
                  onTap: iCollect && m != collector
                      ? () => ref
                          .read(moneyRepositoryProvider)
                          .setPaid(groupId, m, paid.containsKey(m) ? null : amountToSend(shares[m]!).toDouble())
                      : null,
                ),
            ]),
            if (iCollect)
              Padding(
                padding: const EdgeInsets.only(top: KSpace.xs),
                child: Text(tr('Tap a person to mark that you got their money.'), style: text.bodySmall),
              ),
          ],
          const SizedBox(height: KSpace.md),
          Text(
            tr('Prices are what you type from the menu or the receipt; Khroga never guesses prices. '
                'Amounts are rounded up to whole pounds. Payments happen in InstaPay, not in Khroga.'),
            style: text.bodySmall,
          ),
        ],
      ),
    );
  }

  Future<void> _addOrder(BuildContext context, WidgetRef ref, Group group, String uid) async {
    final places = [
      for (final s in group.planStops) PlanStop.fromMap(s).name,
    ];
    final result = await showModalBottomSheet<({String item, double price, int qty, bool shared, String? place})>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _OrderSheet(places: places),
    );
    if (result == null) return;
    final me = ref.read(myProfileProvider).value;
    try {
      await ref.read(moneyRepositoryProvider).addOrder(
            group.id,
            uid: uid,
            name: me?.displayName ?? tr('Friend'),
            item: result.item,
            price: result.price,
            qty: result.qty,
            shared: result.shared,
            place: result.place,
          );
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  Future<void> _collectSheet(BuildContext context, WidgetRef ref, Group group, String uid, MoneySettings s) async {
    final result = await showModalBottomSheet<({String? link, String? to})>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _CollectorSheet(link: s.payLink, to: s.payTo),
    );
    if (result == null) return;
    final me = ref.read(myProfileProvider).value;
    try {
      await ref.read(moneyRepositoryProvider).becomeCollector(
            group.id,
            uid,
            me?.displayName ?? tr('Friend'),
            payLink: result.link,
            payTo: result.to,
            extraPct: s.extraPct,
          );
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }
}

/// Copies the amount and opens the collector's InstaPay payment link (their
/// account is already filled in there). InstaPay doesn't let other apps fill
/// in the amount, so the person pastes it.
Future<void> payWithInstapay(BuildContext context, MoneySettings s, int amount) async {
  await Clipboard.setData(ClipboardData(text: '$amount'));
  if (s.payLink != null && isInstapayLink(s.payLink!)) {
    if (context.mounted) {
      showMessage(context, trf('{n} EGP copied. Paste it as the amount in InstaPay.', {'n': amount}));
    }
    await openUri(Uri.parse(s.payLink!));
    return;
  }
  if (!context.mounted) return;
  await showDialog<void>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(tr('Send with InstaPay')),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr('Open InstaPay, choose Send money, and use these:')),
        const SizedBox(height: KSpace.md),
        if (s.payTo != null)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(s.payTo!, textDirection: TextDirection.ltr),
            subtitle: Text(tr('InstaPay address or number')),
            trailing: IconButton(
              tooltip: tr('Copy'),
              icon: const Icon(Icons.copy),
              onPressed: () => Clipboard.setData(ClipboardData(text: s.payTo!)),
            ),
          ),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(trf('{n} EGP', {'n': amount})),
          subtitle: Text(tr('Amount (copied)')),
          trailing: IconButton(
            tooltip: tr('Copy'),
            icon: const Icon(Icons.copy),
            onPressed: () => Clipboard.setData(ClipboardData(text: '$amount')),
          ),
        ),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(c), child: Text(tr('Done')))],
    ),
  );
}

class _OrderRow extends ConsumerWidget {
  const _OrderRow({required this.order, required this.groupId, required this.canDelete});

  final OrderItem order;
  final String groupId;
  final bool canDelete;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListTile(
      title: Text(order.qty > 1 ? '${order.item} × ${order.qty}' : order.item),
      subtitle: order.place == null && !order.shared
          ? null
          : Text([
              if (order.place != null) order.place!,
              if (order.shared) trf('added by {name}', {'name': order.name}),
            ].join(' · ')),
      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(trf('{n} EGP', {'n': order.total % 1 == 0 ? order.total.toInt() : order.total.toStringAsFixed(2)})),
        if (canDelete)
          IconButton(
            tooltip: tr('Remove'),
            icon: const Icon(Icons.close, size: 18),
            onPressed: () => ref.read(moneyRepositoryProvider).deleteOrder(groupId, order.id),
          ),
      ]),
    );
  }
}

/// Add one thing you ordered: name, price from the menu/receipt, how many.
class _OrderSheet extends StatefulWidget {
  const _OrderSheet({required this.places});

  final List<String> places;

  @override
  State<_OrderSheet> createState() => _OrderSheetState();
}

class _OrderSheetState extends State<_OrderSheet> {
  final _item = TextEditingController();
  final _price = TextEditingController();
  int _qty = 1;
  bool _shared = false;
  String? _place;

  @override
  void dispose() {
    _item.dispose();
    _price.dispose();
    super.dispose();
  }

  double? get _priceValue {
    final raw = _price.text.trim().replaceAll(',', '.').replaceAllMapped(
        RegExp('[٠-٩]'), (m) => '${m[0]!.codeUnitAt(0) - 0x0660}');
    final v = double.tryParse(raw);
    return v == null || v <= 0 || v > 100000 ? null : v;
  }

  @override
  Widget build(BuildContext context) {
    final ok = _item.text.trim().isNotEmpty && _priceValue != null;
    return Padding(
      padding: EdgeInsets.fromLTRB(KSpace.lg, 0, KSpace.lg, KSpace.lg + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(tr('What did you order?'), style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: KSpace.md),
        TextField(
          controller: _item,
          autofocus: true,
          maxLength: 60,
          textCapitalization: TextCapitalization.sentences,
          decoration: InputDecoration(labelText: tr('Item'), hintText: tr('e.g. Iced latte')),
          onChanged: (_) => setState(() {}),
        ),
        TextField(
          controller: _price,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(labelText: tr('Price of one (EGP)'), helperText: tr('From the menu or the receipt')),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: KSpace.sm),
        Row(children: [
          Expanded(child: Text(tr('How many'))),
          IconButton.outlined(
            onPressed: _qty > 1 ? () => setState(() => _qty--) : null,
            icon: const Icon(Icons.remove),
          ),
          SizedBox(width: 44, child: Text('$_qty', textAlign: TextAlign.center)),
          IconButton.outlined(
            onPressed: _qty < 50 ? () => setState(() => _qty++) : null,
            icon: const Icon(Icons.add),
          ),
        ]),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(tr('For the whole table')),
          subtitle: Text(tr('Split between everyone in the group')),
          value: _shared,
          onChanged: (v) => setState(() => _shared = v),
        ),
        if (widget.places.isNotEmpty) ...[
          Text(tr('Where?'), style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: KSpace.xs),
          Wrap(spacing: KSpace.sm, runSpacing: KSpace.xs, children: [
            for (final p in widget.places)
              ChoiceChip(
                label: Text(p),
                selected: _place == p,
                showCheckmark: false,
                onSelected: (v) => setState(() => _place = v ? p : null),
              ),
          ]),
        ],
        const SizedBox(height: KSpace.lg),
        GradientButton(
          label: tr('Add'),
          onPressed: ok
              ? () => Navigator.pop(context, (
                    item: _item.text.trim(),
                    price: _priceValue!,
                    qty: _qty,
                    shared: _shared,
                    place: _place,
                  ))
              : null,
        ),
      ]),
    );
  }
}

/// Become the collector: your InstaPay payment link and/or address.
class _CollectorSheet extends StatefulWidget {
  const _CollectorSheet({this.link, this.to});

  final String? link;
  final String? to;

  @override
  State<_CollectorSheet> createState() => _CollectorSheetState();
}

class _CollectorSheetState extends State<_CollectorSheet> {
  late final _link = TextEditingController(text: widget.link ?? '');
  late final _to = TextEditingController(text: widget.to ?? '');

  @override
  void dispose() {
    _link.dispose();
    _to.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final link = _link.text.trim(), to = _to.text.trim();
    final linkOk = link.isEmpty || isInstapayLink(link);
    final toOk = to.isEmpty || isInstapayAddress(to);
    final ok = linkOk && toOk && (link.isNotEmpty || to.isNotEmpty);
    return Padding(
      padding: EdgeInsets.fromLTRB(KSpace.lg, 0, KSpace.lg, KSpace.lg + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(tr('Collect with InstaPay'), style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: KSpace.xs),
        Text(tr('Your group sees these so they can send you their part.'),
            style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: KSpace.md),
        TextField(
          controller: _link,
          keyboardType: TextInputType.url,
          textDirection: TextDirection.ltr,
          decoration: InputDecoration(
            labelText: tr('InstaPay payment link (best)'),
            hintText: 'https://ipn.eg/S/…',
            helperText: tr('In InstaPay, share your payment link and paste it here.'),
            errorText: linkOk ? null : tr('That is not an InstaPay link (it starts with https://ipn.eg/S/).'),
          ),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: KSpace.sm),
        TextField(
          controller: _to,
          textDirection: TextDirection.ltr,
          decoration: InputDecoration(
            labelText: tr('InstaPay address or mobile number'),
            hintText: 'name@instapay',
            errorText: toOk ? null : tr('Use name@instapay or an 11-digit mobile number.'),
          ),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: KSpace.lg),
        GradientButton(
          label: tr('Save'),
          onPressed: ok
              ? () => Navigator.pop(context, (link: link.isEmpty ? null : link, to: to.isEmpty ? null : to))
              : null,
        ),
      ]),
    );
  }
}
