type Listener = (online: boolean) => void;

let online = true;
const listeners = new Set<Listener>();

/** Fed by the API client: any response means we're online, a request that never got one means we're not. */
export function reportConnectivity(next: boolean) {
  if (next === online) return;
  online = next;
  listeners.forEach((l) => l(next));
}

export function isOnline(): boolean {
  return online;
}

export function subscribeConnectivity(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
