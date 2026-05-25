import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  FileText,
  Hash,
  Banknote,
  ListChecks,
  Pencil,
  Percent,
  ReceiptText,
  Save,
  Scale,
  ShieldCheck,
  Split,
  Tag,
  UserRound,
  UsersRound,
  X
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { Screen } from "@/components/ui/screen";
import { useAccountsStore } from "@/features/accounts/account-store";
import { useGroupsStore } from "@/features/groups/group-store";
import { getPersonInitial, usePeopleStore } from "@/features/people/people-store";
import { useAppearanceTheme } from "@/features/settings/use-appearance-theme";
import {
  useSplitStore,
  type SavedSplit,
  type SavedSplitAllocation
} from "@/features/splits/split-store";
import {
  classificationLabel,
  formatCurrency,
  formatTransactionAmount,
  getTransactionById,
  isSpendTransaction,
  transactionKindLabel,
  useLedgerTransactions,
  useTransactionLedgerStore,
  type Classification,
  type Transaction,
  type TransactionKind
} from "@/features/transactions/transaction-ledger";
import { getReturnTargetRoute } from "@/navigation/return-target";
import { colors, radii, spacing } from "@/styles/theme";

type DetailForm = {
  account: string;
  amount: string;
  category: string;
  classification: Classification;
  date: string;
  description: string;
  merchant: string;
  splitConnection: string;
  time: string;
};

type SplitTargetType = "people" | "groups";
type SplitStep = "target" | "method" | "review";
type SplitMethod = "equal" | "exact" | "percentage" | "ratio";

type SplitPerson = {
  color: string;
  id: string;
  initial: string;
  name: string;
};

type SplitGroup = {
  color: string;
  id: string;
  members: number;
  name: string;
  subtitle: string;
};

type SplitSheetState = {
  exactAmounts: Record<string, string>;
  method: SplitMethod;
  percentages: Record<string, string>;
  ratios: Record<string, string>;
  selectedGroupId: string | null;
  selectedPeopleIds: string[];
  step: SplitStep;
  targetType: SplitTargetType;
};

const categoryOptions = [
  "Dining",
  "Groceries",
  "Shopping",
  "Travel",
  "Coffee",
  "Transport",
  "Bills",
  "Entertainment"
];

const splitMethodCopy: Record<SplitMethod, { label: string; meta: string }> = {
  equal: {
    label: "Equal",
    meta: "Split evenly among everyone"
  },
  exact: {
    label: "Exact $",
    meta: "Enter exact dollar amount each owes"
  },
  percentage: {
    label: "Percent %",
    meta: "Enter percent share for each person"
  },
  ratio: {
    label: "Ratio",
    meta: "Enter ratio shares for each person"
  }
};

const classificationColor: Record<Classification, string> = {
  personal: colors.personal,
  shared: colors.shared,
  unclassified: colors.unclassified
};

const transactionKindColor: Record<TransactionKind, string> = {
  expense: colors.unclassified,
  income: colors.personal,
  payment: "#5CA8FF",
  transfer: "#5CA8FF"
};

const toForm = (transaction: Transaction): DetailForm => ({
  account: transaction.account,
  amount: transaction.amount.toFixed(2),
  category: transaction.category,
  classification: transaction.classification,
  date: transaction.date,
  description: transaction.description,
  merchant: transaction.merchant,
  splitConnection: transaction.splitConnection ?? "",
  time: transaction.time
});

const validateForm = (form: DetailForm) => {
  const amount = Number.parseFloat(form.amount);

  if (!form.merchant.trim()) {
    return "Merchant is required.";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date.trim())) {
    return "Use date format YYYY-MM-DD.";
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return "Amount must be greater than 0.";
  }

  if (!form.account.trim()) {
    return "Account is required.";
  }

  if (!form.category.trim()) {
    return "Category is required.";
  }

  return null;
};

const formatReadableDate = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric"
  });

const formatTimestamp = (timestamp: string) =>
  new Date(timestamp).toLocaleString("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  });

const currencyTolerance = 0.01;

const formatInputAmount = (value: number) =>
  Number.isFinite(value) ? value.toFixed(2) : "0.00";

const getEqualPercentDefaults = (participants: SplitPerson[]) => {
  if (participants.length === 0) {
    return {};
  }

  const base = Math.floor((100 / participants.length) * 100) / 100;
  const percentages = participants.reduce<Record<string, string>>((acc, participant, index) => {
    const value =
      index === participants.length - 1 ? 100 - base * (participants.length - 1) : base;

    acc[participant.id] = formatInputAmount(value);
    return acc;
  }, {});

  return percentages;
};

const getEqualAmountDefaults = (amount: number, participants: SplitPerson[]) => {
  if (participants.length === 0) {
    return {};
  }

  const base = Math.floor((amount / participants.length) * 100) / 100;

  return participants.reduce<Record<string, string>>((acc, participant, index) => {
    const value =
      index === participants.length - 1 ? amount - base * (participants.length - 1) : base;

    acc[participant.id] = formatInputAmount(value);
    return acc;
  }, {});
};

const normalizeAllocationRowsToCents = (
  amount: number,
  rows: Array<{ amount: number; participant: SplitPerson }>
) => {
  const targetCents = Math.round(amount * 100);
  const centsRows = rows.map((row, index) => {
    const rawCents = row.amount * 100;

    return {
      cents: Math.floor(rawCents),
      index,
      participant: row.participant,
      remainder: rawCents - Math.floor(rawCents)
    };
  });
  let centsToDistribute =
    targetCents - centsRows.reduce((sum, row) => sum + row.cents, 0);
  const sortedRows = [...centsRows].sort((a, b) => b.remainder - a.remainder);

  while (centsToDistribute > 0 && sortedRows.length > 0) {
    sortedRows[(centsToDistribute - 1) % sortedRows.length].cents += 1;
    centsToDistribute -= 1;
  }

  return centsRows
    .sort((a, b) => a.index - b.index)
    .map((row) => ({
      amount: row.cents / 100,
      participant: row.participant
    }));
};

const buildSplitAllocation = ({
  amount,
  method,
  participants,
  state
}: {
  amount: number;
  method: SplitMethod;
  participants: SplitPerson[];
  state: SplitSheetState;
}) => {
  if (participants.length === 0) {
    return {
      allocatedTotal: 0,
      rows: [] as Array<{ amount: number; participant: SplitPerson }>,
      validationMessage: "Choose at least one person or group."
    };
  }

  if (method === "equal") {
    const equalAmounts = getEqualAmountDefaults(amount, participants);
    const rows = normalizeAllocationRowsToCents(
      amount,
      participants.map((participant) => ({
        amount: Number.parseFloat(equalAmounts[participant.id] ?? "0") || 0,
        participant
      }))
    );

    return {
      allocatedTotal: rows.reduce((sum, row) => sum + row.amount, 0),
      rows,
      validationMessage: null
    };
  }

  if (method === "exact") {
    const rows = participants.map((participant) => ({
      amount: Number.parseFloat(state.exactAmounts[participant.id] ?? "0") || 0,
      participant
    }));
    const allocatedTotal = rows.reduce((sum, row) => sum + row.amount, 0);

    return {
      allocatedTotal,
      rows,
      validationMessage:
        Math.abs(allocatedTotal - amount) <= currencyTolerance
          ? null
          : `Exact amounts must add up to ${formatCurrency(amount)}.`
    };
  }

  if (method === "percentage") {
    const percentages = participants.map((participant) => ({
      participant,
      value: Number.parseFloat(state.percentages[participant.id] ?? "0") || 0
    }));
    const percentTotal = percentages.reduce((sum, row) => sum + row.value, 0);
    const rows = normalizeAllocationRowsToCents(
      amount,
      percentages.map((row) => ({
        amount: (amount * row.value) / 100,
        participant: row.participant
      }))
    );

    return {
      allocatedTotal: rows.reduce((sum, row) => sum + row.amount, 0),
      rows,
      validationMessage:
        Math.abs(percentTotal - 100) <= currencyTolerance
          ? null
          : "Percentages must add up to 100%."
    };
  }

  const ratios = participants.map((participant) => ({
    participant,
    value: Number.parseFloat(state.ratios[participant.id] ?? "0") || 0
  }));
  const ratioTotal = ratios.reduce((sum, row) => sum + row.value, 0);
  const rows =
    ratioTotal > 0
      ? normalizeAllocationRowsToCents(
          amount,
          ratios.map((row) => ({
            amount: (amount * row.value) / ratioTotal,
            participant: row.participant
          }))
        )
      : participants.map((participant) => ({ amount: 0, participant }));

  return {
    allocatedTotal: rows.reduce((sum, row) => sum + row.amount, 0),
    rows,
    validationMessage: ratioTotal > 0 ? null : "Ratios must add up to more than 0."
  };
};

type TransactionReturnTarget =
  | "accounts"
  | "calendar"
  | "groups"
  | "import"
  | "insights"
  | "people"
  | "settings"
  | "shared"
  | "timeline";

export const TransactionDetailScreen = () => {
  const router = useRouter();
  const { accentColor, accentSoft, palette } = useAppearanceTheme();
  const params = useLocalSearchParams<{ id?: string; returnTo?: TransactionReturnTarget; split?: string }>();
  const transactionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const splitParam = Array.isArray(params.split) ? params.split[0] : params.split;
  const returnToParam = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const ledgerTransactions = useLedgerTransactions();
  const updateTransaction = useTransactionLedgerStore((state) => state.updateTransaction);
  const accounts = useAccountsStore((state) => state.accounts);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const groups = useGroupsStore((state) => state.groups);
  const loadGroups = useGroupsStore((state) => state.loadGroups);
  const people = usePeopleStore((state) => state.people);
  const loadPeople = usePeopleStore((state) => state.loadPeople);
  const splits = useSplitStore((state) => state.splits);
  const deleteSplitForTransaction = useSplitStore((state) => state.deleteSplitForTransaction);
  const loadSplits = useSplitStore((state) => state.loadSplits);
  const upsertSplitForTransaction = useSplitStore((state) => state.upsertSplitForTransaction);
  const transaction = useMemo(
    () => (transactionId ? getTransactionById(transactionId, ledgerTransactions) : null),
    [ledgerTransactions, transactionId]
  );
  const savedSplit = useMemo(
    () =>
      transactionId
        ? splits.find((candidate) => candidate.transactionId === transactionId) ?? null
        : null,
    [splits, transactionId]
  );
  const splitPeople = useMemo<SplitPerson[]>(
    () =>
      people.map((person) => ({
        color: person.color,
        id: person.id,
        initial: getPersonInitial(person.name),
        name: person.name
      })),
    [people]
  );
  const splitGroups = useMemo<SplitGroup[]>(
    () =>
      groups.map((group) => ({
        color: group.color,
        id: group.id,
        members: group.memberIds.length,
        name: group.name,
        subtitle: `${group.memberIds.length} members`
      })),
    [groups]
  );
  const splitGroupMembers = useMemo<Record<string, SplitPerson[]>>(() => {
    const peopleById = splitPeople.reduce<Record<string, SplitPerson>>((acc, person) => {
      acc[person.id] = person;
      return acc;
    }, {});

    return groups.reduce<Record<string, SplitPerson[]>>((acc, group) => {
      acc[group.id] = group.memberIds
        .map((memberId) => peopleById[memberId])
        .filter((person): person is SplitPerson => !!person);
      return acc;
    }, {});
  }, [groups, splitPeople]);
  const [form, setForm] = useState<DetailForm | null>(() =>
    transaction ? toForm(transaction) : null
  );
  const [isEditing, setIsEditing] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [splitSheet, setSplitSheet] = useState<SplitSheetState | null>(null);
  const [didAutoOpenSplit, setDidAutoOpenSplit] = useState(false);

  useEffect(() => {
    void loadAccounts();
    void loadGroups();
    void loadPeople();
    void loadSplits();
  }, [loadAccounts, loadGroups, loadPeople, loadSplits]);

  useEffect(() => {
    if (!transaction || isEditing) {
      return;
    }

    setForm(toForm(transaction));
  }, [isEditing, transaction]);

  const validationMessage = form ? validateForm(form) : null;

  const updateForm = (patch: Partial<DetailForm>) => {
    setForm((currentForm) => (currentForm ? { ...currentForm, ...patch } : currentForm));
    setSaveState("idle");
  };

  const openSplitSheet = () => {
    const splitAmount = Number.parseFloat(form?.amount ?? "0");
    const savedPeopleIds = savedSplit?.allocations.map((allocation) => allocation.personId) ?? [];
    const selectedGroupId =
      savedSplit?.targetType === "groups" && savedSplit.targetId ? savedSplit.targetId : null;
    const selectedPeopleIds =
      savedSplit?.targetType === "people" && savedPeopleIds.length > 0
        ? savedPeopleIds
        : splitPeople.slice(0, 3).map((person) => person.id);
    const participants =
      savedSplit?.targetType === "groups" && selectedGroupId
        ? splitGroupMembers[selectedGroupId] ?? []
        : splitPeople.filter((person) => selectedPeopleIds.includes(person.id));
    const savedInputMap = savedSplit
      ? savedSplit.allocations.reduce<Record<string, string>>((acc, allocation) => {
          if (allocation.inputValue !== null) {
            acc[allocation.personId] = String(allocation.inputValue);
          }
          return acc;
        }, {})
      : {};
    const savedAmountMap = savedSplit
      ? savedSplit.allocations.reduce<Record<string, string>>((acc, allocation) => {
          acc[allocation.personId] = formatInputAmount(allocation.amount);
          return acc;
        }, {})
      : {};

    setSplitSheet({
      exactAmounts:
        savedSplit?.method === "exact" ? savedAmountMap : getEqualAmountDefaults(splitAmount, participants),
      method: savedSplit?.method ?? "equal",
      percentages:
        savedSplit?.method === "percentage"
          ? savedInputMap
          : getEqualPercentDefaults(participants),
      ratios: savedSplit?.method === "ratio" ? savedInputMap : participants.reduce<Record<string, string>>((acc, person) => {
        acc[person.id] = "1";
        return acc;
      }, {}),
      selectedGroupId,
      selectedPeopleIds,
      step: "target",
      targetType: savedSplit?.targetType ?? "people"
    });
  };

  useEffect(() => {
    if (splitParam !== "1" || didAutoOpenSplit || !transaction || !form) {
      return;
    }

    openSplitSheet();
    setDidAutoOpenSplit(true);
  }, [didAutoOpenSplit, form, splitParam, transaction]);

  const handleClassificationPress = async (classification: Classification) => {
    if (!transaction || !isSpendTransaction(transaction)) {
      return;
    }

    if (classification === "shared") {
      openSplitSheet();
      return;
    }

    if (isEditing) {
      updateForm({ classification, splitConnection: "" });
      return;
    }

    await updateTransaction(transaction.id, {
      classification,
      splitConnection: null
    });
    await deleteSplitForTransaction(transaction.id);

    setForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            classification,
            splitConnection: ""
          }
        : currentForm
    );
    setSaveState("saved");
  };

  const saveChanges = async () => {
    if (!transaction || !form || validationMessage) {
      return;
    }

    setSaveState("saving");

    await updateTransaction(transaction.id, {
      account: form.account.trim(),
      amount: Number.parseFloat(form.amount),
      category: form.category.trim(),
      classification: form.classification,
      date: form.date.trim(),
      description: form.description.trim(),
      merchant: form.merchant.trim(),
      splitConnection:
        form.classification === "shared" && form.splitConnection.trim()
          ? form.splitConnection.trim()
          : null,
      time: form.time.trim()
    });

    if (form.classification !== "shared") {
      await deleteSplitForTransaction(transaction.id);
    }

    setIsEditing(false);
    setSaveState("saved");
  };

  const saveSplit = async () => {
    if (!transaction || !form || !splitSheet) {
      return;
    }

    const selectedPeople = splitPeople.filter((person) =>
      splitSheet.selectedPeopleIds.includes(person.id)
    );
    const selectedGroup = splitGroups.find(
      (candidate) => candidate.id === splitSheet.selectedGroupId
    );
    const participants =
      splitSheet.targetType === "people"
        ? selectedPeople
        : selectedGroup
          ? splitGroupMembers[selectedGroup.id] ?? []
          : [];
    const allocation = buildSplitAllocation({
      amount: Number.parseFloat(form.amount),
      method: splitSheet.method,
      participants,
      state: splitSheet
    });
    const splitConnection =
      splitSheet.targetType === "people"
        ? selectedPeople.map((person) => person.name).join(", ")
        : selectedGroup?.name ?? "";

    if (!splitConnection || allocation.validationMessage) {
      return;
    }

    const splitAllocations: SavedSplitAllocation[] = allocation.rows.map(
      ({ amount: rowAmount, participant }) => {
        const inputValue =
          splitSheet.method === "equal"
            ? null
            : splitSheet.method === "exact"
              ? Number.parseFloat(splitSheet.exactAmounts[participant.id] ?? "0") || 0
              : splitSheet.method === "percentage"
                ? Number.parseFloat(splitSheet.percentages[participant.id] ?? "0") || 0
                : Number.parseFloat(splitSheet.ratios[participant.id] ?? "0") || 0;

        return {
          amount: rowAmount,
          inputValue,
          personId: participant.id,
          personName: participant.name
        };
      }
    );
    const allocatedTotal = splitAllocations.reduce(
      (sum, allocationRow) => sum + allocationRow.amount,
      0
    );

    await upsertSplitForTransaction({
      allocatedTotal,
      allocations: splitAllocations,
      merchant: form.merchant.trim(),
      method: splitSheet.method,
      remainingAmount: Number.parseFloat(form.amount) - allocatedTotal,
      targetId: splitSheet.targetType === "groups" ? selectedGroup?.id ?? null : null,
      targetName: splitConnection,
      targetType: splitSheet.targetType,
      totalAmount: Number.parseFloat(form.amount),
      transactionId: transaction.id
    });

    await updateTransaction(transaction.id, {
      account: form.account.trim(),
      amount: Number.parseFloat(form.amount),
      category: form.category.trim(),
      classification: "shared",
      date: form.date.trim(),
      description: form.description.trim(),
      merchant: form.merchant.trim(),
      splitConnection,
      time: form.time.trim()
    });

    setForm({
      ...form,
      classification: "shared",
      splitConnection
    });
    setIsEditing(false);
    setSaveState("saved");
    setSplitSheet(null);
  };

  const closeDetail = () => {
    const returnRoute = getReturnTargetRoute(returnToParam);

    if (returnRoute) {
      router.replace(returnRoute);
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/calendar");
  };

  if (!transaction || !form) {
    return (
      <Screen>
        <View style={styles.emptyRoot}>
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: accentSoft, borderColor: `${accentColor}33` }
            ]}
          >
            <ReceiptText color={accentColor} size={30} />
          </View>
          <Text style={styles.emptyTitle}>Transaction not found</Text>
          <Text style={styles.emptyText}>
            This transaction may have moved after editing. Return to the calendar and try again.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace(getReturnTargetRoute(returnToParam) ?? "/calendar")}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: accentColor },
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.primaryButtonText}>Back to Calendar</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const isSpend = isSpendTransaction(transaction);
  const statusColor = isSpend
    ? classificationColor[form.classification]
    : transactionKindColor[transaction.kind];
  const statusLabel = isSpend
    ? classificationLabel[form.classification]
    : transactionKindLabel[transaction.kind];
  const sharedWith =
    form.classification === "shared"
      ? form.splitConnection.trim() || "Split connection pending"
      : form.classification === "personal"
        ? "Only you"
        : "Not classified yet";

  return (
    <Screen>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={closeDetail}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <ArrowLeft color={colors.textPrimary} size={22} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: accentColor }]}>Transaction detail</Text>
            <Text numberOfLines={1} style={styles.title}>
              {transaction.merchant}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={isEditing ? "Cancel editing" : "Edit transaction"}
            accessibilityRole="button"
            onPress={() => {
              if (isEditing) {
                setForm(toForm(transaction));
                setIsEditing(false);
                setSaveState("idle");
                return;
              }

              setIsEditing(true);
            }}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            {isEditing ? (
              <X color={colors.textSecondary} size={21} strokeWidth={2.5} />
            ) : (
              <Pencil color={accentColor} size={20} strokeWidth={2.5} />
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={[accentSoft, palette.cardStrong]}
            style={[styles.heroCard, { borderColor: `${accentColor}33` }]}
          >
            <View style={styles.heroTop}>
              <View style={[styles.merchantMark, { backgroundColor: `${statusColor}20` }]}>
                <ReceiptText color={statusColor} size={25} strokeWidth={2.4} />
              </View>
              <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {statusLabel}
                </Text>
              </View>
            </View>

            {isEditing ? (
              <DetailInput
                label="Merchant"
                onChangeText={(merchant) => updateForm({ merchant })}
                value={form.merchant}
              />
            ) : (
              <Text numberOfLines={2} style={styles.heroMerchant}>
                {form.merchant}
              </Text>
            )}

            {isEditing ? (
              <DetailInput
                keyboardType="decimal-pad"
                label="Amount"
                onChangeText={(amount) => updateForm({ amount })}
                value={form.amount}
              />
            ) : (
              <Text style={styles.heroAmount}>{formatTransactionAmount(transaction)}</Text>
            )}

            <Text style={styles.heroMeta}>
              {formatReadableDate(form.date)} - {form.time}
            </Text>
          </LinearGradient>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Classification</Text>
              {saveState === "saved" ? (
                <View style={styles.savedBadge}>
                  <Check color={accentColor} size={14} strokeWidth={2.8} />
                  <Text style={[styles.savedBadgeText, { color: accentColor }]}>Saved</Text>
                </View>
              ) : null}
            </View>

            {isSpend ? (
              <>
                <View style={styles.segmentRow}>
                  {(["personal", "shared", "unclassified"] as Classification[]).map((classification) => {
                    const active = form.classification === classification;
                    const tone = classificationColor[classification];

                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={classification}
                        onPress={() => handleClassificationPress(classification)}
                        style={({ pressed }) => [
                          styles.segmentPill,
                          active && {
                            backgroundColor: `${tone}18`,
                            borderColor: `${tone}70`
                          },
                          pressed && styles.pressed
                        ]}
                      >
                        <Text style={[styles.segmentText, active && { color: tone }]}>
                          {classificationLabel[classification]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <InfoRow
                  icon={form.classification === "shared" ? UsersRound : UserRound}
                  label="Shared with"
                  tone={statusColor}
                  value={sharedWith}
                />
              </>
            ) : (
              <>
                <MoneyMovementNotice statusLabel={statusLabel} tone={statusColor} />
                <InfoRow
                  icon={CreditCard}
                  label="Import type"
                  tone={statusColor}
                  value={`${statusLabel} - excluded from spending totals and split review`}
                />
              </>
            )}

            {isSpend && form.classification === "shared" ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={openSplitSheet}
                  style={({ pressed }) => [styles.splitEntryButton, pressed && styles.pressed]}
                >
                  <View style={styles.splitEntryIcon}>
                    <Split color={colors.shared} size={17} strokeWidth={2.6} />
                  </View>
                  <View style={styles.splitEntryCopy}>
                    <Text style={styles.splitEntryLabel}>Split setup</Text>
                    <Text numberOfLines={1} style={styles.splitEntryMeta}>
                      {form.splitConnection || "Choose people or a group"}
                    </Text>
                  </View>
                  <ChevronRight color={colors.textMuted} size={18} />
                </Pressable>

                {savedSplit ? <SavedSplitCard split={savedSplit} /> : null}
              </>
            ) : null}

            {isSpend && isEditing ? (
              <DetailInput
                editable={form.classification === "shared"}
                label="Shared with"
                onChangeText={(splitConnection) => updateForm({ splitConnection })}
                placeholder="Apartment Crew, Jordan, etc."
                value={form.splitConnection}
              />
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transaction info</Text>

            {isEditing ? (
              <View style={styles.formGrid}>
                <DetailInput
                  label="Date"
                  onChangeText={(date) => updateForm({ date })}
                  value={form.date}
                />
                <DetailInput
                  label="Time"
                  onChangeText={(time) => updateForm({ time })}
                  value={form.time}
                />
              </View>
            ) : (
              <View style={styles.detailGrid}>
                <InfoTile icon={CalendarDays} label="Date" value={formatReadableDate(form.date)} />
                <InfoTile icon={Clock3} label="Time" value={form.time} />
              </View>
            )}

            <View style={styles.formBlock}>
              <Text style={styles.formLabel}>Account</Text>
              <View style={styles.optionWrap}>
                {accounts.map((account) => {
                  const active = form.account === account.name;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      disabled={!isEditing}
                      key={account.id}
                      onPress={() => updateForm({ account: account.name })}
                      style={({ pressed }) => [
                        styles.accountOption,
                        active && [
                          styles.accountOptionActive,
                          { backgroundColor: accentSoft, borderColor: `${accentColor}55` }
                        ],
                        pressed && styles.pressed
                      ]}
                    >
                      <View style={[styles.accountDot, { backgroundColor: account.color }]} />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.accountOptionText,
                          active && styles.accountOptionActiveText
                        ]}
                      >
                        {account.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.formBlock}>
              <Text style={styles.formLabel}>Category</Text>
              <View style={styles.optionWrap}>
                {categoryOptions.map((category) => {
                  const active = form.category === category;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      disabled={!isEditing}
                      key={category}
                      onPress={() => updateForm({ category })}
                      style={({ pressed }) => [
                        styles.categoryOption,
                        active && [
                          styles.categoryOptionActive,
                          { backgroundColor: accentSoft, borderColor: `${accentColor}55` }
                        ],
                        pressed && styles.pressed
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryOptionText,
                          active && styles.categoryOptionActiveText
                        ]}
                      >
                        {category}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {isEditing ? (
              <DetailInput
                label="Custom category"
                onChangeText={(category) => updateForm({ category })}
                value={form.category}
              />
            ) : (
              <View style={styles.detailGrid}>
                <InfoTile icon={CreditCard} label="Account" value={form.account} />
                <InfoTile icon={Tag} label="Category" value={form.category} />
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            {isEditing ? (
              <DetailInput
                multiline
                onChangeText={(description) => updateForm({ description })}
                value={form.description}
              />
            ) : (
              <View style={styles.noteCard}>
                <FileText color={colors.textMuted} size={18} strokeWidth={2.3} />
                <Text style={styles.noteText}>{form.description || "No description added."}</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Record</Text>
            <InfoRow
              icon={ShieldCheck}
              label="Duplicate hash"
              value={transaction.duplicateHash}
            />
            <InfoRow
              icon={Hash}
              label="Transaction ID"
              value={transaction.id}
            />
            <InfoRow
              icon={Clock3}
              label="Updated"
              value={formatTimestamp(transaction.updatedAt)}
            />
          </View>

          {isEditing ? (
            <View style={styles.actionDock}>
              {validationMessage ? (
                <Text style={styles.validationText}>{validationMessage}</Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={!!validationMessage || saveState === "saving"}
                onPress={saveChanges}
                style={({ pressed }) => [
                  styles.saveButton,
                  { backgroundColor: accentColor },
                  (!!validationMessage || saveState === "saving") && styles.disabledButton,
                  pressed && styles.pressed
                ]}
              >
                <Save color={colors.background} size={18} strokeWidth={2.6} />
                <Text style={styles.saveButtonText}>
                  {saveState === "saving" ? "Saving" : "Save Changes"}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsEditing(true)}
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  backgroundColor: accentSoft,
                  borderColor: `${accentColor}33`
                },
                pressed && styles.pressed
              ]}
            >
              <Pencil color={accentColor} size={18} strokeWidth={2.5} />
              <Text style={[styles.secondaryButtonText, { color: accentColor }]}>
                Edit Details
              </Text>
              <ChevronRight color={colors.textMuted} size={18} />
            </Pressable>
          )}
        </ScrollView>

        {splitSheet ? (
          <SplitSetupSheet
            amount={Number.parseFloat(form.amount)}
            onBack={() =>
              setSplitSheet((currentSheet) => {
                if (!currentSheet || currentSheet.step === "target") {
                  return currentSheet;
                }

                return {
                  ...currentSheet,
                  step: currentSheet.step === "review" ? "method" : "target"
                };
              })
            }
            onClose={() => setSplitSheet(null)}
            onGoToMethod={() =>
              setSplitSheet((currentSheet) =>
                currentSheet ? { ...currentSheet, step: "method" } : currentSheet
              )
            }
            onReview={() =>
              setSplitSheet((currentSheet) =>
                currentSheet ? { ...currentSheet, step: "review" } : currentSheet
              )
            }
            onSave={saveSplit}
            onSelectGroup={(groupId) =>
              setSplitSheet((currentSheet) => {
                if (!currentSheet) {
                  return currentSheet;
                }

                const groupParticipants = splitGroupMembers[groupId] ?? [];
                const splitAmount = Number.parseFloat(form.amount);

                return {
                  ...currentSheet,
                  exactAmounts: getEqualAmountDefaults(splitAmount, groupParticipants),
                  percentages: getEqualPercentDefaults(groupParticipants),
                  ratios: groupParticipants.reduce<Record<string, string>>((acc, person) => {
                    acc[person.id] = "1";
                    return acc;
                  }, {}),
                  selectedGroupId: groupId
                };
              })
            }
            onSelectMethod={(method) =>
              setSplitSheet((currentSheet) =>
                currentSheet ? { ...currentSheet, method } : currentSheet
              )
            }
            onTogglePerson={(personId) =>
              setSplitSheet((currentSheet) => {
                if (!currentSheet) {
                  return currentSheet;
                }

                const selectedPeopleIds = currentSheet.selectedPeopleIds.includes(personId)
                  ? currentSheet.selectedPeopleIds.filter((id) => id !== personId)
                  : [...currentSheet.selectedPeopleIds, personId];
                const nextPeople = splitPeople.filter((person) =>
                  selectedPeopleIds.includes(person.id)
                );
                const splitAmount = Number.parseFloat(form.amount);

                return {
                  ...currentSheet,
                  exactAmounts: getEqualAmountDefaults(splitAmount, nextPeople),
                  percentages: getEqualPercentDefaults(nextPeople),
                  ratios: nextPeople.reduce<Record<string, string>>((acc, person) => {
                    acc[person.id] = "1";
                    return acc;
                  }, {}),
                  selectedPeopleIds
                };
              })
            }
            onSelectTargetType={(targetType) =>
              setSplitSheet((currentSheet) =>
                currentSheet
                  ? {
                      ...currentSheet,
                      targetType
                    }
                  : currentSheet
              )
            }
            onUpdateAllocation={(method, participantId, value) =>
              setSplitSheet((currentSheet) => {
                if (!currentSheet) {
                  return currentSheet;
                }

                if (method === "exact") {
                  return {
                    ...currentSheet,
                    exactAmounts: {
                      ...currentSheet.exactAmounts,
                      [participantId]: value
                    }
                  };
                }

                if (method === "percentage") {
                  return {
                    ...currentSheet,
                    percentages: {
                      ...currentSheet.percentages,
                      [participantId]: value
                    }
                  };
                }

                return {
                  ...currentSheet,
                  ratios: {
                    ...currentSheet.ratios,
                    [participantId]: value
                  }
                };
              })
            }
            transactionMerchant={form.merchant}
            groups={splitGroups}
            groupMembers={splitGroupMembers}
            people={splitPeople}
            state={splitSheet}
          />
        ) : null}
      </View>
    </Screen>
  );
};

const SplitSetupSheet = ({
  amount,
  groups,
  groupMembers,
  onBack,
  onClose,
  onGoToMethod,
  onReview,
  onSave,
  onSelectGroup,
  onSelectMethod,
  onSelectTargetType,
  onTogglePerson,
  onUpdateAllocation,
  people,
  transactionMerchant,
  state
}: {
  amount: number;
  groups: SplitGroup[];
  groupMembers: Record<string, SplitPerson[]>;
  onBack: () => void;
  onClose: () => void;
  onGoToMethod: () => void;
  onReview: () => void;
  onSave: () => void;
  onSelectGroup: (groupId: string) => void;
  onSelectMethod: (method: SplitMethod) => void;
  onSelectTargetType: (targetType: SplitTargetType) => void;
  onTogglePerson: (personId: string) => void;
  onUpdateAllocation: (
    method: Extract<SplitMethod, "exact" | "percentage" | "ratio">,
    participantId: string,
    value: string
  ) => void;
  people: SplitPerson[];
  transactionMerchant: string;
  state: SplitSheetState;
}) => {
  const { accentColor, accentSoft, palette } = useAppearanceTheme();
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const selectedPeople = people.filter((person) =>
    state.selectedPeopleIds.includes(person.id)
  );
  const selectedGroup = groups.find((group) => group.id === state.selectedGroupId);
  const participants =
    state.targetType === "people"
      ? selectedPeople
      : selectedGroup
        ? groupMembers[selectedGroup.id] ?? []
        : [];
  const hasSelection =
    state.targetType === "people" ? selectedPeople.length > 0 : !!selectedGroup;
  const allocation = buildSplitAllocation({
    amount: safeAmount,
    method: state.method,
    participants,
    state
  });
  const stepIndex = state.step === "target" ? 1 : state.step === "method" ? 2 : 3;
  const splitTitle = state.targetType === "people" ? "Split with People" : "Split with Group";

  return (
    <View style={styles.splitOverlay}>
      <Pressable
        accessibilityLabel="Close split setup"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.splitScrim}
      />
      <View style={styles.splitSheet}>
        <LinearGradient
          colors={[palette.cardStrong, palette.card]}
          style={styles.splitSurface}
        >
          <View style={styles.splitHandle} />

          <View style={styles.splitHeader}>
            <View style={styles.splitHeaderCopy}>
              <Text style={styles.splitTitle}>{splitTitle}</Text>
              <Text style={styles.splitSubtitle}>
                {transactionMerchant} - {formatCurrency(safeAmount)}
              </Text>
            </View>

            <Pressable
              accessibilityLabel="Close split setup"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.splitHeaderButton, pressed && styles.pressed]}
            >
              <X color={colors.textPrimary} size={18} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.splitStepTabs}>
            {[
              { index: 1, key: "target", label: "1. Who" },
              { index: 2, key: "method", label: "2. How" },
              { index: 3, key: "review", label: "3. Review" }
            ].map((step) => {
              const active = step.index === stepIndex;

              return (
                <View
                  key={step.key}
                  style={[
                    styles.splitStepTab,
                    active && [styles.splitStepTabActive, { borderBottomColor: accentColor }]
                  ]}
                >
                  <Text style={[styles.splitStepTabText, active && { color: accentColor }]}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {state.step === "target" ? (
            <View style={styles.splitStep}>
              <View style={styles.targetTypeRow}>
                {(["people", "groups"] as SplitTargetType[]).map((targetType) => {
                  const active = state.targetType === targetType;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={targetType}
                      onPress={() => onSelectTargetType(targetType)}
                      style={({ pressed }) => [
                        styles.targetTypePill,
                        active && [
                          styles.targetTypePillActive,
                          { backgroundColor: accentSoft, borderColor: `${accentColor}55` }
                        ],
                        pressed && styles.pressed
                      ]}
                    >
                      {targetType === "people" ? (
                        <UserRound
                          color={active ? accentColor : colors.textSecondary}
                          size={15}
                          strokeWidth={2.5}
                        />
                      ) : (
                        <UsersRound
                          color={active ? accentColor : colors.textSecondary}
                          size={15}
                          strokeWidth={2.5}
                        />
                      )}
                      <Text style={[styles.targetTypeText, active && { color: accentColor }]}>
                        {targetType === "people" ? "People" : "Group"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {state.targetType === "people" ? (
                <>
                  <View style={styles.peoplePickerHeader}>
                    <View style={styles.peoplePickerCopy}>
                      <Text style={styles.peoplePickerTitle}>Select people</Text>
                      <Text style={styles.peoplePickerMeta}>
                        {selectedPeople.length} selected - tap rows to add or remove
                      </Text>
                    </View>
                    <View style={[styles.selectedCountPill, { backgroundColor: `${accentColor}80` }]}>
                      <Text style={styles.selectedCountText}>{selectedPeople.length}</Text>
                    </View>
                  </View>

                  <View style={styles.targetList}>
                    {people.map((person) => (
                      <SelectablePersonRow
                        accentColor={accentColor}
                        accentSoft={accentSoft}
                        key={person.id}
                        onToggle={() => onTogglePerson(person.id)}
                        person={person}
                        selected={state.selectedPeopleIds.includes(person.id)}
                      />
                    ))}
                  </View>
                </>
              ) : (
                <View style={styles.targetList}>
                  {groups.map((group) => {
                    const active = group.id === state.selectedGroupId;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={group.id}
                        onPress={() => onSelectGroup(group.id)}
                        style={({ pressed }) => [
                          styles.groupCard,
                          active && [
                            styles.groupCardActive,
                            { backgroundColor: accentSoft, borderColor: `${accentColor}80` }
                          ],
                          pressed && styles.pressed
                        ]}
                      >
                        <View style={[styles.groupAvatar, { backgroundColor: `${group.color}30` }]}>
                          <UsersRound color={group.color} size={18} strokeWidth={2.5} />
                        </View>
                        <View style={styles.targetCopy}>
                          <Text style={styles.targetName}>{group.name}</Text>
                          <Text style={styles.targetMeta}>
                            {(groupMembers[group.id] ?? []).length || group.members} saved people
                          </Text>
                        </View>
                        {active ? <Check color={accentColor} size={18} strokeWidth={2.8} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={!hasSelection}
                onPress={onGoToMethod}
                style={({ pressed }) => [
                  styles.splitPrimaryButton,
                  { backgroundColor: accentColor },
                  !hasSelection && styles.disabledButton,
                  pressed && styles.pressed
                ]}
              >
                <Text style={styles.splitPrimaryButtonText}>Next: How to Split</Text>
                <ChevronRight color={colors.background} size={16} strokeWidth={2.7} />
              </Pressable>
            </View>
          ) : null}

          {state.step === "method" && hasSelection ? (
            <View style={styles.splitStep}>
              <View style={styles.methodList}>
                {(["equal", "exact", "percentage", "ratio"] as SplitMethod[]).map((method) => {
                  const active = state.method === method;
                  const Icon =
                    method === "equal"
                      ? Scale
                      : method === "exact"
                        ? Banknote
                        : method === "percentage"
                          ? Percent
                          : ListChecks;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={method}
                      onPress={() => onSelectMethod(method)}
                      style={({ pressed }) => [
                        styles.methodCard,
                        active && [
                          styles.methodCardActive,
                          { backgroundColor: accentSoft, borderColor: `${accentColor}B8` }
                        ],
                        pressed && styles.pressed
                      ]}
                    >
                      <View style={styles.methodIcon}>
                        <Icon
                          color={active ? accentColor : colors.textSecondary}
                          size={17}
                          strokeWidth={2.5}
                        />
                      </View>
                      <View style={styles.targetCopy}>
                        <Text style={styles.methodName}>{splitMethodCopy[method].label}</Text>
                        <Text style={styles.targetMeta}>{splitMethodCopy[method].meta}</Text>
                      </View>
                      {active ? <Check color={accentColor} size={18} strokeWidth={2.8} /> : null}
                    </Pressable>
                  );
                })}
              </View>

              {state.method === "exact" ||
              state.method === "percentage" ||
              state.method === "ratio" ? (
                <AllocationEditor
                  amount={safeAmount}
                  allocation={allocation}
                  method={state.method}
                  onUpdateAllocation={onUpdateAllocation}
                  participants={participants}
                  state={state}
                />
              ) : (
                <SplitAllocationSummary
                  allocatedTotal={allocation.allocatedTotal}
                  amount={safeAmount}
                  remainingFirst
                  validationMessage={allocation.validationMessage}
                />
              )}

              <View style={styles.splitButtonRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={onBack}
                  style={({ pressed }) => [
                    styles.splitSecondaryButton,
                    styles.splitButtonHalf,
                    pressed && styles.pressed
                  ]}
                >
                  <ArrowLeft color={colors.textPrimary} size={16} strokeWidth={2.6} />
                  <Text style={styles.splitSecondaryButtonText}>Back</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={!!allocation.validationMessage}
                  onPress={onReview}
                  style={({ pressed }) => [
                    styles.splitPrimaryButton,
                    styles.splitButtonHalf,
                    { backgroundColor: accentColor },
                    !!allocation.validationMessage && styles.disabledButton,
                    pressed && styles.pressed
                  ]}
                >
                  <Text style={styles.splitPrimaryButtonText}>Next: Review</Text>
                  <ChevronRight color={colors.background} size={16} strokeWidth={2.7} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {state.step === "review" && hasSelection ? (
            <View style={styles.splitStep}>
              <Text style={styles.reviewTotal}>Total: {formatCurrency(safeAmount)}</Text>

              <View style={styles.reviewRows}>
                {allocation.rows.map(({ amount: rowAmount, participant }) => (
                  <ReviewSplitRow
                    avatarColor={participant.color}
                    initial={participant.initial}
                    key={participant.id}
                    label={participant.name}
                    value={formatCurrency(rowAmount)}
                  />
                ))}
              </View>

              <SplitAllocationSummary
                allocatedTotal={allocation.allocatedTotal}
                amount={safeAmount}
                remainingFirst
                validationMessage={allocation.validationMessage}
              />

              <View style={styles.splitButtonRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={onBack}
                  style={({ pressed }) => [
                    styles.splitSecondaryButton,
                    styles.splitButtonHalf,
                    pressed && styles.pressed
                  ]}
                >
                  <ArrowLeft color={colors.textPrimary} size={16} strokeWidth={2.6} />
                  <Text style={styles.splitSecondaryButtonText}>Back</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={onSave}
                  style={({ pressed }) => [
                    styles.splitPrimaryButton,
                    styles.splitButtonHalf,
                    { backgroundColor: accentColor },
                    pressed && styles.pressed
                  ]}
                >
                  <Check color={colors.background} size={16} strokeWidth={2.8} />
                  <Text style={styles.splitPrimaryButtonText}>Save Split</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </LinearGradient>
      </View>
    </View>
  );
};

const AllocationEditor = ({
  allocation,
  amount,
  method,
  onUpdateAllocation,
  participants,
  state
}: {
  allocation: ReturnType<typeof buildSplitAllocation>;
  amount: number;
  method: Extract<SplitMethod, "exact" | "percentage" | "ratio">;
  onUpdateAllocation: (
    method: Extract<SplitMethod, "exact" | "percentage" | "ratio">,
    participantId: string,
    value: string
  ) => void;
  participants: SplitPerson[];
  state: SplitSheetState;
}) => {
  const label =
    method === "exact" ? "Amount" : method === "percentage" ? "Percentage" : "Ratio";
  const suffix = method === "percentage" ? "%" : method === "ratio" ? "x" : "";

  return (
    <View style={styles.allocationBlock}>
      <Text style={styles.allocationTitle}>
        {method === "exact"
          ? "How much does each person owe?"
          : method === "percentage"
            ? "What percentage does each person get?"
            : "How many ratio shares does each person get?"}
      </Text>

      {participants.map((participant) => {
        const value =
          method === "exact"
            ? state.exactAmounts[participant.id] ?? ""
            : method === "percentage"
              ? state.percentages[participant.id] ?? ""
              : state.ratios[participant.id] ?? "";

        return (
          <View key={participant.id} style={styles.allocationRow}>
            <View style={[styles.personAvatar, { backgroundColor: participant.color }]}>
              <Text style={styles.personInitial}>{participant.initial}</Text>
            </View>
            <Text style={styles.allocationName}>{participant.name}</Text>
            <View style={styles.allocationInputWrap}>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(nextValue) =>
                  onUpdateAllocation(method, participant.id, nextValue)
                }
                placeholder={label}
                placeholderTextColor={colors.textMuted}
                style={styles.allocationInput}
                value={value}
              />
              {suffix ? <Text style={styles.allocationSuffix}>{suffix}</Text> : null}
            </View>
          </View>
        );
      })}

      <SplitAllocationSummary
        allocatedTotal={allocation.allocatedTotal}
        amount={amount}
        remainingFirst
        validationMessage={allocation.validationMessage}
      />
    </View>
  );
};

const SplitAllocationSummary = ({
  allocatedTotal,
  amount,
  remainingFirst = false,
  validationMessage
}: {
  allocatedTotal: number;
  amount: number;
  remainingFirst?: boolean;
  validationMessage: string | null;
}) => {
  const remaining = amount - allocatedTotal;
  const summaryItems = [
    {
      key: "allocated",
      label: "Allocated",
      value: formatCurrency(allocatedTotal),
      warning: false
    },
    {
      key: "remaining",
      label: "Remaining",
      value: formatCurrency(remaining),
      warning: Math.abs(remaining) > currencyTolerance
    }
  ];
  const orderedItems = remainingFirst ? [summaryItems[1], summaryItems[0]] : summaryItems;

  return (
    <View style={styles.allocationSummary}>
      {orderedItems.map((item, index) => (
        <View key={item.key} style={index === 1 && styles.allocationSummaryRight}>
          <Text style={styles.allocationSummaryLabel}>{item.label}</Text>
          <Text
            style={[
              styles.allocationSummaryValue,
              item.warning && styles.allocationSummaryWarning
            ]}
          >
            {item.value}
          </Text>
        </View>
      ))}
      {validationMessage ? (
        <Text style={styles.allocationValidation}>{validationMessage}</Text>
      ) : null}
    </View>
  );
};

const SelectablePersonRow = ({
  accentColor,
  accentSoft,
  onToggle,
  person,
  selected
}: {
  accentColor: string;
  accentSoft: string;
  onToggle: () => void;
  person: SplitPerson;
  selected: boolean;
}) => (
  <Pressable
    accessibilityLabel={`${selected ? "Remove" : "Add"} ${person.name}`}
    accessibilityRole="button"
    onPress={onToggle}
    style={({ pressed }) => [
      styles.personRow,
      selected && [
        styles.personRowSelected,
        { backgroundColor: accentSoft, borderColor: `${accentColor}80` }
      ],
      pressed && styles.pressed
    ]}
  >
    <View style={[styles.personAvatar, { backgroundColor: person.color }]}>
      <Text style={styles.personInitial}>{person.initial}</Text>
    </View>
    <View style={styles.personCopy}>
      <Text style={styles.personName}>{person.name}</Text>
      <Text style={styles.personStatus}>{selected ? "Included in split" : "Tap to add"}</Text>
    </View>
    <View
      style={[
        styles.personCheck,
        selected && [
          styles.personCheckSelected,
          { backgroundColor: accentColor, borderColor: accentColor }
        ]
      ]}
    >
      {selected ? <Check color={colors.background} size={15} strokeWidth={3} /> : null}
    </View>
  </Pressable>
);

const ReviewSplitRow = ({
  avatarColor = colors.accent,
  icon,
  iconComponent: IconComponent,
  initial,
  label,
  value
}: {
  avatarColor?: string;
  icon?: "group";
  iconComponent?: typeof CalendarDays;
  initial?: string;
  label: string;
  value: string;
}) => (
  <View style={styles.reviewRow}>
    <View style={styles.reviewIdentity}>
      <View style={[styles.reviewAvatar, { backgroundColor: avatarColor }]}>
        {IconComponent ? (
          <IconComponent color={colors.textPrimary} size={16} strokeWidth={2.5} />
        ) : icon === "group" ? (
          <UsersRound color={colors.textPrimary} size={16} strokeWidth={2.5} />
        ) : (
          <Text style={styles.reviewInitial}>{initial}</Text>
        )}
      </View>
      <Text style={styles.reviewLabel}>{label}</Text>
    </View>
    <Text style={styles.reviewValue}>{value}</Text>
  </View>
);

const SavedSplitCard = ({ split }: { split: SavedSplit }) => (
  <View style={styles.savedSplitCard}>
    <View style={styles.savedSplitHeader}>
      <View>
        <Text style={styles.savedSplitEyebrow}>Saved split</Text>
        <Text style={styles.savedSplitTitle}>{split.targetName}</Text>
      </View>
      <View style={styles.savedSplitMethodPill}>
        <Text style={styles.savedSplitMethodText}>{splitMethodCopy[split.method].label}</Text>
      </View>
    </View>

    <View style={styles.savedSplitRows}>
      {split.allocations.map((allocation) => (
        <View key={allocation.personId} style={styles.savedSplitRow}>
          <View style={styles.savedSplitPerson}>
            <View style={styles.savedSplitAvatar}>
              <Text style={styles.savedSplitInitial}>
                {getPersonInitial(allocation.personName)}
              </Text>
            </View>
            <Text numberOfLines={1} style={styles.savedSplitName}>
              {allocation.personName}
            </Text>
          </View>
          <Text style={styles.savedSplitAmount}>{formatCurrency(allocation.amount)}</Text>
        </View>
      ))}
    </View>

    <View style={styles.savedSplitSummary}>
      <View>
        <Text style={styles.savedSplitSummaryLabel}>Remaining</Text>
        <Text style={styles.savedSplitSummaryValue}>{formatCurrency(split.remainingAmount)}</Text>
      </View>
      <View style={styles.savedSplitSummaryRight}>
        <Text style={styles.savedSplitSummaryLabel}>Allocated</Text>
        <Text style={styles.savedSplitSummaryValue}>{formatCurrency(split.allocatedTotal)}</Text>
      </View>
    </View>
  </View>
);

const DetailInput = ({
  editable = true,
  label,
  multiline = false,
  onChangeText,
  placeholder,
  value,
  keyboardType
}: {
  editable?: boolean;
  keyboardType?: "default" | "decimal-pad";
  label?: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) => (
  <View style={styles.inputBlock}>
    {label ? <Text style={styles.formLabel}>{label}</Text> : null}
    <TextInput
      editable={editable}
      keyboardType={keyboardType}
      multiline={multiline}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      style={[
        styles.input,
        multiline && styles.textArea,
        !editable && styles.inputDisabled
      ]}
      value={value}
    />
  </View>
);

const InfoTile = ({
  icon: Icon,
  label,
  value
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) => {
  const { accentColor, accentSoft } = useAppearanceTheme();

  return (
    <View style={styles.infoTile}>
      <View style={[styles.infoIcon, { backgroundColor: accentSoft }]}>
        <Icon color={accentColor} size={17} strokeWidth={2.5} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
};

const MoneyMovementNotice = ({
  statusLabel,
  tone
}: {
  statusLabel: string;
  tone: string;
}) => (
  <View style={[styles.moneyMovementNotice, { borderColor: `${tone}33` }]}>
    <View style={[styles.moneyMovementIcon, { backgroundColor: `${tone}1F` }]}>
      <CreditCard color={tone} size={18} strokeWidth={2.6} />
    </View>
    <View style={styles.moneyMovementCopy}>
      <Text style={styles.moneyMovementTitle}>Money movement</Text>
      <Text style={styles.moneyMovementText}>
        {statusLabel} records help reconcile accounts, but they are not split eligible and do not
        count as spend.
      </Text>
    </View>
  </View>
);

const InfoRow = ({
  icon: Icon,
  label,
  tone,
  value
}: {
  icon: typeof CalendarDays;
  label: string;
  tone?: string;
  value: string;
}) => {
  const { accentColor } = useAppearanceTheme();
  const resolvedTone = tone ?? accentColor;

  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoRowIcon, { backgroundColor: `${resolvedTone}18` }]}>
        <Icon color={resolvedTone} size={17} strokeWidth={2.5} />
      </View>
      <View style={styles.infoRowCopy}>
        <Text style={styles.infoRowLabel}>{label}</Text>
        <Text numberOfLines={2} style={styles.infoRowValue}>
          {value}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  header: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: colors.surface
  },
  headerCopy: {
    minWidth: 0,
    flex: 1
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 15,
    textTransform: "uppercase"
  },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: 110
  },
  heroCard: {
    minHeight: 208,
    justifyContent: "space-between",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.2)",
    padding: spacing.lg,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 30
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  merchantMark: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)"
  },
  statusPill: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  statusText: {
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16
  },
  heroMerchant: {
    color: colors.textPrimary,
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 35
  },
  heroAmount: {
    color: colors.textPrimary,
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 46
  },
  heroMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  section: {
    gap: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(13, 19, 28, 0.9)",
    padding: spacing.md
  },
  sectionHeader: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  savedBadge: {
    minHeight: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm
  },
  savedBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15
  },
  segmentRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  segmentPill: {
    minHeight: 38,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(5, 8, 13, 0.46)",
    paddingHorizontal: spacing.sm
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15
  },
  splitEntryButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(246, 166, 59, 0.22)",
    backgroundColor: "rgba(246, 166, 59, 0.08)",
    paddingHorizontal: spacing.md
  },
  splitEntryIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(246, 166, 59, 0.16)"
  },
  splitEntryCopy: {
    minWidth: 0,
    flex: 1
  },
  splitEntryLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  splitEntryMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  savedSplitCard: {
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(246, 166, 59, 0.18)",
    backgroundColor: "rgba(5, 8, 13, 0.44)",
    padding: spacing.md
  },
  savedSplitHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  savedSplitEyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 13,
    textTransform: "uppercase"
  },
  savedSplitTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  savedSplitMethodPill: {
    minHeight: 28,
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: "rgba(246, 166, 59, 0.14)",
    paddingHorizontal: spacing.sm
  },
  savedSplitMethodText: {
    color: colors.shared,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15
  },
  savedSplitRows: {
    gap: spacing.xs
  },
  savedSplitRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  savedSplitPerson: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  savedSplitAvatar: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.1)"
  },
  savedSplitInitial: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15
  },
  savedSplitName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  savedSplitAmount: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  savedSplitSummary: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "rgba(17, 25, 35, 0.82)",
    paddingHorizontal: spacing.md
  },
  savedSplitSummaryRight: {
    alignItems: "flex-end"
  },
  savedSplitSummaryLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 13,
    textTransform: "uppercase"
  },
  savedSplitSummaryValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  splitOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    justifyContent: "flex-end",
    marginHorizontal: -spacing.lg
  },
  splitScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 4, 7, 0.74)"
  },
  splitSheet: {
    paddingHorizontal: 0,
    paddingBottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -18 },
    shadowOpacity: 0.44,
    shadowRadius: 28
  },
  splitSurface: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
    paddingTop: spacing.sm
  },
  splitHandle: {
    alignSelf: "center",
    width: 34,
    height: 4,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    marginBottom: spacing.sm
  },
  splitHeader: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md
  },
  splitHeaderButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.06)"
  },
  splitHeaderCopy: {
    minWidth: 0,
    flex: 1
  },
  splitTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21
  },
  splitSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16
  },
  splitStepTabs: {
    height: 42,
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)"
  },
  splitStepTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "transparent"
  },
  splitStepTabActive: {
    borderBottomColor: colors.accent
  },
  splitStepTabText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16
  },
  splitStepTabTextActive: {
    color: colors.accent
  },
  splitStep: {
    gap: spacing.md,
    padding: spacing.md
  },
  targetTypeRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  targetTypePill: {
    minHeight: 34,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(11, 17, 26, 0.68)"
  },
  targetTypePillActive: {
    borderColor: "rgba(67, 216, 139, 0.34)",
    backgroundColor: colors.accentSoft
  },
  targetTypeText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16
  },
  targetTypeTextActive: {
    color: colors.accent
  },
  targetList: {
    gap: spacing.sm
  },
  peoplePickerHeader: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  peoplePickerCopy: {
    minWidth: 0,
    flex: 1
  },
  peoplePickerTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  peoplePickerMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  selectedCountPill: {
    minWidth: 36,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    backgroundColor: "rgba(67, 216, 139, 0.5)"
  },
  selectedCountText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  personRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    backgroundColor: "rgba(31, 38, 49, 0.82)",
    paddingHorizontal: spacing.md
  },
  personRowSelected: {
    borderColor: "rgba(67, 216, 139, 0.55)",
    backgroundColor: "rgba(67, 216, 139, 0.1)"
  },
  personAvatar: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17
  },
  personInitial: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18
  },
  personCopy: {
    minWidth: 0,
    flex: 1
  },
  personName: {
    minWidth: 0,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  personStatus: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  personCheck: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(5, 8, 13, 0.48)"
  },
  personCheckSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent
  },
  groupCard: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    backgroundColor: "rgba(31, 38, 49, 0.82)",
    paddingHorizontal: spacing.md
  },
  groupCardActive: {
    borderColor: "rgba(67, 216, 139, 0.55)",
    backgroundColor: "rgba(67, 216, 139, 0.1)"
  },
  groupAvatar: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17
  },
  allocationBlock: {
    gap: spacing.sm
  },
  allocationTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  allocationRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: "rgba(31, 38, 49, 0.5)",
    paddingHorizontal: spacing.md
  },
  allocationName: {
    minWidth: 0,
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  allocationInputWrap: {
    minWidth: 96,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    borderRadius: radii.sm,
    backgroundColor: "rgba(5, 8, 13, 0.64)",
    paddingHorizontal: spacing.sm
  },
  allocationInput: {
    minWidth: 58,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
    paddingVertical: 0,
    textAlign: "right"
  },
  allocationSuffix: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,
    marginLeft: 2
  },
  allocationSummary: {
    minHeight: 58,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(5, 8, 13, 0.46)",
    padding: spacing.md
  },
  allocationSummaryRight: {
    alignItems: "flex-end"
  },
  allocationSummaryLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 13,
    textTransform: "uppercase"
  },
  allocationSummaryValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  allocationSummaryWarning: {
    color: colors.warning
  },
  allocationValidation: {
    width: "100%",
    color: colors.warning,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15
  },
  targetCopy: {
    minWidth: 0,
    flex: 1
  },
  targetName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  targetMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  methodList: {
    gap: spacing.sm
  },
  methodCard: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(31, 38, 49, 0.62)",
    paddingHorizontal: spacing.md
  },
  methodCardActive: {
    borderColor: "rgba(67, 216, 139, 0.72)",
    backgroundColor: "rgba(67, 216, 139, 0.09)"
  },
  methodIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.06)"
  },
  methodName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  splitButtonRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md
  },
  splitPrimaryButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.accent
  },
  splitPrimaryButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  splitButtonHalf: {
    flex: 1
  },
  splitSecondaryButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(5, 8, 13, 0.26)"
  },
  splitSecondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  reviewTotal: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  reviewRows: {
    gap: spacing.sm
  },
  reviewRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "rgba(31, 38, 49, 0.5)",
    paddingHorizontal: spacing.md
  },
  reviewIdentity: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  reviewAvatar: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17
  },
  reviewInitial: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18
  },
  reviewLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  reviewValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  infoTile: {
    minHeight: 108,
    minWidth: "47%",
    flex: 1,
    justifyContent: "space-between",
    borderRadius: radii.lg,
    backgroundColor: "rgba(5, 8, 13, 0.46)",
    padding: spacing.md
  },
  infoIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.accentSoft
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 13,
    textTransform: "uppercase"
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  infoRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: "rgba(5, 8, 13, 0.46)",
    paddingHorizontal: spacing.md
  },
  moneyMovementNotice: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    backgroundColor: "rgba(92, 168, 255, 0.08)",
    padding: spacing.md
  },
  moneyMovementIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19
  },
  moneyMovementCopy: {
    minWidth: 0,
    flex: 1,
    gap: 3
  },
  moneyMovementTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  moneyMovementText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  infoRowIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18
  },
  infoRowCopy: {
    minWidth: 0,
    flex: 1
  },
  infoRowLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 13,
    textTransform: "uppercase"
  },
  infoRowValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  formGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  formBlock: {
    gap: spacing.sm
  },
  formLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 13,
    textTransform: "uppercase"
  },
  inputBlock: {
    flex: 1,
    gap: spacing.xs
  },
  input: {
    minHeight: 46,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(5, 8, 13, 0.72)",
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
    paddingHorizontal: spacing.md
  },
  textArea: {
    minHeight: 92,
    paddingTop: spacing.md,
    textAlignVertical: "top"
  },
  inputDisabled: {
    opacity: 0.45
  },
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  accountOption: {
    minHeight: 36,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(5, 8, 13, 0.42)",
    paddingHorizontal: spacing.md
  },
  accountOptionActive: {
    borderColor: "rgba(67, 216, 139, 0.38)",
    backgroundColor: colors.accentSoft
  },
  accountDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  accountOptionText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16
  },
  accountOptionActiveText: {
    color: colors.textPrimary
  },
  categoryOption: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(5, 8, 13, 0.42)",
    paddingHorizontal: spacing.md
  },
  categoryOptionActive: {
    borderColor: "rgba(127, 167, 255, 0.5)",
    backgroundColor: "rgba(127, 167, 255, 0.14)"
  },
  categoryOptionText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16
  },
  categoryOptionActiveText: {
    color: colors.textPrimary
  },
  noteCard: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: "rgba(5, 8, 13, 0.46)",
    padding: spacing.md
  },
  noteText: {
    minWidth: 0,
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19
  },
  actionDock: {
    gap: spacing.sm
  },
  validationText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
    textAlign: "center"
  },
  saveButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.accent
  },
  saveButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  disabledButton: {
    opacity: 0.52
  },
  secondaryButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.26)",
    backgroundColor: colors.accentSoft
  },
  secondaryButtonText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  primaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  emptyRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl
  },
  emptyIcon: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.24)",
    backgroundColor: colors.accentSoft
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
    textAlign: "center"
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    textAlign: "center"
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }]
  }
});
