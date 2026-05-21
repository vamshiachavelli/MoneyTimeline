import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  ReceiptText,
  ShieldCheck,
  UserRound,
  UsersRound,
  X
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { useGroupsStore } from "@/features/groups/group-store";
import { getPersonInitial, usePeopleStore } from "@/features/people/people-store";
import {
  useSettlementStore,
  type SavedSettlement,
  type SettlementTargetType
} from "@/features/settlements/settlement-store";
import { useAppearanceTheme } from "@/features/settings/use-appearance-theme";
import { buildSharedBalanceModel } from "@/features/shared/shared-balance-model";
import { useSplitStore } from "@/features/splits/split-store";
import {
  formatCurrency,
  formatSpendAmount,
  useLedgerTransactions
} from "@/features/transactions/transaction-ledger";
import {
  getReturnTargetLabel,
  getReturnTargetParam,
  getReturnTargetRoute,
  withReturnTo
} from "@/navigation/return-target";
import { colors, radii, spacing } from "@/styles/theme";

const isSettlementTargetType = (value: unknown): value is SettlementTargetType =>
  value === "person" || value === "group" || value === "connection";

const formatReadableDate = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  });

const getStatusLabel = (settlement: SavedSettlement) => {
  if (settlement.status === "both_confirmed") {
    return "Both confirmed";
  }

  if (settlement.status === "user_confirmed") {
    return "You confirmed";
  }

  if (settlement.status === "cancelled") {
    return "Cancelled";
  }

  return "Pending";
};

export const SettlementDetailScreen = () => {
  const router = useRouter();
  const { accentColor, accentSoft, palette } = useAppearanceTheme();
  const params = useLocalSearchParams<{ id?: string; returnTo?: string; type?: string }>();
  const targetTypeParam = Array.isArray(params.type) ? params.type[0] : params.type;
  const targetId = Array.isArray(params.id) ? params.id[0] : params.id;
  const returnToParam = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTarget = getReturnTargetParam(returnToParam) ?? "shared";
  const returnLabel = getReturnTargetLabel(returnTarget) ?? "Shared";
  const targetType = isSettlementTargetType(targetTypeParam) ? targetTypeParam : null;
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
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmationState, setConfirmationState] = useState<"idle" | "saved">("idle");

  useEffect(() => {
    void loadPeople();
    void loadGroups();
    void loadSplits();
    void loadSettlements();
  }, [loadGroups, loadPeople, loadSettlements, loadSplits]);

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

  const targetSettlements = useMemo(
    () =>
      targetType && targetId
        ? settlements.filter(
            (settlement) =>
              settlement.targetType === targetType && settlement.targetId === targetId
          )
        : [],
    [settlements, targetId, targetType]
  );
  const latestSettlement = targetSettlements[0] ?? null;
  const hasConfirmedSettlement = targetSettlements.some(
    (settlement) =>
      settlement.status === "user_confirmed" || settlement.status === "both_confirmed"
  );
  const balanceRow = useMemo(() => {
    if (!targetType || !targetId) {
      return null;
    }

    return (
      [...model.peopleRows, ...model.groupRows].find(
        (row) => row.type === targetType && row.id === targetId
      ) ?? null
    );
  }, [model.groupRows, model.peopleRows, targetId, targetType]);
  const fallbackPerson = targetType === "person" ? people.find((person) => person.id === targetId) : null;
  const fallbackGroup = targetType === "group" ? groups.find((group) => group.id === targetId) : null;
  const targetName =
    balanceRow?.name ??
    latestSettlement?.targetName ??
    fallbackPerson?.name ??
    fallbackGroup?.name ??
    targetId ??
    "Settlement";
  const targetColor =
    balanceRow?.color ?? fallbackPerson?.color ?? fallbackGroup?.color ?? colors.shared;
  const relatedTransactionIds =
    balanceRow?.transactionIds.length
      ? balanceRow.transactionIds
      : latestSettlement?.transactionIds ?? [];
  const relatedTransactions = model.transactionRows.filter((transaction) =>
    relatedTransactionIds.includes(transaction.id)
  );
  const remainingAmount = balanceRow?.amount ?? 0;
  const settlementAmount = Math.abs(remainingAmount);
  const isSettled = Math.abs(remainingAmount) < 0.01;
  const directionLabel =
    remainingAmount > 0 ? "owes you" : remainingAmount < 0 ? "you owe" : "settled";
  const Icon = targetType === "person" ? UserRound : UsersRound;

  const closeDetail = () => {
    router.replace(getReturnTargetRoute(returnTarget) ?? "/shared");
  };

  const confirmSettlement = async () => {
    if (!targetType || !targetId || !balanceRow || settlementAmount <= 0) {
      return;
    }

    await createUserConfirmedSettlement({
      amount: settlementAmount,
      notes: "Manual settlement confirmed by user.",
      status: "user_confirmed",
      targetId,
      targetName: balanceRow.name,
      targetType,
      transactionIds: balanceRow.transactionIds
    });
    setShowConfirm(false);
    setConfirmationState("saved");
  };

  const cancelPayment = async (settlementId: string) => {
    await cancelSettlement(settlementId);
    setConfirmationState("idle");
  };

  if (!targetType || !targetId) {
    return (
      <Screen>
        <View style={styles.emptyRoot}>
          <ReceiptText color={colors.textMuted} size={34} strokeWidth={2.4} />
          <Text style={styles.emptyTitle}>Settlement not found</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace(getReturnTargetRoute(returnTarget) ?? "/shared")}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: accentColor },
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.primaryButtonText}>Back to {returnLabel}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel={`Back to ${returnLabel.toLowerCase()}`}
            accessibilityRole="button"
            onPress={closeDetail}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <ArrowLeft color={colors.textPrimary} size={22} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: accentColor }]}>Settlement</Text>
            <Text numberOfLines={1} style={styles.title}>
              {targetName}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={[accentSoft, palette.cardStrong]}
            style={[styles.heroCard, { borderColor: `${accentColor}33` }]}
          >
            <View style={styles.heroTop}>
              <View style={[styles.avatar, { backgroundColor: `${targetColor}26` }]}>
                {targetType === "person" ? (
                  <Text style={[styles.avatarInitial, { color: targetColor }]}>
                    {getPersonInitial(targetName)}
                  </Text>
                ) : (
                  <Icon color={targetColor} size={24} strokeWidth={2.5} />
                )}
              </View>
              <View style={styles.statusPill}>
                <ShieldCheck color={isSettled ? accentColor : colors.shared} size={15} />
                <Text
                  style={[
                    styles.statusText,
                    { color: isSettled ? accentColor : colors.shared }
                  ]}
                >
                  {isSettled ? "Settled" : "Pending"}
                </Text>
              </View>
            </View>

            <Text style={styles.heroLabel}>{directionLabel}</Text>
            <Text
              style={[
                styles.heroAmount,
                remainingAmount < 0 && { color: colors.warning },
                isSettled && { color: accentColor }
              ]}
            >
              {isSettled ? formatCurrency(0) : formatCurrency(Math.abs(remainingAmount))}
            </Text>
            <Text style={styles.heroMeta}>
              {relatedTransactionIds.length} related{" "}
              {relatedTransactionIds.length === 1 ? "transaction" : "transactions"}
            </Text>
          </LinearGradient>

          {confirmationState === "saved" || hasConfirmedSettlement ? (
            <View style={[styles.futureConfirmCard, { backgroundColor: accentSoft }]}>
              <CheckCircle2 color={accentColor} size={18} strokeWidth={2.5} />
              <View style={styles.futureConfirmCopy}>
                <Text style={[styles.futureConfirmTitle, { color: accentColor }]}>
                  Your confirmation is saved
                </Text>
                <Text style={styles.futureConfirmText}>
                  Future two-sided confirmation will ask the other side to confirm too.
                </Text>
              </View>
            </View>
          ) : null}

          <SectionTitle
            meta={`${relatedTransactions.length} expenses attached to this balance`}
            title="Related transactions"
          />
          {relatedTransactions.length > 0 ? (
            <View style={styles.list}>
              {relatedTransactions.map((transaction) => (
                <Pressable
                  accessibilityRole="button"
                  key={transaction.id}
                  onPress={() =>
                    router.push(withReturnTo(`/transaction/${transaction.id}`, returnTarget))
                  }
                  style={({ pressed }) => [styles.transactionRow, pressed && styles.pressed]}
                >
                  <View style={styles.transactionIcon}>
                    <ReceiptText color={colors.shared} size={17} strokeWidth={2.5} />
                  </View>
                  <View style={styles.transactionCopy}>
                    <Text numberOfLines={1} style={styles.transactionMerchant}>
                      {transaction.merchant}
                    </Text>
                    <Text numberOfLines={1} style={styles.transactionMeta}>
                      {transaction.connection} - {transaction.method}
                    </Text>
                  </View>
                  <Text style={styles.transactionAmount}>{formatSpendAmount(transaction.amount)}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <EmptyState text="No transaction links found for this balance." />
          )}

          <SectionTitle
            meta="Local settlement confirmations and future payment records"
            title="Payments"
          />
          {targetSettlements.length > 0 ? (
            <View style={styles.list}>
              {targetSettlements.map((settlement) => (
                <View key={settlement.id} style={styles.paymentRow}>
                  <View style={[styles.paymentIcon, { backgroundColor: accentSoft }]}>
                    <CreditCard color={accentColor} size={17} strokeWidth={2.5} />
                  </View>
                  <View style={styles.transactionCopy}>
                    <Text style={styles.transactionMerchant}>
                      {formatCurrency(settlement.amount)}
                    </Text>
                    <Text style={styles.transactionMeta}>
                      {getStatusLabel(settlement)} - {formatReadableDate(settlement.updatedAt)}
                    </Text>
                  </View>
                  {settlement.status !== "cancelled" ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void cancelPayment(settlement.id)}
                      style={({ pressed }) => [styles.cancelPaymentButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.cancelPaymentText}>Cancel</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <EmptyState text="No payments marked yet." />
          )}

          <Pressable
            accessibilityRole="button"
            disabled={isSettled}
            onPress={() => setShowConfirm(true)}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: accentColor },
              isSettled && styles.disabledButton,
              pressed && styles.pressed
            ]}
          >
            <Check color={colors.background} size={18} strokeWidth={2.8} />
            <Text style={styles.primaryButtonText}>
              {isSettled ? "Balance Settled" : "Mark as Paid"}
            </Text>
          </Pressable>
        </ScrollView>

        {showConfirm ? (
          <SettlementConfirmSheet
            amount={settlementAmount}
            directionLabel={directionLabel}
            onClose={() => setShowConfirm(false)}
            onConfirm={confirmSettlement}
            targetName={targetName}
          />
        ) : null}
      </View>
    </Screen>
  );
};

const SectionTitle = ({ meta, title }: { meta: string; title: string }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Text style={styles.sectionMeta}>{meta}</Text>
  </View>
);

const EmptyState = ({ text }: { text: string }) => (
  <View style={styles.emptyState}>
    <ReceiptText color={colors.textMuted} size={23} strokeWidth={2.4} />
    <Text style={styles.emptyText}>{text}</Text>
  </View>
);

const SettlementConfirmSheet = ({
  amount,
  directionLabel,
  onClose,
  onConfirm,
  targetName
}: {
  amount: number;
  directionLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  targetName: string;
}) => {
  const { accentColor, palette } = useAppearanceTheme();

  return (
    <View style={styles.confirmOverlay}>
      <Pressable
        accessibilityLabel="Close settlement confirmation"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.confirmScrim}
      />
      <View style={styles.confirmSheet}>
        <LinearGradient colors={[palette.cardStrong, palette.card]} style={styles.confirmSurface}>
          <View style={styles.confirmHandle} />
          <View style={styles.confirmHeader}>
            <View style={styles.confirmHeaderCopy}>
              <Text style={styles.confirmTitle}>Confirm settlement</Text>
              <Text style={styles.confirmSubtitle}>
                This clears {formatCurrency(amount)} for {targetName}.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close settlement confirmation"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.confirmCloseButton, pressed && styles.pressed]}
            >
              <X color={colors.textPrimary} size={18} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.confirmPanel}>
            <Clock3 color={colors.shared} size={18} strokeWidth={2.5} />
            <Text style={styles.confirmPanelText}>
              You are confirming this balance is paid. Today this updates your local balance;
              later, MoneyTimeline will ask the other side to confirm too.
            </Text>
          </View>

          <View style={styles.confirmAmountRow}>
            <Text style={styles.confirmAmountLabel}>{directionLabel}</Text>
            <Text style={styles.confirmAmount}>{formatCurrency(amount)}</Text>
          </View>

          <View style={styles.confirmActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.confirmSecondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.confirmSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirmPrimaryButton,
                { backgroundColor: accentColor },
                pressed && styles.pressed
              ]}
            >
              <Check color={colors.background} size={16} strokeWidth={2.8} />
              <Text style={styles.confirmPrimaryText}>Confirm Paid</Text>
            </Pressable>
          </View>
        </LinearGradient>
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
    color: colors.shared,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    textTransform: "uppercase"
  },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26
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
    padding: spacing.lg
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  avatar: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24
  },
  statusPill: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: "rgba(5, 8, 13, 0.42)",
    paddingHorizontal: spacing.md
  },
  statusText: {
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16
  },
  heroLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17,
    textTransform: "uppercase"
  },
  heroAmount: {
    color: colors.textPrimary,
    fontSize: 42,
    fontWeight: "900",
    lineHeight: 48
  },
  heroMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  futureConfirmCard: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.accentSoft,
    padding: spacing.md
  },
  futureConfirmCopy: {
    minWidth: 0,
    flex: 1
  },
  futureConfirmTitle: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  futureConfirmText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16
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
  transactionRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: "rgba(17, 25, 35, 0.82)",
    paddingHorizontal: spacing.md
  },
  transactionIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "rgba(246, 166, 59, 0.14)"
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
  transactionAmount: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  paymentRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: "rgba(17, 25, 35, 0.82)",
    paddingHorizontal: spacing.md
  },
  paymentIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: colors.accentSoft
  },
  cancelPaymentButton: {
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 107, 107, 0.12)",
    paddingHorizontal: spacing.md
  },
  cancelPaymentText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15
  },
  emptyState: {
    minHeight: 112,
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
  primaryButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.accent
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  disabledButton: {
    opacity: 0.5
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    justifyContent: "flex-end",
    marginHorizontal: -spacing.lg
  },
  confirmScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 4, 7, 0.74)"
  },
  confirmSheet: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -18 },
    shadowOpacity: 0.44,
    shadowRadius: 28
  },
  confirmSurface: {
    gap: spacing.md,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: spacing.md,
    paddingTop: spacing.sm
  },
  confirmHandle: {
    alignSelf: "center",
    width: 34,
    height: 4,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.12)"
  },
  confirmHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  confirmHeaderCopy: {
    minWidth: 0,
    flex: 1
  },
  confirmTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22
  },
  confirmSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  confirmCloseButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.06)"
  },
  confirmPanel: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: "rgba(246, 166, 59, 0.08)",
    padding: spacing.md
  },
  confirmPanelText: {
    minWidth: 0,
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18
  },
  confirmAmountRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.lg,
    backgroundColor: "rgba(5, 8, 13, 0.48)",
    paddingHorizontal: spacing.md
  },
  confirmAmountLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    textTransform: "uppercase"
  },
  confirmAmount: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22
  },
  confirmActions: {
    flexDirection: "row",
    gap: spacing.md
  },
  confirmSecondaryButton: {
    minHeight: 46,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(5, 8, 13, 0.32)"
  },
  confirmSecondaryText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  confirmPrimaryButton: {
    minHeight: 46,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.accent
  },
  confirmPrimaryText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  emptyRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }]
  }
});
