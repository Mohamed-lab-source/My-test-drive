export interface AuthUser {
  uid: string;
  email: string;
  name: string | null;
}

export interface AuthBackend {
  /** Fires once immediately with the current user (or null), then on every change. Returns an unsubscribe function. */
  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<AuthUser>;
  signUp(email: string, password: string, name: string): Promise<AuthUser>;
  signOut(): Promise<void>;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
