// PLACEHOLDER. The GitHub "Khroga" workflow replaces this file with your
// Firebase project's real settings when it builds the app (see SETUP.md).
// Builds made without those settings show a "not connected" screen.

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform => throw UnsupportedError(
        'This build has no Firebase settings. '
        'Build it with the GitHub "Khroga" workflow (see SETUP.md).',
      );
}

/// Google sign-in "web client" id, filled in by the build workflow.
const String? googleWebClientId = null;
