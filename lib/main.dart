import 'app/i18n.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app/local_prefs.dart';
import 'app/router.dart';
import 'app/theme.dart';
import 'app/theme_settings.dart';
import 'firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    // Keep a full copy of everything already downloaded on the phone. Screens
    // re-opened later read from it, and only changes count as new reads.
    FirebaseFirestore.instance.settings = const Settings(
      persistenceEnabled: true,
      cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED,
    );
  } catch (e) {
    // Show a clear message instead of a crash if Firebase isn't connected yet.
    runApp(_NotConnectedApp(error: '$e'));
    return;
  }
  SharedPreferences? prefs;
  try {
    prefs = await SharedPreferences.getInstance();
  } catch (_) {
    // Settings just won't be remembered; the app still works.
  }
  // Language: what the person picked, else Arabic if the phone is in Arabic.
  appLang = prefs?.getString('app.lang') ??
      (PlatformDispatcher.instance.locale.languageCode == 'ar' ? 'ar' : 'en');
  runApp(ProviderScope(
    overrides: [sharedPrefsProvider.overrideWithValue(prefs)],
    child: const KhrogaApp(),
  ));
}

class KhrogaApp extends ConsumerWidget {
  const KhrogaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final look = ref.watch(themeSettingsProvider);
    final lang = ref.watch(appSettingsProvider.select((s) => s.lang));
    return MaterialApp.router(
      key: ValueKey(lang), // rebuild every screen in the new language
      locale: Locale(lang),
      supportedLocales: const [Locale('en'), Locale('ar')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      title: tr('Khroga'),
      debugShowCheckedModeBanner: false,
      theme: buildTheme(accent: look.accent, brightness: Brightness.light),
      darkTheme: buildTheme(
          accent: look.accent,
          brightness: Brightness.dark,
          pureBlack: ref.watch(appSettingsProvider.select((s) => s.pureBlack))),
      themeMode: look.mode,
      routerConfig: ref.watch(routerProvider),
      // "Bigger text" setting, on top of the phone's own text size.
      builder: (context, child) {
        final media = MediaQuery.of(context);
        return MediaQuery(
          data: media.copyWith(
            textScaler: TextScaler.linear(
                (media.textScaler.scale(14) / 14 * look.textScale).clamp(0.8, 2.0)),
          ),
          child: child!,
        );
      },
    );
  }
}

class _NotConnectedApp extends StatelessWidget {
  const _NotConnectedApp({required this.error});

  final String error;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: Builder(
        builder: (context) => Scaffold(
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(KSpace.lg),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('🔌', style: TextStyle(fontSize: 48)),
                  const SizedBox(height: KSpace.md),
                  Text(tr("Khroga isn't connected yet"),
                      style: Theme.of(context).textTheme.headlineMedium),
                  const SizedBox(height: KSpace.sm),
                  Text(tr('This test build is missing its Firebase settings.')),
                  const SizedBox(height: KSpace.md),
                  Text(error, style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
