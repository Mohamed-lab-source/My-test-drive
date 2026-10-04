import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

class AuthRepository {
  AuthRepository(this._auth, this._db);

  final FirebaseAuth _auth;
  final FirebaseFirestore _db;
  bool _googleReady = false;

  Stream<User?> authChanges() => _auth.authStateChanges();
  User? get currentUser => _auth.currentUser;

  Future<void> _initGoogle() async {
    if (_googleReady) return;
    await GoogleSignIn.instance.initialize();
    _googleReady = true;
  }

  /// Signs in with Google. If the person was a guest, their guest account is
  /// upgraded in place so they keep their plans and groups.
  Future<void> signInWithGoogle() async {
    await _initGoogle();
    final account = await GoogleSignIn.instance.authenticate();
    final idToken = account.authentication.idToken;
    if (idToken == null) {
      throw Exception('Google did not return a sign-in token. Please try again.');
    }
    final credential = GoogleAuthProvider.credential(idToken: idToken);

    final current = _auth.currentUser;
    UserCredential result;
    if (current != null && current.isAnonymous) {
      try {
        result = await current.linkWithCredential(credential);
      } on FirebaseAuthException catch (e) {
        if (e.code == 'credential-already-in-use') {
          // This Google account already has a Khroga account: use that one.
          result = await _auth.signInWithCredential(credential);
        } else {
          rethrow;
        }
      }
    } else {
      result = await _auth.signInWithCredential(credential);
    }
    await _ensureUserDocuments(result.user!,
        googleName: account.displayName, googlePhoto: account.photoUrl);
  }

  Future<void> signInAsGuest() async {
    final result = await _auth.signInAnonymously();
    await _ensureUserDocuments(result.user!);
  }

  Future<void> signOut() async {
    try {
      await _initGoogle();
      await GoogleSignIn.instance.signOut();
    } catch (e) {
      debugPrint('Google sign-out skipped: $e');
    }
    await _auth.signOut();
  }

  /// Creates the person's documents on first sign-in. Never overwrites
  /// anything that already exists (their username, settings, etc.).
  Future<void> _ensureUserDocuments(User user,
      {String? googleName, String? googlePhoto}) async {
    final profileRef = _db.collection('publicProfiles').doc(user.uid);
    final userRef = _db.collection('users').doc(user.uid);
    // A guest who just linked Google may not have a display name copied onto
    // their account yet, so fall back to the name Google gave us.
    final candidate = user.displayName?.trim().isNotEmpty ?? false
        ? user.displayName!.trim()
        : googleName?.trim();
    final name = candidate == null || candidate.isEmpty ? 'Guest' : candidate;
    final photo = user.photoURL ?? googlePhoto;

    final profile = await profileRef.get();
    if (!profile.exists) {
      await profileRef.set({
        'displayName': name,
        'photoUrl': photo,
        'createdAt': FieldValue.serverTimestamp(),
      });
    } else if (!user.isAnonymous &&
        profile.data()?['displayName'] == 'Guest' &&
        name != 'Guest') {
      // A guest just upgraded to Google: replace the placeholder name.
      await profileRef.update({'displayName': name, 'photoUrl': photo});
    }

    final userDoc = await userRef.get();
    if (!userDoc.exists) {
      await userRef.set({'createdAt': FieldValue.serverTimestamp()});
    }
  }
}
