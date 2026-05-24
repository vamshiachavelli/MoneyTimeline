import { create } from "zustand";

import type { SaveableImportTransaction } from "@/features/import/import-save-service";

export type ImportCompletion = {
  accountName: string;
  batchId: string;
  dateRange: string;
  fileName: string;
  importedAt: string;
  paymentCount: number;
  savedCount: number;
  transactions: SaveableImportTransaction[];
};

type ImportCompletionState = {
  clearCompletion: () => void;
  completion: ImportCompletion | null;
  setCompletion: (completion: Omit<ImportCompletion, "importedAt">) => void;
};

export const useImportCompletionStore = create<ImportCompletionState>((set) => ({
  clearCompletion: () => set({ completion: null }),
  completion: null,
  setCompletion: (completion) =>
    set({
      completion: {
        ...completion,
        importedAt: new Date().toISOString()
      }
    })
}));
