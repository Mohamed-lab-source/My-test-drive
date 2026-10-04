import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/router.dart';
import 'app/theme.dart';
import 'data/providers.dart';
import 'firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  runApp(const ProviderScope(child: KhrogaApp()));
}

class KhrogaApp extends ConsumerWidget {
  const KhrogaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Register for push notifications whenever someone signs in.
    ref.listen(uidProvider, (_, uid) {
      if (uid != null) _registerPush(ref, uid);
    });
    return MaterialApp.router(
      title: 'Khroga',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      routerConfig: ref.watch(routerProvider),
    );
  }
}

/// Best-effort: the app works fine without notifications.
Future<void> _registerPush(WidgetRef ref, String uid) async {
  try {
    final messaging = FirebaseMessaging.instance;
    final settings = await messaging.requestPermission();
    if (settings.authorizationStatus == AuthorizationStatus.denied) return;
    final token = await messaging.getToken();
    if (token != null) {
      await ref.read(socialRepositoryProvider).saveFcmToken(uid, token);
    }
  } catch (e) {
    debugPrint('Push registration skipped: $e');
  }
}
