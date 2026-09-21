// TEMPORARY placeholder backend, standing in for real Firebase Authentication
// until a Firebase project is connected (see src/auth/backend.ts). It stores
// accounts in AsyncStorage on-device — passwords are NOT hashed or secured
// in any real sense. This exists purely so the sign-in/create-account UI is
// fully working and demoable before the cloud project exists; it must not be
// mistaken for a real auth system.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { newId } from '../db/client';
import type { AuthBackend, AuthUser } from './types';
import { AuthError } from './types';

const USERS_KEY = 'anchor-auth-users';
const SESSION_KEY = 'anchor-auth-session';

interface StoredUser extends AuthUser {
  password: string;
}

async function readUsers(): Promise<StoredUser[]> {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeUsers(users: StoredUser[]): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function toPublicUser(u: StoredUser): AuthUser {
  return { uid: u.uid, email: u.email, name: u.name };
}

const listeners = new Set<(user: AuthUser | null) => void>();

async function getSessionUser(): Promise<AuthUser | null> {
  const uid = await AsyncStorage.getItem(SESSION_KEY);
  if (!uid) return null;
  const users = await readUsers();
  const found = users.find((u) => u.uid === uid);
  return found ? toPublicUser(found) : null;
}

function notify(user: AuthUser | null) {
  listeners.forEach((cb) => cb(user));
}

export const localAuthBackend: AuthBackend = {
  onAuthStateChanged(callback) {
    listeners.add(callback);
    getSessionUser().then(callback);
    return () => listeners.delete(callback);
  },

  async signIn(email, password) {
    const users = await readUsers();
    const match = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!match || match.password !== password) {
      throw new AuthError('That email and password don’t match.');
    }
    await AsyncStorage.setItem(SESSION_KEY, match.uid);
    const user = toPublicUser(match);
    notify(user);
    return user;
  },

  async signUp(email, password, name) {
    const users = await readUsers();
    const normalizedEmail = email.trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      throw new AuthError('An account with that email already exists.');
    }
    const newUser: StoredUser = { uid: newId(), email: email.trim(), name: name.trim() || null, password };
    await writeUsers([...users, newUser]);
    await AsyncStorage.setItem(SESSION_KEY, newUser.uid);
    const user = toPublicUser(newUser);
    notify(user);
    return user;
  },

  async signOut() {
    await AsyncStorage.removeItem(SESSION_KEY);
    notify(null);
  },
};
