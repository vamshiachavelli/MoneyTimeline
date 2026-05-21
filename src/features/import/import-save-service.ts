import AsyncStorage from "@react-native-async-storage/async-storage";

export type SaveableImportTransaction = {
  accountId: string;
  accountName: string;
  amount: number;
  category: string | null;
  date: string;
  description: string | null;
  duplicateHash: string;
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

export const saveReviewedImport = async ({
  fileName,
  transactions
}: {
  fileName: string;
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
    savedCount: transactions.length
  };
};
