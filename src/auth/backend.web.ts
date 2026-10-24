// Web is only used to preview the design (the app ships for Android), and
// Firebase's native SDK doesn't run in a browser, so the web build signs
// straight into a local preview account.
import type { AuthBackend, AuthUser } from './types';

const PREVIEW_USER: AuthUser = { uid: 'preview', email: 'preview@anchor.app', name: 'Preview' };

export const authBackend: AuthBackend = {
  onAuthStateChanged(callback) {
    callback(PREVIEW_USER);
    return () => {};
  },
  signIn: async () => PREVIEW_USER,
  signUp: async () => PREVIEW_USER,
  signOut: async () => {},
};
