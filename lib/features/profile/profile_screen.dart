import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../widgets/common.dart';
import '../auth/username_sheet.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(myProfileProvider).value;
    final user = ref.watch(authStateProvider).value;
    final isGuest = user?.isAnonymous ?? true;
    final text = Theme.of(context).textTheme;
    final auth = ref.read(authRepositoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(KSpace.md),
        children: [
          Center(child: Avatar(profile: me, size: 88)),
          const SizedBox(height: KSpace.md),
          Center(child: Text(me?.displayName ?? '', style: text.titleLarge)),
          if (me?.username != null)
            Center(
              child: Text('@${me!.username}',
                  style: text.bodyMedium?.copyWith(color: KColors.inkMuted)),
            ),
          const SizedBox(height: KSpace.lg),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.badge_outlined),
                  title: const Text('Display name'),
                  subtitle: Text(me?.displayName ?? ''),
                  onTap: me == null
                      ? null
                      : () => _editName(context, ref, me.displayName),
                ),
                if (!isGuest) ...[
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.alternate_email),
                    title: const Text('Username'),
                    subtitle: Text(me?.username == null
                        ? 'Not set'
                        : '@${me!.username}'),
                    onTap: () => showUsernameSheet(context),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: KSpace.md),
          if (isGuest) ...[
            Text(
              "You're using Khroga as a guest. Sign in to keep your plans on "
              'any phone and to add friends.',
              style: text.bodyMedium?.copyWith(color: KColors.inkMuted),
            ),
            const SizedBox(height: KSpace.sm),
            BusyButton(
              label: 'Sign in with Google',
              icon: Icons.login,
              onPressed: auth.signInWithGoogle,
            ),
            const SizedBox(height: KSpace.sm),
          ],
          BusyButton(
            label: 'Sign out',
            outlined: true,
            onPressed: () async {
              if (isGuest) {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (dialogContext) => AlertDialog(
                    title: const Text('Sign out of guest account?'),
                    content: const Text(
                        "Guest plans and groups can't be recovered after signing out."),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(dialogContext, false),
                          child: const Text('Cancel')),
                      FilledButton(
                          onPressed: () => Navigator.pop(dialogContext, true),
                          child: const Text('Sign out')),
                    ],
                  ),
                );
                if (ok != true) return;
              }
              await auth.signOut();
            },
          ),
        ],
      ),
    );
  }

  Future<void> _editName(BuildContext context, WidgetRef ref, String current) async {
    final controller = TextEditingController(text: current);
    final name = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Display name'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 40,
          textCapitalization: TextCapitalization.words,
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(dialogContext, controller.text),
              child: const Text('Save')),
        ],
      ),
    );
    controller.dispose();
    if (name == null || name.trim().isEmpty) return;
    final uid = ref.read(uidProvider);
    if (uid == null) return;
    try {
      await ref.read(socialRepositoryProvider).updateDisplayName(uid, name);
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }
}
