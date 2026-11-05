import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'app_state.dart';
import 'screens/onboarding_screen.dart';
import 'screens/root_screen.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final state = AppState();
  await state.load();
  runApp(MasarApp(state: state));
}

class MasarApp extends StatelessWidget {
  const MasarApp({super.key, required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: state,
      builder: (context, _) {
        return MaterialApp(
          title: state.isArabic ? 'مسار' : 'Masar',
          debugShowCheckedModeBanner: false,
          theme: buildTheme(),
          locale: Locale(state.isArabic ? 'ar' : 'en'),
          supportedLocales: const <Locale>[Locale('ar'), Locale('en')],
          localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: AppGate(state: state),
        );
      },
    );
  }
}

/// Shows the welcome screen the first time, then the main app.
class AppGate extends StatelessWidget {
  const AppGate({super.key, required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: state,
      builder: (context, _) {
        return state.onboarded ? RootScreen(state: state) : OnboardingScreen(state: state);
      },
    );
  }
}
