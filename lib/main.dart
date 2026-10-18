import 'app/reminders.dart';
import 'app/i18n.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/foundation.dart' show defaultTargetPlatform, TargetPlatform;
import 'package:flutter/material.dart';
import 'package:quick_actions/quick_actions.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app/local_prefs.dart';
import 'app/router.dart';
import 'app/theme.dart';
import 'app/theme_settings.dart';
import 'data/groups_repository.dart';
import 'data/reviews_repository.dart';
import 'data/safety_repository.dart';
import 'features/profile/about_screen.dart' show appVersion;
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
  _catchErrors(prefs);
  await Reminders.init();
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
    // Tapping an outing reminder opens its plan or group.
    Reminders.onOpen = (route) => ref.read(routerProvider).push(route);
    if (Reminders.launchRoute case final route?) {
      Reminders.launchRoute = null;
      WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(routerProvider).push(route));
    }
    final lang = ref.watch(appSettingsProvider.select((s) => s.lang));
    _setUpShortcuts(ref, lang);
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
        final reduceMotion = ref.watch(phoneSettingsProvider.select((s) => s.reduceMotion));
        final bold = ref.watch(phoneSettingsProvider.select((s) => s.boldText));
        return MediaQuery(
          data: media.copyWith(
            textScaler: TextScaler.linear(
                (media.textScaler.scale(14) / 14 * look.textScale).clamp(0.8, 2.2)),
            disableAnimations: reduceMotion || media.disableAnimations,
            boldText: bold || media.boldText,
          ),
          child: child!,
        );
      },
    );
  }
}

String? _shortcutsLang;

/// Long-press the app icon: jump straight to a new plan, Explore, saved
/// plans or the QR scanner.
void _setUpShortcuts(WidgetRef ref, String lang) {
  if (_shortcutsLang == lang || defaultTargetPlatform != TargetPlatform.android) return;
  _shortcutsLang = lang;
  const routes = {'plan': '/plan', 'explore': '/explore', 'saved': '/saved', 'scan': '/scan'};
  try {
    const actions = QuickActions();
    actions.initialize((type) {
      final route = routes[type];
      if (route != null) ref.read(routerProvider).push(route);
    });
    actions.setShortcutItems([
      ShortcutItem(type: 'plan', localizedTitle: tr('New plan')),
      ShortcutItem(type: 'explore', localizedTitle: tr('Explore')),
      ShortcutItem(type: 'saved', localizedTitle: tr('Saved plans')),
      ShortcutItem(type: 'scan', localizedTitle: tr('Scan a QR code')),
    ]);
  } catch (_) {
    // Shortcuts are a nice extra; the app works without them.
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

/// Saves a short technical note when the app hits an error, so it can be
/// fixed (no messages or personal details; at most 3 per app run; can be
/// turned off in Profile). Stored write-only in Firebase.
void _catchErrors(SharedPreferences? prefs) {
  var sent = 0;
  void report(Object error, StackTrace? stack) {
    if (sent >= 3 || (prefs?.getBool('set.sendErrors') ?? true) == false) return;
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;
    sent++;
    final db = FirebaseFirestore.instance;
    SafetyRepository(db, GroupsRepository(db), ReviewsRepository(db))
        .sendError(by: uid, message: '$error', stack: '$stack', version: appVersion)
        .catchError((_) {});
  }

  final previous = FlutterError.onError;
  FlutterError.onError = (details) {
    previous?.call(details);
    report(details.exception, details.stack);
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    report(error, stack);
    return false; // let Flutter handle it as usual too
  };
}
