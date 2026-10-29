import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from '@react-native-firebase/auth';
import type { AuthBackend, AuthUser } from './types';
import { AuthError } from './types';

function toAuthUser(user: FirebaseUser): AuthUser {
  return { uid: user.uid, email: user.email ?? '', name: user.displayName };
}

function mapError(e: unknown): AuthError {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return new AuthError('That email address looks invalid.');
    case 'auth/user-disabled':
      return new AuthError('This account has been disabled.');
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return new AuthError('That email and password don’t match.');
    case 'auth/email-already-in-use':
      return new AuthError('An account with that email already exists.');
    case 'auth/weak-password':
      return new AuthError('Use a stronger password (at least 6 characters).');
    case 'auth/network-request-failed':
      return new AuthError('No internet connection. Please try again.');
    case 'auth/too-many-requests':
      return new AuthError('Too many attempts. Please wait a moment and try again.');
    default:
      return new AuthError('Something went wrong. Please try again.');
  }
}

export const firebaseAuthBackend: AuthBackend = {
  onAuthStateChanged(callback) {
    return onAuthStateChanged(getAuth(), (user) => callback(user ? toAuthUser(user) : null));
  },

  async signIn(email, password) {
    try {
      const cred = await signInWithEmailAndPassword(getAuth(), email.trim(), password);
      return toAuthUser(cred.user);
    } catch (e) {
      throw mapError(e);
    }
  },

  async signUp(email, password, name) {
    try {
      const cred = await createUserWithEmailAndPassword(getAuth(), email.trim(), password);
      const trimmedName = name.trim();
      if (trimmedName) {
        await updateProfile(cred.user, { displayName: trimmedName });
      }
      return { uid: cred.user.uid, email: cred.user.email ?? email.trim(), name: trimmedName || null };
    } catch (e) {
      throw mapError(e);
    }
  },

  async signOut() {
    await firebaseSignOut(getAuth());
  },
};
