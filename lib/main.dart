import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/router.dart';
import 'app/theme.dart';
import 'firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  } catch (e) {
    // Show a clear message instead of a crash if Firebase isn't connected yet.
    runApp(_NotConnectedApp(error: '$e'));
    return;
  }
  runApp(const ProviderScope(child: KhrogaApp()));
}

class KhrogaApp extends ConsumerWidget {
  const KhrogaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Khroga',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      routerConfig: ref.watch(routerProvider),
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
                  Text("Khroga isn't connected yet",
                      style: Theme.of(context).textTheme.headlineMedium),
                  const SizedBox(height: KSpace.sm),
                  const Text('This test build is missing its Firebase settings.'),
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
