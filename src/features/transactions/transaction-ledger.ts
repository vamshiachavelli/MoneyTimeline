import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo } from "react";
import { create } from "zustand";

export type Classification = "personal" | "shared" | "unclassified";

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
  value === 0 ? formatCurrency(0) : `-${formatCurrency(value)}`;

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
  const loadLedger = useTransactionLedgerStore((state) => state.loadLedger);
  const transactionEdits = useTransactionLedgerStore((state) => state.transactionEdits);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  return useMemo(
    () =>
      defaultTransactions.map((transaction) => ({
        ...transaction,
        ...(transactionEdits[transaction.id] ?? {})
      })),
    [transactionEdits]
  );
};
