import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
      backgroundColor: KColors.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(KSpace.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(flex: 2),
              Container(
                width: 72,
                height: 72,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: KColors.accent,
                  borderRadius: BorderRadius.circular(22),
                ),
                child: const Text('خ',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 40,
                        fontWeight: FontWeight.w800)),
              ),
              const SizedBox(height: KSpace.lg),
              Text('Khroga', style: text.headlineMedium),
              const SizedBox(height: KSpace.sm),
              Text(
                'Plan real outings in Cairo, Giza and Alexandria — '
                'with real places, and your friends.',
                style: text.bodyLarge?.copyWith(color: KColors.inkMuted),
              ),
              const Spacer(flex: 3),
              BusyButton(
                label: 'Continue with Google',
                icon: Icons.login,
                onPressed: auth.signInWithGoogle,
              ),
              const SizedBox(height: KSpace.sm),
              BusyButton(
                label: 'Try as guest',
                outlined: true,
                onPressed: auth.signInAsGuest,
              ),
              const SizedBox(height: KSpace.md),
              Text(
                'Guests can plan and explore. Sign in with Google later to keep '
                'everything and add friends.',
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
