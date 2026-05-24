import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  CreditCard,
  HandCoins,
  ReceiptText,
  Search,
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

import { AppTopBar } from "@/components/navigation/app-top-bar";
import { PremiumEmptyState } from "@/components/ui/premium-empty-state";
import { Screen } from "@/components/ui/screen";
import {
  useSettlementStore,
  type SavedSettlement,
  type SettlementStatus
} from "@/features/settlements/settlement-store";
import { useAppearanceTheme } from "@/features/settings/use-appearance-theme";
import {
  classificationLabel,
  formatCurrency,
  formatTransactionAmount,
  isSpendTransaction,
  transactionKindLabel,
  useLedgerTransactions,
  type Classification,
  type Transaction,
  type TransactionKind
} from "@/features/transactions/transaction-ledger";
import { colors, radii, spacing } from "@/styles/theme";

type TimelineFilter = "all" | Classification | "payments" | "settlements";

type TimelineItem =
  | {
      amount: number;
      date: string;
      id: string;
      kind: "transaction";
      sortTimestamp: string;
      transaction: Transaction;
    }
  | {
      amount: number;
      date: string;
      id: string;
      kind: "settlement";
      settlement: SavedSettlement;
      sortTimestamp: string;
    };

type TimelineGroup = {
  date: string;
  label: string;
  meta: string;
  total: number;
  items: TimelineItem[];
};

const filterOptions: Array<{ label: string; value: TimelineFilter }> = [
  { label: "All", value: "all" },
  { label: "Personal", value: "personal" },
  { label: "Shared", value: "shared" },
  { label: "Unclassified", value: "unclassified" },
  { label: "Payments", value: "payments" },
  { label: "Settlements", value: "settlements" }
];

const classificationColor: Record<Classification, string> = {
  personal: colors.personal,
  shared: colors.shared,
  unclassified: colors.unclassified
};

const classificationIcon: Record<Classification, typeof UserRound> = {
  personal: UserRound,
  shared: UsersRound,
  unclassified: CircleHelp
};

const transactionKindColor: Record<TransactionKind, string> = {
  expense: colors.unclassified,
  income: colors.personal,
  payment: "#5CA8FF",
  transfer: "#5CA8FF"
};

const getTransactionTone = (transaction: Transaction) =>
  isSpendTransaction(transaction)
    ? classificationColor[transaction.classification]
    : transactionKindColor[transaction.kind];

const settlementStatusCopy: Record<SettlementStatus, { label: string; tone: string }> = {
  both_confirmed: {
    label: "Both confirmed",
    tone: colors.accent
  },
  cancelled: {
    label: "Cancelled",
    tone: colors.danger
  },
  pending: {
    label: "Pending",
    tone: colors.shared
  },
  user_confirmed: {
    label: "You confirmed",
    tone: colors.accent
  }
};

const getDateKeyFromTimestamp = (timestamp: string) =>
  new Date(timestamp).toISOString().slice(0, 10);

const formatActivityTime = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });

const formatGroupLabel = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    weekday: "long"
  });

const formatGroupMeta = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-US", {
    year: "numeric"
  });

const sortTransactions = (transactions: Transaction[]) =>
  [...transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const sortItems = (items: TimelineItem[]) =>
  [...items].sort((a, b) => b.sortTimestamp.localeCompare(a.sortTimestamp));

const buildTransactionItem = (transaction: Transaction): TimelineItem => ({
  amount: transaction.amount,
  date: transaction.date,
  id: `transaction-${transaction.id}`,
  kind: "transaction",
  sortTimestamp: transaction.createdAt,
  transaction
});

const buildSettlementItem = (settlement: SavedSettlement): TimelineItem => ({
  amount: settlement.status === "cancelled" ? 0 : settlement.amount,
  date: getDateKeyFromTimestamp(settlement.updatedAt),
  id: `settlement-${settlement.id}`,
  kind: "settlement",
  settlement,
  sortTimestamp: settlement.updatedAt
});

const buildTimelineGroups = (items: TimelineItem[]): TimelineGroup[] => {
  const grouped = items.reduce<Record<string, TimelineItem[]>>((acc, item) => {
    acc[item.date] = [...(acc[item.date] ?? []), item];
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([date, dateItems]) => {
      const sorted = sortItems(dateItems);

      return {
        date,
        label: formatGroupLabel(date),
        meta: formatGroupMeta(date),
        total: sorted.reduce(
          (sum, item) =>
            item.kind === "transaction" && !isSpendTransaction(item.transaction)
              ? sum
              : sum + item.amount,
          0
        ),
        items: sorted
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
};

export const TimelineFeedScreen = () => {
  const router = useRouter();
  const { accentColor, accentSoft, palette } = useAppearanceTheme();
  const params = useLocalSearchParams<{ importBatchId?: string }>();
  const importBatchId = typeof params.importBatchId === "string" ? params.importBatchId : "";
  const ledgerTransactions = useLedgerTransactions();
  const settlements = useSettlementStore((state) => state.settlements);
  const loadSettlements = useSettlementStore((state) => state.loadSettlements);
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>("all");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    void loadSettlements();
  }, [loadSettlements]);

  const activeSettlements = useMemo(
    () => settlements.filter((settlement) => settlement.status !== "cancelled"),
    [settlements]
  );

  const timelineItems = useMemo(
    () => [
      ...ledgerTransactions.map(buildTransactionItem),
      ...activeSettlements.map(buildSettlementItem)
    ],
    [activeSettlements, ledgerTransactions]
  );

  const filteredItems = useMemo(
    () =>
      sortItems(timelineItems).filter((item) => {
        const matchesImport =
          !importBatchId ||
          (item.kind === "transaction" && item.transaction.importBatchId === importBatchId);
        const matchesFilter =
          activeFilter === "all" ||
          (activeFilter === "settlements" && item.kind === "settlement") ||
          (activeFilter === "payments" &&
            item.kind === "transaction" &&
            !isSpendTransaction(item.transaction)) ||
          (item.kind === "transaction" && item.transaction.classification === activeFilter);

        const matchesQuery = !normalizedQuery || doesItemMatchQuery(item, normalizedQuery);

        return matchesImport && matchesFilter && matchesQuery;
      }),
    [activeFilter, importBatchId, normalizedQuery, timelineItems]
  );

  const groups = useMemo(() => buildTimelineGroups(filteredItems), [filteredItems]);
  const transactionCount = ledgerTransactions.length;
  const settlementCount = activeSettlements.length;
  const confirmedSettlementCount = activeSettlements.length;
  const showingLabel = filteredItems.length === 1 ? "activity" : "activities";
  const totalSpend = filteredItems.reduce(
    (sum, item) =>
      item.kind === "transaction" && isSpendTransaction(item.transaction)
        ? sum + item.amount
        : sum,
    0
  );
  const totalSettled = filteredItems.reduce(
    (sum, item) => (item.kind === "settlement" ? sum + item.amount : sum),
    0
  );
  const paymentTotal = filteredItems.reduce(
    (sum, item) =>
      item.kind === "transaction" && !isSpendTransaction(item.transaction)
        ? sum + Math.abs(item.amount)
        : sum,
    0
  );
  const heroValue =
    activeFilter === "settlements"
      ? totalSettled
      : activeFilter === "payments"
        ? paymentTotal
        : totalSpend;
  const heroValueLabel =
    activeFilter === "settlements"
      ? "Settled total"
      : activeFilter === "payments"
        ? "Payments moved"
        : "Total spend";
  const unclassifiedCount = ledgerTransactions.filter(
    (transaction) => transaction.classification === "unclassified"
  ).length;

  return (
    <Screen>
      <View style={styles.root}>
        <AppTopBar />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={[accentSoft, palette.cardStrong]}
            style={[styles.heroCard, { borderColor: `${accentColor}33`, shadowColor: accentColor }]}
          >
            <View style={styles.heroHeader}>
              <View style={[styles.heroIcon, { backgroundColor: accentSoft }]}>
                <CalendarDays color={accentColor} size={27} strokeWidth={2.6} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={[styles.eyebrow, { color: accentColor }]}>Timeline feed</Text>
                <Text style={styles.heroTitle}>
                  {importBatchId ? "Recently imported" : "Every spend, in order"}
                </Text>
              </View>
            </View>

            <View style={styles.heroStats}>
              <View>
                <Text style={styles.heroLabel}>Showing</Text>
                <Text style={styles.heroAmount}>{filteredItems.length}</Text>
                <Text style={styles.heroMeta}>{showingLabel}</Text>
              </View>
              <View style={styles.heroSpendBlock}>
                <Text style={styles.heroLabel}>{heroValueLabel}</Text>
                <Text style={styles.heroSpend}>{formatCurrency(heroValue)}</Text>
                <Text style={styles.heroMeta}>
                  {confirmedSettlementCount} confirmed - {settlementCount} settlement events
                </Text>
              </View>
            </View>
          </LinearGradient>

          <View style={[styles.searchShell, { backgroundColor: palette.card }]}>
            <Search color={colors.textMuted} size={18} strokeWidth={2.4} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Search merchant, category, note"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
            {query ? (
              <Pressable
                accessibilityLabel="Clear search"
                accessibilityRole="button"
                onPress={() => setQuery("")}
                style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
              >
                <X color={colors.textSecondary} size={16} strokeWidth={2.5} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={styles.filterRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {importBatchId ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace("/timeline")}
                style={({ pressed }) => [
                  styles.filterPill,
                  styles.filterPillActive,
                  { backgroundColor: accentSoft, borderColor: `${accentColor}55` },
                  pressed && styles.pressed
                ]}
              >
                <Text style={[styles.filterText, { color: accentColor }]}>Recent import</Text>
                <Text style={styles.filterCountActive}>{filteredItems.length}</Text>
              </Pressable>
            ) : null}
            {filterOptions.map((filter) => {
              const active = activeFilter === filter.value;
              const count =
                filter.value === "all"
                  ? transactionCount + settlementCount
                  : filter.value === "settlements"
                    ? settlementCount
                    : filter.value === "payments"
                      ? ledgerTransactions.filter((transaction) => !isSpendTransaction(transaction))
                          .length
                      : ledgerTransactions.filter(
                          (transaction) => transaction.classification === filter.value
                        ).length;

              return (
                <Pressable
                  accessibilityRole="button"
                  key={filter.value}
                  onPress={() => setActiveFilter(filter.value)}
                  style={({ pressed }) => [
                    styles.filterPill,
                    active && [
                      styles.filterPillActive,
                      { backgroundColor: accentSoft, borderColor: `${accentColor}55` }
                    ],
                    pressed && styles.pressed
                  ]}
                >
                  <Text style={[styles.filterText, active && { color: accentColor }]}>
                    {filter.label}
                  </Text>
                  <Text style={[styles.filterCount, active && styles.filterCountActive]}>
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {groups.length > 0 ? (
            <View style={styles.groupList}>
              {groups.map((group) => (
                <TimelineDateGroup
                  accentColor={accentColor}
                  accentSoft={accentSoft}
                  cardColor={palette.card}
                  group={group}
                  key={group.date}
                  onOpenSettlement={(settlement) =>
                    router.push(
                      `/settlement/${settlement.targetType}/${encodeURIComponent(
                        settlement.targetId
                      )}?returnTo=timeline`
                    )
                  }
                  onOpenTransaction={(transaction) =>
                    router.push(`/transaction/${transaction.id}?returnTo=timeline`)
                  }
                />
              ))}
            </View>
          ) : (
            <TimelineEmptyState hasSearch={!!normalizedQuery} />
          )}
        </ScrollView>
      </View>
    </Screen>
  );
};

const TimelineDateGroup = ({
  accentColor,
  accentSoft,
  cardColor,
  group,
  onOpenSettlement,
  onOpenTransaction
}: {
  accentColor: string;
  accentSoft: string;
  cardColor: string;
  group: TimelineGroup;
  onOpenSettlement: (settlement: SavedSettlement) => void;
  onOpenTransaction: (transaction: Transaction) => void;
}) => (
  <View style={styles.dateGroup}>
    <View style={styles.dateHeader}>
      <View>
        <Text style={styles.dateTitle}>{group.label}</Text>
        <Text style={styles.dateMeta}>
          {group.meta} - {group.items.length} {group.items.length === 1 ? "activity" : "activities"}
        </Text>
      </View>
      <Text style={styles.dateTotal}>{formatCurrency(group.total)}</Text>
    </View>

    <View style={styles.timelineRailWrap}>
      <View style={[styles.timelineRail, { backgroundColor: `${accentColor}2A` }]} />
      <View style={styles.transactionList}>
        {group.items.map((item) =>
          item.kind === "transaction" ? (
            <TimelineTransactionCard
              accentColor={accentColor}
              cardColor={cardColor}
              key={item.id}
              onPress={() => onOpenTransaction(item.transaction)}
              transaction={item.transaction}
            />
          ) : (
            <TimelineSettlementCard
              accentColor={accentColor}
              accentSoft={accentSoft}
              cardColor={cardColor}
              key={item.id}
              onPress={() => onOpenSettlement(item.settlement)}
              settlement={item.settlement}
            />
          )
        )}
      </View>
    </View>
  </View>
);

const doesItemMatchQuery = (item: TimelineItem, normalizedQuery: string) => {
  if (item.kind === "transaction") {
    return (
      item.transaction.merchant.toLowerCase().includes(normalizedQuery) ||
      item.transaction.category.toLowerCase().includes(normalizedQuery) ||
      item.transaction.description.toLowerCase().includes(normalizedQuery)
    );
  }

  const status = settlementStatusCopy[item.settlement.status].label;

  return (
    item.settlement.targetName.toLowerCase().includes(normalizedQuery) ||
    item.settlement.targetType.toLowerCase().includes(normalizedQuery) ||
    status.toLowerCase().includes(normalizedQuery) ||
    item.settlement.notes?.toLowerCase().includes(normalizedQuery) ||
    "settlement".includes(normalizedQuery)
  );
};

const TimelineTransactionCard = ({
  accentColor,
  cardColor,
  onPress,
  transaction
}: {
  accentColor: string;
  cardColor: string;
  onPress: () => void;
  transaction: Transaction;
}) => {
  const isSpend = isSpendTransaction(transaction);
  const tone = getTransactionTone(transaction);
  const Icon = isSpend ? classificationIcon[transaction.classification] : CreditCard;
  const statusLabel = isSpend
    ? classificationLabel[transaction.classification]
    : transactionKindLabel[transaction.kind];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.transactionCard,
        { backgroundColor: cardColor },
        pressed && [
          styles.cardPressed,
          { borderColor: `${accentColor}33`, backgroundColor: cardColor }
        ]
      ]}
    >
      <View style={styles.transactionMarker}>
        <View style={[styles.transactionIcon, { backgroundColor: `${tone}24` }]}>
          <Icon color={tone} size={18} strokeWidth={2.5} />
        </View>
      </View>

      <View style={styles.transactionCopy}>
        <Text numberOfLines={1} style={styles.transactionMerchant}>
          {transaction.merchant}
        </Text>
        <Text numberOfLines={1} style={styles.transactionMeta}>
          {transaction.time} - {transaction.category} - {transaction.account}
        </Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, { backgroundColor: `${tone}18` }]}>
            <Text style={[styles.statusText, { color: tone }]}>
              {statusLabel}
            </Text>
          </View>
          {transaction.splitConnection ? (
            <Text numberOfLines={1} style={styles.splitText}>
              {transaction.splitConnection}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.amountBlock}>
        <Text style={styles.transactionAmount}>{formatTransactionAmount(transaction)}</Text>
        <ChevronRight color={colors.textMuted} size={17} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
};

const TimelineSettlementCard = ({
  accentColor,
  accentSoft,
  cardColor,
  onPress,
  settlement
}: {
  accentColor: string;
  accentSoft: string;
  cardColor: string;
  onPress: () => void;
  settlement: SavedSettlement;
}) => {
  const statusBase = settlementStatusCopy[settlement.status];
  const statusTone =
    settlement.status === "cancelled"
      ? colors.danger
      : settlement.status === "pending"
        ? colors.shared
        : accentColor;
  const status = {
    ...statusBase,
    tone: statusTone
  };
  const targetLabel =
    settlement.targetType === "person"
      ? "Person balance"
      : settlement.targetType === "group"
        ? "Group balance"
        : "Shared connection";
  const relatedCount = settlement.transactionIds.length;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.settlementCard,
        { shadowColor: statusTone },
        pressed && styles.settlementCardPressed
      ]}
    >
      <LinearGradient
        colors={
          settlement.status === "cancelled"
            ? ["rgba(255, 107, 107, 0.16)", cardColor]
            : [accentSoft, cardColor]
        }
        style={[styles.settlementSurface, { borderColor: `${statusTone}36` }]}
      >
        <View style={styles.settlementMarker}>
          <View
            style={[
              styles.settlementIcon,
              { backgroundColor: `${status.tone}24`, borderColor: `${status.tone}33` }
            ]}
          >
            <CheckCircle2 color={status.tone} size={20} strokeWidth={2.7} />
          </View>
        </View>

        <View style={styles.settlementCopy}>
          <View style={styles.settlementTitleRow}>
            <Text numberOfLines={1} style={styles.settlementTitle}>
              Settlement with {settlement.targetName}
            </Text>
            <View style={[styles.settlementStatusPill, { backgroundColor: `${status.tone}18` }]}>
              <Text style={[styles.settlementStatusText, { color: status.tone }]}>
                {status.label}
              </Text>
            </View>
          </View>
          <Text numberOfLines={1} style={styles.settlementMeta}>
            {formatActivityTime(settlement.updatedAt)} - {targetLabel}
          </Text>
          <View style={styles.settlementDetailRow}>
            <HandCoins color={status.tone} size={14} strokeWidth={2.5} />
            <Text numberOfLines={1} style={styles.settlementDetailText}>
              {relatedCount} related {relatedCount === 1 ? "transaction" : "transactions"}
            </Text>
          </View>
        </View>

        <View style={styles.settlementAmountBlock}>
          <Text style={[styles.settlementAmount, { color: status.tone }]}>
            {formatCurrency(settlement.amount)}
          </Text>
          <ChevronRight color={colors.textMuted} size={17} strokeWidth={2.5} />
        </View>
      </LinearGradient>
    </Pressable>
  );
};

const TimelineEmptyState = ({ hasSearch }: { hasSearch: boolean }) => {
  const { accentColor } = useAppearanceTheme();

  return (
    <PremiumEmptyState
      icon={hasSearch ? Search : ReceiptText}
      message={
        hasSearch
          ? "Try another merchant, category, or note to keep exploring your spending memory."
          : "Import a statement to start building your chronological money story."
      }
      title={hasSearch ? "No search results" : "No transactions yet"}
      tone={hasSearch ? colors.unclassified : accentColor}
    />
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  content: {
    gap: spacing.md,
    paddingBottom: 116
  },
  heroCard: {
    gap: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.18)",
    padding: spacing.lg,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 30
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  heroIcon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: colors.accentSoft
  },
  heroCopy: {
    minWidth: 0,
    flex: 1
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    textTransform: "uppercase"
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 31
  },
  heroStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  heroLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    textTransform: "uppercase"
  },
  heroAmount: {
    color: colors.textPrimary,
    fontSize: 38,
    fontWeight: "900",
    lineHeight: 44
  },
  heroMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  heroSpendBlock: {
    alignItems: "flex-end",
    justifyContent: "flex-end"
  },
  heroSpend: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28
  },
  searchShell: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(17, 25, 35, 0.82)",
    paddingHorizontal: spacing.md
  },
  searchInput: {
    minWidth: 0,
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
    paddingVertical: spacing.sm
  },
  clearButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.06)"
  },
  filterRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg
  },
  filterPill: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(17, 25, 35, 0.68)",
    paddingHorizontal: spacing.md
  },
  filterPillActive: {
    borderColor: "rgba(67, 216, 139, 0.28)",
    backgroundColor: colors.accentSoft
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  filterTextActive: {
    color: colors.accent
  },
  filterCount: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17
  },
  filterCountActive: {
    color: colors.textPrimary
  },
  groupList: {
    gap: spacing.lg
  },
  dateGroup: {
    gap: spacing.sm
  },
  dateHeader: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  dateTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22
  },
  dateMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15
  },
  dateTotal: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  timelineRailWrap: {
    position: "relative"
  },
  timelineRail: {
    position: "absolute",
    top: spacing.sm,
    bottom: spacing.sm,
    left: 18,
    width: 2,
    borderRadius: 1,
    backgroundColor: "rgba(67, 216, 139, 0.16)"
  },
  transactionList: {
    gap: spacing.sm
  },
  transactionCard: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(17, 25, 35, 0.82)",
    padding: spacing.md
  },
  settlementCard: {
    borderRadius: radii.xl,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 28
  },
  settlementSurface: {
    minHeight: 110,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.24)",
    padding: spacing.md
  },
  settlementCardPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }]
  },
  cardPressed: {
    borderColor: "rgba(67, 216, 139, 0.28)",
    backgroundColor: "rgba(17, 25, 35, 0.94)"
  },
  transactionMarker: {
    width: 38,
    alignItems: "center"
  },
  transactionIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)"
  },
  settlementMarker: {
    width: 42,
    alignItems: "center"
  },
  settlementIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.22)"
  },
  transactionCopy: {
    minWidth: 0,
    flex: 1,
    gap: 3
  },
  transactionMerchant: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  transactionMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  statusRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  statusPill: {
    minHeight: 22,
    justifyContent: "center",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm
  },
  statusText: {
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 14
  },
  splitText: {
    minWidth: 0,
    flex: 1,
    color: colors.shared,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 14
  },
  amountBlock: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.xs
  },
  transactionAmount: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  settlementCopy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs
  },
  settlementTitleRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  settlementTitle: {
    minWidth: 0,
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  settlementStatusPill: {
    minHeight: 24,
    justifyContent: "center",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm
  },
  settlementStatusText: {
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 14
  },
  settlementMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15
  },
  settlementDetailRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  settlementDetailText: {
    minWidth: 0,
    flex: 1,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15
  },
  settlementAmountBlock: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.xs
  },
  settlementAmount: {
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  emptyState: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(17, 25, 35, 0.62)",
    padding: spacing.xl
  },
  emptyIcon: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 29,
    backgroundColor: "rgba(255, 255, 255, 0.05)"
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24,
    marginTop: spacing.sm
  },
  emptyText: {
    maxWidth: 250,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    textAlign: "center"
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }]
  }
});
