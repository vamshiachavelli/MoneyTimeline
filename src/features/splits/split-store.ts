import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export type SavedSplitMethod = "equal" | "exact" | "percentage" | "ratio";
export type SavedSplitTargetType = "people" | "groups";

export type SavedSplitAllocation = {
  amount: number;
  inputValue: number | null;
  personId: string;
  personName: string;
};

export type SavedSplit = {
  allocatedTotal: number;
  allocations: SavedSplitAllocation[];
  createdAt: string;
  id: string;
  merchant: string;
  method: SavedSplitMethod;
  remainingAmount: number;
  targetId: string | null;
  targetName: string;
  targetType: SavedSplitTargetType;
  totalAmount: number;
  transactionId: string;
  updatedAt: string;
};

type SplitInput = Omit<SavedSplit, "createdAt" | "id" | "updatedAt">;

type SplitState = {
  deleteSplitForTransaction: (transactionId: string) => Promise<void>;
  hasLoaded: boolean;
  loadSplits: () => Promise<void>;
  splits: SavedSplit[];
  upsertSplitForTransaction: (split: SplitInput) => Promise<SavedSplit>;
};

const splitsStorageKey = "moneytimeline.splits.v1";

const persistSplits = async (splits: SavedSplit[]) => {
  await AsyncStorage.setItem(splitsStorageKey, JSON.stringify(splits));
};

export const useSplitStore = create<SplitState>((set, get) => ({
  deleteSplitForTransaction: async (transactionId) => {
    const nextSplits = get().splits.filter((split) => split.transactionId !== transactionId);

    set({ splits: nextSplits });
    await persistSplits(nextSplits);
  },
  hasLoaded: false,
  loadSplits: async () => {
    if (get().hasLoaded) {
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(splitsStorageKey);
      const splits = stored ? (JSON.parse(stored) as SavedSplit[]) : [];

      set({
        hasLoaded: true,
        splits
      });
    } catch {
      set({
        hasLoaded: true,
        splits: []
      });
    }
  },
  splits: [],
  upsertSplitForTransaction: async (splitInput) => {
    const existingSplit = get().splits.find(
      (split) => split.transactionId === splitInput.transactionId
    );
    const now = new Date().toISOString();
    const nextSplit: SavedSplit = {
      ...splitInput,
      createdAt: existingSplit?.createdAt ?? now,
      id: existingSplit?.id ?? `split_${Date.now()}`,
      updatedAt: now
    };
    const nextSplits = existingSplit
      ? get().splits.map((split) => (split.id === existingSplit.id ? nextSplit : split))
      : [...get().splits, nextSplit];

    set({ splits: nextSplits });
    await persistSplits(nextSplits);

    return nextSplit;
  }
}));
