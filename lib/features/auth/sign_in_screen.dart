import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../widgets/common.dart';

class SignInScreen extends ConsumerWidget {
  const SignInScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final auth = ref.watch(authRepositoryProvider);
    return Scaffold(
      backgroundColor: context.k.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(KSpace.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(flex: 2),
              Align(
                alignment: Alignment.centerLeft,
                child: Image.asset('assets/icon/khroga.png', width: 80, height: 80),
              ),
              const SizedBox(height: KSpace.lg),
              Row(
                children: [
                  Expanded(child: Text(tr('Khroga'), style: text.headlineMedium)),
                  TextButton.icon(
                    icon: const Icon(Icons.translate),
                    label: Text(isArabic ? 'English' : 'العربية'),
                    onPressed: () =>
                        ref.read(appSettingsProvider.notifier).setLanguage(isArabic ? 'en' : 'ar'),
                  ),
                ],
              ),
              const SizedBox(height: KSpace.sm),
              Text(
                tr('Plan real outings in Cairo, Giza and Alexandria — '
                'with real places, and your friends.'),
                style: text.bodyLarge?.copyWith(color: context.k.inkMuted),
              ),
              const Spacer(flex: 3),
              BusyButton(
                label: tr('Continue with Google'),
                icon: Icons.login,
                onPressed: auth.signInWithGoogle,
              ),
              const SizedBox(height: KSpace.sm),
              BusyButton(
                label: tr('Try as guest'),
                outlined: true,
                onPressed: auth.signInAsGuest,
              ),
              const SizedBox(height: KSpace.md),
              Text(
                tr('Guests can plan and explore. Sign in with Google later to keep '
                'everything and add friends.'),
                style: text.bodySmall,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
