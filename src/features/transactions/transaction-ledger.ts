import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo } from "react";
import { create } from "zustand";

import { useAuth } from "@/features/auth/auth-provider";
import { transactionService } from "@/services/supabase/transaction-service";
import type { Json, Transaction as DatabaseTransaction } from "@/types/database";

export type Classification = "personal" | "shared" | "unclassified";
export type TransactionKind = "expense" | "income" | "payment" | "transfer";

export type Transaction = {
  account: string;
  amount: number;
  category: string;
  classification: Classification;
  createdAt: string;
  date: string;
  description: string;
  duplicateHash: string;
  id: string;
  importBatchId?: string | null;
  kind: TransactionKind;
  merchant: string;
  splitConnection: string | null;
  time: string;
  updatedAt: string;
};

export type TransactionPatch = Partial<
  Pick<
    Transaction,
    | "account"
    | "amount"
    | "category"
    | "classification"
    | "date"
    | "description"
    | "kind"
    | "merchant"
    | "splitConnection"
    | "time"
  >
> & {
  updatedAt?: string;
};

type LedgerState = {
  hasLoaded: boolean;
  loadLedger: () => Promise<void>;
  loadRemoteTransactions: (userId: string) => Promise<void>;
  remoteError: string | null;
  remoteHasLoaded: boolean;
  remoteTransactions: Transaction[];
  transactionEdits: Record<string, TransactionPatch>;
  updateTransaction: (transactionId: string, patch: TransactionPatch) => Promise<void>;
};

const ledgerStorageKey = "moneytimeline.transactionLedger.v2";

export const defaultTransactions: Transaction[] = [
  {
    account: "Chase Sapphire",
    amount: 332.1,
    category: "Travel",
    classification: "shared",
    createdAt: "2026-05-01T14:20:00.000Z",
    date: "2026-05-01",
    description: "Flight with Alex and Jordan",
    duplicateHash: "chase-sapphire-2026-05-01-vegas-trip-33210",
    id: "txn_20260501_vegas_trip",
    importBatchId: null,
    kind: "expense",
    merchant: "Vegas Trip",
    splitConnection: "Vegas Trip",
    time: "7:20 AM",
    updatedAt: "2026-05-01T14:20:00.000Z"
  },
  {
    account: "Amex Gold",
    amount: 5.6,
    category: "Coffee",
    classification: "personal",
    createdAt: "2026-05-02T15:42:00.000Z",
    date: "2026-05-02",
    description: "Morning coffee",
    duplicateHash: "amex-gold-2026-05-02-starbucks-560",
   id: "txn_20260502_starbucks",
    importBatchId: null,
    kind: "expense",
    merchant: "Starbucks",
    splitConnection: null,
    time: "8:42 AM",
    updatedAt: "2026-05-02T15:42:00.000Z"
  },
  {
    account: "Wells Fargo Checking",
    amount: 68.4,
    category: "Dining",
    classification: "shared",
    createdAt: "2026-05-04T03:10:00.000Z",
    date: "2026-05-03",
    description: "Split with 3 people",
    duplicateHash: "wells-checking-2026-05-03-dinner-with-friends-6840",
    id: "txn_20260503_dinner_with_friends",
    importBatchId: null,
    kind: "expense",
    merchant: "Dinner with friends",
    splitConnection: "Apartment Crew",
    time: "8:10 PM",
    updatedAt: "2026-05-04T03:10:00.000Z"
  },
  {
    account: "Chase Sapphire",
    amount: 42.18,
    category: "Essentials",
    classification: "personal",
    createdAt: "2026-05-06T00:45:00.000Z",
    date: "2026-05-05",
    description: "Household basics",
    duplicateHash: "chase-sapphire-2026-05-05-target-4218",
    id: "txn_20260505_target",
    importBatchId: null,
    kind: "expense",
    merchant: "Target",
    splitConnection: null,
    time: "5:45 PM",
    updatedAt: "2026-05-06T00:45:00.000Z"
  },
  {
    account: "Chase Sapphire",
    amount: 18.75,
    category: "Transport",
    classification: "personal",
    createdAt: "2026-05-08T06:48:00.000Z",
    date: "2026-05-07",
    description: "Late night ride",
    duplicateHash: "chase-sapphire-2026-05-07-uber-1875",
    id: "txn_20260507_uber",
    importBatchId: null,
    kind: "expense",
    merchant: "Uber",
    splitConnection: null,
    time: "11:48 PM",
    updatedAt: "2026-05-08T06:48:00.000Z"
  },
  {
    account: "Chase Sapphire",
    amount: 64.2,
    category: "Dining",
    classification: "unclassified",
    createdAt: "2026-05-09T19:18:00.000Z",
    date: "2026-05-09",
    description: "Needs review",
    duplicateHash: "chase-sapphire-2026-05-09-chipotle-6420",
    id: "txn_20260509_chipotle",
    importBatchId: null,
    kind: "expense",
    merchant: "Chipotle",
    splitConnection: null,
    time: "12:18 PM",
    updatedAt: "2026-05-09T19:18:00.000Z"
  },
  {
    account: "Amex Gold",
    amount: 6.45,
    category: "Coffee",
    classification: "personal",
    createdAt: "2026-05-12T04:15:00.000Z",
    date: "2026-05-11",
    description: "Coffee after gym",
    duplicateHash: "amex-gold-2026-05-11-starbucks-645",
    id: "txn_20260511_starbucks",
    importBatchId: null,
    kind: "expense",
    merchant: "Starbucks",
    splitConnection: null,
    time: "9:15 PM",
    updatedAt: "2026-05-12T04:15:00.000Z"
  },
  {
    account: "Chase Sapphire",
    amount: 89.99,
    category: "Shopping",
    classification: "shared",
    createdAt: "2026-05-12T05:02:00.000Z",
    date: "2026-05-11",
    description: "Apartment supplies",
    duplicateHash: "chase-sapphire-2026-05-11-amazon-8999",
    id: "txn_20260511_amazon",
    importBatchId: null,
    kind: "expense",
    merchant: "Amazon",
    splitConnection: "Apartment Crew",
    time: "10:02 PM",
    updatedAt: "2026-05-12T05:02:00.000Z"
  },
  {
    account: "Wells Fargo Checking",
    amount: 47.3,
    category: "Groceries",
    classification: "shared",
    createdAt: "2026-05-12T01:20:00.000Z",
    date: "2026-05-11",
    description: "Shared dinner ingredients",
    duplicateHash: "wells-checking-2026-05-11-whole-foods-4730",
    id: "txn_20260511_whole_foods",
    importBatchId: null,
    kind: "expense",
    merchant: "Whole Foods",
    splitConnection: "Apartment Crew",
    time: "6:20 PM",
    updatedAt: "2026-05-12T01:20:00.000Z"
  },
  {
    account: "Chase Sapphire",
    amount: 12.99,
    category: "Entertainment",
    classification: "personal",
    createdAt: "2026-05-11T14:00:00.000Z",
    date: "2026-05-11",
    description: "Monthly subscription",
    duplicateHash: "chase-sapphire-2026-05-11-netflix-1299",
    id: "txn_20260511_netflix",
    importBatchId: null,
    kind: "expense",
    merchant: "Netflix",
    splitConnection: null,
    time: "7:00 AM",
    updatedAt: "2026-05-11T14:00:00.000Z"
  },
  {
    account: "Chase Sapphire",
    amount: 24.1,
    category: "Travel",
    classification: "unclassified",
    createdAt: "2026-05-13T04:15:00.000Z",
    date: "2026-05-12",
    description: "Needs review",
    duplicateHash: "chase-sapphire-2026-05-12-uber-eats-2410",
    id: "txn_20260512_uber_eats",
    importBatchId: null,
    kind: "expense",
    merchant: "Uber Eats",
    splitConnection: null,
    time: "9:15 PM",
    updatedAt: "2026-05-13T04:15:00.000Z"
  },
  {
    account: "Amex Gold",
    amount: 82.45,
    category: "Groceries",
    classification: "personal",
    createdAt: "2026-05-13T00:48:00.000Z",
    date: "2026-05-12",
    description: "Bulk groceries",
    duplicateHash: "amex-gold-2026-05-12-costco-8245",
    id: "txn_20260512_costco",
    importBatchId: null,
    kind: "expense",
    merchant: "Costco",
    splitConnection: null,
    time: "5:48 PM",
    updatedAt: "2026-05-13T00:48:00.000Z"
  },
  {
    account: "Wells Fargo Checking",
    amount: 67.42,
    category: "Shopping",
    classification: "shared",
    createdAt: "2026-05-12T18:20:00.000Z",
    date: "2026-05-12",
    description: "Dinner supplies",
    duplicateHash: "wells-checking-2026-05-12-trader-joes-6742",
    id: "txn_20260512_trader_joes",
    kind: "expense",
    merchant: "Trader Joe's",
    splitConnection: "Apartment Crew",
    time: "11:20 AM",
    updatedAt: "2026-05-12T18:20:00.000Z"
  },
  {
    account: "Chase Sapphire",
    amount: 45,
    category: "Transport",
    classification: "unclassified",
    createdAt: "2026-05-12T16:02:00.000Z",
    date: "2026-05-12",
    description: "Fuel",
    duplicateHash: "chase-sapphire-2026-05-12-shell-gas-station-4500",
    id: "txn_20260512_shell_gas_station",
    kind: "expense",
    merchant: "Shell Gas Station",
    splitConnection: null,
    time: "9:02 AM",
    updatedAt: "2026-05-12T16:02:00.000Z"
  },
  {
    account: "Amex Gold",
    amount: 74.25,
    category: "Dining",
    classification: "shared",
    createdAt: "2026-05-16T17:45:00.000Z",
    date: "2026-05-16",
    description: "Group meal",
    duplicateHash: "amex-gold-2026-05-16-brunch-7425",
    id: "txn_20260516_brunch",
    kind: "expense",
    merchant: "Brunch",
    splitConnection: "NYC Friends",
    time: "10:45 AM",
    updatedAt: "2026-05-16T17:45:00.000Z"
  },
  {
    account: "Wells Fargo Checking",
    amount: 210.4,
    category: "Bills",
    classification: "unclassified",
    createdAt: "2026-05-18T15:00:00.000Z",
    date: "2026-05-18",
    description: "Roommate split likely",
    duplicateHash: "wells-checking-2026-05-18-electric-bill-21040",
    id: "txn_20260518_electric_bill",
    kind: "expense",
    merchant: "Electric Bill",
    splitConnection: null,
    time: "8:00 AM",
    updatedAt: "2026-05-18T15:00:00.000Z"
  },
  {
    account: "Chase Sapphire",
    amount: 35.24,
    category: "Groceries",
    classification: "personal",
    createdAt: "2026-05-22T01:14:00.000Z",
    date: "2026-05-21",
    description: "Weekly groceries",
    duplicateHash: "chase-sapphire-2026-05-21-trader-joes-3524",
    id: "txn_20260521_trader_joes",
    kind: "expense",
    merchant: "Trader Joe's",
    splitConnection: null,
    time: "6:14 PM",
    updatedAt: "2026-05-22T01:14:00.000Z"
  }
];

export const classificationLabel: Record<Classification, string> = {
  personal: "Personal",
  shared: "Shared",
  unclassified: "Unclassified"
};

export const transactionKindLabel: Record<TransactionKind, string> = {
  expense: "Expense",
  income: "Income",
  payment: "Payment",
  transfer: "Transfer"
};

export const isSpendTransaction = (transaction: Transaction) => transaction.kind === "expense";

export const getTransactionKey = (transaction: Transaction) => transaction.id;

export const getTransactionById = (transactionId: string, ledger: Transaction[]) =>
  ledger.find((transaction) => transaction.id === transactionId) ?? null;

export const formatCurrency = (value: number, compact = false) =>
  new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: compact ? 0 : 2,
    minimumFractionDigits: compact ? 0 : 2,
    style: "currency"
  }).format(value);

export const formatSpendAmount = (value: number) =>
  value <= 0 ? formatCurrency(value) : `-${formatCurrency(value)}`;

export const formatTransactionAmount = (transaction: Pick<Transaction, "amount" | "kind">) => {
  if (transaction.kind === "expense") {
    return formatSpendAmount(transaction.amount);
  }

  if (transaction.kind === "income") {
    return `+${formatCurrency(Math.abs(transaction.amount))}`;
  }

  return transaction.amount < 0
    ? formatCurrency(transaction.amount)
    : formatCurrency(transaction.amount);
};

const isClassification = (value: unknown): value is Classification =>
  value === "personal" || value === "shared" || value === "unclassified";

const sanitizeTransactionPatch = (value: unknown): TransactionPatch => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const patch = value as Record<string, unknown>;
  const sanitized: TransactionPatch = {};

  if (typeof patch.account === "string") {
    sanitized.account = patch.account;
  }

  if (typeof patch.amount === "number" && Number.isFinite(patch.amount)) {
    sanitized.amount = patch.amount;
  }

  if (typeof patch.category === "string") {
    sanitized.category = patch.category;
  }

  if (isClassification(patch.classification)) {
    sanitized.classification = patch.classification;
  }

  if (typeof patch.date === "string") {
    sanitized.date = patch.date;
  }

  if (typeof patch.description === "string") {
    sanitized.description = patch.description;
  }

  if (typeof patch.merchant === "string") {
    sanitized.merchant = patch.merchant;
  }

  if (
    patch.kind === "expense" ||
    patch.kind === "income" ||
    patch.kind === "payment" ||
    patch.kind === "transfer"
  ) {
    sanitized.kind = patch.kind;
  }

  if (typeof patch.splitConnection === "string" || patch.splitConnection === null) {
    sanitized.splitConnection = patch.splitConnection;
  }

  if (typeof patch.time === "string") {
    sanitized.time = patch.time;
  }

  if (typeof patch.updatedAt === "string") {
    sanitized.updatedAt = patch.updatedAt;
  }

  return sanitized;
};

const sanitizeTransactionEdits = (value: unknown): Record<string, TransactionPatch> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, TransactionPatch>>((acc, [id, patch]) => {
    if (defaultTransactions.some((transaction) => transaction.id === id)) {
      acc[id] = sanitizeTransactionPatch(patch);
    }

    return acc;
  }, {});
};

const persistTransactionEdits = async (transactionEdits: Record<string, TransactionPatch>) => {
  await AsyncStorage.setItem(ledgerStorageKey, JSON.stringify({ transactionEdits }));
};

const readMetadataString = (metadata: Json, key: string) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = metadata[key];

  return typeof value === "string" ? value : null;
};

const inferTransactionKind = (transaction: DatabaseTransaction): TransactionKind => {
  const descriptor = `${transaction.merchant} ${transaction.description ?? ""}`;

  if (
    /mobile payment - thank you|payment thank you|american express.*ach pmt|ach pmt|credit card payment|card payment|autopay|online payment|payment to/i.test(
      descriptor
    )
  ) {
    return "payment";
  }

  if (/transfer (to|from)|internet transfer|external transfer|account transfer/i.test(descriptor)) {
    return "transfer";
  }

  if (/payroll|deposit|zelle payment from|refund|credit/i.test(descriptor)) {
    return "income";
  }

  return transaction.kind ?? "expense";
};

const toLedgerTransaction = (
  transaction: DatabaseTransaction
): Transaction => {
  const kind = inferTransactionKind(transaction);
  const amount =
    kind === "payment" ? -(transaction.amount_minor / 100) : transaction.amount_minor / 100;

  return {
    account: readMetadataString(transaction.metadata, "import_account_name") ?? "Imported account",
    amount,
    category:
      readMetadataString(transaction.metadata, "import_category") ??
      (kind === "payment" || kind === "transfer"
        ? "Payments / Transfers"
        : kind === "income"
          ? "Income"
          : "Uncategorized"),
    classification:
      transaction.status === "personal" || transaction.status === "shared"
        ? transaction.status
        : "unclassified",
    createdAt: transaction.created_at,
    date: transaction.transaction_date,
    description: transaction.description ?? transaction.original_description ?? "",
    duplicateHash: transaction.duplicate_hash,
    id: transaction.id,
    importBatchId: readMetadataString(transaction.metadata, "import_batch_id"),
    kind,
    merchant: transaction.merchant,
    splitConnection: readMetadataString(transaction.metadata, "split_connection"),
    time: transaction.posted_at
      ? new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit"
        }).format(new Date(transaction.posted_at))
      : "All day",
    updatedAt: transaction.updated_at
  };
};

export const useTransactionLedgerStore = create<LedgerState>((set, get) => ({
  hasLoaded: false,
  loadLedger: async () => {
    if (get().hasLoaded) {
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(ledgerStorageKey);
      const parsed = stored ? (JSON.parse(stored) as { transactionEdits?: unknown }) : null;

      set({
        hasLoaded: true,
        transactionEdits: sanitizeTransactionEdits(parsed?.transactionEdits)
      });
    } catch {
      set({ hasLoaded: true, transactionEdits: {} });
    }
  },
  loadRemoteTransactions: async (userId) => {
    try {
      const transactions = await transactionService.listForUser(userId);

      set({
        remoteError: null,
        remoteHasLoaded: true,
        remoteTransactions: transactions.map(toLedgerTransaction)
      });
    } catch (error) {
      set({
        remoteError:
          error instanceof Error ? error.message : "Could not load transactions from Supabase.",
        remoteHasLoaded: true,
        remoteTransactions: []
      });
    }
  },
  remoteError: null,
  remoteHasLoaded: false,
  remoteTransactions: [],
  transactionEdits: {},
  updateTransaction: async (transactionId, patch) => {
    const nextPatch = sanitizeTransactionPatch({
      ...patch,
      updatedAt: new Date().toISOString()
    });
    const nextEdits = {
      ...get().transactionEdits,
      [transactionId]: {
        ...(get().transactionEdits[transactionId] ?? {}),
        ...nextPatch
      }
    };

    set({ transactionEdits: nextEdits });
    await persistTransactionEdits(nextEdits);
  }
}));

export const useLedgerTransactions = () => {
  const { user } = useAuth();
  const loadLedger = useTransactionLedgerStore((state) => state.loadLedger);
  const loadRemoteTransactions = useTransactionLedgerStore(
    (state) => state.loadRemoteTransactions
  );
  const remoteTransactions = useTransactionLedgerStore((state) => state.remoteTransactions);
  const transactionEdits = useTransactionLedgerStore((state) => state.transactionEdits);

  useEffect(() => {
    if (user) {
      void loadRemoteTransactions(user.id);
      return;
    }

    void loadLedger();
  }, [loadLedger, loadRemoteTransactions, user]);

  return useMemo(
    () => {
      const sourceTransactions = user ? remoteTransactions : defaultTransactions;

      return sourceTransactions.map((transaction) => ({
        ...transaction,
        ...(transactionEdits[transaction.id] ?? {})
      }));
    },
    [remoteTransactions, transactionEdits, user]
  );
};
