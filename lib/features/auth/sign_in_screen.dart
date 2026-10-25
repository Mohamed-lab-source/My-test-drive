import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/motion.dart';

class SignInScreen extends ConsumerWidget {
  const SignInScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final auth = ref.watch(authRepositoryProvider);
    final k = context.k;
    final theme = Theme.of(context);
    // Buttons that stand out on the colorful background.
    final onGradient = theme.copyWith(
      filledButtonTheme: FilledButtonThemeData(
        style: theme.filledButtonTheme.style?.copyWith(
          backgroundColor: WidgetStatePropertyAll(k.onHero),
          foregroundColor: WidgetStatePropertyAll(k.isDark ? k.background : k.ink),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: theme.outlinedButtonTheme.style?.copyWith(
          foregroundColor: WidgetStatePropertyAll(k.onHero),
          side: WidgetStatePropertyAll(BorderSide(color: k.onHero.withValues(alpha: 0.6), width: 1.4)),
        ),
      ),
    );
    return Scaffold(
      body: GradientBackdrop(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(KSpace.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: TextButton.icon(
                    style: TextButton.styleFrom(foregroundColor: k.onHero),
                    icon: const Icon(Icons.translate),
                    label: Text(isArabic ? 'English' : 'العربية'),
                    onPressed: () => ref.read(appSettingsProvider.notifier).setLanguage(isArabic ? 'en' : 'ar'),
                  ),
                ),
                const Spacer(flex: 2),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: PopIn(
                    child: Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(26),
                        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.25), blurRadius: 30, offset: const Offset(0, 12))],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(26),
                        child: Image.asset('assets/icon/khroga.png', width: 92, height: 92),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: KSpace.lg),
                FadeSlideIn(
                  index: 1,
                  child: KhrogaWordmark(size: 50, color: k.onHero),
                ),
                const SizedBox(height: KSpace.sm),
                FadeSlideIn(
                  index: 2,
                  child: Text(
                    tr('Plan real outings in Cairo, Giza and Alexandria — '
                        'with real places, and your friends.'),
                    style: text.titleMedium?.copyWith(color: k.onHero.withValues(alpha: 0.92), fontWeight: FontWeight.w500),
                  ),
                ),
                const SizedBox(height: KSpace.lg),
                FadeSlideIn(
                  index: 3,
                  child: Wrap(spacing: KSpace.sm, runSpacing: KSpace.sm, children: [
                    for (final t in ['☕ Cafés', '🍽️ Restaurants', '🛍️ Malls', '🌳 Parks', '🏛️ Museums'])
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                        decoration: ShapeDecoration(
                          shape: StadiumBorder(side: BorderSide(color: Colors.white.withValues(alpha: 0.3))),
                          color: Colors.white.withValues(alpha: k.isDark ? 0.08 : 0.16),
                        ),
                        child: Text(tr(t), style: TextStyle(color: k.onHero, fontWeight: FontWeight.w600)),
                      ),
                  ]),
                ),
                const Spacer(flex: 3),
                Theme(
                  data: onGradient,
                  child: FadeSlideIn(
                    index: 4,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
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
                    ]),
                  ),
                ),
                const SizedBox(height: KSpace.md),
                Text(
                  tr('Guests can plan and explore. Sign in with Google later to keep '
                      'everything and add friends.'),
                  style: text.bodySmall?.copyWith(color: k.onHero.withValues(alpha: 0.85)),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
