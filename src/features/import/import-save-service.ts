import AsyncStorage from "@react-native-async-storage/async-storage";

import { isSupabaseConfigured } from "@/config/env";
import type { ParsedTransactionKind } from "@/features/import/statement-parser";
import { transactionService, type TransactionInput } from "@/services/supabase/transaction-service";

export type SaveableImportTransaction = {
  accountId: string;
  accountName: string;
  amount: number;
  category: string | null;
  date: string;
  description: string | null;
  duplicateHash: string;
  kind: ParsedTransactionKind;
  merchant: string;
  rowNumber: number;
};

export type SavedImportBatch = {
  fileName: string;
  id: string;
  importedAt: string;
  transactions: SaveableImportTransaction[];
};

const importedTransactionsKey = "moneytimeline.importedTransactions.v1";

export const getSavedImportBatches = async () => {
  try {
    const existingRaw = await AsyncStorage.getItem(importedTransactionsKey);
    return existingRaw ? (JSON.parse(existingRaw) as SavedImportBatch[]) : [];
  } catch {
    return [];
  }
};

export const getSavedDuplicateHashes = async () => {
  const batches = await getSavedImportBatches();

  return new Set(
    batches.flatMap((batch) =>
      batch.transactions.map((transaction) => transaction.duplicateHash)
    )
  );
};

export const getKnownDuplicateHashes = async ({
  hashes,
  userId
}: {
  hashes?: string[];
  userId?: string | null;
} = {}) => {
  const localHashes = await getSavedDuplicateHashes();

  if (!userId || !hashes || hashes.length === 0) {
    return localHashes;
  }

  const remoteHashes = await transactionService.findDuplicateHashes(userId, hashes);

  return new Set([...localHashes, ...remoteHashes]);
};

export const saveReviewedImport = async ({
  fileName,
  importJobId,
  transactions
}: {
  fileName: string;
  importJobId?: string | null;
  transactions: SaveableImportTransaction[];
}) => {
  const existing = await getSavedImportBatches();
  const batch: SavedImportBatch = {
    fileName,
    id: `batch_${Date.now()}`,
    importedAt: new Date().toISOString(),
    transactions
  };

  await AsyncStorage.setItem(importedTransactionsKey, JSON.stringify([batch, ...existing]));

  return {
    batchId: batch.id,
    savedCount: transactions.length,
    transactions
  };
};

const getImportDisplayMerchant = (transaction: SaveableImportTransaction) => {
  if (
    transaction.kind === "payment" &&
    /^(credit card payment|card payment|payment)$/i.test(transaction.merchant)
  ) {
    return `${transaction.accountName} Payment`;
  }

  if (
    transaction.kind === "transfer" &&
    /^(account transfer|transfer)$/i.test(transaction.merchant)
  ) {
    return `${transaction.accountName} Transfer`;
  }

  return transaction.merchant;
};

export const saveReviewedImportToSupabase = async ({
  importJobId,
  transactions,
  uploadedFileId,
  userId
}: {
  importJobId?: string | null;
  transactions: SaveableImportTransaction[];
  uploadedFileId?: string | null;
  userId: string;
}) => {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const batchId = importJobId ?? uploadedFileId ?? `supabase_${Date.now()}`;
  const transactionInputs: TransactionInput[] = transactions.map((transaction) => ({
    account_id: transaction.accountId,
    amount_minor: Math.round(Math.abs(transaction.amount) * 100),
    category_id: null,
    currency: "USD",
    description: transaction.description,
    direction: transaction.amount < 0 ? "credit" : "debit",
    duplicate_hash: transaction.duplicateHash,
    import_job_id: importJobId ?? null,
    kind: transaction.kind,
    metadata: {
      import_account_name: transaction.accountName,
      import_batch_id: batchId,
      import_category: transaction.category,
      import_row_number: transaction.rowNumber
    },
    merchant: getImportDisplayMerchant(transaction),
    original_description: transaction.description,
    status: transaction.kind === "expense" ? "unclassified" : "ignored",
    transaction_date: transaction.date,
    uploaded_file_id: uploadedFileId ?? null
  }));

  const savedTransactions = await transactionService.createMany(userId, transactionInputs);

  return {
    batchId,
    savedCount: savedTransactions?.length ?? transactions.length,
    transactions
  };
};
