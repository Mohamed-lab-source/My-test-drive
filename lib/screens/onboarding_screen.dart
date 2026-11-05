import 'package:flutter/material.dart';

import '../app_state.dart';
import '../theme.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.state});

  final AppState state;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final TextEditingController _name = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Widget _langButton(String label, bool arabic) {
    final selected = widget.state.isArabic == arabic;
    return Expanded(
      child: SizedBox(
        height: 52,
        child: selected
            ? FilledButton(
                onPressed: () => widget.state.setArabic(arabic),
                child: Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              )
            : OutlinedButton(
                onPressed: () => widget.state.setArabic(arabic),
                child: Text(label, style: const TextStyle(fontSize: 16)),
              ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.state.tr;
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 48, 24, 24),
          children: <Widget>[
            const Align(alignment: AlignmentDirectional.centerStart, child: MasarLogo(size: 56)),
            const SizedBox(height: 24),
            Text(
              t('مسار', 'Masar'),
              style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w700, color: AppColors.ink),
            ),
            const SizedBox(height: 8),
            Text(
              t('رفيقك في البكالوريا المصرية: اختار مسارك، تابع درجاتك، واعرف محتاج إيه توصل لكليتك.',
                  'Your Egyptian Baccalaureate companion: pick your track, follow your scores, and know exactly what you need for your college.'),
              style: const TextStyle(fontSize: 16, height: 1.6, color: AppColors.muted),
            ),
            const SizedBox(height: 32),
            Text(t('اللغة', 'Language'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            Row(
              children: <Widget>[
                _langButton('عربي', true),
                const SizedBox(width: 10),
                _langButton('English', false),
              ],
            ),
            const SizedBox(height: 24),
            Text(t('اسمك', 'Your name'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            TextField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              decoration: InputDecoration(
                hintText: t('اكتب اسمك', 'Type your name'),
                filled: true,
                fillColor: AppColors.white,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
            const SizedBox(height: 32),
            SizedBox(
              height: 56,
              child: FilledButton(
                onPressed: () => widget.state.finishOnboarding(_name.text),
                child: Text(t('يلا نبدأ', "Let's start"), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
