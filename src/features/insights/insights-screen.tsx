import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  CalendarDays,
  ChartNoAxesColumn,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  HandCoins,
  ReceiptText,
  Share2,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
  UserRound,
  UsersRound
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  type DimensionValue
} from "react-native";

import { AppTopBar } from "@/components/navigation/app-top-bar";
import { PremiumEmptyState } from "@/components/ui/premium-empty-state";
import { Screen } from "@/components/ui/screen";
import { useAppearanceTheme } from "@/features/settings/use-appearance-theme";
import {
  getReturnTargetLabel,
  getReturnTargetParam,
  getReturnTargetRoute
} from "@/navigation/return-target";
import {
  formatCurrency,
  isSpendTransaction,
  useLedgerTransactions,
  type Classification,
  type Transaction
} from "@/features/transactions/transaction-ledger";
import { colors, radii, spacing } from "@/styles/theme";

type InsightMetric = {
  icon: typeof ReceiptText;
  label: string;
  meta: string;
  tone: string;
  value: string;
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const classificationTone: Record<Classification, string> = {
  personal: colors.personal,
  shared: colors.shared,
  unclassified: colors.unclassified
};

const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;

const formatMonthTitle = (date: Date) =>
  `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

const getDayKey = (dateKey: string) => Number.parseInt(dateKey.slice(8, 10), 10);

const summarizeBy = (
  transactions: Transaction[],
  getKey: (transaction: Transaction) => string
) => {
  const totals = transactions.reduce<Record<string, { amount: number; count: number }>>(
    (acc, transaction) => {
      const key = getKey(transaction);
      const current = acc[key] ?? { amount: 0, count: 0 };

      acc[key] = {
        amount: current.amount + transaction.amount,
        count: current.count + 1
      };

      return acc;
    },
    {}
  );

  return Object.entries(totals)
    .map(([label, value]) => ({ label, ...value }))
    .sort((a, b) => b.amount - a.amount);
};

const buildDailyTotals = (transactions: Transaction[], monthDate: Date) => {
  const daysInMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0
  ).getDate();
  const emptyDays = Array.from({ length: daysInMonth }, (_, index) => ({
    amount: 0,
    count: 0,
    day: index + 1
  }));

  transactions.forEach((transaction) => {
    const day = getDayKey(transaction.date);
    const daySummary = emptyDays[day - 1];

    if (!daySummary) {
      return;
    }

    daySummary.amount += transaction.amount;
    daySummary.count += 1;
  });

  return emptyDays;
};

const getMostActiveDay = (transactions: Transaction[]) => {
  const daySummaries = summarizeBy(transactions, (transaction) => transaction.date);
  const topDay = [...daySummaries].sort((a, b) =>
    b.count === a.count ? b.amount - a.amount : b.count - a.count
  )[0];

  if (!topDay) {
    return null;
  }

  return {
    amount: topDay.amount,
    count: topDay.count,
    label: new Date(`${topDay.label}T12:00:00`).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short"
    })
  };
};

const shareRecapText = async (text: string) => {
  if (Platform.OS === "web" && typeof navigator !== "undefined") {
    if ("share" in navigator && typeof navigator.share === "function") {
      await navigator.share({ text, title: "MoneyTimeline monthly recap" });
      return "shared";
    }

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return "copied";
      } catch {
        // Fall through to a text download when clipboard access is blocked.
      }
    }

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "moneytimeline-monthly-recap.txt";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return "downloaded";
  }

  await Share.share({ message: text, title: "MoneyTimeline monthly recap" });
  return "shared";
};

export const InsightsScreen = () => {
  const router = useRouter();
  const { accentColor, accentSoft, palette } = useAppearanceTheme();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTarget = getReturnTargetParam(params.returnTo);
  const returnRoute = getReturnTargetRoute(params.returnTo);
  const returnLabel = getReturnTargetLabel(returnTarget);
  const ledgerTransactions = useLedgerTransactions();
  const [monthDate, setMonthDate] = useState(new Date(2026, 4, 1));
  const [isSharing, setIsSharing] = useState(false);
  const [notice, setNotice] = useState("");
  const didApplyLatestImportMonth = useRef(false);
  const monthKey = toMonthKey(monthDate);

  useEffect(() => {
    if (didApplyLatestImportMonth.current || ledgerTransactions.length === 0) {
      return;
    }

    const currentMonthHasTransactions = ledgerTransactions.some((transaction) =>
      transaction.date.startsWith(monthKey)
    );

    if (currentMonthHasTransactions) {
      didApplyLatestImportMonth.current = true;
      return;
    }

    const latestTransaction = [...ledgerTransactions].sort((a, b) => b.date.localeCompare(a.date))[0];

    if (latestTransaction) {
      const latestDate = new Date(`${latestTransaction.date}T12:00:00`);
      setMonthDate(new Date(latestDate.getFullYear(), latestDate.getMonth(), 1));
      didApplyLatestImportMonth.current = true;
    }
  }, [ledgerTransactions, monthKey]);

  const monthTransactions = useMemo(
    () =>
      ledgerTransactions.filter(
        (transaction) => transaction.date.startsWith(monthKey) && isSpendTransaction(transaction)
      ),
    [ledgerTransactions, monthKey]
  );

  const summary = useMemo(() => {
    const totalSpent = monthTransactions.reduce(
      (sum, transaction) => sum + transaction.amount,
      0
    );
    const personalSpent = monthTransactions
      .filter((transaction) => transaction.classification === "personal")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const sharedSpent = monthTransactions
      .filter((transaction) => transaction.classification === "shared")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const unclassifiedSpent = monthTransactions
      .filter((transaction) => transaction.classification === "unclassified")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const categoryLeaders = summarizeBy(monthTransactions, (transaction) => transaction.category);
    const merchantLeaders = summarizeBy(monthTransactions, (transaction) => transaction.merchant);
    const dailyTotals = buildDailyTotals(monthTransactions, monthDate);
    const mostActiveDay = getMostActiveDay(monthTransactions);

    return {
      categoryLeaders,
      dailyTotals,
      merchantLeaders,
      mostActiveDay,
      personalSpent,
      sharedSpent,
      totalSpent,
      unclassifiedSpent
    };
  }, [monthDate, monthTransactions]);

  const maxDailyAmount = Math.max(...summary.dailyTotals.map((day) => day.amount), 1);
  const topCategory = summary.categoryLeaders[0] ?? null;
  const topMerchant = summary.merchantLeaders[0] ?? null;
  const sharedShare =
    summary.totalSpent > 0 ? Math.round((summary.sharedSpent / summary.totalSpent) * 100) : 0;
  const metrics: InsightMetric[] = [
    {
      icon: UserRound,
      label: "Personal spent",
      meta: `${Math.round((summary.personalSpent / Math.max(summary.totalSpent, 1)) * 100)}% of month`,
      tone: colors.personal,
      value: formatCurrency(summary.personalSpent)
    },
    {
      icon: UsersRound,
      label: "Shared spent",
      meta: `${sharedShare}% of month`,
      tone: colors.shared,
      value: formatCurrency(summary.sharedSpent)
    },
    {
      icon: CircleHelp,
      label: "Needs review",
      meta: "Unclassified",
      tone: colors.unclassified,
      value: formatCurrency(summary.unclassifiedSpent)
    }
  ];

  const changeMonth = (direction: -1 | 1) => {
    setMonthDate(
      (current) => new Date(current.getFullYear(), current.getMonth() + direction, 1)
    );
    setNotice("");
  };

  const shareRecap = async () => {
    if (isSharing) {
      return;
    }

    setIsSharing(true);

    try {
      const monthTitle = formatMonthTitle(monthDate);
      const recap = [
        `MoneyTimeline Recap - ${monthTitle}`,
        `Total spent: ${formatCurrency(summary.totalSpent)}`,
        `Personal: ${formatCurrency(summary.personalSpent)}`,
        `Shared: ${formatCurrency(summary.sharedSpent)} (${sharedShare}% of spend)`,
        `Needs review: ${formatCurrency(summary.unclassifiedSpent)}`,
        `Top category: ${topCategory?.label ?? "None"}`,
        `Top merchant: ${topMerchant?.label ?? "None"}`,
        `Most active day: ${summary.mostActiveDay?.label ?? "None"}`,
        `${monthTransactions.length} transactions reviewed.`
      ].join("\n");
      const result = await shareRecapText(recap);

      setNotice(
        result === "copied"
          ? "Monthly recap copied to clipboard."
          : result === "downloaded"
            ? "Monthly recap downloaded as a text file."
            : "Monthly recap is ready to share."
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Could not share recap: ${error.message}`
          : "Could not share recap. Please try again."
      );
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Screen>
      <View style={styles.root}>
        {returnRoute ? (
          <Pressable
            accessibilityLabel={`Back to ${returnLabel?.toLowerCase() ?? "previous page"}`}
            accessibilityRole="button"
            onPress={() => router.replace(returnRoute)}
            style={({ pressed }) => [styles.returnButton, pressed && styles.pressed]}
          >
            <ArrowLeft color={colors.textPrimary} size={18} strokeWidth={2.6} />
            <Text style={styles.returnText}>Back to {returnLabel}</Text>
          </Pressable>
        ) : null}
        <AppTopBar />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.monthControlRow}>
            <Pressable
              accessibilityLabel="Previous month"
              accessibilityRole="button"
              onPress={() => changeMonth(-1)}
              style={({ pressed }) => [
                styles.monthArrow,
                { backgroundColor: palette.surface },
                pressed && styles.pressed
              ]}
            >
              <ChevronLeft color={colors.textSecondary} size={20} strokeWidth={2.5} />
            </Pressable>
            <View style={styles.monthCopy}>
              <Text style={[styles.eyebrow, { color: accentColor }]}>Monthly recap</Text>
              <Text style={styles.monthTitle}>{formatMonthTitle(monthDate)}</Text>
            </View>
            <Pressable
              accessibilityLabel="Next month"
              accessibilityRole="button"
              onPress={() => changeMonth(1)}
              style={({ pressed }) => [
                styles.monthArrow,
                { backgroundColor: palette.surface },
                pressed && styles.pressed
              ]}
            >
              <ChevronRight color={colors.textSecondary} size={20} strokeWidth={2.5} />
            </Pressable>
          </View>

          {monthTransactions.length > 0 ? (
            <>
              <LinearGradient
                colors={[accentSoft, palette.cardStrong]}
                style={[styles.heroCard, { borderColor: `${accentColor}33`, shadowColor: accentColor }]}
              >
                <View style={styles.heroHeader}>
                  <View style={[styles.heroIcon, { backgroundColor: accentSoft }]}>
                    <Sparkles color={accentColor} size={27} strokeWidth={2.6} />
                  </View>
                  <View style={styles.heroCopy}>
                    <Text style={[styles.eyebrow, { color: accentColor }]}>You spent</Text>
                    <Text style={styles.heroAmount}>{formatCurrency(summary.totalSpent)}</Text>
                    <Text style={styles.heroMeta}>
                      {monthTransactions.length} transactions in {formatMonthTitle(monthDate)}
                    </Text>
                  </View>
                </View>

                <DailyRhythmChart
                  accentColor={accentColor}
                  cardColor={palette.card}
                  dailyTotals={summary.dailyTotals}
                  maxDailyAmount={maxDailyAmount}
                />
              </LinearGradient>

              <View style={styles.metricRow}>
                {metrics.map((metric) => (
                  <MetricCard cardColor={palette.card} key={metric.label} metric={metric} />
                ))}
              </View>

              <View style={styles.insightGrid}>
                <InsightCard
                  cardColor={palette.card}
                  icon={Tag}
                  label="Top category"
                  meta={
                    topCategory
                      ? `${topCategory.count} transactions - ${Math.round(
                          (topCategory.amount / summary.totalSpent) * 100
                        )}%`
                      : "No category yet"
                  }
                  tone={colors.personal}
                  value={topCategory?.label ?? "None"}
                />
                <InsightCard
                  cardColor={palette.card}
                  icon={Store}
                  label="Top merchant"
                  meta={topMerchant ? formatCurrency(topMerchant.amount) : "No merchant yet"}
                  tone={colors.unclassified}
                  value={topMerchant?.label ?? "None"}
                />
                <InsightCard
                  cardColor={palette.card}
                  icon={CalendarDays}
                  label="Most active day"
                  meta={
                    summary.mostActiveDay
                      ? `${summary.mostActiveDay.count} transactions - ${formatCurrency(
                          summary.mostActiveDay.amount
                        )}`
                      : "No activity"
                  }
                  tone={accentColor}
                  value={summary.mostActiveDay?.label ?? "None"}
                />
                <InsightCard
                  cardColor={palette.card}
                  icon={HandCoins}
                  label="Shared expenses"
                  meta={`${sharedShare}% of total spend`}
                  tone={colors.shared}
                  value={formatCurrency(summary.sharedSpent)}
                />
              </View>

              <View style={[styles.leaderboardCard, { backgroundColor: palette.card }]}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Category mix</Text>
                    <Text style={styles.sectionMeta}>Where the month went</Text>
                  </View>
                  <ChartNoAxesColumn color={colors.textSecondary} size={21} strokeWidth={2.4} />
                </View>

                <View style={styles.categoryList}>
                  {summary.categoryLeaders.slice(0, 5).map((category, index) => (
                    <CategoryRow
                      amount={category.amount}
                      accentColor={accentColor}
                      accentSoft={accentSoft}
                      key={category.label}
                      label={category.label}
                      maxAmount={summary.categoryLeaders[0]?.amount ?? 1}
                      rank={index + 1}
                    />
                  ))}
                </View>
              </View>

              {notice ? (
                <View style={[styles.noticeCard, { backgroundColor: accentSoft }]}>
                  <Share2 color={accentColor} size={17} strokeWidth={2.5} />
                  <Text style={[styles.noticeText, { color: accentColor }]}>{notice}</Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={isSharing}
                onPress={() => void shareRecap()}
                style={({ pressed }) => [
                  styles.shareButton,
                  { backgroundColor: accentColor },
                  pressed && styles.pressed
                ]}
              >
                <Share2 color={colors.background} size={18} strokeWidth={2.7} />
                <Text style={styles.shareButtonText}>
                  {isSharing ? "Preparing Recap" : "Share Recap"}
                </Text>
              </Pressable>
            </>
          ) : (
            <InsightsEmptyState accentColor={accentColor} monthTitle={formatMonthTitle(monthDate)} />
          )}
        </ScrollView>
      </View>
    </Screen>
  );
};

const DailyRhythmChart = ({
  accentColor,
  cardColor,
  dailyTotals,
  maxDailyAmount
}: {
  accentColor: string;
  cardColor: string;
  dailyTotals: Array<{ amount: number; count: number; day: number }>;
  maxDailyAmount: number;
}) => (
  <View style={[styles.chartCard, { backgroundColor: cardColor }]}>
    <View style={styles.chartHeader}>
      <Text style={styles.chartTitle}>Daily rhythm</Text>
      <Text style={styles.chartMeta}>Spend by day</Text>
    </View>
    <View style={styles.dailyBars}>
      {dailyTotals.map((day) => {
        const active = day.amount > 0;
        const height = active ? 10 + Math.round((day.amount / maxDailyAmount) * 46) : 5;

        return (
          <View key={day.day} style={styles.dailyBarSlot}>
            <View
              style={[
                styles.dailyBar,
                active && { backgroundColor: accentColor },
                { height }
              ]}
            />
          </View>
        );
      })}
    </View>
  </View>
);

const MetricCard = ({
  cardColor,
  metric
}: {
  cardColor: string;
  metric: InsightMetric;
}) => {
  const Icon = metric.icon;

  return (
    <View style={[styles.metricCard, { backgroundColor: cardColor }]}>
      <View style={[styles.metricIcon, { backgroundColor: `${metric.tone}1f` }]}>
        <Icon color={metric.tone} size={18} strokeWidth={2.5} />
      </View>
      <Text style={styles.metricValue}>{metric.value}</Text>
      <Text style={styles.metricLabel}>{metric.label}</Text>
      <Text style={styles.metricMeta}>{metric.meta}</Text>
    </View>
  );
};

const InsightCard = ({
  cardColor,
  icon: Icon,
  label,
  meta,
  tone,
  value
}: {
  cardColor: string;
  icon: typeof ReceiptText;
  label: string;
  meta: string;
  tone: string;
  value: string;
}) => (
  <View style={[styles.insightCard, { backgroundColor: cardColor }]}>
    <View style={[styles.insightIcon, { backgroundColor: `${tone}1f` }]}>
      <Icon color={tone} size={18} strokeWidth={2.5} />
    </View>
    <Text style={styles.insightLabel}>{label}</Text>
    <Text numberOfLines={1} style={styles.insightValue}>
      {value}
    </Text>
    <Text numberOfLines={1} style={styles.insightMeta}>
      {meta}
    </Text>
  </View>
);

const CategoryRow = ({
  accentColor,
  accentSoft,
  amount,
  label,
  maxAmount,
  rank
}: {
  accentColor: string;
  accentSoft: string;
  amount: number;
  label: string;
  maxAmount: number;
  rank: number;
}) => {
  const width = `${Math.max(8, Math.round((amount / maxAmount) * 100))}%` as DimensionValue;

  return (
    <View style={styles.categoryRow}>
      <View style={styles.categoryTopLine}>
        <View style={styles.categoryNameWrap}>
          <Text style={[styles.categoryRank, { backgroundColor: accentSoft, color: accentColor }]}>
            {rank}
          </Text>
          <Text numberOfLines={1} style={styles.categoryName}>
            {label}
          </Text>
        </View>
        <Text style={styles.categoryAmount}>{formatCurrency(amount)}</Text>
      </View>
      <View style={styles.categoryTrack}>
        <View style={[styles.categoryFill, { backgroundColor: accentColor, width }]} />
      </View>
    </View>
  );
};

const InsightsEmptyState = ({
  accentColor,
  monthTitle
}: {
  accentColor: string;
  monthTitle: string;
}) => (
  <PremiumEmptyState
    icon={ReceiptText}
    message={`${monthTitle} has no imported transactions. Import a statement to unlock insights.`}
    title="No recap yet"
    tone={accentColor}
  />
);

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  returnButton: {
    minHeight: 38,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md
  },
  returnText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17
  },
  content: {
    gap: spacing.md,
    paddingBottom: 116
  },
  monthControlRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  monthArrow: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: colors.surface
  },
  monthCopy: {
    alignItems: "center"
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    textTransform: "uppercase"
  },
  monthTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26
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
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 27,
    backgroundColor: colors.accentSoft
  },
  heroCopy: {
    minWidth: 0,
    flex: 1
  },
  heroAmount: {
    color: colors.textPrimary,
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 42
  },
  heroMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  chartCard: {
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: "rgba(5, 8, 13, 0.34)",
    padding: spacing.md
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  chartTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  chartMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15
  },
  dailyBars: {
    height: 64,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2
  },
  dailyBarSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  dailyBar: {
    width: "70%",
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.1)"
  },
  dailyBarActive: {
    backgroundColor: colors.accent
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  metricCard: {
    minHeight: 126,
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(17, 25, 35, 0.82)",
    padding: spacing.md
  },
  metricIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    marginBottom: spacing.sm
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    marginTop: 2
  },
  metricMeta: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 14,
    marginTop: spacing.xs
  },
  insightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  insightCard: {
    width: "48.7%",
    minHeight: 132,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(17, 25, 35, 0.82)",
    padding: spacing.md
  },
  insightIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    marginBottom: spacing.sm
  },
  insightLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 14,
    textTransform: "uppercase"
  },
  insightValue: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 23,
    marginTop: spacing.xs
  },
  insightMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
    marginTop: spacing.xs
  },
  leaderboardCard: {
    gap: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(17, 25, 35, 0.82)",
    padding: spacing.lg
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
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
    fontWeight: "800",
    lineHeight: 15
  },
  categoryList: {
    gap: spacing.md
  },
  categoryRow: {
    gap: spacing.sm
  },
  categoryTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  categoryNameWrap: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  categoryRank: {
    width: 24,
    height: 24,
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 24,
    textAlign: "center"
  },
  categoryName: {
    minWidth: 0,
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  categoryAmount: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17
  },
  categoryTrack: {
    height: 7,
    overflow: "hidden",
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)"
  },
  categoryFill: {
    height: "100%",
    borderRadius: 6,
    backgroundColor: colors.accent
  },
  noticeCard: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md
  },
  noticeText: {
    minWidth: 0,
    flex: 1,
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17
  },
  shareButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.accent
  },
  shareButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  emptyState: {
    minHeight: 360,
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
    maxWidth: 260,
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
