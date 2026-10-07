import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/local_prefs.dart';
import '../../app/theme.dart';

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
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(KSpace.lg),
          child: Column(
            children: [
              Row(
                children: [
                  TextButton.icon(
                    icon: const Icon(Icons.translate),
                    label: Text(isArabic ? 'English' : 'العربية'),
                    onPressed: () => ref
                        .read(appSettingsProvider.notifier)
                        .setLanguage(isArabic ? 'en' : 'ar'),
                  ),
                  const Spacer(),
                  TextButton(onPressed: _done, child: Text(tr('Skip'))),
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
                          Text(emoji, style: const TextStyle(fontSize: 72)),
                          const SizedBox(height: KSpace.lg),
                          Text(tr(title), style: text.headlineMedium, textAlign: TextAlign.center),
                          const SizedBox(height: KSpace.sm),
                          Text(tr(body),
                              textAlign: TextAlign.center,
                              style: text.bodyLarge?.copyWith(color: context.k.inkMuted)),
                        ],
                      ),
                  ],
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < _cards.length; i++)
                    Container(
                      width: i == _index ? 22 : 8,
                      height: 8,
                      margin: const EdgeInsets.all(4),
                      decoration: ShapeDecoration(
                        shape: const StadiumBorder(),
                        color: i == _index ? context.k.accent : context.k.line,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: KSpace.lg),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
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
    );
  }
}
