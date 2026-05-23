import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  HandCoins,
  ReceiptText,
  UserRound,
  UsersRound
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppTopBar } from "@/components/navigation/app-top-bar";
import { PremiumEmptyState } from "@/components/ui/premium-empty-state";
import { Screen } from "@/components/ui/screen";
import { useGroupsStore } from "@/features/groups/group-store";
import { getPersonInitial, usePeopleStore } from "@/features/people/people-store";
import { useSettlementStore } from "@/features/settlements/settlement-store";
import { useAppearanceTheme } from "@/features/settings/use-appearance-theme";
import {
  buildSharedBalanceModel,
  type SharedBalanceRow,
  type SharedTransactionRow
} from "@/features/shared/shared-balance-model";
import { useSplitStore } from "@/features/splits/split-store";
import {
  formatCurrency,
  formatSpendAmount,
  useLedgerTransactions
} from "@/features/transactions/transaction-ledger";
import { colors, radii, spacing } from "@/styles/theme";

type SharedNotice = {
  message: string;
  undoSettlementId?: string;
};

type SettlementMode = "full" | "partial";

type SettlementSheetState = {
  amountInput: string;
  mode: SettlementMode;
  row: SharedBalanceRow;
};

const getReadableDate = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short"
  });

export const SharedScreen = () => {
  const router = useRouter();
  const { accentColor, accentSoft, palette } = useAppearanceTheme();
  const ledgerTransactions = useLedgerTransactions();
  const people = usePeopleStore((state) => state.people);
  const loadPeople = usePeopleStore((state) => state.loadPeople);
  const groups = useGroupsStore((state) => state.groups);
  const loadGroups = useGroupsStore((state) => state.loadGroups);
  const splits = useSplitStore((state) => state.splits);
  const loadSplits = useSplitStore((state) => state.loadSplits);
  const settlements = useSettlementStore((state) => state.settlements);
  const cancelSettlement = useSettlementStore((state) => state.cancelSettlement);
  const createUserConfirmedSettlement = useSettlementStore(
    (state) => state.createUserConfirmedSettlement
  );
  const loadSettlements = useSettlementStore((state) => state.loadSettlements);
  const [activeView, setActiveView] = useState<"balances" | "transactions">("balances");
  const [notice, setNotice] = useState<SharedNotice | null>(null);
  const [settlementSheet, setSettlementSheet] = useState<SettlementSheetState | null>(null);

  useEffect(() => {
    void loadPeople();
    void loadGroups();
    void loadSplits();
    void loadSettlements();
  }, [loadGroups, loadPeople, loadSettlements, loadSplits]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeout = setTimeout(() => setNotice(null), 3600);

    return () => clearTimeout(timeout);
  }, [notice]);

  const model = useMemo(
    () =>
      buildSharedBalanceModel({
        groups,
        ledgerTransactions,
        people,
        settlements,
        splits
      }),
    [groups, ledgerTransactions, people, settlements, splits]
  );

  const positivePeopleCount = model.peopleRows.filter((row) => row.amount > 0).length;
  const positiveGroupCount = model.groupRows.filter((row) => row.amount > 0).length;

  const openSettlement = (row: SharedBalanceRow) => {
    router.push(`/settlement/${row.type}/${encodeURIComponent(row.id)}?returnTo=shared`);
  };

  const openSettleSheet = (row: SharedBalanceRow) => {
    setSettlementSheet({
      amountInput: Math.abs(row.amount).toFixed(2),
      mode: "full",
      row
    });
  };

  const closeSettleSheet = () => {
    setSettlementSheet(null);
  };

  const updateSettleMode = (mode: SettlementMode) => {
    setSettlementSheet((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        amountInput: mode === "full" ? Math.abs(current.row.amount).toFixed(2) : "",
        mode
      };
    });
  };

  const updateSettleAmount = (amountInput: string) => {
    setSettlementSheet((current) => (current ? { ...current, amountInput } : current));
  };

  const confirmSettlement = async () => {
    if (!settlementSheet) {
      return;
    }

    const row = settlementSheet.row;
    const balanceAmount = Math.abs(row.amount);
    const parsedAmount =
      settlementSheet.mode === "full"
        ? balanceAmount
        : Number.parseFloat(settlementSheet.amountInput);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > balanceAmount) {
      return;
    }

    const savedSettlement = await createUserConfirmedSettlement({
      amount: parsedAmount,
      notes:
        settlementSheet.mode === "full"
          ? "Full settlement marked from Shared."
          : "Partial settlement marked from Shared.",
      status: "user_confirmed",
      targetId: row.id,
      targetName: row.name,
      targetType: row.type,
      transactionIds: row.transactionIds
    });

    closeSettleSheet();
    setNotice({
      message:
        settlementSheet.mode === "full"
          ? `${row.name} marked settled.`
          : `${formatCurrency(parsedAmount)} settled with ${row.name}.`,
      undoSettlementId: savedSettlement.id
    });
  };

  const undoQuickSettle = async (settlementId: string) => {
    await cancelSettlement(settlementId);
    setNotice({
      message: "Settlement undone."
    });
  };

  return (
    <Screen>
      <View style={styles.root}>
        <AppTopBar />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={[accentSoft, palette.cardStrong]}
            style={[
              styles.heroCard,
              { borderColor: `${accentColor}33`, shadowColor: accentColor }
            ]}
          >
            <View style={styles.heroHeader}>
              <View style={[styles.heroIcon, { backgroundColor: accentSoft }]}>
                <UsersRound color={accentColor} size={28} strokeWidth={2.5} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={[styles.eyebrow, { color: accentColor }]}>Shared balances</Text>
                <Text style={styles.heroTitle}>Who owes what</Text>
              </View>
            </View>

            <Text style={styles.heroLabel}>Total owed to you</Text>
            <Text style={styles.heroAmount}>{formatCurrency(model.totalOwed)}</Text>

            <View style={styles.heroStats}>
              <HeroStat label="People" value={`${positivePeopleCount}`} />
              <HeroStat label="Groups" value={`${positiveGroupCount}`} />
              <HeroStat label="Shared spend" value={formatCurrency(model.totalShared, true)} />
            </View>
          </LinearGradient>

          {model.totalYouOwe > 0 ? (
            <View style={styles.noticeCard}>
              <HandCoins color={colors.warning} size={17} strokeWidth={2.5} />
              <Text style={styles.noticeText}>
                You owe {formatCurrency(model.totalYouOwe)} across older balances.
              </Text>
            </View>
          ) : null}

          {notice ? (
            <View style={[styles.inlineToast, { backgroundColor: accentSoft }]}>
              <CheckCircle2 color={accentColor} size={16} strokeWidth={2.5} />
              <Text style={[styles.inlineToastText, { color: accentColor }]}>{notice.message}</Text>
              {notice.undoSettlementId ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void undoQuickSettle(notice.undoSettlementId!)}
                  style={({ pressed }) => [
                    styles.toastAction,
                    { backgroundColor: `${accentColor}2E` },
                    pressed && styles.pressed
                  ]}
                >
                  <Text style={[styles.toastActionText, { color: accentColor }]}>Undo</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.segmentRow, { backgroundColor: palette.card }]}>
            {(["balances", "transactions"] as const).map((view) => {
              const active = activeView === view;

              return (
                <Pressable
                  accessibilityRole="button"
                  key={view}
                  onPress={() => setActiveView(view)}
                  style={({ pressed }) => [
                    styles.segmentPill,
                    active && [styles.segmentPillActive, { backgroundColor: accentSoft }],
                    pressed && styles.pressed
                  ]}
                >
                  <Text style={[styles.segmentText, active && { color: accentColor }]}>
                    {view === "balances" ? "Balances" : "Transactions"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {activeView === "balances" ? (
            <>
              <SectionHeader
                meta="People are calculated from saved splits and group shares"
                title="People"
              />
              {model.peopleRows.length > 0 ? (
                <View style={styles.list}>
                  {model.peopleRows.map((row) => (
                    <BalanceCard
                      accentColor={accentColor}
                      accentSoft={accentSoft}
                      cardColor={palette.card}
                      key={row.id}
                      onMarkSettled={() => openSettleSheet(row)}
                      onOpen={() => openSettlement(row)}
                      row={row}
                    />
                  ))}
                </View>
              ) : (
                <EmptyState
                  icon={UserRound}
                  text="Split with a person and their balance will appear here."
                  title="No people balances"
                  tone={accentColor}
                />
              )}

              <SectionHeader
                meta="Groups include saved group splits and imported shared connections"
                title="Groups"
              />
              {model.groupRows.length > 0 ? (
                <View style={styles.list}>
                  {model.groupRows.map((row) => (
                    <BalanceCard
                      accentColor={accentColor}
                      accentSoft={accentSoft}
                      cardColor={palette.card}
                      key={`${row.type}-${row.id}`}
                      onMarkSettled={() => openSettleSheet(row)}
                      onOpen={() => openSettlement(row)}
                      row={row}
                    />
                  ))}
                </View>
              ) : (
                <EmptyState
                  icon={UsersRound}
                  text="Create a group split for roommates, trips, or shared bills."
                  title="No group balances"
                  tone={accentColor}
                />
              )}
            </>
          ) : (
            <>
              <SectionHeader
                meta={`${model.transactionRows.length} shared transactions found`}
                title="Transaction history"
              />
              {model.transactionRows.length > 0 ? (
                <View style={styles.list}>
                  {model.transactionRows.map((transaction) => (
                    <SharedTransactionCard
                      accentColor={accentColor}
                      cardColor={palette.card}
                      key={transaction.id}
                      onPress={() => router.push(`/transaction/${transaction.id}?returnTo=shared`)}
                      transaction={transaction}
                    />
                  ))}
                </View>
              ) : (
                <EmptyState
                  icon={ReceiptText}
                  text="Mark a transaction as Shared to build your shared expense history."
                  title="No shared expenses"
                  tone={colors.shared}
                />
              )}
            </>
          )}
        </ScrollView>

        {settlementSheet ? (
          <SettlementSheet
            accentColor={accentColor}
            accentSoft={accentSoft}
            onClose={closeSettleSheet}
            onConfirm={() => void confirmSettlement()}
            onModeChange={updateSettleMode}
            onPartialAmountChange={updateSettleAmount}
            sheet={settlementSheet}
          />
        ) : null}
      </View>
    </Screen>
  );
};

const HeroStat = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.heroStat}>
    <Text style={styles.heroStatValue}>{value}</Text>
    <Text style={styles.heroStatLabel}>{label}</Text>
  </View>
);

const SectionHeader = ({ meta, title }: { meta: string; title: string }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Text style={styles.sectionMeta}>{meta}</Text>
  </View>
);

const BalanceCard = ({
  accentColor,
  accentSoft,
  cardColor,
  onMarkSettled,
  onOpen,
  row
}: {
  accentColor: string;
  accentSoft: string;
  cardColor: string;
  onMarkSettled: () => void;
  onOpen: () => void;
  row: SharedBalanceRow;
}) => {
  const isPositive = row.amount >= 0;
  const Icon = row.type === "person" ? UserRound : UsersRound;

  return (
    <Pressable
      accessibilityHint="Opens settlement details and related transactions"
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [
        styles.balanceCard,
        { backgroundColor: cardColor },
        pressed && [
          styles.cardPressed,
          { borderColor: `${accentColor}33`, backgroundColor: cardColor }
        ]
      ]}
    >
      <View style={styles.balanceTop}>
        <View style={[styles.avatar, { backgroundColor: `${row.color}26` }]}>
          {row.type === "person" ? (
            <Text style={[styles.avatarInitial, { color: row.color }]}>
              {getPersonInitial(row.name)}
            </Text>
          ) : (
            <Icon color={row.color} size={19} strokeWidth={2.5} />
          )}
        </View>

        <View style={styles.balanceCopy}>
          <Text numberOfLines={1} style={styles.balanceName}>
            {row.name}
          </Text>
          <Text numberOfLines={1} style={styles.balanceMeta}>
            {row.meta}
          </Text>
        </View>

        <View style={styles.amountBlock}>
          <Text style={[styles.balanceAmount, { color: isPositive ? colors.accent : colors.warning }]}>
            {isPositive ? "+" : "-"}
            {formatCurrency(Math.abs(row.amount))}
          </Text>
          <Text style={styles.amountCaption}>{isPositive ? "owes you" : "you owe"}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <Pressable
          accessibilityRole="button"
          onPress={(event) => {
            event.stopPropagation();
            onMarkSettled();
          }}
          style={({ pressed }) => [
            styles.settleButton,
            { backgroundColor: accentSoft },
            pressed && styles.pressed
          ]}
        >
          <CheckCircle2 color={accentColor} size={14} strokeWidth={2.5} />
          <Text style={[styles.settleButtonText, { color: accentColor }]}>Mark settled</Text>
        </Pressable>
      </View>
    </Pressable>
  );
};

const SharedTransactionCard = ({
  accentColor,
  cardColor,
  onPress,
  transaction
}: {
  accentColor: string;
  cardColor: string;
  onPress: () => void;
  transaction: SharedTransactionRow;
}) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [
      styles.transactionCard,
      { backgroundColor: cardColor },
      pressed && styles.pressed
    ]}
  >
    <View style={styles.transactionDate}>
      <Clock3 color={colors.shared} size={16} strokeWidth={2.5} />
      <Text style={styles.transactionDateText}>{getReadableDate(transaction.date)}</Text>
    </View>
    <View style={styles.transactionCopy}>
      <Text numberOfLines={1} style={styles.transactionMerchant}>
        {transaction.merchant}
      </Text>
      <Text numberOfLines={1} style={styles.transactionMeta}>
        {transaction.connection} - {transaction.method}
      </Text>
    </View>
    <View style={styles.transactionAmountBlock}>
      <Text style={styles.transactionAmount}>{formatSpendAmount(transaction.amount)}</Text>
      <Text style={[styles.savedText, transaction.saved && { color: accentColor }]}>
        {transaction.saved ? "Saved" : "Review"}
      </Text>
    </View>
    <ChevronRight color={colors.textMuted} size={18} />
  </Pressable>
);

const SettlementSheet = ({
  accentColor,
  accentSoft,
  onClose,
  onConfirm,
  onModeChange,
  onPartialAmountChange,
  sheet
}: {
  accentColor: string;
  accentSoft: string;
  onClose: () => void;
  onConfirm: () => void;
  onModeChange: (mode: SettlementMode) => void;
  onPartialAmountChange: (amount: string) => void;
  sheet: SettlementSheetState;
}) => {
  const balanceAmount = Math.abs(sheet.row.amount);
  const parsedPartial = Number.parseFloat(sheet.amountInput);
  const settlementAmount = sheet.mode === "full" ? balanceAmount : parsedPartial;
  const hasValidAmount =
    Number.isFinite(settlementAmount) &&
    settlementAmount > 0 &&
    settlementAmount <= balanceAmount;
  const remainingAmount = hasValidAmount ? balanceAmount - settlementAmount : balanceAmount;
  const directionCopy = sheet.row.amount >= 0 ? "they owe you" : "you owe";
  const validationMessage =
    sheet.mode === "partial" && sheet.amountInput.trim()
      ? !Number.isFinite(parsedPartial) || parsedPartial <= 0
        ? "Enter an amount greater than $0."
        : parsedPartial > balanceAmount
          ? "Partial settlement cannot exceed the open balance."
          : ""
      : sheet.mode === "partial"
        ? "Enter the partial amount to settle."
        : "";

  return (
    <View pointerEvents="box-none" style={styles.sheetOverlay}>
      <Pressable
        accessibilityLabel="Close settlement sheet"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.sheetScrim}
      />
      <View style={styles.settlementSheet}>
        <LinearGradient
          colors={["rgba(17, 25, 35, 0.98)", "rgba(7, 11, 17, 0.98)"]}
          style={[styles.settlementSheetSurface, { borderColor: `${accentColor}38` }]}
        >
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.eyebrow, { color: accentColor }]}>Settle balance</Text>
              <Text style={styles.sheetTitle}>{sheet.row.name}</Text>
              <Text style={styles.sheetSubtitle}>
                {formatCurrency(balanceAmount)} open - {directionCopy}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close settlement sheet"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.sheetCloseButton, pressed && styles.pressed]}
            >
              <Text style={styles.sheetCloseText}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.settleModeRow}>
            {(["full", "partial"] as const).map((mode) => {
              const active = sheet.mode === mode;

              return (
                <Pressable
                  accessibilityRole="button"
                  key={mode}
                  onPress={() => onModeChange(mode)}
                  style={({ pressed }) => [
                    styles.settleModePill,
                    active && { backgroundColor: accentSoft, borderColor: `${accentColor}66` },
                    pressed && styles.pressed
                  ]}
                >
                  <Text style={[styles.settleModeText, active && { color: accentColor }]}>
                    {mode === "full" ? "Full amount" : "Partial amount"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {sheet.mode === "partial" ? (
            <View style={styles.partialInputWrap}>
              <Text style={styles.partialInputLabel}>Settlement amount</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={onPartialAmountChange}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                style={styles.partialInput}
                value={sheet.amountInput}
              />
              {validationMessage ? (
                <Text style={styles.validationText}>{validationMessage}</Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.reviewCard}>
            <ReviewLine label="Open balance" value={formatCurrency(balanceAmount)} />
            <ReviewLine
              label="Settlement amount"
              value={hasValidAmount ? formatCurrency(settlementAmount) : "--"}
            />
            <ReviewLine
              highlight
              label="Remaining after this"
              value={formatCurrency(remainingAmount)}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!hasValidAmount}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.confirmSettlementButton,
              { backgroundColor: accentColor },
              !hasValidAmount && styles.confirmSettlementButtonDisabled,
              pressed && styles.pressed
            ]}
          >
            <CheckCircle2 color={colors.background} size={17} strokeWidth={2.7} />
            <Text style={styles.confirmSettlementText}>Confirm settlement</Text>
          </Pressable>
        </LinearGradient>
      </View>
    </View>
  );
};

const ReviewLine = ({
  highlight = false,
  label,
  value
}: {
  highlight?: boolean;
  label: string;
  value: string;
}) => (
  <View style={styles.reviewLine}>
    <Text style={highlight ? styles.reviewLabelStrong : styles.reviewLabel}>{label}</Text>
    <Text style={highlight ? styles.reviewValueStrong : styles.reviewValue}>{value}</Text>
  </View>
);

const EmptyState = ({
  icon,
  text,
  title,
  tone
}: {
  icon: typeof ReceiptText;
  text: string;
  title: string;
  tone: string;
}) => (
  <PremiumEmptyState
    icon={icon}
    message={text}
    title={title}
    tone={tone}
  />
);

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  content: {
    gap: spacing.md,
    paddingBottom: 116
  },
  heroCard: {
    gap: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(246, 166, 59, 0.22)",
    padding: spacing.lg,
    shadowColor: colors.shared,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.15,
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
    backgroundColor: "rgba(246, 166, 59, 0.15)"
  },
  heroCopy: {
    minWidth: 0,
    flex: 1
  },
  eyebrow: {
    color: colors.shared,
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
  heroLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
    textTransform: "uppercase"
  },
  heroAmount: {
    color: colors.textPrimary,
    fontSize: 42,
    fontWeight: "900",
    lineHeight: 48
  },
  heroStats: {
    flexDirection: "row",
    gap: spacing.sm
  },
  heroStat: {
    minHeight: 58,
    flex: 1,
    justifyContent: "center",
    borderRadius: radii.lg,
    backgroundColor: "rgba(5, 8, 13, 0.38)",
    paddingHorizontal: spacing.md
  },
  heroStatValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21
  },
  heroStatLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 14,
    textTransform: "uppercase"
  },
  noticeCard: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(246, 166, 59, 0.2)",
    backgroundColor: "rgba(246, 166, 59, 0.08)",
    paddingHorizontal: spacing.md
  },
  noticeText: {
    minWidth: 0,
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  inlineToast: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md
  },
  inlineToastText: {
    minWidth: 0,
    flex: 1,
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17
  },
  toastAction: {
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: "rgba(67, 216, 139, 0.18)",
    paddingHorizontal: spacing.md
  },
  toastActionText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17
  },
  segmentRow: {
    flexDirection: "row",
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: "rgba(17, 25, 35, 0.76)",
    padding: spacing.xs
  },
  segmentPill: {
    minHeight: 40,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md
  },
  segmentPillActive: {
    backgroundColor: "rgba(246, 166, 59, 0.16)"
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  segmentTextActive: {
    color: colors.shared
  },
  sectionHeader: {
    gap: 2,
    marginTop: spacing.xs
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  list: {
    gap: spacing.sm
  },
  balanceCard: {
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(17, 25, 35, 0.82)",
    padding: spacing.md
  },
  cardPressed: {
    borderColor: "rgba(67, 216, 139, 0.28)",
    backgroundColor: "rgba(17, 25, 35, 0.94)"
  },
  balanceTop: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  avatar: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  balanceCopy: {
    minWidth: 0,
    flex: 1
  },
  balanceName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  balanceMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  amountBlock: {
    alignItems: "flex-end"
  },
  balanceAmount: {
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  amountCaption: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 14
  },
  cardActions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  settleButton: {
    minHeight: 38,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft
  },
  settleButtonText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17
  },
  transactionCard: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(17, 25, 35, 0.82)",
    paddingHorizontal: spacing.md
  },
  transactionDate: {
    width: 48,
    alignItems: "center",
    gap: 3
  },
  transactionDateText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 14
  },
  transactionCopy: {
    minWidth: 0,
    flex: 1
  },
  transactionMerchant: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  transactionMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  transactionAmountBlock: {
    alignItems: "flex-end"
  },
  transactionAmount: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  savedText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 14
  },
  savedTextActive: {
    color: colors.accent
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 80
  },
  sheetScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.58)"
  },
  settlementSheet: {
    paddingHorizontal: spacing.md,
    paddingBottom: 96
  },
  settlementSheetSurface: {
    gap: spacing.md,
    borderRadius: 26,
    borderWidth: 1,
    padding: spacing.lg,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: -18 },
    shadowOpacity: 0.18,
    shadowRadius: 30
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 255, 255, 0.18)"
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28
  },
  sheetSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  sheetCloseButton: {
    minHeight: 34,
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: spacing.md
  },
  sheetCloseText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17
  },
  settleModeRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  settleModePill: {
    minHeight: 44,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.04)"
  },
  settleModeText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  partialInputWrap: {
    gap: spacing.xs
  },
  partialInputLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    textTransform: "uppercase"
  },
  partialInput: {
    minHeight: 50,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(5, 8, 13, 0.5)",
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    paddingHorizontal: spacing.md
  },
  validationText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15
  },
  reviewCard: {
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(5, 8, 13, 0.38)",
    padding: spacing.md
  },
  reviewLine: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  reviewLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  reviewValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  reviewLabelStrong: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  reviewValueStrong: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  confirmSettlementButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg
  },
  confirmSettlementButtonDisabled: {
    opacity: 0.45
  },
  confirmSettlementText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  emptyState: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(17, 25, 35, 0.62)"
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }]
  }
});
