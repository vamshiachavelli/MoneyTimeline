import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  ReceiptText,
  Sparkles
} from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { useImportCompletionStore } from "@/features/import/import-completion-store";
import { useAppearanceTheme } from "@/features/settings/use-appearance-theme";
import {
  getReturnTargetParam,
  getReturnTargetRoute
} from "@/navigation/return-target";
import { colors, radii, spacing } from "@/styles/theme";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);

const formatImportedAt = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

const getTransactionAmountLabel = (transaction: { amount: number; kind: string }) =>
  transaction.kind === "expense"
    ? `-${formatCurrency(Math.abs(transaction.amount))}`
    : formatCurrency(Math.abs(transaction.amount));

const getKindLabel = (kind: string) => {
  if (kind === "payment") {
    return "Payment";
  }

  if (kind === "transfer") {
    return "Transfer";
  }

  if (kind === "income") {
    return "Income";
  }

  return "Expense";
};

export const ImportCompleteScreen = () => {
  const router = useRouter();
  const { accentColor, accentSoft, palette } = useAppearanceTheme();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTarget = getReturnTargetParam(params.returnTo);
  const returnRoute = getReturnTargetRoute(params.returnTo);
  const completion = useImportCompletionStore((state) => state.completion);

  const goCalendar = () => router.replace(returnRoute ?? "/calendar");
  const goRecentImport = () =>
    completion
      ? router.replace(`/timeline?importBatchId=${encodeURIComponent(completion.batchId)}`)
      : router.replace("/timeline");
  const goImportDetail = () =>
    completion
      ? router.push(`/import-detail/${encodeURIComponent(completion.batchId)}?returnTo=importComplete`)
      : router.push("/data-import");

  if (!completion) {
    return (
      <Screen>
        <View style={styles.emptyRoot}>
          <View style={[styles.emptyIcon, { backgroundColor: accentSoft }]}>
            <ReceiptText color={accentColor} size={28} />
          </View>
          <Text style={styles.emptyTitle}>No recent import</Text>
          <Text style={styles.emptyText}>Import a statement to see the new transactions here.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/import")}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: accentColor },
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.primaryButtonText}>Import Statement</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const expenseCount = completion.savedCount - completion.paymentCount;
  const expenses = completion.transactions.filter((transaction) => transaction.kind === "expense");
  const moneyMovement = completion.transactions.filter(
    (transaction) => transaction.kind === "payment" || transaction.kind === "transfer"
  );
  const previewTransactions = [...expenses.slice(0, 4), ...moneyMovement.slice(0, 2)].slice(0, 6);

  return (
    <Screen>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back to calendar"
            accessibilityRole="button"
            onPress={goCalendar}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft color={colors.textPrimary} size={22} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: accentColor }]}>Import Complete</Text>
            <Text style={styles.title}>New transactions added</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={[accentSoft, palette.cardStrong]}
            style={[styles.heroCard, { borderColor: `${accentColor}33`, shadowColor: accentColor }]}
          >
            <View style={[styles.heroIcon, { backgroundColor: accentSoft }]}>
              <CheckCircle2 color={accentColor} size={38} strokeWidth={2.8} />
            </View>
            <Text style={styles.heroTitle}>{completion.savedCount} transactions added</Text>
            <Text style={styles.heroText}>
              {completion.accountName} is now reflected across Calendar, Timeline, and Insights.
            </Text>

            <View style={styles.statementStrip}>
              <View style={styles.statementCopy}>
                <Text style={styles.statementLabel}>Statement</Text>
                <Text numberOfLines={1} style={styles.statementFile}>
                  {completion.fileName}
                </Text>
                <Text style={styles.statementMeta}>
                  Imported {formatImportedAt(completion.importedAt)}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Open statement detail"
                accessibilityRole="button"
                onPress={goImportDetail}
                style={({ pressed }) => [styles.statementButton, pressed && styles.pressed]}
              >
                <FileText color={colors.textPrimary} size={16} strokeWidth={2.5} />
                <Text style={styles.statementButtonText}>Details</Text>
              </Pressable>
            </View>

            <View style={styles.statGrid}>
              <StatPill label="Expenses" value={`${expenseCount}`} />
              <StatPill label="Payments / transfers" value={`${completion.paymentCount}`} />
              <StatPill label="Range" value={completion.dateRange} />
            </View>
          </LinearGradient>

          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Sparkles color={accentColor} size={20} />
              <View style={styles.detailCopy}>
                <Text style={styles.detailTitle}>Recently imported</Text>
                <Text numberOfLines={1} style={styles.detailMeta}>
                  {completion.fileName}
                </Text>
              </View>
            </View>

            {previewTransactions.map((transaction) => (
              <View key={`${transaction.duplicateHash}-${transaction.rowNumber}`} style={styles.row}>
                <View
                  style={[
                    styles.rowIcon,
                    {
                      backgroundColor:
                        transaction.kind === "expense" ? accentSoft : "rgba(127, 167, 255, 0.18)"
                    }
                  ]}
                >
                  {transaction.kind === "expense" ? (
                    <ReceiptText color={accentColor} size={16} strokeWidth={2.5} />
                  ) : (
                    <CreditCard color="#7FA7FF" size={16} strokeWidth={2.5} />
                  )}
                </View>
                <View style={styles.rowCopy}>
                  <Text numberOfLines={1} style={styles.rowMerchant}>
                    {transaction.merchant}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {transaction.date} - {getKindLabel(transaction.kind)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.rowAmount,
                    transaction.kind === "expense" ? null : styles.moneyMovementAmount
                  ]}
                >
                  {getTransactionAmountLabel(transaction)}
                </Text>
              </View>
            ))}

            {completion.transactions.length > previewTransactions.length ? (
              <Text style={styles.moreRowsText}>
                +{completion.transactions.length - previewTransactions.length} more rows in this import
              </Text>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={goRecentImport}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <ReceiptText color={colors.textPrimary} size={18} />
            <Text style={styles.secondaryButtonText}>View Imported Transactions</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={goCalendar}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: accentColor },
              pressed && styles.pressed
            ]}
          >
            <CalendarDays color={colors.background} size={19} strokeWidth={2.6} />
            <Text style={styles.primaryButtonText}>View in Calendar</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
};

const StatPill = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.statPill}>
    <Text numberOfLines={1} style={styles.statValue}>
      {value}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

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
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    textTransform: "uppercase"
  },
  title: {
    color: colors.textPrimary,
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 27
  },
  content: {
    gap: spacing.md,
    paddingBottom: 140
  },
  heroCard: {
    alignItems: "center",
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
    shadowOpacity: 0.18,
    shadowRadius: 24
  },
  heroIcon: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 38,
    marginBottom: spacing.md
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 32,
    textAlign: "center"
  },
  heroText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: spacing.xs,
    textAlign: "center"
  },
  statGrid: {
    width: "100%",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg
  },
  statementStrip: {
    width: "100%",
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    backgroundColor: "rgba(5, 8, 13, 0.36)",
    marginTop: spacing.lg,
    padding: spacing.md
  },
  statementCopy: {
    minWidth: 0,
    flex: 1
  },
  statementLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 14,
    textTransform: "uppercase"
  },
  statementFile: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  statementMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
    marginTop: 2
  },
  statementButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: spacing.sm
  },
  statementButtonText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16
  },
  statPill: {
    minWidth: 0,
    flex: 1,
    borderRadius: radii.lg,
    backgroundColor: "rgba(5, 8, 13, 0.42)",
    padding: spacing.md
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 14,
    marginTop: 2,
    textTransform: "uppercase"
  },
  detailCard: {
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(17, 25, 35, 0.86)",
    padding: spacing.md
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.sm
  },
  detailCopy: {
    minWidth: 0,
    flex: 1
  },
  detailTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  detailMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: "rgba(5, 8, 13, 0.38)",
    paddingHorizontal: spacing.md
  },
  rowIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17
  },
  rowCopy: {
    minWidth: 0,
    flex: 1
  },
  rowMerchant: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  rowMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  rowAmount: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  moneyMovementAmount: {
    color: "#7FA7FF"
  },
  moreRowsText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
    paddingTop: spacing.xs,
    textAlign: "center"
  },
  footer: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(5, 8, 13, 0.92)",
    paddingTop: spacing.md,
    paddingBottom: spacing.lg
  },
  primaryButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    marginHorizontal: spacing.lg
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  secondaryButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(17, 25, 35, 0.92)",
    marginHorizontal: spacing.lg
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
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
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }]
  }
});
