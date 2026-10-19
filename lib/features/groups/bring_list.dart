import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/social.dart';
import '../../widgets/common.dart';

/// Up to 50 things per group, live while the sheet is open.
final groupItemsProvider = StreamProvider.autoDispose.family<List<BringItem>, String>(
  (ref, groupId) => ref.watch(groupsRepositoryProvider).watchItems(groupId),
);

/// Quick suggestions for the list (tap to add).
const bringIdeas = ['Playing cards', 'Snacks', 'Water', 'Speaker', 'Power bank', 'Umbrella', 'Blanket', 'Football'];

void showBringList(BuildContext context, Group group, String uid) => showModalBottomSheet<void>(
  context: context,
  isScrollControlled: true,
  builder: (_) => _BringSheet(group: group, uid: uid),
);

class _BringSheet extends ConsumerStatefulWidget {
  const _BringSheet({required this.group, required this.uid});

  final Group group;
  final String uid;

  @override
  ConsumerState<_BringSheet> createState() => _BringSheetState();
}

class _BringSheetState extends ConsumerState<_BringSheet> {
  final _text = TextEditingController();

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  String get _myName => ref.read(myProfileProvider).value?.displayName ?? tr('A friend');

  Future<void> _run(Future<void> Function() action) async {
    try {
      await action();
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _add(String text) async {
    final t = text.trim();
    if (t.isEmpty) return;
    _text.clear();
    await _run(() => ref.read(groupsRepositoryProvider).addItem(widget.group.id, widget.uid, _myName, t));
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final repo = ref.read(groupsRepositoryProvider);
    final g = widget.group;
    final items = ref.watch(groupItemsProvider(g.id));
    final list = items.value ?? const <BringItem>[];
    final have = list.map((i) => i.text.toLowerCase()).toSet();
    return Padding(
      padding: EdgeInsets.fromLTRB(
        KSpace.lg,
        KSpace.lg,
        KSpace.lg,
        KSpace.lg + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(tr("🎒 Who's bringing what"), style: text.titleLarge),
          const SizedBox(height: KSpace.xs),
          Text(
            list.isEmpty
                ? tr('Add things the group needs. Anyone can say "I\'ll bring it".')
                : trf('{a} of {b} sorted', {'a': list.where((i) => i.takenBy != null).length, 'b': list.length}),
            style: text.bodySmall?.copyWith(color: context.k.inkMuted),
          ),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              children: [
                for (final i in list)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      i.takenBy == null ? Icons.radio_button_unchecked : Icons.check_circle,
                      color: i.takenBy == null ? null : context.k.accent,
                    ),
                    title: Text(i.text),
                    subtitle: Text(
                      i.takenBy == null
                          ? trf('Added by {name}', {'name': i.uid == widget.uid ? tr('you') : i.name})
                          : i.takenBy == widget.uid
                          ? tr('You\'re bringing it')
                          : trf('{name} is bringing it', {'name': i.takenName ?? ''}),
                    ),
                    trailing: i.takenBy == null
                        ? TextButton(
                            onPressed: () => _run(() => repo.takeItem(g.id, i.id, widget.uid, _myName)),
                            child: Text(tr("I'll bring it")),
                          )
                        : i.takenBy == widget.uid
                        ? TextButton(
                            onPressed: () => _run(() => repo.takeItem(g.id, i.id, null, null)),
                            child: Text(tr("Can't anymore")),
                          )
                        : null,
                    onLongPress: i.uid == widget.uid || g.isOwner(widget.uid)
                        ? () => _run(() => repo.deleteItem(g.id, i.id))
                        : null,
                  ),
              ],
            ),
          ),
          if (list.length < 50) ...[
            Wrap(
              spacing: KSpace.xs,
              children: [
                for (final idea in bringIdeas)
                  if (!have.contains(tr(idea).toLowerCase()))
                    ActionChip(label: Text(tr(idea)), onPressed: () => _add(tr(idea))),
              ],
            ),
            TextField(
              controller: _text,
              maxLength: 60,
              textInputAction: TextInputAction.done,
              decoration: InputDecoration(
                hintText: tr('Something else to bring'),
                suffixIcon: IconButton(
                  tooltip: tr('Add'),
                  icon: const Icon(Icons.add),
                  onPressed: () => _add(_text.text),
                ),
              ),
              onSubmitted: _add,
            ),
          ],
          if (list.isNotEmpty) Text(tr('Long-press a thing you added to remove it.'), style: text.bodySmall),
        ],
      ),
    );
  }
}
