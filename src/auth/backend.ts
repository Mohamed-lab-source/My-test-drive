// Single swap point: once a Firebase project is connected, add
// src/auth/firebaseAuthBackend.ts (implementing the same AuthBackend
// interface against @react-native-firebase/auth) and change this one line —
// nothing else in the app needs to know which backend is active.
import { localAuthBackend } from './localAuthBackend';
import type { AuthBackend } from './types';

export const authBackend: AuthBackend = localAuthBackend;
