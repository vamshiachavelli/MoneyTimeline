import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Clock3,
  CreditCard,
  FileText,
  ReceiptText,
  Trash2,
  WalletCards,
  X
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { PremiumEmptyState } from "@/components/ui/premium-empty-state";
import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/features/auth/auth-provider";
import {
  deleteSavedImportBatch,
  getSavedImportBatches,
  type SavedImportBatch
} from "@/features/import/import-save-service";
import { useAppearanceTheme } from "@/features/settings/use-appearance-theme";
import { getReturnTargetRoute, withReturnTo } from "@/navigation/return-target";
import {
  importHistoryService,
  type ImportHistoryItem
} from "@/services/supabase/import-history-service";
import { useSplitStore } from "@/features/splits/split-store";
import { useTransactionLedgerStore } from "@/features/transactions/transaction-ledger";
import { colors, radii, spacing } from "@/styles/theme";

type ImportDetailTransaction = {
  accountId?: string | null;
  accountName?: string | null;
  amount: number;
  date: string;
  id: string;
  kind: string;
  merchant: string;
};

type ImportDetail = {
  accountId: string | null;
  accountName: string | null;
  fileName: string;
  fileType: string;
  id: string;
  importedAt: string;
  importedRows: number;
  transactions: ImportDetailTransaction[];
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

const formatTransactionDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short"
  });

const getTransactionAmountLabel = (transaction: ImportDetailTransaction) => {
  if (transaction.kind === "expense") {
    return `-${formatCurrency(transaction.amount)}`;
  }

  return formatCurrency(transaction.amount);
};

const toRemoteDetail = (item: ImportHistoryItem): ImportDetail => ({
  accountId: item.accountId,
  accountName: item.accountName,
  fileName: item.fileName,
  fileType: item.fileType.toUpperCase(),
  id: item.id,
  importedAt: item.importedAt,
  importedRows: item.importedRows,
  transactions: item.transactions.map((transaction) => ({
    accountId: transaction.account_id,
    accountName: item.accountName,
    amount: transaction.amount_minor / 100,
    date: transaction.transaction_date,
    id: transaction.id,
    kind: transaction.kind,
    merchant: transaction.merchant
  }))
});

const toLocalDetail = (batch: SavedImportBatch): ImportDetail => ({
  accountId: batch.transactions[0]?.accountId ?? null,
  accountName: batch.transactions[0]?.accountName ?? null,
  fileName: batch.fileName,
  fileType: "LOCAL",
  id: batch.id,
  importedAt: batch.importedAt,
  importedRows: batch.transactions.length,
  transactions: batch.transactions.map((transaction) => ({
    accountId: transaction.accountId,
    accountName: transaction.accountName,
    amount: Math.abs(transaction.amount),
    date: transaction.date,
    id: `${batch.id}_${transaction.rowNumber}`,
    kind: transaction.kind,
    merchant: transaction.merchant
  }))
});

export const ImportDetailScreen = () => {
  const router = useRouter();
  const { accentColor, accentSoft, palette } = useAppearanceTheme();
  const { user } = useAuth();
  const deleteSplitForTransaction = useSplitStore((state) => state.deleteSplitForTransaction);
  const loadSplits = useSplitStore((state) => state.loadSplits);
  const loadRemoteTransactions = useTransactionLedgerStore((state) => state.loadRemoteTransactions);
  const params = useLocalSearchParams<{ id?: string; returnTo?: string }>();
  const importId = typeof params.id === "string" ? decodeURIComponent(params.id) : "";
  const returnRoute = getReturnTargetRoute(params.returnTo) ?? "/data-import";
  const [detail, setDetail] = useState<ImportDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadDetail = async () => {
      setIsLoading(true);

      try {
        if (user) {
          const remoteItems = await importHistoryService.listForUser(user.id);
          const item = remoteItems.find((historyItem) => historyItem.id === importId);

          if (isMounted) {
            setDetail(item ? toRemoteDetail(item) : null);
          }
          return;
        }

        const localBatches = await getSavedImportBatches();
        const batch = localBatches.find((historyBatch) => historyBatch.id === importId);

        if (isMounted) {
          setDetail(batch ? toLocalDetail(batch) : null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      isMounted = false;
    };
  }, [importId, user?.id]);

  const counts = useMemo(() => {
    const transactions = detail?.transactions ?? [];
    const expenses = transactions.filter((transaction) => transaction.kind === "expense");
    const moved = transactions.filter(
      (transaction) => transaction.kind === "payment" || transaction.kind === "transfer"
    );

    return {
      expenses: expenses.length,
      expenseTotal: expenses.reduce((sum, transaction) => sum + transaction.amount, 0),
      moved: moved.length,
      movedTotal: moved.reduce((sum, transaction) => sum + transaction.amount, 0)
    };
  }, [detail?.transactions]);

  const groupedTransactions = useMemo(() => {
    const transactions = detail?.transactions ?? [];

    return [
      {
        accent: accentColor,
        icon: ReceiptText,
        rows: transactions.filter((transaction) => transaction.kind === "expense"),
        title: "Expenses"
      },
      {
        accent: "#7FA7FF",
        icon: CreditCard,
        rows: transactions.filter(
          (transaction) => transaction.kind === "payment" || transaction.kind === "transfer"
        ),
        title: "Payments / transfers"
      },
      {
        accent: colors.personal,
        icon: WalletCards,
        rows: transactions.filter(
          (transaction) =>
            transaction.kind !== "expense" &&
            transaction.kind !== "payment" &&
            transaction.kind !== "transfer"
        ),
        title: "Other activity"
      }
    ].filter((group) => group.rows.length > 0);
  }, [accentColor, detail?.transactions]);

  const openTimeline = () => {
    router.push(withReturnTo(`/timeline?importBatchId=${encodeURIComponent(importId)}`, "dataImport"));
  };

  const deleteStatement = async () => {
    if (!detail) {
      return;
    }

    setDeleteError(null);
    setIsDeleting(true);

    try {
      if (user) {
        await importHistoryService.deleteImportForUser({
          importJobId: detail.id,
          userId: user.id
        });
        await loadRemoteTransactions(user.id);
      } else {
        await deleteSavedImportBatch(detail.id);
      }

      await loadSplits();
      for (const transaction of detail.transactions) {
        await deleteSplitForTransaction(transaction.id);
      }

      setDeleteConfirmVisible(false);
      router.replace(returnRoute);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Could not delete this statement."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back to Data and Import"
            accessibilityRole="button"
            onPress={() => router.replace(returnRoute)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <ArrowLeft color={colors.textPrimary} size={21} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: accentColor }]}>Import detail</Text>
            <Text style={styles.title}>Statement summary</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={accentColor} />
            <Text style={styles.loadingText}>Loading statement</Text>
          </View>
        ) : !detail ? (
          <PremiumEmptyState
            actionLabel="Back to Imports"
            icon={FileText}
            message="This statement could not be found in your import history."
            onAction={() => router.replace(returnRoute)}
            title="Import not found"
            tone={accentColor}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <LinearGradient
              colors={[accentSoft, palette.cardStrong]}
              style={[styles.heroCard, { borderColor: `${accentColor}33`, shadowColor: accentColor }]}
            >
              <View style={styles.heroHeader}>
                <View style={[styles.heroIcon, { backgroundColor: accentSoft }]}>
                  <FileText color={accentColor} size={28} strokeWidth={2.5} />
                </View>
                <View style={styles.heroCopy}>
                  <Text numberOfLines={2} style={styles.fileName}>{detail.fileName}</Text>
                  <Text style={styles.fileMeta}>
                    {detail.fileType} - Imported {formatDate(detail.importedAt)}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <WalletCards color={accentColor} size={18} strokeWidth={2.4} />
                  <View>
                    <Text style={styles.infoLabel}>Account</Text>
                    <Text numberOfLines={1} style={styles.infoValue}>
                      {detail.accountName ?? "Imported account"}
                    </Text>
                  </View>
                </View>
                <View style={styles.infoItem}>
                  <CalendarDays color="#7FA7FF" size={18} strokeWidth={2.4} />
                  <View>
                    <Text style={styles.infoLabel}>Transactions</Text>
                    <Text style={styles.infoValue}>{detail.importedRows}</Text>
                  </View>
                </View>
              </View>

            </LinearGradient>

            <View style={styles.summaryGrid}>
              <SummaryCard
                color={accentColor}
                icon={ReceiptText}
                label="Expenses"
                meta={formatCurrency(counts.expenseTotal)}
                value={counts.expenses}
              />
              <SummaryCard
                color="#7FA7FF"
                icon={CreditCard}
                label="Payments"
                meta={formatCurrency(counts.movedTotal)}
                value={counts.moved}
              />
            </View>

            <Pressable
              accessibilityLabel="Open this import in timeline"
              accessibilityRole="button"
              onPress={openTimeline}
              style={({ pressed }) => [
                styles.timelineButton,
                { backgroundColor: accentColor },
                pressed && styles.pressed
              ]}
            >
              <Clock3 color={colors.background} size={20} strokeWidth={2.6} />
              <Text style={styles.timelineButtonText}>Open in Timeline</Text>
              <ChevronRight color={colors.background} size={20} strokeWidth={2.6} />
            </Pressable>

            <Pressable
              accessibilityLabel="Delete this statement"
              accessibilityRole="button"
              onPress={() => {
                setDeleteError(null);
                setDeleteConfirmVisible(true);
              }}
              style={({ pressed }) => [styles.deleteStatementButton, pressed && styles.pressed]}
            >
              <Trash2 color={colors.danger} size={19} strokeWidth={2.6} />
              <Text style={styles.deleteStatementText}>Delete Statement</Text>
            </Pressable>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Imported transactions</Text>
              <Text style={[styles.sectionMeta, { color: accentColor }]}>
                {detail.transactions.length} rows
              </Text>
            </View>

            <View style={styles.groupedList}>
              {groupedTransactions.map((group) => {
                const Icon = group.icon;

                return (
                  <View key={group.title} style={styles.transactionGroup}>
                    <View style={styles.groupHeader}>
                      <View style={[styles.groupIcon, { backgroundColor: `${group.accent}22` }]}>
                        <Icon color={group.accent} size={16} strokeWidth={2.5} />
                      </View>
                      <Text style={styles.groupTitle}>{group.title}</Text>
                      <Text style={[styles.groupCount, { color: group.accent }]}>
                        {group.rows.length}
                      </Text>
                    </View>

                    <View style={styles.transactionList}>
                      {group.rows.map((transaction) => (
                        <View key={transaction.id} style={styles.transactionRow}>
                          <View style={[styles.transactionIcon, { backgroundColor: `${group.accent}22` }]}>
                            <Icon color={group.accent} size={17} strokeWidth={2.4} />
                          </View>
                          <View style={styles.transactionCopy}>
                            <Text numberOfLines={1} style={styles.transactionMerchant}>
                              {transaction.merchant}
                            </Text>
                            <Text style={styles.transactionMeta}>
                              {formatTransactionDate(transaction.date)}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.transactionAmount,
                              transaction.kind === "expense" ? null : styles.moneyMovementAmount
                            ]}
                          >
                            {getTransactionAmountLabel(transaction)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
        <DeleteStatementModal
          errorMessage={deleteError}
          fileName={detail?.fileName ?? "Imported statement"}
          isDeleting={isDeleting}
          onClose={() => {
            if (!isDeleting) {
              setDeleteConfirmVisible(false);
              setDeleteError(null);
            }
          }}
          onConfirm={() => void deleteStatement()}
          transactionCount={detail?.transactions.length ?? 0}
          visible={deleteConfirmVisible}
        />
      </View>
    </Screen>
  );
};

const DeleteStatementModal = ({
  errorMessage,
  fileName,
  isDeleting,
  onClose,
  onConfirm,
  transactionCount,
  visible
}: {
  errorMessage: string | null;
  fileName: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
  transactionCount: number;
  visible: boolean;
}) => (
  <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <View style={styles.modalHandle} />
        <View style={styles.modalHeader}>
          <View style={styles.deleteModalIcon}>
            <Trash2 color={colors.danger} size={24} strokeWidth={2.5} />
          </View>
          <View style={styles.modalTitleWrap}>
            <Text style={styles.deleteEyebrow}>Delete statement</Text>
            <Text style={styles.modalTitle}>Remove this import?</Text>
            <Text style={styles.modalMeta} numberOfLines={2}>
              {fileName}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Close delete statement confirmation"
            accessibilityRole="button"
            disabled={isDeleting}
            onPress={onClose}
            style={({ pressed }) => [styles.modalClose, pressed && styles.pressed]}
          >
            <X color={colors.textSecondary} size={18} />
          </Pressable>
        </View>

        <View style={styles.deleteWarning}>
          <Text style={styles.deleteWarningTitle}>
            This will remove {transactionCount} imported transactions.
          </Text>
          <Text style={styles.deleteWarningText}>
            The account stays read from the original PDF statement. If the statement was wrong,
            delete it and upload the correct one.
          </Text>
        </View>

        {errorMessage ? <Text style={styles.modalError}>{errorMessage}</Text> : null}

        <View style={styles.modalActions}>
          <Pressable
            accessibilityLabel="Cancel delete statement"
            accessibilityRole="button"
            disabled={isDeleting}
            onPress={onClose}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Confirm delete statement"
            accessibilityRole="button"
            disabled={isDeleting}
            onPress={onConfirm}
            style={({ pressed }) => [styles.confirmDeleteButton, pressed && styles.pressed]}
          >
            {isDeleting ? (
              <ActivityIndicator color={colors.textPrimary} size="small" />
            ) : (
              <>
                <Trash2 color={colors.textPrimary} size={17} strokeWidth={2.6} />
                <Text style={styles.confirmDeleteText}>Delete</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>
);

const SummaryCard = ({
  color,
  icon: Icon,
  label,
  meta,
  value
}: {
  color: string;
  icon: typeof ReceiptText;
  label: string;
  meta?: string;
  value: number;
}) => (
  <View style={styles.summaryCard}>
    <View style={[styles.summaryIcon, { backgroundColor: `${color}22` }]}>
      <Icon color={color} size={20} strokeWidth={2.5} />
    </View>
    <Text style={styles.summaryValue}>{value}</Text>
    <Text style={styles.summaryLabel}>{label}</Text>
    {meta ? <Text style={styles.summaryMeta}>{meta}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.xs
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)"
  },
  headerCopy: {
    flex: 1
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 34
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "800"
  },
  content: {
    paddingBottom: 118,
    paddingTop: spacing.md,
    gap: spacing.md
  },
  heroCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { height: 14, width: 0 }
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  heroIcon: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 29
  },
  heroCopy: {
    flex: 1
  },
  fileName: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 25
  },
  fileMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.xs
  },
  infoRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg
  },
  infoItem: {
    flex: 1,
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: "rgba(4, 8, 13, 0.42)",
    padding: spacing.md
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 2
  },
  summaryGrid: {
    flexDirection: "row",
    gap: spacing.md
  },
  summaryCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(14, 21, 31, 0.88)",
    padding: spacing.md
  },
  summaryIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    marginBottom: spacing.sm
  },
  summaryValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "900"
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  summaryMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
    marginTop: 2
  },
  timelineButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg
  },
  timelineButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "900"
  },
  deleteStatementButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 92, 92, 0.32)",
    backgroundColor: "rgba(255, 92, 92, 0.1)"
  },
  deleteStatementText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "900"
  },
  sectionMeta: {
    fontSize: 12,
    fontWeight: "900"
  },
  groupedList: {
    gap: spacing.md
  },
  transactionGroup: {
    gap: spacing.sm
  },
  groupHeader: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  groupIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14
  },
  groupTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  groupCount: {
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16
  },
  transactionList: {
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(14, 21, 31, 0.88)"
  },
  transactionRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: spacing.md
  },
  transactionIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18
  },
  transactionCopy: {
    flex: 1
  },
  transactionMerchant: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900"
  },
  transactionMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3
  },
  transactionAmount: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900"
  },
  moneyMovementAmount: {
    color: "#7FA7FF"
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    padding: spacing.md
  },
  modalCard: {
    gap: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(17, 25, 35, 0.98)",
    padding: spacing.md
  },
  modalHandle: {
    width: 42,
    height: 4,
    alignSelf: "center",
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 255, 255, 0.16)"
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  deleteModalIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "rgba(255, 92, 92, 0.14)"
  },
  modalTitleWrap: {
    minWidth: 0,
    flex: 1
  },
  modalEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    textTransform: "uppercase"
  },
  deleteEyebrow: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    textTransform: "uppercase"
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 23
  },
  modalMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 2
  },
  modalClose: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.06)"
  },
  deleteWarning: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 92, 92, 0.2)",
    backgroundColor: "rgba(255, 92, 92, 0.08)",
    padding: spacing.md
  },
  deleteWarningTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  deleteWarningText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: spacing.xs
  },
  modalError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
    textAlign: "center"
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  cancelButton: {
    flex: 1,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.06)"
  },
  cancelButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900"
  },
  confirmDeleteButton: {
    flex: 1,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: colors.danger
  },
  confirmDeleteText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }]
  }
});
