import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../widgets/common.dart';
import '../../widgets/motion.dart';

/// Three quick cards the first time someone opens Khroga.
class WelcomeScreen extends ConsumerStatefulWidget {
  const WelcomeScreen({super.key});

  @override
  ConsumerState<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends ConsumerState<WelcomeScreen> {
  final _pages = PageController();
  int _index = 0;

  static const _cards = [
    ('✨', 'Tell us the vibe', 'Pick who\'s coming and the mood. Khroga builds an outing from real places.'),
    ('🧭', 'Explore real places', 'Thousands of places in Cairo, Giza and Alexandria, straight from the map. '
        'Unknown facts say "unknown", never guesses.'),
    ('👯', 'Bring your friends', 'Make a group, vote in polls, chat and split the bill. All free.'),
    ('🇪🇬', 'Arabic or English', 'Switch language any time in Profile. Maps, check-ins and plans work in both.'),
  ];

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  void _done() {
    ref.read(appSettingsProvider.notifier).finishOnboarding();
    context.go(ref.read(appSettingsProvider).startOnExplore ? '/explore' : '/plan');
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final last = _index == _cards.length - 1;
    final k = context.k;
    return Scaffold(
      body: GradientBackdrop(
        child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(KSpace.lg),
          child: Column(
            children: [
              Row(
                children: [
                  TextButton.icon(
                    style: TextButton.styleFrom(foregroundColor: k.onHero),
                    icon: const Icon(Icons.translate),
                    label: Text(isArabic ? 'English' : 'العربية'),
                    onPressed: () => ref
                        .read(appSettingsProvider.notifier)
                        .setLanguage(isArabic ? 'en' : 'ar'),
                  ),
                  const Spacer(),
                  TextButton(
                    style: TextButton.styleFrom(foregroundColor: k.onHero),
                    onPressed: _done,
                    child: Text(tr('Skip')),
                  ),
                ],
              ),
              Expanded(
                child: PageView(
                  controller: _pages,
                  onPageChanged: (i) => setState(() => _index = i),
                  children: [
                    for (final (emoji, title, body) in _cards)
                      Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          PopIn(
                            child: Container(
                              width: 148,
                              height: 148,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: Colors.white.withValues(alpha: k.isDark ? 0.08 : 0.18),
                                border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
                              ),
                              child: Text(emoji, style: const TextStyle(fontSize: 72)),
                            ),
                          ),
                          const SizedBox(height: KSpace.xl),
                          FadeSlideIn(
                            index: 1,
                            child: Text(tr(title),
                                style: text.headlineLarge?.copyWith(color: k.onHero), textAlign: TextAlign.center),
                          ),
                          const SizedBox(height: KSpace.sm),
                          FadeSlideIn(
                            index: 2,
                            child: Text(tr(body),
                                textAlign: TextAlign.center,
                                style: text.bodyLarge?.copyWith(color: k.onHero.withValues(alpha: 0.9))),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < _cards.length; i++)
                    AnimatedContainer(
                      duration: KMotion.medium,
                      curve: KMotion.curve,
                      width: i == _index ? 26 : 8,
                      height: 8,
                      margin: const EdgeInsets.all(4),
                      decoration: ShapeDecoration(
                        shape: const StadiumBorder(),
                        color: k.onHero.withValues(alpha: i == _index ? 1 : 0.4),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: KSpace.lg),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: k.onHero, foregroundColor: k.isDark ? k.background : k.ink),
                  onPressed: last
                      ? _done
                      : () => _pages.nextPage(
                          duration: const Duration(milliseconds: 250), curve: Curves.easeOut),
                  child: Text(last ? tr("Let's go") : tr('Next')),
                ),
              ),
            ],
          ),
        ),
      ),
      ),
    );
  }
}
