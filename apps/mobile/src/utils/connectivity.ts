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

export type CatalogSource = "server" | "bundle";
type SourceListener = (source: CatalogSource) => void;

let catalogSource: CatalogSource = "server";
const sourceListeners = new Set<SourceListener>();

/** Whether the latest recipe data came from the live server or the copy bundled in the app. */
export function reportCatalogSource(next: CatalogSource) {
  if (next === catalogSource) return;
  catalogSource = next;
  sourceListeners.forEach((l) => l(next));
}

export function getCatalogSource(): CatalogSource {
  return catalogSource;
}

export function subscribeCatalogSource(listener: SourceListener): () => void {
  sourceListeners.add(listener);
  return () => {
    sourceListeners.delete(listener);
  };
}
