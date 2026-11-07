// Cloud sync is native-only; the web design preview keeps data local.
export const SYNCED_TABLES: string[] = [];
export function setSyncUser(_uid: string | null): void {}
export async function pullAllFromCloud(): Promise<void> {}
