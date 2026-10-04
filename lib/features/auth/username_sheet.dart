import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../widgets/common.dart';

final _usernamePattern = RegExp(r'^[a-z0-9_.]{3,20}$');

/// Bottom sheet to choose a unique @username.
Future<void> showUsernameSheet(BuildContext context) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => const _UsernameSheet(),
  );
}

class _UsernameSheet extends ConsumerStatefulWidget {
  const _UsernameSheet();

  @override
  ConsumerState<_UsernameSheet> createState() => _UsernameSheetState();
}

class _UsernameSheetState extends ConsumerState<_UsernameSheet> {
  final _controller = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final value = _controller.text.trim().toLowerCase();
    if (!_usernamePattern.hasMatch(value)) {
      setState(() => _error =
          '3–20 characters: letters, numbers, dots and underscores only.');
      return;
    }
    setState(() => _error = null);
    await ref.read(socialRepositoryProvider).claimUsername(value);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(KSpace.lg, KSpace.lg, KSpace.lg,
          KSpace.lg + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Pick a username', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: KSpace.sm),
          const Text('Friends find you by this name.',
              style: TextStyle(color: KColors.inkMuted)),
          const SizedBox(height: KSpace.md),
          TextField(
            controller: _controller,
            autofocus: true,
            autocorrect: false,
            textInputAction: TextInputAction.done,
            decoration: InputDecoration(
              prefixText: '@',
              hintText: 'username',
              errorText: _error,
            ),
          ),
          const SizedBox(height: KSpace.md),
          BusyButton(label: 'Save', onPressed: _save),
        ],
      ),
    );
  }
}
