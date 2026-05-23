import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Coffee,
  CreditCard,
  MoreHorizontal,
  RotateCcw,
  ShoppingBag,
  UserRound,
  UsersRound
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
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
  classificationLabel,
  formatCurrency,
  formatSpendAmount,
  formatTransactionAmount,
  getTransactionKey,
  isSpendTransaction,
  transactionKindLabel,
  useLedgerTransactions,
  useTransactionLedgerStore,
  type Classification,
  type Transaction,
  type TransactionKind
} from "@/features/transactions/transaction-ledger";
import { colors, radii, spacing } from "@/styles/theme";

type CalendarDay = {
  date: Date;
  inMonth: boolean;
  key: string;
};

type UndoClassificationState = {
  createdAt: number;
  nextClassification: Classification;
  previousClassification: Classification;
  transaction: Transaction;
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

const getTransactionTone = (transaction: Transaction) =>
  isSpendTransaction(transaction)
    ? classificationColor[transaction.classification]
    : transactionKindColor[transaction.kind];

const dayCellHeight = 74;
const calendarColumnLines = Array.from(
  { length: 6 },
  (_, index) => `${((index + 1) / 7) * 100}%` as DimensionValue
);
const calendarRowLines = Array.from({ length: 5 }, (_, index) => (index + 1) * dayCellHeight);

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getDateFromKey = (key: string) => new Date(`${key}T12:00:00`);

const buildCalendarDays = (monthDate: Date): CalendarDay[] => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const leadingDays = firstDay.getDay();

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, index + 1 - leadingDays);

    return {
      date,
      inMonth: date.getMonth() === month,
      key: toDateKey(date)
    };
  });
};

export const CalendarHomeScreen = () => {
  const { accentColor, accentSoft, palette } = useAppearanceTheme();
  const ledgerTransactions = useLedgerTransactions();
  const updateTransaction = useTransactionLedgerStore((state) => state.updateTransaction);
  const [monthDate, setMonthDate] = useState(new Date(2026, 4, 1));
  const [selectedKey, setSelectedKey] = useState("2026-05-12");
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const [sharedReviewTransaction, setSharedReviewTransaction] = useState<Transaction | null>(null);
  const [undoState, setUndoState] = useState<UndoClassificationState | null>(null);

  useEffect(() => {
    if (!undoState) {
      return undefined;
    }

    const timeout = setTimeout(() => setUndoState(null), 3500);

    return () => clearTimeout(timeout);
  }, [undoState]);

  const calendarDays = useMemo(() => buildCalendarDays(monthDate), [monthDate]);
  const monthKey = `${monthDate.getFullYear()}-${`${monthDate.getMonth() + 1}`.padStart(2, "0")}`;
  const monthTransactions = useMemo(
    () => ledgerTransactions.filter((transaction) => transaction.date.startsWith(monthKey)),
    [ledgerTransactions, monthKey]
  );
  const transactionsByDate = useMemo(() => {
    return monthTransactions.reduce<Record<string, Transaction[]>>((acc, transaction) => {
      acc[transaction.date] = [...(acc[transaction.date] ?? []), transaction];
      return acc;
    }, {});
  }, [monthTransactions]);
  const totals = useMemo(
    () =>
      monthTransactions.reduce(
        (acc, transaction) => {
          if (!isSpendTransaction(transaction)) {
            return acc;
          }

          acc.total += transaction.amount;
          acc[transaction.classification] += transaction.amount;
          return acc;
        },
        { personal: 0, shared: 0, total: 0, unclassified: 0 }
      ),
    [monthTransactions]
  );

  const openDaySheet = (key: string) => {
    setSelectedKey(key);
    setSheetKey(key);
    setSharedReviewTransaction(null);
  };

  const changeMonth = (direction: -1 | 1) => {
    const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + direction, 1);
    setMonthDate(nextMonth);
    setSelectedKey(toDateKey(nextMonth));
    setSheetKey(null);
    setSharedReviewTransaction(null);
  };

  const moveSheetDay = (direction: -1 | 1) => {
    const baseDate = getDateFromKey(sheetKey ?? selectedKey);
    const nextDate = new Date(baseDate);
    nextDate.setDate(baseDate.getDate() + direction);
    const nextKey = toDateKey(nextDate);

    if (
      nextDate.getMonth() !== monthDate.getMonth() ||
      nextDate.getFullYear() !== monthDate.getFullYear()
    ) {
      setMonthDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    }

    setSelectedKey(nextKey);
    setSheetKey(nextKey);
    setSharedReviewTransaction(null);
  };

  const setTransactionClassification = (
    transaction: Transaction,
    nextClassification: Classification
  ) => {
    if (!isSpendTransaction(transaction)) {
      return;
    }

    if (nextClassification === "shared") {
      setSharedReviewTransaction({ ...transaction, classification: nextClassification });
    }

    if (transaction.classification === nextClassification) {
      return;
    }

    void updateTransaction(transaction.id, { classification: nextClassification });
    setUndoState({
      createdAt: Date.now(),
      nextClassification,
      previousClassification: transaction.classification,
      transaction
    });
  };

  const undoClassification = () => {
    if (!undoState) {
      return;
    }

    const key = getTransactionKey(undoState.transaction);
    void updateTransaction(undoState.transaction.id, {
      classification: undoState.previousClassification
    });

    if (
      sharedReviewTransaction &&
      getTransactionKey(sharedReviewTransaction) === key &&
      undoState.nextClassification === "shared"
    ) {
      setSharedReviewTransaction(null);
    }

    setUndoState(null);
  };

  return (
    <Screen>
      <View style={styles.root}>
        <AppTopBar />

        <MonthSnapshotCard
          accentColor={accentColor}
          accentSoft={accentSoft}
          cardColor={palette.cardStrong}
          transactionCount={monthTransactions.length}
          total={totals.total}
        />

        <View style={styles.metricRow}>
          <MetricTile
            cardColor={palette.card}
            color={colors.personal}
            label="Personal"
            value={formatCurrency(totals.personal, true)}
          />
          <MetricTile
            cardColor={palette.card}
            color={colors.shared}
            label="Shared"
            value={formatCurrency(totals.shared, true)}
          />
          <MetricTile
            cardColor={palette.card}
            color={colors.unclassified}
            label="Unclassified"
            value={formatCurrency(totals.unclassified, true)}
          />
        </View>

        <View style={styles.monthControlRow}>
          <View style={styles.monthTitleWrap}>
            <Text style={styles.monthTitle}>
              {monthNames[monthDate.getMonth()]} {monthDate.getFullYear()}
            </Text>
            <ChevronRight color={colors.textSecondary} size={16} />
          </View>
          <View style={styles.monthArrows}>
            <Pressable
              accessibilityLabel="Previous month"
              accessibilityRole="button"
              onPress={() => changeMonth(-1)}
              style={({ pressed }) => [styles.monthArrow, pressed && styles.pressed]}
            >
              <ChevronLeft color={colors.textSecondary} size={20} />
            </Pressable>
            <Pressable
              accessibilityLabel="Next month"
              accessibilityRole="button"
              onPress={() => changeMonth(1)}
              style={({ pressed }) => [styles.monthArrow, pressed && styles.pressed]}
            >
              <ChevronRight color={colors.textSecondary} size={20} />
            </Pressable>
          </View>
        </View>

        <MonthCalendarGrid
          accentColor={accentColor}
          accentSoft={accentSoft}
          calendarDays={calendarDays}
          onSelectDay={openDaySheet}
          selectedKey={selectedKey}
          transactionsByDate={transactionsByDate}
        />

        {sheetKey ? (
          <DayLedgerSheet
            accentColor={accentColor}
            accentSoft={accentSoft}
            dateKey={sheetKey}
            onClassifyTransaction={setTransactionClassification}
            onClose={() => {
              setSheetKey(null);
              setSharedReviewTransaction(null);
            }}
            onCloseSharedReview={() => setSharedReviewTransaction(null)}
            onMoveDay={moveSheetDay}
            sharedReviewTransaction={
              sharedReviewTransaction?.date === sheetKey ? sharedReviewTransaction : null
            }
            transactions={transactionsByDate[sheetKey] ?? []}
            surfaceColor={palette.cardStrong}
          />
        ) : null}

        {undoState ? (
          <ClassificationUndoToast
            accentColor={accentColor}
            accentSoft={accentSoft}
            onUndo={undoClassification}
            state={undoState}
          />
        ) : null}
      </View>
    </Screen>
  );
};

const MonthSnapshotCard = ({
  accentColor,
  accentSoft,
  cardColor,
  total,
  transactionCount
}: {
  accentColor: string;
  accentSoft: string;
  cardColor: string;
  total: number;
  transactionCount: number;
}) => (
  <LinearGradient
    colors={[accentSoft, cardColor]}
    style={[styles.snapshotCard, { borderColor: `${accentColor}33` }]}
  >
    <View>
      <Text style={[styles.snapshotLabel, { color: accentColor }]}>Total Spent</Text>
      <Text style={styles.snapshotValue}>{formatCurrency(total)}</Text>
      <Text style={styles.snapshotMeta}>{transactionCount} transactions this month</Text>
    </View>
    <View style={styles.snapshotChart}>
      {[28, 44, 27, 58, 38, 31, 45, 24, 41, 56, 34, 49].map((height, index) => (
        <View key={`${height}-${index}`} style={[styles.chartLine, { backgroundColor: accentColor, height }]} />
      ))}
    </View>
  </LinearGradient>
);

const MetricTile = ({
  cardColor,
  color,
  label,
  value
}: {
  cardColor: string;
  color: string;
  label: string;
  value: string;
}) => (
  <View style={[styles.metricTile, { backgroundColor: cardColor }]}>
    <View style={[styles.metricDot, { backgroundColor: color }]} />
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const MonthCalendarGrid = ({
  accentColor,
  accentSoft,
  calendarDays,
  onSelectDay,
  selectedKey,
  transactionsByDate
}: {
  accentColor: string;
  accentSoft: string;
  calendarDays: CalendarDay[];
  onSelectDay: (key: string) => void;
  selectedKey: string;
  transactionsByDate: Record<string, Transaction[]>;
}) => (
  <View style={styles.calendarGridWrap}>
    <View style={styles.weekdayRow}>
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
        <Text key={weekday} style={styles.weekdayText}>
          {weekday}
        </Text>
      ))}
    </View>
    <View style={styles.calendarGrid}>
      <CalendarGridLines />
      {calendarDays.map((day) => (
        <CalendarDayCell
          day={day}
          accentColor={accentColor}
          accentSoft={accentSoft}
          key={day.key}
          onPress={() => onSelectDay(day.key)}
          selected={day.key === selectedKey}
          transactions={transactionsByDate[day.key] ?? []}
        />
      ))}
    </View>
  </View>
);

const CalendarGridLines = () => (
  <View style={styles.calendarGridLines}>
    {calendarColumnLines.map((left) => (
      <View key={`column-${left}`} style={[styles.calendarVerticalLine, { left }]} />
    ))}
    {calendarRowLines.map((top) => (
      <View key={`row-${top}`} style={[styles.calendarHorizontalLine, { top }]} />
    ))}
  </View>
);

const CalendarDayCell = ({
  accentColor,
  accentSoft,
  day,
  onPress,
  selected,
  transactions: dayTransactions
}: {
  accentColor: string;
  accentSoft: string;
  day: CalendarDay;
  onPress: () => void;
  selected: boolean;
  transactions: Transaction[];
}) => {
  const dayTotal = dayTransactions
    .filter(isSpendTransaction)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return (
    <Pressable
      accessibilityLabel={`${day.date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "long"
      })}, ${dayTransactions.length} transactions`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.dayCell,
        selected && [styles.dayCellSelected, { backgroundColor: accentSoft }],
        !day.inMonth && styles.outsideMonth,
        pressed && styles.pressed
      ]}
    >
      <Text style={[styles.dayNumber, selected && { color: accentColor }]}>
        {day.date.getDate()}
      </Text>
      <View style={styles.dayCoinZone}>
        {dayTransactions.length > 0 ? (
          <TransactionCoinStack transactions={dayTransactions} />
        ) : null}
      </View>
      <View style={styles.dayAmountZone}>
        {dayTransactions.length > 0 ? (
          <View
            style={[
              styles.selectedAmountPill,
              selected && {
                borderColor: `${accentColor}66`,
                backgroundColor: accentColor
              }
            ]}
          >
            <Text style={[styles.selectedAmountText, selected && styles.selectedAmountTextActive]}>
              {formatCurrency(dayTotal, true)}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
};

const TransactionCoinStack = ({ transactions: stackTransactions }: { transactions: Transaction[] }) => {
  const visibleTransactions = stackTransactions.slice(0, 3);
  const [frontTransaction, secondTransaction, thirdTransaction] = visibleTransactions;

  if (!frontTransaction) {
    return null;
  }

  return (
    <View style={styles.coinStack}>
      {thirdTransaction ? (
        <View
          style={[
            styles.coinMoon,
            styles.coinMoonBack,
            { backgroundColor: getTransactionTone(thirdTransaction) }
          ]}
        />
      ) : null}
      {secondTransaction ? (
        <View
          style={[
            styles.coinMoon,
            thirdTransaction ? styles.coinMoonMiddle : styles.coinMoonSingle,
            { backgroundColor: getTransactionTone(secondTransaction) }
          ]}
        />
      ) : null}
      <View
        style={[
          styles.coinMain,
          { backgroundColor: getTransactionTone(frontTransaction) }
        ]}
      >
        <Text style={styles.merchantInitial}>{frontTransaction.merchant.charAt(0)}</Text>
      </View>
    </View>
  );
};

const DayLedgerSheet = ({
  accentColor,
  accentSoft,
  dateKey,
  onClassifyTransaction,
  onClose,
  onCloseSharedReview,
  onMoveDay,
  sharedReviewTransaction,
  surfaceColor,
  transactions: dayTransactions
}: {
  accentColor: string;
  accentSoft: string;
  dateKey: string;
  onClassifyTransaction: (transaction: Transaction, classification: Classification) => void;
  onClose: () => void;
  onCloseSharedReview: () => void;
  onMoveDay: (direction: -1 | 1) => void;
  sharedReviewTransaction: Transaction | null;
  surfaceColor: string;
  transactions: Transaction[];
}) => {
  const router = useRouter();
  const date = getDateFromKey(dateKey);
  const spendTotal = dayTransactions
    .filter(isSpendTransaction)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const sheetProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    sheetProgress.setValue(0);
    Animated.timing(sheetProgress, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true
    }).start();
  }, [dateKey, sheetProgress]);

  const sheetMotionStyle = {
    opacity: sheetProgress,
    transform: [
      {
        translateY: sheetProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [34, 0]
        })
      }
    ]
  };

  const classifyTransaction = (transaction: Transaction, classification: Classification) => {
    onClassifyTransaction(transaction, classification);

    if (classification === "shared") {
      onCloseSharedReview();
      router.push(`/transaction/${transaction.id}?split=1&returnTo=calendar`);
    }
  };

  const openTransactionDetail = (transaction: Transaction) => {
    router.push(`/transaction/${transaction.id}?returnTo=calendar`);
  };

  return (
    <View pointerEvents="box-none" style={styles.sheetOverlay}>
      <Pressable
        accessibilityLabel="Close day details"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.sheetScrim}
      />
      <Animated.View style={[styles.dayLedgerSheet, sheetMotionStyle]}>
        <LinearGradient
          colors={[surfaceColor, "rgba(8, 12, 18, 0.98)"]}
          style={[styles.dayLedgerSurface, { borderColor: `${accentColor}33` }]}
        >
          <Pressable
            accessibilityLabel="Close day details"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.sheetHandle}
          />

          <View style={styles.sheetDateNav}>
            <Pressable
              accessibilityLabel="Previous day"
              accessibilityRole="button"
              onPress={() => onMoveDay(-1)}
              style={({ pressed }) => [styles.sheetArrow, pressed && styles.pressed]}
            >
              <ChevronLeft color={colors.textPrimary} size={23} />
            </Pressable>

            <View style={styles.sheetDateCopy}>
              <Text style={styles.sheetDate}>
                {date.toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "long",
                  year: "numeric"
                })}
              </Text>
              <Text style={styles.sheetTotal}>
                {date.toLocaleDateString("en-US", { weekday: "long" })} - Total{" "}
                {formatCurrency(spendTotal)}
              </Text>
            </View>

            <Pressable
              accessibilityLabel="Next day"
              accessibilityRole="button"
              onPress={() => onMoveDay(1)}
              style={({ pressed }) => [styles.sheetArrow, pressed && styles.pressed]}
            >
              <ChevronRight color={colors.textPrimary} size={23} />
            </Pressable>
          </View>

          <View style={styles.sheetToolbar}>
            <View>
              <Text style={styles.sheetSectionTitle}>Daily ledger</Text>
              <Text style={styles.sheetCount}>{dayTransactions.length} transactions</Text>
            </View>
            <MoreHorizontal color={colors.textSecondary} size={24} />
          </View>

          {sharedReviewTransaction ? (
            <SharedSplitStarter
              onClose={onCloseSharedReview}
              transaction={sharedReviewTransaction}
            />
          ) : null}

          {sharedReviewTransaction ? null : (
            <ScrollView
              contentContainerStyle={styles.sheetList}
              showsVerticalScrollIndicator={false}
              style={styles.sheetListScroller}
            >
              {dayTransactions.length > 0 ? (
                dayTransactions.map((transaction) => (
                  <SheetTransactionRow
                    key={getTransactionKey(transaction)}
                    onClassify={(classification) => classifyTransaction(transaction, classification)}
                    onPress={() => openTransactionDetail(transaction)}
                    transaction={transaction}
                  />
                ))
              ) : (
                <PremiumEmptyState
                  icon={CalendarDays}
                  message="This day is clear in your money timeline. Move to another day to keep reviewing."
                  title="No transactions"
                  tone={colors.unclassified}
                />
              )}
            </ScrollView>
          )}

          <View style={styles.sheetFooter}>
            <Text style={styles.sheetCount}>{dayTransactions.length} transactions</Text>
            <Text style={styles.sheetFooterTotal}>{formatSpendAmount(spendTotal)}</Text>
          </View>

        </LinearGradient>
      </Animated.View>
    </View>
  );
};

const SharedSplitStarter = ({
  onClose,
  transaction
}: {
  onClose: () => void;
  transaction: Transaction;
}) => (
  <View style={styles.sharedStarter}>
    <View style={styles.sharedStarterHeader}>
      <View style={styles.sharedStarterTitleWrap}>
        <View style={styles.sharedStarterIcon}>
          <UsersRound color={colors.shared} size={18} strokeWidth={2.5} />
        </View>
        <View style={styles.sharedStarterCopy}>
          <Text style={styles.detailEyebrow}>Split expense</Text>
          <Text numberOfLines={1} style={styles.sharedStarterTitle}>
            {transaction.merchant}
          </Text>
        </View>
      </View>
            <Text style={styles.sharedStarterAmount}>{formatTransactionAmount(transaction)}</Text>
    </View>

    <View style={styles.splitModeRow}>
      <View style={[styles.splitModePill, styles.splitModePillInactive]}>
        <UserRound color={colors.textSecondary} size={14} strokeWidth={2.4} />
        <Text style={styles.splitModeText}>Individuals</Text>
      </View>
      <View style={[styles.splitModePill, styles.splitModePillActive]}>
        <UsersRound color={colors.shared} size={14} strokeWidth={2.4} />
        <Text style={styles.splitModeActiveText}>Group</Text>
      </View>
    </View>

    <View style={styles.suggestedSplitCard}>
      <View>
        <Text style={styles.suggestedSplitName}>Apartment Crew</Text>
        <Text style={styles.suggestedSplitMeta}>4 members - equal split ready</Text>
      </View>
      <Text style={styles.suggestedSplitAmount}>{formatSpendAmount(transaction.amount / 4)} each</Text>
    </View>

    <Pressable
      accessibilityLabel="Continue split setup"
      accessibilityRole="button"
      onPress={onClose}
      style={({ pressed }) => [styles.sharedStarterButton, pressed && styles.pressed]}
    >
      <Text style={styles.sharedStarterButtonText}>Continue</Text>
    </Pressable>
  </View>
);

const ClassificationUndoToast = ({
  accentColor,
  accentSoft,
  onUndo,
  state
}: {
  accentColor: string;
  accentSoft: string;
  onUndo: () => void;
  state: UndoClassificationState;
}) => {
  const tone = classificationColor[state.nextClassification];

  return (
    <View style={styles.undoToast}>
      <View style={[styles.undoIcon, { backgroundColor: `${tone}18` }]}>
        <RotateCcw color={tone} size={16} strokeWidth={2.6} />
      </View>
      <View style={styles.undoCopy}>
        <Text numberOfLines={1} style={styles.undoTitle}>
          Marked as {classificationLabel[state.nextClassification]}
        </Text>
        <Text numberOfLines={1} style={styles.undoMeta}>
          {state.transaction.merchant}
        </Text>
      </View>
      <Pressable
        accessibilityLabel="Undo classification"
        accessibilityRole="button"
        onPress={onUndo}
        style={({ pressed }) => [
          styles.undoButton,
          { backgroundColor: accentSoft },
          pressed && styles.pressed
        ]}
      >
        <Text style={[styles.undoButtonText, { color: accentColor }]}>Undo</Text>
      </Pressable>
    </View>
  );
};

const SwipeActionPanel = ({
  direction,
  label,
  tone
}: {
  direction: "left" | "right";
  label: string;
  tone: "personal" | "shared";
}) => {
  const Icon = tone === "personal" ? UserRound : UsersRound;
  const accent = tone === "personal" ? colors.personal : colors.shared;

  return (
    <View
      style={[
        styles.swipeActionPanel,
        direction === "left" ? styles.swipeActionLeft : styles.swipeActionRight,
        { backgroundColor: accent }
      ]}
    >
      <Icon color={colors.background} size={19} strokeWidth={2.5} />
      <View>
        <Text style={styles.swipeActionLabel}>{label}</Text>
        <Text style={styles.swipeActionMeta}>
          {tone === "personal" ? "For you only" : "Split with others"}
        </Text>
      </View>
    </View>
  );
};

const SheetTransactionRow = ({
  onClassify,
  onPress,
  transaction
}: {
  onClassify: (classification: Classification) => void;
  onPress: () => void;
  transaction: Transaction;
}) => {
  const isSpend = isSpendTransaction(transaction);
  const Icon = !isSpend ? CreditCard : transaction.category === "Coffee" ? Coffee : ShoppingBag;
  const tone = getTransactionTone(transaction);
  const badgeLabel = isSpend
    ? classificationLabel[transaction.classification]
    : transactionKindLabel[transaction.kind];
  const translateX = useRef(new Animated.Value(0)).current;
  const latestDragX = useRef(0);
  const actionOpacity = translateX.interpolate({
    extrapolate: "clamp",
    inputRange: [-16, 0, 16],
    outputRange: [1, 0, 1]
  });

  const resetSwipe = () => {
    latestDragX.current = 0;
    Animated.spring(translateX, {
      friction: 8,
      tension: 90,
      toValue: 0,
      useNativeDriver: true
    }).start();
  };

  const completeSwipe = (classification: Classification) => {
    onClassify(classification);
    resetSwipe();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        isSpend &&
        Math.abs(gestureState.dx) > 8 &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderMove: (_, gestureState) => {
        const clampedX = Math.max(-122, Math.min(122, gestureState.dx));
        latestDragX.current = clampedX;
        translateX.setValue(clampedX);
      },
      onPanResponderRelease: () => {
        if (latestDragX.current > 58) {
          completeSwipe("shared");
          return;
        }

        if (latestDragX.current < -58) {
          completeSwipe("personal");
          return;
        }

        resetSwipe();
      },
      onPanResponderTerminate: resetSwipe
    })
  ).current;

  return (
    <View style={styles.swipeContainer}>
      {isSpend ? (
        <Animated.View style={[styles.swipeActionLayer, { opacity: actionOpacity }]}>
          <SwipeActionPanel direction="left" label="Shared" tone="shared" />
          <SwipeActionPanel direction="right" label="Personal" tone="personal" />
        </Animated.View>
      ) : null}
      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX }] }}
      >
        <Pressable
          accessibilityLabel={`Open ${transaction.merchant} transaction detail`}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [
            styles.sheetTransactionRow,
            pressed && styles.pressed
          ]}
        >
          <View style={[styles.sheetTransactionIcon, { backgroundColor: `${tone}20` }]}>
            <Icon color={tone} size={19} strokeWidth={2.5} />
          </View>
          <View style={styles.sheetTransactionInfo}>
            <Text numberOfLines={1} style={styles.sheetMerchant}>
              {transaction.merchant}
            </Text>
            <Text numberOfLines={1} style={styles.sheetMeta}>
              {transaction.time} - {transaction.category} - {transaction.account}
            </Text>
          </View>
          <View style={styles.sheetAmountBlock}>
            <Text style={styles.sheetAmount}>{formatTransactionAmount(transaction)}</Text>
            <View style={[styles.sheetStatusPill, { backgroundColor: `${tone}16` }]}>
              <View style={[styles.sheetStatusDot, { backgroundColor: tone }]} />
              <Text style={[styles.sheetStatusText, { color: tone }]}>
                {badgeLabel}
              </Text>
            </View>
          </View>
          <ChevronRight color={colors.textMuted} size={18} />
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingBottom: 88
  },
  snapshotCard: {
    minHeight: 106,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.14)",
    padding: spacing.lg
  },
  snapshotLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  snapshotValue: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 38
  },
  snapshotMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17
  },
  snapshotChart: {
    width: 76,
    height: 58,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4
  },
  chartLine: {
    width: 2,
    borderRadius: 2,
    backgroundColor: colors.accent
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  metricTile: {
    minHeight: 72,
    flex: 1,
    justifyContent: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(17, 25, 35, 0.82)",
    padding: spacing.md
  },
  metricDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    fontWeight: "600",
    lineHeight: 15
  },
  monthControlRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md
  },
  monthTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  monthTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 24
  },
  monthArrows: {
    flexDirection: "row",
    gap: spacing.lg
  },
  monthArrow: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16
  },
  calendarGridWrap: {
    flex: 1,
    minHeight: 268
  },
  weekdayRow: {
    flexDirection: "row",
    marginTop: spacing.sm,
    marginBottom: spacing.sm
  },
  weekdayText: {
    width: "14.285%",
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
    textTransform: "uppercase"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    position: "relative"
  },
  calendarGridLines: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0
  },
  calendarVerticalLine: {
    position: "absolute",
    top: 4,
    bottom: 4,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.07)"
  },
  calendarHorizontalLine: {
    position: "absolute",
    right: 2,
    left: 2,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.045)"
  },
  dayCell: {
    width: "14.285%",
    height: dayCellHeight,
    alignItems: "center",
    borderRadius: 22,
    paddingTop: 3,
    paddingBottom: 3,
    overflow: "hidden",
    zIndex: 1
  },
  dayCellSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.08)"
  },
  outsideMonth: {
    opacity: 0.32
  },
  dayNumber: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18
  },
  daySelectedText: {
    color: colors.accent
  },
  dayCoinZone: {
    width: "100%",
    height: 31,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  coinStack: {
    width: 40,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  coinMoon: {
    position: "absolute",
    width: 19,
    height: 19,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4
  },
  coinMoonSingle: {
    right: 7,
    bottom: 0,
    zIndex: 1,
    opacity: 0.94
  },
  coinMoonBack: {
    right: 5,
    bottom: 0,
    zIndex: 1,
    opacity: 0.95
  },
  coinMoonMiddle: {
    left: 5,
    bottom: 3,
    zIndex: 2,
    opacity: 0.94
  },
  coinMain: {
    position: "absolute",
    top: 0,
    left: 9,
    zIndex: 3,
    width: 21,
    height: 21,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.34,
    shadowRadius: 8
  },
  dayAmountZone: {
    width: "100%",
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1
  },
  selectedAmountPill: {
    minWidth: 36,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    backgroundColor: "#445BD6",
    paddingHorizontal: 5
  },
  selectedAmountPillActive: {
    borderColor: "rgba(67, 216, 139, 0.32)",
    backgroundColor: "#445BD6"
  },
  selectedAmountText: {
    color: colors.textPrimary,
    fontSize: 8,
    fontWeight: "900",
    lineHeight: 10
  },
  selectedAmountTextActive: {
    color: colors.textPrimary
  },
  merchantInitial: {
    color: colors.textPrimary,
    fontSize: 9,
    fontWeight: "900",
    lineHeight: 11
  },
  sheetOverlay: {
    position: "absolute",
    top: 0,
    right: -spacing.lg,
    bottom: 0,
    left: -spacing.lg,
    zIndex: 20
  },
  sheetScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 4, 7, 0.58)"
  },
  dayLedgerSheet: {
    position: "absolute",
    right: spacing.md,
    bottom: 78,
    left: spacing.md,
    maxHeight: 506,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -18 },
    shadowOpacity: 0.4,
    shadowRadius: 28
  },
  dayLedgerSurface: {
    maxHeight: 506,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
    padding: spacing.md,
    position: "relative"
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.26)",
    marginBottom: spacing.md
  },
  sheetDateNav: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  sheetArrow: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.05)"
  },
  sheetDateCopy: {
    flex: 1,
    alignItems: "center"
  },
  sheetDate: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 24,
    textAlign: "center"
  },
  sheetTotal: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    textAlign: "center"
  },
  sheetToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    marginBottom: spacing.sm
  },
  sheetSectionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  sheetCount: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  detailEyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 13,
    textTransform: "uppercase"
  },
  sharedStarter: {
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(246, 166, 59, 0.24)",
    backgroundColor: "rgba(246, 166, 59, 0.08)",
    marginBottom: spacing.sm,
    padding: spacing.md
  },
  sharedStarterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  sharedStarterTitleWrap: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  sharedStarterIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(246, 166, 59, 0.16)"
  },
  sharedStarterCopy: {
    minWidth: 0,
    flex: 1
  },
  sharedStarterTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  sharedStarterAmount: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  splitModeRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  splitModePill: {
    minHeight: 34,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm
  },
  splitModePillInactive: {
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(5, 8, 13, 0.42)"
  },
  splitModePillActive: {
    borderColor: "rgba(246, 166, 59, 0.34)",
    backgroundColor: "rgba(246, 166, 59, 0.14)"
  },
  splitModeText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16
  },
  splitModeActiveText: {
    color: colors.shared,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16
  },
  suggestedSplitCard: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "rgba(5, 8, 13, 0.45)",
    paddingHorizontal: spacing.md
  },
  suggestedSplitName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  suggestedSplitMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  suggestedSplitAmount: {
    color: colors.shared,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15
  },
  sharedStarterButton: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.shared
  },
  sharedStarterButtonText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  sheetListScroller: {
    maxHeight: 252
  },
  sheetList: {
    gap: spacing.sm,
    paddingBottom: 1
  },
  swipeContainer: {
    borderRadius: radii.lg,
    overflow: "hidden"
  },
  swipeActionLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  swipeActionPanel: {
    minWidth: 122,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md
  },
  swipeActionLeft: {
    justifyContent: "flex-start"
  },
  swipeActionRight: {
    justifyContent: "flex-end"
  },
  swipeActionLabel: {
    color: colors.background,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  swipeActionMeta: {
    color: "rgba(5, 8, 13, 0.76)",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13
  },
  sheetTransactionRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "#0A1018",
    paddingHorizontal: spacing.md
  },
  sheetTransactionIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19
  },
  sheetTransactionInfo: {
    minWidth: 0,
    flex: 1
  },
  sheetMerchant: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  sheetMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16
  },
  sheetAmount: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  sheetAmountBlock: {
    minWidth: 72,
    alignItems: "flex-end",
    gap: 3
  },
  sheetStatusPill: {
    minHeight: 18,
    maxWidth: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radii.pill,
    paddingHorizontal: 6
  },
  sheetStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3
  },
  sheetStatusText: {
    fontSize: 9,
    fontWeight: "900",
    lineHeight: 12
  },
  emptySheet: {
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17
  },
  sheetFooter: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: spacing.sm
  },
  sheetFooterTotal: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  undoToast: {
    position: "absolute",
    right: spacing.md,
    bottom: 104,
    left: spacing.md,
    zIndex: 40,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(5, 8, 13, 0.94)",
    paddingHorizontal: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.34,
    shadowRadius: 18
  },
  undoIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16
  },
  undoCopy: {
    minWidth: 0,
    flex: 1
  },
  undoTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17
  },
  undoMeta: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 14
  },
  undoButton: {
    minHeight: 32,
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md
  },
  undoButtonText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }]
  }
});
