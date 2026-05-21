import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

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
  addAccount: (account: NewMoneyAccount) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  hasLoaded: boolean;
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

export const useAccountsStore = create<AccountState>((set, get) => ({
  accounts: defaultAccounts,
  addAccount: async (account) => {
    const nextAccounts = [
      ...get().accounts,
      {
        ...account,
        id: `account_${Date.now()}`
      }
    ];

    set({ accounts: nextAccounts });
    await persistAccounts(nextAccounts);
  },
  deleteAccount: async (id) => {
    const currentAccounts = get().accounts;

    if (currentAccounts.length <= 1) {
      return;
    }

    const nextAccounts = currentAccounts.filter((account) => account.id !== id);
    set({ accounts: nextAccounts });
    await persistAccounts(nextAccounts);
  },
  hasLoaded: false,
  loadAccounts: async () => {
    if (get().hasLoaded) {
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(accountsStorageKey);
      const accounts = stored ? (JSON.parse(stored) as MoneyAccount[]) : defaultAccounts;

      set({
        accounts: accounts.length > 0 ? accounts : defaultAccounts,
        hasLoaded: true
      });
    } catch {
      set({
        accounts: defaultAccounts,
        hasLoaded: true
      });
    }
  },
  updateAccount: async (id, patch) => {
    const nextAccounts = get().accounts.map((account) =>
      account.id === id ? { ...account, ...patch } : account
    );

    set({ accounts: nextAccounts });
    await persistAccounts(nextAccounts);
  }
}));
