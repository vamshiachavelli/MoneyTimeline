import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { isSupabaseConfigured } from "@/config/env";
import { accountService } from "@/services/supabase/account-service";
import { getSupabaseClient } from "@/services/supabase/client";
import type { Account, AccountType } from "@/types/database";

export type MoneyAccount = {
  accountType: string;
  color: string;
  id: string;
  institution: string;
  lastFour: string;
  name: string;
};

type NewMoneyAccount = Omit<MoneyAccount, "id">;

type AccountState = {
  accounts: MoneyAccount[];
  addAccount: (account: NewMoneyAccount) => Promise<MoneyAccount>;
  deleteAccount: (id: string) => Promise<void>;
  hasLoaded: boolean;
  loadedUserId: string | null;
  loadAccounts: () => Promise<void>;
  updateAccount: (id: string, patch: Partial<NewMoneyAccount>) => Promise<void>;
};

const accountsStorageKey = "moneytimeline.accounts.v1";

export const defaultAccounts: MoneyAccount[] = [
  {
    accountType: "Credit card",
    color: "#2F7BFF",
    id: "chase-sapphire",
    institution: "Chase",
    lastFour: "1234",
    name: "Chase Sapphire"
  },
  {
    accountType: "Credit card",
    color: "#F6C343",
    id: "amex-gold",
    institution: "Amex",
    lastFour: "5678",
    name: "Amex Gold"
  },
  {
    accountType: "Checking",
    color: "#E94D4D",
    id: "wells-checking",
    institution: "Wells Fargo",
    lastFour: "9876",
    name: "Wells Fargo Checking"
  }
];

const persistAccounts = async (accounts: MoneyAccount[]) => {
  await AsyncStorage.setItem(accountsStorageKey, JSON.stringify(accounts));
};

const dbAccountTypeToLabel: Record<AccountType, string> = {
  cash: "Cash",
  checking: "Checking",
  credit_card: "Credit card",
  investment: "Investment",
  loan: "Loan",
  other: "Other",
  savings: "Savings"
};

const accountTypeLabelToDb = (label: string): AccountType => {
  const normalized = label.toLowerCase();

  if (normalized.includes("credit")) {
    return "credit_card";
  }

  if (normalized.includes("checking")) {
    return "checking";
  }

  if (normalized.includes("saving")) {
    return "savings";
  }

  if (normalized.includes("cash")) {
    return "cash";
  }

  return "other";
};

const toMoneyAccount = (account: Account): MoneyAccount => ({
  accountType: dbAccountTypeToLabel[account.account_type],
  color: account.color ?? "#43D88B",
  id: account.id,
  institution: account.institution ?? "Manual",
  lastFour: account.last_four ?? "----",
  name: account.name
});

const getCurrentUserId = async () => {
  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    const {
      data: { user }
    } = await getSupabaseClient().auth.getUser();

    return user?.id ?? null;
  } catch {
    return null;
  }
};

const createDefaultRemoteAccounts = async (userId: string) => {
  const created = [];

  for (const account of defaultAccounts) {
    created.push(
      await accountService.create(userId, {
        account_type: accountTypeLabelToDb(account.accountType),
        color: account.color,
        currency: "USD",
        institution: account.institution,
        last_four: account.lastFour,
        name: account.name
      })
    );
  }

  return created.map(toMoneyAccount);
};

export const useAccountsStore = create<AccountState>((set, get) => ({
  accounts: defaultAccounts,
  addAccount: async (account) => {
    const userId = await getCurrentUserId();

    if (userId) {
      const created = await accountService.create(userId, {
        account_type: accountTypeLabelToDb(account.accountType),
        color: account.color,
        currency: "USD",
        institution: account.institution,
        last_four: account.lastFour,
        name: account.name
      });
      const nextAccounts = [...get().accounts, toMoneyAccount(created)];

      set({ accounts: nextAccounts });
      await persistAccounts(nextAccounts);
      return toMoneyAccount(created);
    }

    const createdAccount = {
      ...account,
      id: `account_${Date.now()}`
    };
    const nextAccounts = [
      ...get().accounts,
      createdAccount
    ];

    set({ accounts: nextAccounts });
    await persistAccounts(nextAccounts);
    return createdAccount;
  },
  deleteAccount: async (id) => {
    const currentAccounts = get().accounts;

    if (currentAccounts.length <= 1) {
      return;
    }

    const userId = await getCurrentUserId();

    if (userId) {
      await accountService.softDelete(id);
    }

    const nextAccounts = currentAccounts.filter((account) => account.id !== id);
    set({ accounts: nextAccounts });
    await persistAccounts(nextAccounts);
  },
  hasLoaded: false,
  loadedUserId: null,
  loadAccounts: async () => {
    try {
      const userId = await getCurrentUserId();

      if (get().hasLoaded && get().loadedUserId === userId) {
        return;
      }

      if (userId) {
        const remoteAccounts = await accountService.list(userId);
        const accounts =
          remoteAccounts.length > 0
            ? remoteAccounts.map(toMoneyAccount)
            : await createDefaultRemoteAccounts(userId);

        set({
          accounts,
          hasLoaded: true,
          loadedUserId: userId
        });
        await persistAccounts(accounts);
        return;
      }

      const stored = await AsyncStorage.getItem(accountsStorageKey);
      const accounts = stored ? (JSON.parse(stored) as MoneyAccount[]) : defaultAccounts;

      set({
        accounts: accounts.length > 0 ? accounts : defaultAccounts,
        hasLoaded: true,
        loadedUserId: null
      });
    } catch {
      set({
        accounts: defaultAccounts,
        hasLoaded: true,
        loadedUserId: null
      });
    }
  },
  updateAccount: async (id, patch) => {
    const userId = await getCurrentUserId();

    if (userId) {
      await accountService.update(id, {
        account_type: patch.accountType ? accountTypeLabelToDb(patch.accountType) : undefined,
        color: patch.color,
        institution: patch.institution,
        last_four: patch.lastFour,
        name: patch.name
      });
    }

    const nextAccounts = get().accounts.map((account) =>
      account.id === id ? { ...account, ...patch } : account
    );

    set({ accounts: nextAccounts });
    await persistAccounts(nextAccounts);
  }
}));
