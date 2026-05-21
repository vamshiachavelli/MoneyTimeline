import { type MoneyGroup } from "@/features/groups/group-store";
import { type MoneyPerson } from "@/features/people/people-store";
import {
  isBalanceReducingSettlement,
  type SavedSettlement,
  type SettlementTargetType
} from "@/features/settlements/settlement-store";
import { type SavedSplit } from "@/features/splits/split-store";
import { type Transaction } from "@/features/transactions/transaction-ledger";

export type SharedBalanceRow = {
  amount: number;
  color: string;
  count: number;
  id: string;
  memberCount?: number;
  meta: string;
  name: string;
  settledAmount: number;
  transactionIds: string[];
  type: SettlementTargetType;
};

export type SharedTransactionRow = {
  amount: number;
  category: string;
  connection: string;
  date: string;
  id: string;
  merchant: string;
  method: string;
  saved: boolean;
  time: string;
};

export type SharedBalanceModel = {
  groupRows: SharedBalanceRow[];
  peopleRows: SharedBalanceRow[];
  settlementRows: SavedSettlement[];
  totalOwed: number;
  totalShared: number;
  totalYouOwe: number;
  transactionRows: SharedTransactionRow[];
};

type BalanceAccumulator = {
  amount: number;
  transactionIds: Set<string>;
};

const zeroBalance = (): BalanceAccumulator => ({
  amount: 0,
  transactionIds: new Set<string>()
});

const normalizeName = (value: string) => value.trim().toLowerCase();

const addBalance = (
  map: Map<string, BalanceAccumulator>,
  id: string,
  amount: number,
  transactionId: string
) => {
  const current = map.get(id) ?? zeroBalance();

  current.amount += amount;
  current.transactionIds.add(transactionId);
  map.set(id, current);
};

const getSplitMethodLabel = (split: SavedSplit | undefined) => {
  if (!split) {
    return "Needs split details";
  }

  if (split.method === "exact") {
    return "Exact split";
  }

  if (split.method === "percentage") {
    return "Percent split";
  }

  if (split.method === "ratio") {
    return "Ratio split";
  }

  return "Equal split";
};

const getSplitConnection = (transaction: Transaction, split: SavedSplit | undefined) =>
  split?.targetName ?? transaction.splitConnection ?? "Shared expense";

const getMatchedPeople = (connection: string | null, people: MoneyPerson[]) => {
  if (!connection) {
    return [];
  }

  const tokens = connection
    .split(",")
    .map((token) => normalizeName(token))
    .filter(Boolean);

  return people.filter((person) => tokens.includes(normalizeName(person.name)));
};

const getMatchedGroup = (connection: string | null, groups: MoneyGroup[]) => {
  if (!connection) {
    return null;
  }

  return (
    groups.find((group) => normalizeName(group.name) === normalizeName(connection)) ?? null
  );
};

const getSettledAmount = (
  settlements: SavedSettlement[],
  targetType: SettlementTargetType,
  targetId: string
) =>
  settlements
    .filter(
      (settlement) =>
        settlement.targetType === targetType &&
        settlement.targetId === targetId &&
        isBalanceReducingSettlement(settlement)
    )
    .reduce((sum, settlement) => sum + settlement.amount, 0);

const buildRowAmount = (
  amount: number,
  settlements: SavedSettlement[],
  targetType: SettlementTargetType,
  targetId: string
) => {
  const settledAmount = getSettledAmount(settlements, targetType, targetId);
  const sign = amount >= 0 ? 1 : -1;
  const remaining = Math.max(Math.abs(amount) - settledAmount, 0) * sign;

  return {
    remaining,
    settledAmount
  };
};

export const buildSharedBalanceModel = ({
  groups,
  ledgerTransactions,
  people,
  settlements,
  splits
}: {
  groups: MoneyGroup[];
  ledgerTransactions: Transaction[];
  people: MoneyPerson[];
  settlements: SavedSettlement[];
  splits: SavedSplit[];
}): SharedBalanceModel => {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const splitsByTransactionId = new Map(splits.map((split) => [split.transactionId, split]));
  const directPersonBalances = new Map<string, BalanceAccumulator>();
  const displayPersonBalances = new Map<string, BalanceAccumulator>();
  const groupBalances = new Map<string, BalanceAccumulator>();
  const connectionBalances = new Map<string, BalanceAccumulator>();
  const connectionNames = new Map<string, string>();
  const sharedTransactions = ledgerTransactions
    .filter((transaction) => transaction.classification === "shared")
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

  splits.forEach((split) => {
    if (split.targetType === "groups") {
      if (split.targetId && groupById.has(split.targetId)) {
        addBalance(groupBalances, split.targetId, split.allocatedTotal, split.transactionId);
      } else {
        const key = normalizeName(split.targetName || "Shared group");
        connectionNames.set(key, split.targetName || "Shared group");
        addBalance(connectionBalances, key, split.allocatedTotal, split.transactionId);
      }

      split.allocations.forEach((allocation) => {
        if (peopleById.has(allocation.personId)) {
          addBalance(
            displayPersonBalances,
            allocation.personId,
            allocation.amount,
            split.transactionId
          );
        }
      });
      return;
    }

    split.allocations.forEach((allocation) => {
      if (!peopleById.has(allocation.personId)) {
        return;
      }

      addBalance(directPersonBalances, allocation.personId, allocation.amount, split.transactionId);
      addBalance(displayPersonBalances, allocation.personId, allocation.amount, split.transactionId);
    });
  });

  sharedTransactions.forEach((transaction) => {
    if (splitsByTransactionId.has(transaction.id)) {
      return;
    }

    const matchedGroup = getMatchedGroup(transaction.splitConnection, groups);

    if (matchedGroup) {
      addBalance(groupBalances, matchedGroup.id, transaction.amount, transaction.id);

      const memberShare =
        matchedGroup.memberIds.length > 0
          ? transaction.amount / matchedGroup.memberIds.length
          : 0;

      matchedGroup.memberIds.forEach((personId) => {
        if (peopleById.has(personId)) {
          addBalance(displayPersonBalances, personId, memberShare, transaction.id);
        }
      });
      return;
    }

    const matchedPeople = getMatchedPeople(transaction.splitConnection, people);

    if (matchedPeople.length > 0) {
      const personShare = transaction.amount / matchedPeople.length;

      matchedPeople.forEach((person) => {
        addBalance(directPersonBalances, person.id, personShare, transaction.id);
        addBalance(displayPersonBalances, person.id, personShare, transaction.id);
      });
      return;
    }

    const connectionName = transaction.splitConnection ?? transaction.merchant;
    const key = normalizeName(connectionName);
    connectionNames.set(key, connectionName);
    addBalance(connectionBalances, key, transaction.amount, transaction.id);
  });

  const peopleRows = people
    .map<SharedBalanceRow>((person) => {
      const computed = displayPersonBalances.get(person.id);
      const amount = computed?.amount ?? person.balancePreview;
      const count = computed?.transactionIds.size ?? (Math.abs(person.balancePreview) > 0 ? 1 : 0);
      const { remaining, settledAmount } = buildRowAmount(
        amount,
        settlements,
        "person",
        person.id
      );

      return {
        amount: remaining,
        color: person.color,
        count,
        id: person.id,
        meta: `${count} split ${count === 1 ? "share" : "shares"}`,
        name: person.name,
        settledAmount,
        transactionIds: Array.from(computed?.transactionIds ?? []),
        type: "person"
      };
    })
    .filter((row) => Math.abs(row.amount) >= 0.01)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  const groupRows = groups
    .map<SharedBalanceRow>((group) => {
      const computed = groupBalances.get(group.id);
      const amount = computed?.amount ?? group.balancePreview;
      const count = computed?.transactionIds.size ?? (Math.abs(group.balancePreview) > 0 ? 1 : 0);
      const { remaining, settledAmount } = buildRowAmount(
        amount,
        settlements,
        "group",
        group.id
      );

      return {
        amount: remaining,
        color: group.color,
        count,
        id: group.id,
        memberCount: group.memberIds.length,
        meta: `${group.memberIds.length} members - ${count} ${count === 1 ? "expense" : "expenses"}`,
        name: group.name,
        settledAmount,
        transactionIds: Array.from(computed?.transactionIds ?? []),
        type: "group"
      };
    })
    .filter((row) => Math.abs(row.amount) >= 0.01);

  const connectionRows = Array.from(connectionBalances.entries()).map<SharedBalanceRow>(
    ([id, balance]) => {
      const { remaining, settledAmount } = buildRowAmount(
        balance.amount,
        settlements,
        "connection",
        id
      );

      return {
        amount: remaining,
        color: "#14B8A6",
        count: balance.transactionIds.size,
        id,
        meta: `${balance.transactionIds.size} imported ${
          balance.transactionIds.size === 1 ? "expense" : "expenses"
        }`,
        name: connectionNames.get(id) ?? "Shared expense",
        settledAmount,
        transactionIds: Array.from(balance.transactionIds),
        type: "connection"
      };
    }
  );

  const allGroupRows = [...groupRows, ...connectionRows]
    .filter((row) => Math.abs(row.amount) >= 0.01)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  const directPeopleTotal = Array.from(directPersonBalances.entries()).reduce(
    (sum, [personId, balance]) => {
      const { remaining } = buildRowAmount(balance.amount, settlements, "person", personId);
      return sum + Math.max(remaining, 0);
    },
    0
  );
  const totalOwed =
    allGroupRows.reduce((sum, row) => sum + Math.max(row.amount, 0), 0) + directPeopleTotal;
  const totalYouOwe =
    allGroupRows.reduce((sum, row) => sum + Math.abs(Math.min(row.amount, 0)), 0) +
    Array.from(directPersonBalances.entries()).reduce((sum, [personId, balance]) => {
      const { remaining } = buildRowAmount(balance.amount, settlements, "person", personId);
      return sum + Math.abs(Math.min(remaining, 0));
    }, 0);
  const transactionRows = sharedTransactions.map<SharedTransactionRow>((transaction) => {
    const split = splitsByTransactionId.get(transaction.id);

    return {
      amount: transaction.amount,
      category: transaction.category,
      connection: getSplitConnection(transaction, split),
      date: transaction.date,
      id: transaction.id,
      merchant: transaction.merchant,
      method: getSplitMethodLabel(split),
      saved: !!split,
      time: transaction.time
    };
  });

  return {
    groupRows: allGroupRows,
    peopleRows,
    settlementRows: settlements,
    totalOwed,
    totalShared: sharedTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    totalYouOwe,
    transactionRows
  };
};
