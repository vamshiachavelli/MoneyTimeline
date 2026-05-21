import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export type SettlementStatus = "pending" | "user_confirmed" | "both_confirmed" | "cancelled";
export type SettlementTargetType = "person" | "group" | "connection";

export type SavedSettlement = {
  amount: number;
  cancelledAt: string | null;
  counterpartyConfirmedAt: string | null;
  createdAt: string;
  id: string;
  notes: string | null;
  status: SettlementStatus;
  targetId: string;
  targetName: string;
  targetType: SettlementTargetType;
  transactionIds: string[];
  updatedAt: string;
  userConfirmedAt: string | null;
};

type SettlementInput = Omit<
  SavedSettlement,
  "cancelledAt" | "counterpartyConfirmedAt" | "createdAt" | "id" | "updatedAt" | "userConfirmedAt"
>;

type SettlementState = {
  cancelSettlement: (settlementId: string) => Promise<void>;
  createUserConfirmedSettlement: (settlement: SettlementInput) => Promise<SavedSettlement>;
  hasLoaded: boolean;
  loadSettlements: () => Promise<void>;
  settlements: SavedSettlement[];
};

const settlementsStorageKey = "moneytimeline.settlements.v1";

const persistSettlements = async (settlements: SavedSettlement[]) => {
  await AsyncStorage.setItem(settlementsStorageKey, JSON.stringify(settlements));
};

export const isBalanceReducingSettlement = (settlement: SavedSettlement) =>
  settlement.status === "user_confirmed" || settlement.status === "both_confirmed";

export const useSettlementStore = create<SettlementState>((set, get) => ({
  cancelSettlement: async (settlementId) => {
    const now = new Date().toISOString();
    const nextSettlements = get().settlements.map((settlement) =>
      settlement.id === settlementId
        ? {
            ...settlement,
            cancelledAt: now,
            status: "cancelled" as const,
            updatedAt: now
          }
        : settlement
    );

    set({ settlements: nextSettlements });
    await persistSettlements(nextSettlements);
  },
  createUserConfirmedSettlement: async (settlementInput) => {
    const now = new Date().toISOString();
    const nextSettlement: SavedSettlement = {
      ...settlementInput,
      cancelledAt: null,
      counterpartyConfirmedAt: null,
      createdAt: now,
      id: `settlement_${Date.now()}`,
      status: "user_confirmed",
      updatedAt: now,
      userConfirmedAt: now
    };
    const nextSettlements = [nextSettlement, ...get().settlements];

    set({ settlements: nextSettlements });
    await persistSettlements(nextSettlements);

    return nextSettlement;
  },
  hasLoaded: false,
  loadSettlements: async () => {
    if (get().hasLoaded) {
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(settlementsStorageKey);
      const settlements = stored ? (JSON.parse(stored) as SavedSettlement[]) : [];

      set({
        hasLoaded: true,
        settlements
      });
    } catch {
      set({
        hasLoaded: true,
        settlements: []
      });
    }
  },
  settlements: []
}));
