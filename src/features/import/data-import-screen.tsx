import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Clock3,
  Database,
  FileText,
  ReceiptText,
  RefreshCw,
  UploadCloud
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
  getSavedImportBatches,
  type SavedImportBatch
} from "@/features/import/import-save-service";
import { useAppearanceTheme } from "@/features/settings/use-appearance-theme";
import {
  importHistoryService,
  type ImportHistoryItem
} from "@/services/supabase/import-history-service";
import { colors, radii, spacing } from "@/styles/theme";
import { withReturnTo } from "@/navigation/return-target";

type HistoryItem = {
  accountId: string | null;
  accountName: string | null;
  expenseCount: number;
  expenseTotal: number;
  fileName: string;
  fileType: string;
  id: string;
  importedAt: string;
  importedRows: number;
  paymentTransferCount: number;
  paymentTransferTotal: number;
  source: "local" | "supabase";
  status: string;
  totalRows: number;
  transactions: {
    amount: number;
    date: string;
    id: string;
    kind: string;
    merchant: string;
  }[];
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

const toTitle = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const mapRemoteHistory = (items: ImportHistoryItem[]): HistoryItem[] =>
  items.map((item) => ({
    accountId: item.accountId,
    accountName: item.accountName,
    expenseCount: item.transactions.filter((transaction) => transaction.kind === "expense").length,
    expenseTotal:
      item.transactions
        .filter((transaction) => transaction.kind === "expense")
        .reduce((sum, transaction) => sum + transaction.amount_minor / 100, 0),
    fileName: item.fileName,
    fileType: item.fileType.toUpperCase(),
    id: item.id,
    importedAt: item.importedAt,
    importedRows: item.importedRows,
    paymentTransferCount: item.transactions.filter(
      (transaction) => transaction.kind === "payment" || transaction.kind === "transfer"
    ).length,
    paymentTransferTotal:
      item.transactions
        .filter((transaction) => transaction.kind === "payment" || transaction.kind === "transfer")
        .reduce((sum, transaction) => sum + transaction.amount_minor / 100, 0),
    source: "supabase",
    status: item.status,
    totalRows: item.totalRows,
    transactions: item.transactions.slice(0, 4).map((transaction) => ({
      amount: transaction.amount_minor / 100,
      date: transaction.transaction_date,
      id: transaction.id,
      kind: transaction.kind,
      merchant: transaction.merchant
    }))
  }));

const mapLocalHistory = (batches: SavedImportBatch[]): HistoryItem[] =>
  batches.map((batch) => ({
    accountId: batch.transactions[0]?.accountId ?? null,
    accountName: batch.transactions[0]?.accountName ?? null,
    expenseCount: batch.transactions.filter((transaction) => transaction.kind === "expense").length,
    expenseTotal: batch.transactions
      .filter((transaction) => transaction.kind === "expense")
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    fileName: batch.fileName,
    fileType: "LOCAL",
    id: batch.id,
    importedAt: batch.importedAt,
    importedRows: batch.transactions.length,
    paymentTransferCount: batch.transactions.filter(
      (transaction) => transaction.kind === "payment" || transaction.kind === "transfer"
    ).length,
    paymentTransferTotal: batch.transactions
      .filter((transaction) => transaction.kind === "payment" || transaction.kind === "transfer")
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    source: "local",
    status: "completed",
    totalRows: batch.transactions.length,
    transactions: batch.transactions.slice(0, 4).map((transaction) => ({
      amount: Math.abs(transaction.amount),
      date: transaction.date,
      id: `${batch.id}_${transaction.rowNumber}`,
      kind: transaction.kind,
      merchant: transaction.merchant
    }))
  }));

export const DataImportScreen = () => {
  const router = useRouter();
  const { accentColor, accentSoft, palette } = useAppearanceTheme();
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadHistory = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const items = user
        ? mapRemoteHistory(await importHistoryService.listForUser(user.id))
        : mapLocalHistory(await getSavedImportBatches());

      setHistory(items);
    } catch (error) {
      setHistory([]);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load import history."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [user?.id])
  );

  const totals = useMemo(
    () =>
      history.reduce(
        (acc, item) => ({
          imported: acc.imported + item.importedRows,
          statements: acc.statements + 1
        }),
        { imported: 0, statements: 0 }
      ),
    [history]
  );

  const recentTransactions = useMemo(
    () =>
      history
        .flatMap((item) =>
          item.transactions.map((transaction) => ({
            ...transaction,
            accountName: item.accountName,
            importId: item.id
          }))
        )
        .slice(0, 6),
    [history]
  );

  const openUpload = () => {
    router.push(withReturnTo("/import", "dataImport"));
  };

  const openImportTimeline = (item: HistoryItem) => {
    router.push(withReturnTo(`/import-detail/${encodeURIComponent(item.id)}`, "dataImport"));
  };

  return (
    <Screen>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back to settings"
            accessibilityRole="button"
            onPress={() => router.replace("/settings")}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <ArrowLeft color={colors.textPrimary} size={21} strokeWidth={2.5} />
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: accentColor }]}>Data workspace</Text>
            <Text style={styles.title}>Data & Import</Text>
          </View>

          <Pressable
            accessibilityLabel="Refresh import history"
            accessibilityRole="button"
            onPress={() => void loadHistory()}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            {isLoading ? (
              <ActivityIndicator color={accentColor} size="small" />
            ) : (
              <RefreshCw color={colors.textPrimary} size={19} strokeWidth={2.5} />
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={[accentSoft, palette.cardStrong]}
            style={[styles.heroCard, { borderColor: `${accentColor}33`, shadowColor: accentColor }]}
          >
            <View style={styles.heroTop}>
              <View style={[styles.heroIcon, { backgroundColor: accentSoft }]}>
                <Database color={accentColor} size={28} strokeWidth={2.5} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroLabel}>Imported data</Text>
                <Text style={styles.heroValue}>{totals.imported}</Text>
                <Text style={styles.heroMeta}>
                  {totals.statements} statements saved to your timeline
                </Text>
              </View>
            </View>

            <View style={styles.metricRow}>
              <MetricPill label="Transactions" tone={accentColor} value={totals.imported} />
              <MetricPill label="Statements" tone="#7FA7FF" value={totals.statements} />
              <MetricPill
                label="Recent rows"
                tone={colors.shared}
                value={recentTransactions.length}
              />
            </View>
          </LinearGradient>

          <View style={styles.actionRow}>
            <ActionCard
              accent={accentColor}
              icon={UploadCloud}
              onPress={openUpload}
              subtitle="PDF, CSV, XLS, XLSX"
              title="Upload statement"
            />
            <ActionCard
              accent="#7FA7FF"
              icon={Clock3}
              onPress={() => router.push("/timeline")}
              subtitle="All imported activity"
              title="Open timeline"
            />
          </View>

          {errorMessage ? (
            <View style={styles.errorCard}>
              <AlertCircle color={colors.danger} size={18} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Import history</Text>
            <Text style={[styles.sectionMeta, { color: accentColor }]}>
              {isLoading ? "Loading" : `${history.length} statements`}
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={accentColor} />
              <Text style={styles.loadingText}>Loading import history</Text>
            </View>
          ) : history.length === 0 ? (
            <PremiumEmptyState
              actionLabel="Upload Statement"
              icon={UploadCloud}
              message="Once you import a statement, this page keeps the summary and quick links back to its transactions."
              onAction={openUpload}
              title="No statements imported"
              tone={accentColor}
            />
          ) : (
            <View style={styles.historyList}>
              {history.map((item) => (
                <ImportHistoryCard
                  accentColor={accentColor}
                  item={item}
                  key={item.id}
                  onPress={() => openImportTimeline(item)}
                />
              ))}
            </View>
          )}

          {recentTransactions.length > 0 ? (
            <View style={styles.recentSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recently imported</Text>
                <Text style={[styles.sectionMeta, { color: accentColor }]}>
                  Quick scan
                </Text>
              </View>
              <View style={styles.recentList}>
                {recentTransactions.map((transaction) => (
                  <View key={`${transaction.importId}_${transaction.id}`} style={styles.recentRow}>
                    <View style={[styles.recentIcon, { backgroundColor: accentSoft }]}>
                      <ReceiptText color={accentColor} size={17} strokeWidth={2.4} />
                    </View>
                    <View style={styles.recentCopy}>
                      <Text numberOfLines={1} style={styles.recentMerchant}>
                        {transaction.merchant}
                      </Text>
                      <Text numberOfLines={1} style={styles.recentMeta}>
                        {formatDate(transaction.date)}{transaction.accountName ? ` - ${transaction.accountName}` : ""}
                      </Text>
                    </View>
                    <Text style={styles.recentAmount}>{formatCurrency(transaction.amount)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Screen>
  );
};

const MetricPill = ({
  label,
  tone,
  value
}: {
  label: string;
  tone: string;
  value: number;
}) => (
  <View style={styles.metricPill}>
    <View style={[styles.metricDot, { backgroundColor: tone }]} />
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const ActionCard = ({
  accent,
  icon: Icon,
  onPress,
  subtitle,
  title
}: {
  accent: string;
  icon: typeof UploadCloud;
  onPress: () => void;
  subtitle: string;
  title: string;
}) => (
  <Pressable
    accessibilityLabel={title}
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}
  >
    <View style={[styles.actionIcon, { backgroundColor: `${accent}22` }]}>
      <Icon color={accent} size={21} strokeWidth={2.5} />
    </View>
    <Text style={styles.actionTitle}>{title}</Text>
    <Text style={styles.actionSubtitle}>{subtitle}</Text>
  </Pressable>
);

const ImportHistoryCard = ({
  accentColor,
  item,
  onPress
}: {
  accentColor: string;
  item: HistoryItem;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityLabel={`Open ${item.fileName} import`}
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [styles.historyCard, pressed && styles.pressed]}
  >
    <View style={styles.historyTop}>
      <View style={[styles.fileIcon, { backgroundColor: `${accentColor}1F` }]}>
        <FileText color={accentColor} size={21} strokeWidth={2.5} />
      </View>
      <View style={styles.historyCopy}>
        <Text numberOfLines={1} style={styles.historyTitle}>
          {item.fileName}
        </Text>
        <Text numberOfLines={1} style={styles.historyMeta}>
          {formatDate(item.importedAt)} - {item.accountName ?? "Imported account"}
        </Text>
      </View>
      <ChevronRight color={colors.textSecondary} size={19} />
    </View>

    <View style={styles.historyStats}>
      <HistoryStat label="Imported" value={item.importedRows} />
      <HistoryStat label="Expenses" value={item.expenseCount} />
      <HistoryStat label="Payments" value={item.paymentTransferCount} />
    </View>

    <View style={styles.historyTotals}>
      <View style={styles.historyTotalBlock}>
        <Text style={styles.historyTotalLabel}>Expense spend</Text>
        <Text style={styles.historyTotalValue}>{formatCurrency(item.expenseTotal)}</Text>
      </View>
      <View style={styles.historyTotalDivider} />
      <View style={styles.historyTotalBlock}>
        <Text style={styles.historyTotalLabel}>Payments moved</Text>
        <Text style={[styles.historyTotalValue, styles.paymentTotalValue]}>
          {formatCurrency(item.paymentTransferTotal)}
        </Text>
      </View>
    </View>

    <View style={styles.historyFooter}>
      <Text style={styles.statusText}>{toTitle(item.status)}</Text>
      <Text style={styles.fileTypeText}>{item.fileType}</Text>
    </View>
  </Pressable>
);

const HistoryStat = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.historyStat}>
    <Text style={styles.historyStatValue}>{value}</Text>
    <Text style={styles.historyStatLabel}>{label}</Text>
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
    justifyContent: "space-between",
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
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    color: colors.textPrimary,
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 34
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
  heroTop: {
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
  heroLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "800"
  },
  heroValue: {
    color: colors.textPrimary,
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 45
  },
  heroMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700"
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg
  },
  metricPill: {
    flex: 1,
    minHeight: 70,
    justifyContent: "center",
    borderRadius: radii.lg,
    backgroundColor: "rgba(4, 8, 13, 0.46)",
    padding: spacing.sm
  },
  metricDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginBottom: spacing.xs
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "900"
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.md
  },
  actionCard: {
    flex: 1,
    minHeight: 116,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(14, 21, 31, 0.88)",
    padding: spacing.md
  },
  actionIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    marginBottom: spacing.md
  },
  actionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900"
  },
  actionSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 79, 79, 0.26)",
    backgroundColor: "rgba(255, 79, 79, 0.1)",
    padding: spacing.md
  },
  errorText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700"
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
  loadingCard: {
    minHeight: 116,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: "rgba(14, 21, 31, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)"
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700"
  },
  historyList: {
    gap: spacing.md
  },
  historyCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(14, 21, 31, 0.88)",
    padding: spacing.md
  },
  historyTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  fileIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21
  },
  historyCopy: {
    flex: 1
  },
  historyTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900"
  },
  historyMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3
  },
  historyStats: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  historyTotals: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.md,
    backgroundColor: "rgba(4, 8, 13, 0.28)",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm
  },
  historyTotalBlock: {
    minWidth: 0,
    flex: 1
  },
  historyTotalLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 14,
    textTransform: "uppercase"
  },
  historyTotalValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
    marginTop: 2
  },
  paymentTotalValue: {
    color: "#7FA7FF"
  },
  historyTotalDivider: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginHorizontal: spacing.sm
  },
  historyStat: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: "rgba(4, 8, 13, 0.36)",
    padding: spacing.sm
  },
  historyStatValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900"
  },
  historyStatLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  historyFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md
  },
  statusText: {
    color: colors.personal,
    fontSize: 12,
    fontWeight: "900"
  },
  fileTypeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900"
  },
  recentSection: {
    gap: spacing.sm
  },
  recentList: {
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(14, 21, 31, 0.88)"
  },
  recentRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: spacing.md
  },
  recentIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17
  },
  recentCopy: {
    flex: 1
  },
  recentMerchant: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900"
  },
  recentMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3
  },
  recentAmount: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }]
  }
});
