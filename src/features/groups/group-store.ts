import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export type MoneyGroup = {
  balancePreview: number;
  color: string;
  id: string;
  memberIds: string[];
  name: string;
  updatedAt: string;
};

type NewMoneyGroup = Omit<MoneyGroup, "id" | "updatedAt">;

type GroupState = {
  addGroup: (group: NewMoneyGroup) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  groups: MoneyGroup[];
  hasLoaded: boolean;
  loadGroups: () => Promise<void>;
  updateGroup: (id: string, patch: Partial<NewMoneyGroup>) => Promise<void>;
};

const groupsStorageKey = "moneytimeline.groups.v1";

export const defaultGroups: MoneyGroup[] = [
  {
    balancePreview: 228.75,
    color: "#A855F7",
    id: "apartment-crew",
    memberIds: ["alex", "jordan", "sam", "mia"],
    name: "Apartment Crew",
    updatedAt: "2026-05-12T12:00:00.000Z"
  },
  {
    balancePreview: -84.2,
    color: "#F59E42",
    id: "trip-to-bali",
    memberIds: ["jordan", "sam", "mia"],
    name: "Trip to Bali",
    updatedAt: "2026-05-12T12:00:00.000Z"
  },
  {
    balancePreview: 12.5,
    color: "#3D7BFF",
    id: "game-night",
    memberIds: ["alex", "jordan", "sam"],
    name: "Game Night",
    updatedAt: "2026-05-12T12:00:00.000Z"
  }
];

const persistGroups = async (groups: MoneyGroup[]) => {
  await AsyncStorage.setItem(groupsStorageKey, JSON.stringify(groups));
};

export const useGroupsStore = create<GroupState>((set, get) => ({
  addGroup: async (group) => {
    const now = new Date().toISOString();
    const nextGroups = [
      ...get().groups,
      {
        ...group,
        id: `group_${Date.now()}`,
        updatedAt: now
      }
    ];

    set({ groups: nextGroups });
    await persistGroups(nextGroups);
  },
  deleteGroup: async (id) => {
    const nextGroups = get().groups.filter((group) => group.id !== id);

    set({ groups: nextGroups });
    await persistGroups(nextGroups);
  },
  groups: defaultGroups,
  hasLoaded: false,
  loadGroups: async () => {
    if (get().hasLoaded) {
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(groupsStorageKey);
      const groups = stored ? (JSON.parse(stored) as MoneyGroup[]) : defaultGroups;

      set({
        groups,
        hasLoaded: true
      });
    } catch {
      set({
        groups: defaultGroups,
        hasLoaded: true
      });
    }
  },
  updateGroup: async (id, patch) => {
    const updatedAt = new Date().toISOString();
    const nextGroups = get().groups.map((group) =>
      group.id === id ? { ...group, ...patch, updatedAt } : group
    );

    set({ groups: nextGroups });
    await persistGroups(nextGroups);
  }
}));
