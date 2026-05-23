import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  RotateCcw,
  Save,
  Trash2,
  WalletCards
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { Screen } from "@/components/ui/screen";
import { useAccountsStore, type MoneyAccount } from "@/features/accounts/account-store";
import { useAuth } from "@/features/auth/auth-provider";
import {
  saveReviewedImport,
  saveReviewedImportToSupabase,
  type SaveableImportTransaction
} from "@/features/import/import-save-service";
import { useImportSessionStore } from "@/features/import/import-session-store";
import { useAppearanceTheme } from "@/features/settings/use-appearance-theme";
import type {
  DuplicateTransactionDraft,
  ParsedTransactionKind,
  ParsedTransactionDraft,
  StatementFailedRow
} from "@/features/import/statement-parser";
import { createTransactionDuplicateHash } from "@/features/import/statement-parser";
import {
  getReturnTargetLabel,
  getReturnTargetParam,
  getReturnTargetRoute,
  withReturnTo
} from "@/navigation/return-target";
import { colors, radii, spacing } from "@/styles/theme";

type ReviewTransactionRow = {
  accountId: string;
  accountName: string;
  amount: string;
  category: string;
  date: string;
  description: string;
  duplicateHash: string;
  id: string;
  kind: ParsedTransactionKind;
  merchant: string;
  rowNumber: number;
  skipped: boolean;
};

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { savedCount: number; status: "saved" }
  | { message: string; status: "error" };

const toReviewRow = (transaction: ParsedTransactionDraft): ReviewTransactionRow => ({
  accountId: transaction.accountId,
  accountName: transaction.accountName,
  amount: transaction.amount.toFixed(2),
  category: transaction.category ?? "",
  date: transaction.date,
  description: transaction.description ?? "",
  duplicateHash: transaction.duplicateHash,
  id: `${transaction.duplicateHash}-${transaction.rowNumber}`,
  kind: transaction.kind ?? "expense",
  merchant: transaction.merchant,
  rowNumber: transaction.rowNumber,
  skipped: false
});

const toSaveableTransaction = (row: ReviewTransactionRow): SaveableImportTransaction => ({
  accountId: row.accountId,
  accountName: row.accountName,
  amount: Number.parseFloat(row.amount),
  category: row.category.trim() || null,
  date: row.date.trim(),
  description: row.description.trim() || null,
  duplicateHash: createTransactionDuplicateHash({
    accountId: row.accountId,
    amount: Number.parseFloat(row.amount),
    date: row.date.trim(),
    merchant: row.merchant.trim()
  }),
  kind: row.kind,
  merchant: row.merchant.trim(),
  rowNumber: row.rowNumber
});

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);

const kindLabel: Record<ParsedTransactionKind, string> = {
  expense: "Expense",
  income: "Income",
  payment: "Payment",
  transfer: "Transfer"
};

const kindTone: Record<ParsedTransactionKind, string> = {
  expense: colors.unclassified,
  income: colors.personal,
  payment: "#5CA8FF",
  transfer: "#5CA8FF"
};

export const ImportReviewScreen = () => {
  const router = useRouter();
  const { accentColor, accentSoft } = useAppearanceTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTarget = getReturnTargetParam(params.returnTo);
  const returnRoute = getReturnTargetRoute(params.returnTo);
  const returnLabel = getReturnTargetLabel(returnTarget);
  const accounts = useAccountsStore((state) => state.accounts);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const session = useImportSessionStore((state) => state.session);
  const clearSession = useImportSessionStore((state) => state.clearSession);
  const [rows, setRows] = useState<ReviewTransactionRow[]>(
    () => session?.result.transactions.map(toReviewRow) ?? []
  );
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    setRows(session?.result.transactions.map(toReviewRow) ?? []);
    setSaveState({ status: "idle" });
  }, [session?.createdAt, session?.result.transactions]);

  const activeRows = useMemo(() => rows.filter((row) => !row.skipped), [rows]);
  const skippedRows = rows.length - activeRows.length;
  const activeTotal = useMemo(
    () =>
      activeRows.reduce((sum, row) => {
        const parsed = Number.parseFloat(row.amount);
        return Number.isNaN(parsed) ? sum : sum + parsed;
      }, 0),
    [activeRows]
  );
  const validationMessage = useMemo(() => validateRows(activeRows), [activeRows]);

  const updateRow = (id: string, patch: Partial<ReviewTransactionRow>) => {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
    setSaveState({ status: "idle" });
  };

  const assignAccount = (id: string, account: MoneyAccount) => {
    updateRow(id, {
      accountId: account.id,
      accountName: account.name
    });
  };

  const confirmImport = async () => {
    if (!session || validationMessage || activeRows.length === 0) {
      return;
    }

    setSaveState({ status: "saving" });

    try {
      const saveableTransactions = activeRows.map(toSaveableTransaction);
      const result =
        user && session.uploadedFileId
          ? await saveReviewedImportToSupabase({
              importJobId: session.importJobId,
              transactions: saveableTransactions,
              uploadedFileId: session.uploadedFileId,
              userId: user.id
            })
          : await saveReviewedImport({
              fileName: session.fileName,
              transactions: saveableTransactions
            });

      setSaveState({
        savedCount: result.savedCount,
        status: "saved"
      });
    } catch {
      setSaveState({
        message: "Could not save the reviewed transactions. Please try again.",
        status: "error"
      });
    }
  };

  const closeReview = () => {
    if (returnTarget) {
      router.replace(withReturnTo("/import", returnTarget));
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/import");
  };

  const viewCalendar = () => {
    clearSession();
    router.replace(returnRoute ?? "/calendar");
  };

  if (!session) {
    return (
      <Screen>
        <View style={styles.emptyRoot}>
          <View style={[styles.emptyIcon, { backgroundColor: accentSoft }]}>
            <WalletCards color={accentColor} size={30} />
          </View>
          <Text style={styles.emptyTitle}>No import to review</Text>
          <Text style={styles.emptyText}>
            Upload a statement first, then extracted rows will appear here before saving.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace(withReturnTo("/import", returnTarget))}
            style={({ pressed }) => [
              styles.emptyButton,
              { backgroundColor: accentColor },
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.emptyButtonText}>Go to Import</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const confirmDisabled =
    saveState.status === "saving" || !!validationMessage || activeRows.length === 0;

  return (
    <Screen>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back to import"
            accessibilityRole="button"
            onPress={closeReview}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft color={colors.textPrimary} size={22} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: accentColor }]}>Review Import</Text>
            <Text style={styles.title}>Check each row before saving</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.summaryCard, { borderColor: `${accentColor}33` }]}>
            <View style={styles.summaryTop}>
              <View>
                <Text numberOfLines={1} style={styles.fileName}>
                  {session.fileName}
                </Text>
                <Text style={styles.summaryMeta}>
                  {activeRows.length} importing - {skippedRows} skipped - {formatCurrency(activeTotal)}
                </Text>
              </View>
              <CheckCircle2 color={accentColor} size={24} />
            </View>

            <View style={styles.summaryPills}>
              <SummaryPill label="Extracted" value={rows.length} />
              <SummaryPill label="Failed" tone="danger" value={session.result.failedRows.length} />
              <SummaryPill label="Duplicates" tone="warning" value={session.result.duplicates.length} />
            </View>
          </View>

          {validationMessage ? (
            <InlineMessage tone="danger" text={validationMessage} />
          ) : null}

          {saveState.status === "saved" ? (
            <InlineMessage
              tone="accent"
              text={`${saveState.savedCount} transactions saved and ready for your timeline.`}
            />
          ) : null}

          {saveState.status === "error" ? (
            <InlineMessage tone="danger" text={saveState.message} />
          ) : null}

          {session.result.failedRows.length > 0 ? (
            <FailedRowsPreview rows={session.result.failedRows} />
          ) : null}

          {session.result.duplicates.length > 0 ? (
            <DuplicateRowsPreview duplicates={session.result.duplicates} />
          ) : null}

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Extracted Transactions</Text>
            <Text style={styles.listMeta}>Edit, skip, or reassign</Text>
          </View>

          {rows.map((row, index) => (
            <ReviewTransactionCard
              accounts={accounts}
              index={index}
              key={row.id}
              onAssignAccount={(account) => assignAccount(row.id, account)}
              onUpdate={(patch) => updateRow(row.id, patch)}
              row={row}
            />
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityLabel={saveState.status === "saved" ? "View calendar" : "Confirm import"}
            accessibilityRole="button"
            disabled={confirmDisabled && saveState.status !== "saved"}
            onPress={saveState.status === "saved" ? viewCalendar : confirmImport}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: accentColor },
              confirmDisabled && saveState.status !== "saved" && styles.primaryButtonDisabled,
              pressed && styles.pressed
            ]}
          >
            {saveState.status === "saving" ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : saveState.status === "saved" ? (
              <CheckCircle2 color={colors.background} size={20} strokeWidth={2.7} />
            ) : (
              <Save color={colors.background} size={20} strokeWidth={2.7} />
            )}
            <Text style={styles.primaryButtonText}>
              {saveState.status === "saved"
                ? returnLabel
                  ? `Back to ${returnLabel}`
                  : "View Calendar"
                : saveState.status === "saving"
                  ? "Saving Import"
                  : `Confirm ${activeRows.length} Transactions`}
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
};

const ReviewTransactionCard = ({
  accounts,
  index,
  onAssignAccount,
  onUpdate,
  row
}: {
  accounts: MoneyAccount[];
  index: number;
  onAssignAccount: (account: MoneyAccount) => void;
  onUpdate: (patch: Partial<ReviewTransactionRow>) => void;
  row: ReviewTransactionRow;
}) => {
  const { accentColor, accentSoft } = useAppearanceTheme();

  return (
  <View style={[styles.transactionCard, row.skipped && styles.transactionCardSkipped]}>
    <View style={styles.transactionHeader}>
      <View>
        <Text style={styles.rowLabel}>Row {row.rowNumber}</Text>
        <Text style={styles.rowTitle}>Transaction {index + 1}</Text>
      </View>
      <View style={[styles.kindPill, { backgroundColor: `${kindTone[row.kind]}18` }]}>
        <Text style={[styles.kindPillText, { color: kindTone[row.kind] }]}>
          {kindLabel[row.kind]}
        </Text>
      </View>
      <Pressable
        accessibilityLabel={row.skipped ? "Restore row" : "Skip row"}
        accessibilityRole="button"
        onPress={() => onUpdate({ skipped: !row.skipped })}
        style={({ pressed }) => [
          styles.skipButton,
          row.skipped && [styles.restoreButton, { backgroundColor: accentSoft }],
          pressed && styles.pressed
        ]}
      >
        {row.skipped ? (
          <RotateCcw color={accentColor} size={15} />
        ) : (
          <Trash2 color={colors.danger} size={15} />
        )}
        <Text style={[styles.skipButtonText, row.skipped && { color: accentColor }]}>
          {row.skipped ? "Restore" : "Skip"}
        </Text>
      </Pressable>
    </View>

    <View style={styles.inputGrid}>
      <LabeledInput
        label="Date"
        onChangeText={(date) => onUpdate({ date })}
        placeholder="YYYY-MM-DD"
        value={row.date}
      />
      <LabeledInput
        keyboardType="decimal-pad"
        label="Amount"
        onChangeText={(amount) => onUpdate({ amount })}
        placeholder="0.00"
        value={row.amount}
      />
    </View>

    <LabeledInput
      label="Merchant"
      onChangeText={(merchant) => onUpdate({ merchant })}
      placeholder="Merchant"
      value={row.merchant}
    />

    <View style={styles.inputGrid}>
      <LabeledInput
        label="Category"
        onChangeText={(category) => onUpdate({ category })}
        placeholder="Category"
        value={row.category}
      />
      <LabeledInput
        label="Description"
        onChangeText={(description) => onUpdate({ description })}
        placeholder="Optional"
        value={row.description}
      />
    </View>

    <View style={styles.accountChooser}>
      <Text style={styles.accountChooserLabel}>Account source</Text>
      <View style={styles.accountChips}>
        {accounts.map((account) => (
          <Pressable
            accessibilityLabel={`Assign ${account.name}`}
            accessibilityRole="button"
            key={account.id}
            onPress={() => onAssignAccount(account)}
            style={({ pressed }) => [
              styles.accountChip,
              row.accountId === account.id && [
                styles.accountChipActive,
                { backgroundColor: accentSoft, borderColor: `${accentColor}66` }
              ],
              pressed && styles.pressed
            ]}
          >
            <View style={[styles.accountChipDot, { backgroundColor: account.color }]} />
            <Text
              numberOfLines={1}
              style={[
                styles.accountChipText,
                row.accountId === account.id && styles.accountChipTextActive
              ]}
            >
              {account.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  </View>
  );
};

const LabeledInput = ({
  keyboardType = "default",
  label,
  onChangeText,
  placeholder,
  value
}: {
  keyboardType?: "decimal-pad" | "default";
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) => (
  <View style={styles.inputWrap}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      keyboardType={keyboardType}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      style={styles.textInput}
      value={value}
    />
  </View>
);

const SummaryPill = ({
  label,
  tone = "accent",
  value
}: {
  label: string;
  tone?: "accent" | "danger" | "warning";
  value: number;
}) => {
  const { accentColor } = useAppearanceTheme();
  const toneColor = {
    accent: accentColor,
    danger: colors.danger,
    warning: colors.warning
  }[tone];

  return (
    <View style={styles.summaryPill}>
      <Text style={[styles.summaryPillValue, { color: toneColor }]}>{value}</Text>
      <Text style={styles.summaryPillLabel}>{label}</Text>
    </View>
  );
};

const InlineMessage = ({ text, tone }: { text: string; tone: "accent" | "danger" }) => {
  const { accentColor, accentSoft } = useAppearanceTheme();

  return (
    <View
      style={[
        styles.inlineMessage,
        tone === "danger"
          ? styles.inlineDanger
          : [styles.inlineAccent, { backgroundColor: accentSoft, borderColor: `${accentColor}33` }]
      ]}
    >
      {tone === "danger" ? (
        <AlertCircle color={colors.danger} size={17} />
      ) : (
        <CheckCircle2 color={accentColor} size={17} />
      )}
      <Text style={styles.inlineMessageText}>{text}</Text>
    </View>
  );
};

const FailedRowsPreview = ({ rows }: { rows: StatementFailedRow[] }) => (
  <View style={styles.failedRowsCard}>
    <Text style={styles.failedRowsTitle}>Rows needing attention</Text>
    {rows.slice(0, 3).map((row) => (
      <Text key={`${row.rowNumber}-${row.message}`} style={styles.failedRowsText}>
        Row {row.rowNumber || "-"} - {row.message}
      </Text>
    ))}
  </View>
);

const DuplicateRowsPreview = ({
  duplicates
}: {
  duplicates: DuplicateTransactionDraft[];
}) => (
  <View style={styles.duplicateRowsCard}>
    <Text style={styles.duplicateRowsTitle}>Duplicates skipped automatically</Text>
    {duplicates.slice(0, 3).map((duplicate) => (
      <Text key={`${duplicate.duplicateHash}-${duplicate.rowNumber}`} style={styles.failedRowsText}>
        Row {duplicate.rowNumber} - {duplicate.merchant} - {formatCurrency(duplicate.amount)} -{" "}
        {duplicate.duplicateReason === "previous_import" ? "already imported" : "same file"}
      </Text>
    ))}
  </View>
);

const validateRows = (rows: ReviewTransactionRow[]) => {
  if (rows.length === 0) {
    return "Restore at least one row before confirming the import.";
  }

  const invalidRow = rows.find((row) => {
    const amount = Number.parseFloat(row.amount);
    return !row.date.trim() || !row.merchant.trim() || Number.isNaN(amount);
  });

  if (invalidRow) {
    return `Row ${invalidRow.rowNumber} needs a date, merchant, and valid amount.`;
  }

  return "";
};

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
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
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 27
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: 116
  },
  summaryCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.16)",
    backgroundColor: "rgba(17, 25, 35, 0.86)",
    padding: spacing.lg
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  fileName: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22
  },
  summaryMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 2
  },
  summaryPills: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  summaryPill: {
    flex: 1,
    borderRadius: radii.lg,
    backgroundColor: "rgba(5, 8, 13, 0.48)",
    padding: spacing.md
  },
  summaryPillValue: {
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22
  },
  summaryPillLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
    marginTop: 2
  },
  inlineMessage: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md
  },
  inlineDanger: {
    borderColor: "rgba(255, 107, 107, 0.24)",
    backgroundColor: "rgba(255, 107, 107, 0.1)"
  },
  inlineAccent: {
    borderColor: "rgba(67, 216, 139, 0.24)",
    backgroundColor: "rgba(67, 216, 139, 0.08)"
  },
  inlineMessageText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  failedRowsCard: {
    gap: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(246, 166, 59, 0.22)",
    backgroundColor: "rgba(246, 166, 59, 0.08)",
    padding: spacing.md
  },
  failedRowsTitle: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  failedRowsText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  duplicateRowsCard: {
    gap: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(246, 166, 59, 0.22)",
    backgroundColor: "rgba(246, 166, 59, 0.08)",
    padding: spacing.md
  },
  duplicateRowsTitle: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md
  },
  listTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22
  },
  listMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  transactionCard: {
    gap: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(17, 25, 35, 0.82)",
    padding: spacing.md
  },
  transactionCardSkipped: {
    opacity: 0.58
  },
  transactionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  rowLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
    textTransform: "uppercase"
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  kindPill: {
    minHeight: 30,
    justifyContent: "center",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md
  },
  kindPillText: {
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    textTransform: "uppercase"
  },
  skipButton: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 107, 107, 0.12)",
    paddingHorizontal: spacing.md
  },
  restoreButton: {
    backgroundColor: colors.accentSoft
  },
  skipButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16
  },
  restoreButtonText: {
    color: colors.accent
  },
  inputGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  inputWrap: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    textTransform: "uppercase"
  },
  textInput: {
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    backgroundColor: "rgba(5, 8, 13, 0.5)",
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
    paddingHorizontal: spacing.md
  },
  accountChooser: {
    gap: spacing.sm
  },
  accountChooserLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    textTransform: "uppercase"
  },
  accountChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  accountChip: {
    minHeight: 34,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    backgroundColor: "rgba(5, 8, 13, 0.42)",
    paddingHorizontal: spacing.sm
  },
  accountChipActive: {
    borderColor: "rgba(67, 216, 139, 0.4)",
    backgroundColor: colors.accentSoft
  },
  accountChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  accountChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15
  },
  accountChipTextActive: {
    color: colors.textPrimary
  },
  footer: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(5, 8, 13, 0.92)",
    paddingTop: spacing.md,
    paddingBottom: spacing.lg
  },
  primaryButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    marginHorizontal: spacing.lg
  },
  primaryButtonDisabled: {
    opacity: 0.56
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22
  },
  emptyRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg
  },
  emptyIcon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    marginBottom: spacing.md
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: spacing.xs,
    textAlign: "center"
  },
  emptyButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl
  },
  emptyButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }]
  }
});
