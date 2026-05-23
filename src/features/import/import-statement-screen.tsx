import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  UploadCloud,
  WalletCards,
  X
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PremiumEmptyState } from "@/components/ui/premium-empty-state";
import { Screen } from "@/components/ui/screen";
import { useAccountsStore, type MoneyAccount } from "@/features/accounts/account-store";
import { useAuth } from "@/features/auth/auth-provider";
import { useAppearanceTheme } from "@/features/settings/use-appearance-theme";
import { getSavedDuplicateHashes } from "@/features/import/import-save-service";
import { useImportSessionStore } from "@/features/import/import-session-store";
import {
  parseStatementFile,
  type StatementParseResult,
  type StatementParseSummary
} from "@/features/import/statement-parser";
import {
  getReturnTargetParam,
  getReturnTargetRoute,
  withReturnTo
} from "@/navigation/return-target";
import { uploadService } from "@/services/supabase/upload-service";
import { colors, radii, spacing } from "@/styles/theme";

type ImportStatus = "idle" | "picked" | "uploading" | "ready" | "error";

const acceptedStatementTypes = [
  "application/pdf",
  "text/csv",
  "application/csv",
  "text/comma-separated-values",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
];

const formatBytes = (bytes?: number | null) => {
  if (!bytes) {
    return "Size unavailable";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);

const getFileKind = (file?: DocumentPicker.DocumentPickerAsset | null) => {
  const name = file?.name.toLowerCase() ?? "";

  if (name.endsWith(".pdf")) {
    return "PDF statement";
  }

  if (name.endsWith(".csv")) {
    return "CSV statement";
  }

  if (name.endsWith(".xls") || name.endsWith(".xlsx")) {
    return "Excel statement";
  }

  return "Statement file";
};

export const ImportStatementScreen = () => {
  const router = useRouter();
  const { accentColor, accentSoft, palette } = useAppearanceTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTarget = getReturnTargetParam(params.returnTo);
  const returnRoute = getReturnTargetRoute(params.returnTo);
  const setSession = useImportSessionStore((state) => state.setSession);
  const accounts = useAccountsStore((state) => state.accounts);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<StatementParseSummary | null>(null);
  const [parseResult, setParseResult] = useState<StatementParseResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? accounts[0],
    [accounts, selectedAccountId]
  );

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (!selectedAccountId || !accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0]?.id ?? null);
    }
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    if (status !== "uploading") {
      return undefined;
    }

    const interval = setInterval(() => {
      setProgress((currentProgress) => {
        if (currentProgress >= 100) {
          return 100;
        }

        const step = currentProgress < 54 ? 13 : currentProgress < 86 ? 7 : 4;
        return Math.min(currentProgress + step, 100);
      });
    }, 260);

    return () => clearInterval(interval);
  }, [status]);

  const pickStatement = async () => {
    try {
      setErrorMessage(null);
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: acceptedStatementTypes
      });

      if (result.canceled) {
        return;
      }

      const [file] = result.assets;
      setSelectedFile(file);
      setProgress(0);
      setSummary(null);
      setParseResult(null);
      setStatus("picked");
    } catch {
      setStatus("error");
      setErrorMessage("Could not open the file picker. Please try again.");
    }
  };

  const startImport = async () => {
    if (!selectedFile) {
      setStatus("error");
      setErrorMessage("Choose a PDF, CSV, or Excel statement first.");
      return;
    }

    if (!selectedAccount) {
      setStatus("error");
      setErrorMessage("Add an account before importing a statement.");
      return;
    }

    setErrorMessage(null);
    setSummary(null);
    setParseResult(null);
    setProgress(12);
    setStatus("uploading");

    try {
      let uploadedFileId: string | null = null;
      let importJobId: string | null = null;

      if (user) {
        const upload = await uploadService.uploadStatementBlob({
          contentType: selectedFile.mimeType,
          fileName: selectedFile.name,
          uri: selectedFile.uri,
          userId: user.id
        });
        const registeredFile = await uploadService.registerUploadedFile(user.id, {
          bucketId: upload.bucketId,
          fileName: selectedFile.name,
          mimeType: selectedFile.mimeType,
          sizeBytes: upload.sizeBytes,
          storagePath: upload.storagePath
        });
        const importJob = (await uploadService.startProcessing(registeredFile.id)) as {
          import_job_id?: string;
        } | null;

        uploadedFileId = registeredFile.id;
        importJobId = importJob?.import_job_id ?? null;
      }

      const knownDuplicateHashes = await getSavedDuplicateHashes();
      const result = await parseStatementFile({
        account: {
          id: selectedAccount.id,
          name: selectedAccount.name
        },
        file: selectedFile,
        knownDuplicateHashes
      });

      setParseResult(result);
      setSession({
        account: selectedAccount,
        fileName: selectedFile.name,
        importJobId,
        result,
        uploadedFileId
      });
      setSummary(result.summary);
      setProgress(100);
      setStatus("ready");

      if (result.summary.newTransactions === 0 && result.summary.failedRows > 0) {
        setErrorMessage(result.failedRows[0]?.message ?? "No transactions could be extracted.");
      }
    } catch (error) {
      setProgress(0);
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while parsing the statement."
      );
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setProgress(0);
    setSummary(null);
    setParseResult(null);
    setStatus("idle");
    setErrorMessage(null);
  };

  const closeImport = () => {
    if (returnRoute) {
      router.replace(returnRoute);
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/calendar");
  };

  const isUploading = status === "uploading";
  const isReady = status === "ready";

  return (
    <Screen>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={closeImport}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft color={colors.textPrimary} size={22} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: accentColor }]}>Statement Import</Text>
            <Text style={styles.title}>Bring your spending into the timeline</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={[accentSoft, palette.cardStrong]}
            style={[styles.importCard, { borderColor: `${accentColor}33` }]}
          >
            <View style={styles.uploadIconWrap}>
              <UploadCloud color={accentColor} size={30} strokeWidth={2.4} />
            </View>
            <Text style={styles.importTitle}>Upload a statement</Text>
            <Text style={styles.importSubtitle}>PDF, CSV, XLS, or XLSX from any account.</Text>

            <Pressable
              accessibilityLabel="Choose statement file"
              accessibilityRole="button"
              disabled={isUploading}
              onPress={pickStatement}
              style={({ pressed }) => [
                styles.dropZone,
                selectedFile && styles.dropZoneActive,
                pressed && styles.pressed,
                isUploading && styles.disabled
              ]}
            >
              <View style={styles.fileIcon}>
                {selectedFile?.name.toLowerCase().endsWith(".pdf") ? (
                  <FileText color={accentColor} size={22} />
                ) : (
                  <FileSpreadsheet color={accentColor} size={22} />
                )}
              </View>
              <View style={styles.fileCopy}>
                <Text numberOfLines={1} style={styles.fileTitle}>
                  {selectedFile ? selectedFile.name : "Choose PDF, CSV, or Excel file"}
                </Text>
                <Text style={styles.fileMeta}>
                  {selectedFile
                    ? `${getFileKind(selectedFile)} - ${formatBytes(selectedFile.size)}`
                    : "Securely staged before review"}
                </Text>
              </View>
              {selectedFile ? (
                <Pressable
                  accessibilityLabel="Remove selected file"
                  accessibilityRole="button"
                  onPress={clearFile}
                  style={({ pressed }) => [styles.removeFileButton, pressed && styles.pressed]}
                >
                  <X color={colors.textSecondary} size={18} />
                </Pressable>
              ) : null}
            </Pressable>

            <View style={styles.supportedFormats}>
              {["PDF", "CSV", "XLS", "XLSX"].map((format) => (
                <View key={format} style={styles.formatPill}>
                  <Text style={styles.formatText}>{format}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          {errorMessage ? (
            <View style={styles.errorCard}>
              <AlertCircle color={colors.danger} size={18} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Account</Text>
              <View style={styles.accountBadge}>
                <WalletCards color={accentColor} size={14} />
                <Text style={[styles.accountBadgeText, { color: accentColor }]}>
                  Selected source
                </Text>
              </View>
            </View>

            <View style={styles.accountList}>
              {accounts.map((account) => (
                <AccountOption
                  account={account}
                  key={account.id}
                  onPress={() => setSelectedAccountId(account.id)}
                  selected={account.id === selectedAccount?.id}
                />
              ))}
            </View>
            <Pressable
              accessibilityLabel="Manage accounts"
              accessibilityRole="button"
              onPress={() => router.push(withReturnTo("/accounts", "import"))}
              style={({ pressed }) => [styles.manageAccountsButton, pressed && styles.pressed]}
            >
              <Text style={styles.manageAccountsText}>Manage accounts</Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Import Progress</Text>
              <Text style={styles.progressPercent}>{isUploading ? `${progress}%` : "Ready"}</Text>
            </View>

            <View style={styles.progressCard}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: accentColor, width: `${progress}%` }
                  ]}
                />
              </View>

              <View style={styles.progressSteps}>
                <ProgressStep active={!!selectedFile} label="File staged" />
                <ProgressStep active={isUploading || isReady} loading={isUploading} label="Extracting rows" />
                <ProgressStep active={isReady} label="Summary ready" />
              </View>
            </View>
          </View>

          {summary && parseResult ? (
            <ImportSummaryCard result={parseResult} />
          ) : !selectedFile ? (
            <PremiumEmptyState
              actionLabel="Choose Statement"
              icon={UploadCloud}
              message="Upload your first PDF, CSV, or Excel statement to start building the timeline."
              onAction={() => void pickStatement()}
              title="No statements imported"
              tone={accentColor}
            />
          ) : (
            <View
              style={[
                styles.securityCard,
                { backgroundColor: accentSoft, borderColor: `${accentColor}33` }
              ]}
            >
              <ShieldCheck color={accentColor} size={20} />
              <View style={styles.securityCopy}>
                <Text style={styles.securityTitle}>Review before saving</Text>
                <Text style={styles.securityText}>
                  Extracted transactions will be shown for editing before anything is added.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityLabel="Start import"
            accessibilityRole="button"
            disabled={isUploading}
            onPress={
              isReady && parseResult
                ? () => router.push(withReturnTo("/import-review", returnTarget))
                : startImport
            }
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: accentColor },
              (!selectedFile || isUploading) && styles.primaryButtonDisabled,
              pressed && selectedFile && !isUploading && styles.pressed
            ]}
          >
            {isUploading ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <UploadCloud color={colors.background} size={20} strokeWidth={2.6} />
            )}
            <Text style={styles.primaryButtonText}>
              {isReady ? "Review Transactions" : isUploading ? "Analyzing Statement" : "Import Statement"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
};

const AccountOption = ({
  account,
  onPress,
  selected
}: {
  account: MoneyAccount;
  onPress: () => void;
  selected: boolean;
}) => {
  const { accentColor, accentSoft } = useAppearanceTheme();

  return (
    <Pressable
      accessibilityLabel={`Select ${account.name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.accountOption,
        selected && [
          styles.accountOptionSelected,
          { backgroundColor: accentSoft, borderColor: `${accentColor}55` }
        ],
        pressed && styles.pressed
      ]}
    >
      <View style={[styles.accountMark, { backgroundColor: account.color }]}>
        <Text style={styles.accountInitial}>{account.institution.charAt(0)}</Text>
      </View>
      <View style={styles.accountCopy}>
        <Text style={styles.accountName}>{account.name}</Text>
        <Text style={styles.accountMeta}>
          {account.accountType} - {account.lastFour}
        </Text>
      </View>
      {selected ? (
        <CheckCircle2 color={accentColor} size={20} fill={`${accentColor}20`} />
      ) : (
        <ChevronDown color={colors.textMuted} size={18} />
      )}
    </Pressable>
  );
};

const ProgressStep = ({
  active,
  label,
  loading = false
}: {
  active: boolean;
  label: string;
  loading?: boolean;
}) => (
  <ProgressStepContent active={active} label={label} loading={loading} />
);

const ProgressStepContent = ({
  active,
  label,
  loading
}: {
  active: boolean;
  label: string;
  loading: boolean;
}) => {
  const { accentColor } = useAppearanceTheme();

  return (
    <View style={styles.progressStep}>
      <View
        style={[
          styles.stepDot,
          active && [
            styles.stepDotActive,
            { backgroundColor: accentColor, borderColor: accentColor }
          ]
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.background} size="small" />
        ) : active ? (
          <CheckCircle2 color={colors.background} size={12} strokeWidth={3} />
        ) : null}
      </View>
      <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
    </View>
  );
};

const ImportSummaryCard = ({ result }: { result: StatementParseResult }) => {
  const { accentColor } = useAppearanceTheme();
  const { summary } = result;

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <View>
          <Text style={[styles.summaryEyebrow, { color: accentColor }]}>Import Summary</Text>
          <Text style={styles.summaryTitle}>{summary.newTransactions} new transactions ready</Text>
          <Text style={styles.summarySource}>{sourceLabel[result.source]}</Text>
        </View>
        <CheckCircle2 color={accentColor} size={26} />
      </View>

      <SummaryRow label="Total found" value={summary.totalFound} />
      <SummaryRow label="Duplicates skipped" tone="warning" value={summary.duplicatesSkipped} />
      <SummaryRow label="New to import" tone="accent" value={summary.newTransactions} />
      <SummaryRow
        label="Failed rows"
        tone={summary.failedRows > 0 ? "danger" : "muted"}
        value={summary.failedRows}
      />

      {result.duplicates.length > 0 ? (
        <View style={styles.duplicatesPreview}>
          <Text style={styles.previewTitle}>Duplicates skipped</Text>
          {result.duplicates.slice(0, 3).map((duplicate) => (
            <View key={`${duplicate.duplicateHash}-${duplicate.rowNumber}`} style={styles.previewItem}>
              <CheckCircle2 color={colors.warning} size={14} />
              <Text style={styles.previewText}>
                Row {duplicate.rowNumber}: {duplicate.merchant} - {formatCurrency(duplicate.amount)} (
                {duplicateReasonLabel[duplicate.duplicateReason]})
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {result.failedRows.length > 0 ? (
        <View style={styles.failedRowsPreview}>
          {result.failedRows.slice(0, 3).map((row) => (
            <View key={`${row.rowNumber}-${row.message}`} style={styles.failedRowItem}>
              <AlertCircle color={colors.danger} size={14} />
              <Text style={styles.failedRowText}>
                Row {row.rowNumber || "-"}: {row.message}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const sourceLabel: Record<StatementParseResult["source"], string> = {
  local_csv: "Parsed locally from CSV",
  local_excel: "Parsed locally from Excel",
  remote_pdf_ocr: "PDF/OCR worker"
};

const duplicateReasonLabel = {
  previous_import: "already imported",
  same_file: "same file"
} as const;

const SummaryRow = ({
  label,
  tone = "default",
  value
}: {
  label: string;
  tone?: "accent" | "danger" | "default" | "muted" | "warning";
  value: number;
}) => {
  const valueColor = {
    accent: colors.accent,
    danger: colors.danger,
    default: colors.textPrimary,
    muted: colors.textSecondary,
    warning: colors.warning
  }[tone];

  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
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
  importCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.16)",
    padding: spacing.lg
  },
  uploadIconWrap: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 27,
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.28)",
    backgroundColor: colors.accentSoft,
    marginBottom: spacing.md
  },
  importTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 30
  },
  importSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: spacing.xs
  },
  dropZone: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(5, 8, 13, 0.48)",
    marginTop: spacing.lg,
    padding: spacing.md
  },
  dropZoneActive: {
    borderColor: "rgba(67, 216, 139, 0.36)",
    backgroundColor: "rgba(67, 216, 139, 0.08)"
  },
  fileIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.surface
  },
  fileCopy: {
    minWidth: 0,
    flex: 1
  },
  fileTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  fileMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 2
  },
  removeFileButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)"
  },
  supportedFormats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  formatPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(17, 25, 35, 0.66)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  formatText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15
  },
  section: {
    gap: spacing.sm
  },
  sectionHeader: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22
  },
  accountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  accountBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14
  },
  accountList: {
    gap: spacing.sm
  },
  manageAccountsButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.24)",
    backgroundColor: "rgba(67, 216, 139, 0.08)"
  },
  manageAccountsText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17
  },
  accountOption: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(17, 25, 35, 0.76)",
    paddingHorizontal: spacing.md
  },
  accountOptionSelected: {
    borderColor: "rgba(67, 216, 139, 0.42)",
    backgroundColor: "rgba(67, 216, 139, 0.08)"
  },
  accountMark: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21
  },
  accountInitial: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22
  },
  accountCopy: {
    minWidth: 0,
    flex: 1
  },
  accountName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  accountMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17
  },
  progressPercent: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  progressCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(17, 25, 35, 0.76)",
    padding: spacing.md
  },
  progressTrack: {
    height: 8,
    overflow: "hidden",
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 255, 255, 0.08)"
  },
  progressFill: {
    height: "100%",
    borderRadius: radii.pill,
    backgroundColor: colors.accent
  },
  progressSteps: {
    gap: spacing.sm,
    marginTop: spacing.md
  },
  progressStep: {
    minHeight: 25,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  stepDot: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.05)"
  },
  stepDotActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent
  },
  stepLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  stepLabelActive: {
    color: colors.textPrimary
  },
  errorCard: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.24)",
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    padding: spacing.md
  },
  errorText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  securityCard: {
    minHeight: 78,
    flexDirection: "row",
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.18)",
    backgroundColor: "rgba(67, 216, 139, 0.07)",
    padding: spacing.md
  },
  securityCopy: {
    flex: 1
  },
  securityTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  securityText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 2
  },
  summaryCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.2)",
    backgroundColor: "rgba(17, 25, 35, 0.86)",
    padding: spacing.md
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    paddingBottom: spacing.md,
    marginBottom: spacing.sm
  },
  summaryEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    textTransform: "uppercase"
  },
  summaryTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
    marginTop: 2
  },
  summarySource: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 2
  },
  summaryRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  failedRowsPreview: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    marginTop: spacing.sm,
    paddingTop: spacing.sm
  },
  duplicatesPreview: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    marginTop: spacing.sm,
    paddingTop: spacing.sm
  },
  previewTitle: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17,
    textTransform: "uppercase"
  },
  previewItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  previewText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  failedRowItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  failedRowText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
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
    opacity: 0.58
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22
  },
  disabled: {
    opacity: 0.66
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }]
  }
});
