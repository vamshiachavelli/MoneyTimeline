import { create } from "zustand";

import type { ImportAccount } from "@/features/import/import-accounts";
import type { StatementParseResult } from "@/features/import/statement-parser";

export type ImportSession = {
  account: ImportAccount;
  createdAt: string;
  fileName: string;
  importJobId?: string | null;
  result: StatementParseResult;
  uploadedFileId?: string | null;
};

type ImportSessionState = {
  clearSession: () => void;
  session: ImportSession | null;
  setSession: (session: Omit<ImportSession, "createdAt">) => void;
};

export const useImportSessionStore = create<ImportSessionState>((set) => ({
  clearSession: () => set({ session: null }),
  session: null,
  setSession: (session) =>
    set({
      session: {
        ...session,
        createdAt: new Date().toISOString()
      }
    })
}));
