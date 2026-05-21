import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export type MoneyPerson = {
  balancePreview: number;
  color: string;
  email?: string;
  id: string;
  name: string;
  phone?: string;
  updatedAt: string;
};

type NewMoneyPerson = Omit<MoneyPerson, "id" | "updatedAt">;

type PeopleState = {
  addPerson: (person: NewMoneyPerson) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  hasLoaded: boolean;
  loadPeople: () => Promise<void>;
  people: MoneyPerson[];
  updatePerson: (id: string, patch: Partial<NewMoneyPerson>) => Promise<void>;
};

const peopleStorageKey = "moneytimeline.people.v1";

export const defaultPeople: MoneyPerson[] = [
  {
    balancePreview: 64.2,
    color: "#3D7BFF",
    email: "alex@example.com",
    id: "alex",
    name: "Alex",
    phone: "",
    updatedAt: "2026-05-12T12:00:00.000Z"
  },
  {
    balancePreview: 142.35,
    color: "#A855F7",
    email: "jordan@example.com",
    id: "jordan",
    name: "Jordan",
    phone: "",
    updatedAt: "2026-05-12T12:00:00.000Z"
  },
  {
    balancePreview: 38.45,
    color: "#55C989",
    email: "",
    id: "sam",
    name: "Sam",
    phone: "(555) 010-4812",
    updatedAt: "2026-05-12T12:00:00.000Z"
  },
  {
    balancePreview: -24.8,
    color: "#F59E42",
    email: "mia@example.com",
    id: "mia",
    name: "Mia",
    phone: "",
    updatedAt: "2026-05-12T12:00:00.000Z"
  }
];

export const getPersonInitial = (name: string) =>
  name.trim().charAt(0).toUpperCase() || "?";

const persistPeople = async (people: MoneyPerson[]) => {
  await AsyncStorage.setItem(peopleStorageKey, JSON.stringify(people));
};

export const usePeopleStore = create<PeopleState>((set, get) => ({
  addPerson: async (person) => {
    const now = new Date().toISOString();
    const nextPeople = [
      ...get().people,
      {
        ...person,
        id: `person_${Date.now()}`,
        updatedAt: now
      }
    ];

    set({ people: nextPeople });
    await persistPeople(nextPeople);
  },
  deletePerson: async (id) => {
    const nextPeople = get().people.filter((person) => person.id !== id);

    set({ people: nextPeople });
    await persistPeople(nextPeople);
  },
  hasLoaded: false,
  loadPeople: async () => {
    if (get().hasLoaded) {
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(peopleStorageKey);
      const people = stored ? (JSON.parse(stored) as MoneyPerson[]) : defaultPeople;

      set({
        hasLoaded: true,
        people
      });
    } catch {
      set({
        hasLoaded: true,
        people: defaultPeople
      });
    }
  },
  people: defaultPeople,
  updatePerson: async (id, patch) => {
    const updatedAt = new Date().toISOString();
    const nextPeople = get().people.map((person) =>
      person.id === id ? { ...person, ...patch, updatedAt } : person
    );

    set({ people: nextPeople });
    await persistPeople(nextPeople);
  }
}));
