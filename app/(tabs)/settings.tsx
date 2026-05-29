import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import {
  Bell,
  ChartNoAxesColumn,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  Landmark,
  LockKeyhole,
  LogOut,
  type LucideIcon,
  Palette,
  ShieldAlert,
  Trash2,
  UploadCloud,
  UsersRound
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAccountsStore } from "@/features/accounts/account-store";
import { authService } from "@/features/auth/auth-service";
import { useAuth } from "@/features/auth/auth-provider";
import {
  getSavedImportBatches,
  type SavedImportBatch
} from "@/features/import/import-save-service";
import {
  getAccentOption,
  getAppIconOption,
  getThemePalette,
  getThemeOption,
  useAppearanceSettingsStore
} from "@/features/settings/appearance-store";
import {
  getProfileDisplayEmail,
  getProfileDisplayName,
  getProfileInitials,
  isProfileForEmail,
  syncProfileFromRemote,
  useProfileSettingsStore
} from "@/features/settings/profile-store";
import {
  formatCurrency,
  isSpendTransaction,
  type Transaction,
  useTransactionLedgerStore,
  useLedgerTransactions
} from "@/features/transactions/transaction-ledger";
import { withReturnTo } from "@/navigation/return-target";
import { importHistoryService } from "@/services/supabase/import-history-service";
import { profileService } from "@/services/supabase/profile-service";
import { colors, radii, spacing } from "@/styles/theme";

type SettingRowProps = {
  color: string;
  icon: LucideIcon;
  route?: Href;
  subtitle: string;
  title: string;
};

type SettingsImportSummary = {
  fileName: string;
  rows: number;
};

type ComingSoonFeature = {
  color: string;
  icon: LucideIcon;
  points: string[];
  subtitle: string;
  title: string;
};

const rows: SettingRowProps[] = [
  {
    color: "#16A34A",
    icon: Palette,
    route: "/appearance",
    subtitle: "Dark mode, accent color, app icon",
    title: "Appearance"
  },
  {
    color: "#2563EB",
    icon: Landmark,
    route: "/accounts",
    subtitle: "Connected banks and wallets",
    title: "Accounts"
  },
  {
    color: "#F97316",
    icon: Bell,
    subtitle: "Reminders, recaps, and alerts",
    title: "Notifications"
  },
  {
    color: "#A855F7",
    icon: LockKeyhole,
    subtitle: "Face ID, auto-lock, data controls",
    title: "Privacy & Security"
  },
  {
    color: "#D99A10",
    icon: UploadCloud,
    route: "/data-import",
    subtitle: "Import history, auto-merge, parsing",
    title: "Data & Import"
  },
  {
    color: "#C344E6",
    icon: UsersRound,
    route: "/groups",
    subtitle: "Groups, people, and connections",
    title: "Groups & Friends"
  },
  {
    color: colors.accentStrong,
    icon: ChartNoAxesColumn,
    route: "/insights",
    subtitle: "Preferences, alerts, budget tracking",
    title: "Insights"
  },
  {
    color: "#2563EB",
    icon: CircleHelp,
    subtitle: "Help center, feedback, rate app",
    title: "Support"
  }
];

const comingSoonFeatures: Record<string, ComingSoonFeature> = {
  "Notifications": {
    color: "#F97316",
    icon: Bell,
    points: [
      "Import reminders and monthly recap alerts",
      "Split follow-ups after shared expenses",
      "Real-time bank transaction nudges in Part 2"
    ],
    subtitle: "Reminders, recaps, and alerts",
    title: "Notifications"
  },
  "Privacy & Security": {
    color: "#A855F7",
    icon: LockKeyhole,
    points: [
      "App lock and biometric prompts",
      "Data retention controls for imports and exports",
      "Sensitive account and statement protection"
    ],
    subtitle: "Face ID, auto-lock, data controls",
    title: "Privacy & Security"
  },
  "Support": {
    color: "#2563EB",
    icon: CircleHelp,
    points: [
      "Help center for imports, splits, and settlements",
      "Feedback and bug report shortcuts",
      "App review and release support"
    ],
    subtitle: "Help center, feedback, rate app",
    title: "Support"
  }
};

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const getLatestTransactionMonthKey = (transactions: Array<{ date: string }>) => {
  const latestTransaction = [...transactions].sort((a, b) => b.date.localeCompare(a.date))[0];

  return latestTransaction ? latestTransaction.date.slice(0, 7) : getCurrentMonthKey();
};

const getPreviousMonthKey = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  const previousMonth = new Date(year, month - 2, 1);

  return `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, "0")}`;
};

const getMonthSpend = (transactions: ReturnType<typeof useLedgerTransactions>, monthKey: string) =>
  transactions
    .filter(
      (transaction) =>
        transaction.date.startsWith(monthKey) && isSpendTransaction(transaction)
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);

const getMonthComparison = ({
  currentSpend,
  previousSpend
}: {
  currentSpend: number;
  previousSpend: number;
}) => {
  if (previousSpend <= 0 && currentSpend <= 0) {
    return { label: "No data", value: "0%" };
  }

  if (previousSpend <= 0) {
    return { label: "new month", value: "New" };
  }

  const change = ((currentSpend - previousSpend) / previousSpend) * 100;
  const roundedChange = Math.round(Math.abs(change));

  return {
    label: change >= 0 ? "vs last month" : "less than last month",
    value: `${change >= 0 ? "+" : "-"}${roundedChange}%`
  };
};

const toTitleName = (value: string) =>
  value
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");

const getProfileName = (email: string, metadataName?: unknown) => {
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  const localPart = email.split("@")[0] ?? "";
  return toTitleName(localPart) || "User";
};

const csvColumns = [
  "date",
  "merchant",
  "amount",
  "kind",
  "classification",
  "category",
  "account",
  "description",
  "split_connection",
  "import_batch_id",
  "transaction_id"
] as const;

const escapeCsvValue = (value: string | number | null | undefined) => {
  const text = value == null ? "" : String(value);

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const getExportAmount = (transaction: Transaction) =>
  isSpendTransaction(transaction) ? -Math.abs(transaction.amount) : Math.abs(transaction.amount);

const buildTransactionsCsv = (transactions: Transaction[]) => {
  const rows = transactions.map((transaction) => [
    transaction.date,
    transaction.merchant,
    getExportAmount(transaction).toFixed(2),
    transaction.kind,
    transaction.classification,
    transaction.category,
    transaction.account,
    transaction.description,
    transaction.splitConnection,
    transaction.importBatchId,
    transaction.id
  ]);

  return [
    csvColumns.join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(","))
  ].join("\n");
};

const downloadCsv = async ({
  csv,
  fileName
}: {
  csv: string;
  fileName: string;
}) => {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return;
  }

  await Share.share({
    message: csv,
    title: fileName
  });
};

export default function SettingsScreen() {
  const router = useRouter();
  const { isConfigured, isLoading: isAuthLoading, user } = useAuth();
  const accounts = useAccountsStore((state) => state.accounts);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const ledgerTransactions = useLedgerTransactions();
  const remoteTransactionsLoaded = useTransactionLedgerStore((state) => state.remoteHasLoaded);
  const appearance = useAppearanceSettingsStore((state) => state.appearance);
  const loadAppearance = useAppearanceSettingsStore((state) => state.loadAppearance);
  const profile = useProfileSettingsStore((state) => state.profile);
  const hydrateProfile = useProfileSettingsStore((state) => state.hydrateProfile);
  const loadProfile = useProfileSettingsStore((state) => state.loadProfile);
  const [importBatches, setImportBatches] = useState<SettingsImportSummary[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingImports, setIsLoadingImports] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notice, setNotice] = useState("");
  const [comingSoonFeature, setComingSoonFeature] = useState<ComingSoonFeature | null>(null);

  useEffect(() => {
    void loadAccounts();
    void loadAppearance();
    void loadProfile(user?.id);
  }, [loadAccounts, loadAppearance, loadProfile, user?.id]);

  useEffect(() => {
    if (!user?.id || !user.email) {
      return;
    }

    let isMounted = true;

    profileService
      .getProfile(user.id)
      .then((remoteProfile) => {
        if (!isMounted) {
          return;
        }

        return hydrateProfile(
          syncProfileFromRemote({
            authEmail: user.email ?? "",
            currentProfile: useProfileSettingsStore.getState().profile,
            remoteProfile
          })
        );
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [hydrateProfile, user?.email, user?.id]);

  useEffect(() => {
    let isMounted = true;

    if (isAuthLoading) {
      return () => {
        isMounted = false;
      };
    }

    const loadImportSummary = async () => {
      if (user) {
        const remoteItems = await importHistoryService.listForUser(user.id);

        return remoteItems.map((item) => ({
          fileName: item.fileName,
          rows: item.importedRows
        }));
      }

      const localItems: SavedImportBatch[] = await getSavedImportBatches();

      return localItems.map((item) => ({
        fileName: item.fileName,
        rows: item.transactions.length
      }));
    };

    loadImportSummary()
      .then((batches) => {
        if (isMounted) {
          setImportBatches(batches);
        }
      })
      .catch(() => {
        if (isMounted) {
          setImportBatches([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingImports(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthLoading, user?.id]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = setTimeout(() => setNotice(""), 3600);

    return () => clearTimeout(timeout);
  }, [notice]);

  const fallbackEmail = user?.email ?? "";
  const fallbackProfileName = getProfileName(fallbackEmail, user?.user_metadata?.full_name);
  const profileMatchesUser = isProfileForEmail(profile, fallbackEmail);
  const displayProfile = profileMatchesUser
    ? profile
    : {
        ...profile,
        email: "",
        firstName: "",
        fullName: "",
        lastName: "",
        phone: ""
      };
  const profileEmail = getProfileDisplayEmail(displayProfile, fallbackEmail);
  const profileName = getProfileDisplayName(displayProfile, fallbackProfileName);
  const profileInitials = getProfileInitials(profileName);
  const appearanceAccent = useMemo(
    () => getAccentOption(appearance.accent),
    [appearance.accent]
  );
  const appearanceTheme = useMemo(
    () => getThemeOption(appearance.theme),
    [appearance.theme]
  );
  const appearancePalette = useMemo(
    () => getThemePalette(appearance.theme),
    [appearance.theme]
  );
  const appearanceIcon = useMemo(
    () => getAppIconOption(appearance.appIcon),
    [appearance.appIcon]
  );
  const settingsRows = useMemo(
    () =>
      rows.map((row) =>
        row.title === "Appearance"
          ? {
              ...row,
              color: appearanceAccent.color,
              subtitle: `${appearanceAccent.label} accent, ${appearanceTheme.label}, ${appearanceIcon.label} icon`
            }
          : row.title === "Insights"
            ? {
                ...row,
                color: appearanceAccent.color
              }
            : row
      ),
    [
      appearanceAccent.color,
      appearanceAccent.label,
      appearanceIcon.label,
      appearanceTheme.label
    ]
  );
  const monthKey = useMemo(() => {
    const currentMonthKey = getCurrentMonthKey();
    const spendTransactions = ledgerTransactions.filter(isSpendTransaction);
    const currentMonthHasSpend = spendTransactions.some((transaction) =>
      transaction.date.startsWith(currentMonthKey)
    );

    return currentMonthHasSpend
      ? currentMonthKey
      : getLatestTransactionMonthKey(spendTransactions);
  }, [ledgerTransactions]);
  const monthTransactions = useMemo(
    () =>
      ledgerTransactions.filter(
        (transaction) =>
          transaction.date.startsWith(monthKey) && isSpendTransaction(transaction)
      ),
    [ledgerTransactions, monthKey]
  );
  const monthSpent = useMemo(
    () => monthTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    [monthTransactions]
  );
  const monthComparison = useMemo(
    () =>
      getMonthComparison({
        currentSpend: monthSpent,
        previousSpend: getMonthSpend(ledgerTransactions, getPreviousMonthKey(monthKey))
      }),
    [ledgerTransactions, monthKey, monthSpent]
  );
  const totalImportedTransactions = useMemo(
    () =>
      importBatches.reduce((sum, batch) => sum + batch.rows, 0),
    [importBatches]
  );
  const latestImport = importBatches[0] ?? null;
  const exportLedgerReady = user ? remoteTransactionsLoaded : true;

  const openComingSoon = (featureName: string) => {
    const feature = comingSoonFeatures[featureName];

    if (feature) {
      setComingSoonFeature(feature);
      setNotice("");
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      if (user && isConfigured) {
        await authService.signOut();
      }

      router.replace("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDangerZone = () => {
    setNotice("Danger Zone is protected for Part 2 so data cannot be deleted by accident.");
  };

  const handleExportData = async () => {
    if (isExporting) {
      return;
    }

    if (!exportLedgerReady) {
      setNotice("Transactions are still loading. Try exporting again in a moment.");
      return;
    }

    if (ledgerTransactions.length === 0) {
      setNotice("No transactions are available to export yet. Import a statement first.");
      return;
    }

    setIsExporting(true);

    try {
      const csv = buildTransactionsCsv(ledgerTransactions);
      const dateStamp = new Date().toISOString().slice(0, 10);

      await downloadCsv({
        csv,
        fileName: `moneytimeline-transactions-${dateStamp}.csv`
      });
      setNotice(`Exported ${ledgerTransactions.length} transactions to CSV.`);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Could not export CSV: ${error.message}`
          : "Could not export CSV. Please try again."
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <LinearGradient colors={appearancePalette.gradient} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <PhoneStatus />
          <Text style={styles.title}>Settings</Text>

          <View style={[styles.profileCard, { backgroundColor: appearancePalette.cardStrong }]}>
            <View style={styles.profileTop}>
              <LinearGradient
                colors={[appearanceAccent.color, appearanceAccent.strong]}
                style={styles.avatarRing}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{profileInitials}</Text>
                </View>
              </LinearGradient>

              <View style={styles.profileText}>
                <Text style={styles.profileName}>{profileName}</Text>
                <Text numberOfLines={1} style={styles.profileEmail}>
                  {profileEmail}
                </Text>
              </View>

              <Pressable
                accessibilityLabel="Edit profile"
                accessibilityRole="button"
                onPress={() => router.push(withReturnTo("/profile", "settings"))}
                style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
              >
                <Text style={styles.editText}>Edit Profile</Text>
              </Pressable>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.monthRow}>
              <View>
                <Text style={styles.monthLabel}>This month</Text>
                <Text style={styles.monthValue}>{formatCurrency(monthSpent)} <Text style={styles.monthSmall}>spent</Text></Text>
              </View>
              <Sparkline color={appearanceAccent.color} />
              <View style={styles.percentBlock}>
                <Text style={[styles.percent, { color: appearanceAccent.color }]}>
                  {monthComparison.value}
                </Text>
                <Text style={styles.percentSub}>{monthComparison.label}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.rowsCard, { backgroundColor: appearancePalette.card }]}>
            {settingsRows.map((row, index) => {
              const route = row.route;

              return (
                <SettingRow
                  key={row.title}
                  {...row}
                  isLast={index === rows.length - 1}
                  onPress={
                    route
                      ? () => router.push(withReturnTo(String(route), "settings"))
                      : () => openComingSoon(row.title)
                  }
                />
              );
            })}
          </View>

          {notice ? (
            <View
              style={[
                styles.noticeBanner,
                {
                  backgroundColor: appearanceAccent.soft,
                  borderColor: `${appearanceAccent.color}33`
                }
              ]}
            >
              <ShieldAlert color={appearanceAccent.color} size={17} strokeWidth={2.5} />
              <Text style={[styles.noticeText, { color: appearanceAccent.color }]}>{notice}</Text>
            </View>
          ) : null}

          <View style={styles.dataSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Data workspace</Text>
              <Text style={[styles.sectionMeta, { color: appearanceAccent.color }]}>
                {accounts.length} accounts
              </Text>
            </View>

            <View style={styles.dataGrid}>
              <DataActionCard
                accent="#7FA7FF"
                icon={Clock3}
                meta={
                  latestImport
                    ? `${latestImport.fileName} - ${latestImport.rows} rows`
                    : isLoadingImports
                      ? "Checking saved imports"
                      : "No statements imported yet"
                }
                onPress={() => router.push(withReturnTo("/data-import", "settings"))}
                title="Import history"
                value={`${importBatches.length} statements`}
              />
              <DataActionCard
                accent={appearanceAccent.color}
                icon={Download}
                meta={
                  !exportLedgerReady
                    ? "Preparing transaction data"
                    : ledgerTransactions.length > 0
                    ? `${ledgerTransactions.length} transactions ready`
                    : "Import transactions first"
                }
                disabled={isExporting || !exportLedgerReady}
                onPress={handleExportData}
                title="Export data"
                value={isExporting ? "Preparing" : !exportLedgerReady ? "Loading" : "CSV export"}
              />
            </View>
          </View>

          <Pressable
            accessibilityLabel="Log out"
            accessibilityRole="button"
            disabled={isLoggingOut}
            onPress={handleLogout}
            style={({ pressed }) => [styles.logoutRow, pressed && styles.pressed]}
          >
            <View style={[styles.rowIcon, styles.logoutIcon]}>
              <LogOut color={colors.textPrimary} size={20} strokeWidth={2.5} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.logoutTitle}>{isLoggingOut ? "Logging out" : "Logout"}</Text>
              <Text style={styles.rowSubtitle}>Return to the secure sign-in screen</Text>
            </View>
            <ChevronRight color={colors.textSecondary} size={20} />
          </Pressable>

          <Pressable
            accessibilityLabel="Danger Zone"
            accessibilityRole="button"
            onPress={handleDangerZone}
            style={({ pressed }) => [styles.dangerRow, pressed && styles.pressed]}
          >
            <View style={[styles.rowIcon, styles.dangerIcon]}>
              <Trash2 color="#FF4F4F" size={21} strokeWidth={2.4} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.dangerTitle}>Danger Zone</Text>
              <Text style={styles.rowSubtitle}>Delete data, reset or delete account</Text>
            </View>
            <ChevronRight color={colors.textSecondary} size={20} />
          </Pressable>
        </ScrollView>
        <ComingSoonSheet
          feature={comingSoonFeature}
          onClose={() => setComingSoonFeature(null)}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const PhoneStatus = () => (
  <View style={styles.statusBar}>
    <Text style={styles.statusTime}>9:41</Text>
    <View style={styles.statusRight}>
      <View style={styles.signalBars}>
        <View style={[styles.signalBar, { height: 7 }]} />
        <View style={[styles.signalBar, { height: 10 }]} />
        <View style={[styles.signalBar, { height: 13 }]} />
      </View>
      <View style={styles.wifi} />
      <View style={styles.battery}>
        <View style={styles.batteryFill} />
      </View>
    </View>
  </View>
);

const SettingRow = ({
  color,
  icon: Icon,
  isLast,
  onPress,
  subtitle,
  title
}: SettingRowProps & { isLast?: boolean; onPress?: () => void }) => (
  <Pressable
    accessibilityLabel={title}
    accessibilityRole="button"
    disabled={!onPress}
    onPress={onPress}
    style={({ pressed }) => [styles.row, isLast && styles.rowLast, pressed && styles.pressed]}
  >
    <View style={[styles.rowIcon, { backgroundColor: `${color}24` }]}>
      <Icon color={color} size={22} strokeWidth={2.5} />
    </View>
    <View style={styles.rowText}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowSubtitle}>{subtitle}</Text>
    </View>
    <ChevronRight color={colors.textSecondary} size={20} />
  </Pressable>
);

const ComingSoonSheet = ({
  feature,
  onClose
}: {
  feature: ComingSoonFeature | null;
  onClose: () => void;
}) => {
  if (!feature) {
    return null;
  }

  const Icon = feature.icon;

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={styles.sheetOverlay}>
        <View style={styles.sheetCard}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={[styles.sheetIcon, { backgroundColor: `${feature.color}22` }]}>
              <Icon color={feature.color} size={25} strokeWidth={2.5} />
            </View>
            <View style={styles.sheetTitleWrap}>
              <Text style={[styles.sheetEyebrow, { color: feature.color }]}>Part 2</Text>
              <Text style={styles.sheetTitle}>{feature.title}</Text>
              <Text style={styles.sheetSubtitle}>{feature.subtitle}</Text>
            </View>
          </View>

          <View style={styles.sheetPointList}>
            {feature.points.map((point) => (
              <View key={point} style={styles.sheetPoint}>
                <View style={[styles.sheetPointDot, { backgroundColor: feature.color }]} />
                <Text style={styles.sheetPointText}>{point}</Text>
              </View>
            ))}
          </View>

          <Pressable
            accessibilityLabel={`Close ${feature.title} info`}
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.sheetButton,
              { backgroundColor: feature.color },
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.sheetButtonText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const DataActionCard = ({
  accent,
  disabled = false,
  icon: Icon,
  meta,
  onPress,
  title,
  value
}: {
  accent: string;
  disabled?: boolean;
  icon: typeof Palette;
  meta: string;
  onPress: () => void;
  title: string;
  value: string;
}) => (
  <Pressable
    accessibilityLabel={title}
    accessibilityRole="button"
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.dataCard, disabled && styles.disabledCard, pressed && styles.pressed]}
  >
    <View style={[styles.dataIcon, { backgroundColor: `${accent}22` }]}>
      <Icon color={accent} size={21} strokeWidth={2.5} />
    </View>
    <View style={styles.dataCopy}>
      <Text style={styles.dataTitle}>{title}</Text>
      <Text style={styles.dataValue}>{value}</Text>
      <Text numberOfLines={2} style={styles.dataMeta}>
        {meta}
      </Text>
    </View>
  </Pressable>
);

const Sparkline = ({ color }: { color: string }) => (
  <View style={styles.sparkline}>
    <View style={[styles.sparkSegment, styles.sparkOne, { backgroundColor: color }]} />
    <View style={[styles.sparkSegment, styles.sparkTwo, { backgroundColor: color }]} />
    <View style={[styles.sparkSegment, styles.sparkThree, { backgroundColor: color }]} />
    <View style={[styles.sparkSegment, styles.sparkFour, { backgroundColor: color }]} />
    <View style={[styles.sparkSegment, styles.sparkFive, { backgroundColor: color }]} />
    <View style={[styles.sparkSegment, styles.sparkSix, { backgroundColor: color }]} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  safeArea: {
    flex: 1
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 118
  },
  statusBar: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs
  },
  statusTime: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800"
  },
  statusRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  signalBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2
  },
  signalBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.textPrimary
  },
  wifi: {
    width: 13,
    height: 13,
    borderTopWidth: 3,
    borderColor: colors.textPrimary,
    borderRadius: 7
  },
  battery: {
    width: 24,
    height: 12,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: 3,
    padding: 2
  },
  batteryFill: {
    flex: 1,
    borderRadius: 2,
    backgroundColor: colors.textPrimary
  },
  title: {
    color: colors.textPrimary,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 34,
    marginTop: spacing.lg,
    marginBottom: spacing.md
  },
  profileCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(14, 21, 31, 0.88)",
    padding: spacing.md
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  avatarRing: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28
  },
  avatar: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "#172231"
  },
  avatarText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "900"
  },
  profileText: {
    minWidth: 0,
    flex: 1
  },
  profileName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22
  },
  profileEmail: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17
  },
  editButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  editText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "700"
  },
  cardDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: spacing.sm
  },
  monthRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  monthLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17
  },
  monthValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 23
  },
  monthSmall: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "500"
  },
  sparkline: {
    height: 54,
    flex: 1,
    position: "relative"
  },
  sparkSegment: {
    position: "absolute",
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent
  },
  sparkOne: {
    left: 2,
    top: 42,
    width: 20,
    transform: [{ rotate: "-18deg" }]
  },
  sparkTwo: {
    left: 19,
    top: 37,
    width: 20,
    transform: [{ rotate: "12deg" }]
  },
  sparkThree: {
    left: 36,
    top: 36,
    width: 23,
    transform: [{ rotate: "-22deg" }]
  },
  sparkFour: {
    left: 56,
    top: 29,
    width: 20,
    transform: [{ rotate: "13deg" }]
  },
  sparkFive: {
    left: 73,
    top: 26,
    width: 24,
    transform: [{ rotate: "-28deg" }]
  },
  sparkSix: {
    left: 92,
    top: 17,
    width: 24,
    transform: [{ rotate: "-12deg" }]
  },
  percentBlock: {
    width: 52
  },
  percent: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21
  },
  percentSub: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 13
  },
  rowsCard: {
    overflow: "hidden",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(14, 21, 31, 0.82)",
    marginTop: spacing.sm
  },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.07)",
    paddingHorizontal: spacing.md,
    paddingVertical: 4
  },
  rowLast: {
    borderBottomWidth: 0
  },
  rowIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16
  },
  rowText: {
    minWidth: 0,
    flex: 1
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17
  },
  rowSubtitle: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 15
  },
  noticeBanner: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.2)",
    backgroundColor: colors.accentSoft,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  noticeText: {
    minWidth: 0,
    flex: 1,
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16
  },
  dataSection: {
    marginTop: spacing.md
  },
  sectionHeader: {
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  sectionMeta: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16
  },
  dataGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    padding: spacing.md
  },
  sheetCard: {
    gap: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(17, 25, 35, 0.98)",
    padding: spacing.md
  },
  sheetHandle: {
    width: 42,
    height: 4,
    alignSelf: "center",
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 255, 255, 0.16)"
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  sheetIcon: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 25
  },
  sheetTitleWrap: {
    minWidth: 0,
    flex: 1
  },
  sheetEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    textTransform: "uppercase"
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26
  },
  sheetSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  sheetPointList: {
    gap: spacing.sm
  },
  sheetPoint: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    paddingHorizontal: spacing.md
  },
  sheetPointDot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  sheetPointText: {
    minWidth: 0,
    flex: 1,
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  sheetButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg
  },
  sheetButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  dataCard: {
    minHeight: 132,
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(14, 21, 31, 0.82)",
    padding: spacing.md
  },
  disabledCard: {
    opacity: 0.6
  },
  dataIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    marginBottom: spacing.md
  },
  dataCopy: {
    minWidth: 0,
    flex: 1
  },
  dataTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17
  },
  dataValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
    marginTop: 2
  },
  dataMeta: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 14,
    marginTop: spacing.xs
  },
  logoutRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  logoutIcon: {
    backgroundColor: "rgba(255, 255, 255, 0.08)"
  },
  logoutTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  dangerRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 79, 79, 0.2)",
    backgroundColor: "rgba(255, 79, 79, 0.1)",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  dangerIcon: {
    backgroundColor: "rgba(255, 79, 79, 0.14)"
  },
  dangerTitle: {
    color: "#FF4F4F",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }]
  }
});
