import { insertRow } from '../db/helpers';
import { useUndoStore } from '../store/undoStore';

// Call right after a delete: the row is already a full snapshot from the
// store, so undoing just re-inserts it as-is (same id) and refreshes.
export function showUndoDelete<T extends object>(
  table: string,
  row: T,
  message: string,
  refresh: () => void | Promise<void>
): void {
  useUndoStore.getState().show(message, () => {
    insertRow(table, row as Record<string, unknown>).then(() => refresh());
  });
}
