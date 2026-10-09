import 'package:firebase_core/firebase_core.dart';

/// Our free website (Firebase Hosting): `{project}.web.app`. Null when the
/// app isn't connected to Firebase (test builds).
String? webHost() {
  try {
    return '${Firebase.app().options.projectId}.web.app';
  } catch (_) {
    return null;
  }
}
