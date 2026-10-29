// Single swap point for which AuthBackend implementation is active —
// nothing else in the app needs to know which backend is behind this.
import { firebaseAuthBackend } from './firebaseAuthBackend';
import type { AuthBackend } from './types';

export const authBackend: AuthBackend = firebaseAuthBackend;
