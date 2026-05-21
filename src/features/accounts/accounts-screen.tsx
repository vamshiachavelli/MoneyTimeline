import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  CreditCard,
  Landmark,
  Plus,
  Trash2,
  WalletCards
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { useAppearanceTheme } from "@/features/settings/use-appearance-theme";
import { getReturnTargetRoute } from "@/navigation/return-target";
import { colors, radii, spacing } from "@/styles/theme";
import { useAccountsStore, type MoneyAccount } from "./account-store";

const accountTypes = ["Credit card", "Checking", "Savings", "Wallet"];
const colorOptions = ["#2F7BFF", "#F6C343", "#E94D4D", "#43D88B", "#A855F7", "#F97316"];

type AccountFormState = {
  accountType: string;
  color: string;
  institution: string;
  lastFour: string;
  name: string;
};

const initialForm: AccountFormState = {
  accountType: "Credit card",
  color: "#2F7BFF",
  institution: "",
  lastFour: "",
  name: ""
};

export const AccountsScreen = () => {
  const router = useRouter();
  const { accentColor, accentSoft, palette } = useAppearanceTheme();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnRoute = getReturnTargetRoute(params.returnTo);
  const accounts = useAccountsStore((state) => state.accounts);
  const addAccount = useAccountsStore((state) => state.addAccount);
  const deleteAccount = useAccountsStore((state) => state.deleteAccount);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const [form, setForm] = useState<AccountFormState>(initialForm);
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const creditAccounts = useMemo(
    () => accounts.filter((account) => account.accountType === "Credit card").length,
    [accounts]
  );

  const closeAccounts = () => {
    if (returnRoute) {
      router.replace(returnRoute);
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/settings");
  };

  const updateForm = (patch: Partial<AccountFormState>) => {
    setForm((currentForm) => ({ ...currentForm, ...patch }));
    setErrorMessage("");
  };

  const handleAddAccount = async () => {
    const name = form.name.trim();
    const institution = form.institution.trim();
    const lastFour = form.lastFour.trim();

    if (!name || !institution || !/^\d{4}$/.test(lastFour)) {
      setErrorMessage("Add a name, institution, and 4-digit account ending.");
      return;
    }

    await addAccount({
      accountType: form.accountType,
      color: form.color,
      institution,
      lastFour,
      name
    });
    setForm(initialForm);
    setIsAdding(false);
    setErrorMessage("");
  };

  return (
    <Screen>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back to settings"
            accessibilityRole="button"
            onPress={closeAccounts}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft color={colors.textPrimary} size={22} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: accentColor }]}>Accounts</Text>
            <Text style={styles.title}>Manage statement sources</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={[accentSoft, palette.cardStrong]}
            style={[styles.summaryCard, { borderColor: `${accentColor}33` }]}
          >
            <View style={[styles.summaryIcon, { backgroundColor: accentSoft }]}>
              <WalletCards color={accentColor} size={28} strokeWidth={2.4} />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryTitle}>{accounts.length} accounts connected</Text>
              <Text style={styles.summarySub}>
                {creditAccounts} credit cards - {accounts.length - creditAccounts} bank or wallet accounts
              </Text>
            </View>
          </LinearGradient>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your accounts</Text>
            <Pressable
              accessibilityLabel="Add account"
              accessibilityRole="button"
              onPress={() => setIsAdding((current) => !current)}
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: accentColor },
                pressed && styles.pressed
              ]}
            >
              <Plus color={colors.background} size={18} strokeWidth={2.8} />
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>

          {isAdding ? (
            <View style={[styles.formCard, { borderColor: `${accentColor}33` }]}>
              <Text style={styles.formTitle}>New account</Text>
              <LabeledInput
                label="Account name"
                onChangeText={(name) => updateForm({ name })}
                placeholder="Chase Sapphire"
                value={form.name}
              />
              <View style={styles.inputGrid}>
                <LabeledInput
                  label="Institution"
                  onChangeText={(institution) => updateForm({ institution })}
                  placeholder="Chase"
                  value={form.institution}
                />
                <LabeledInput
                  keyboardType="number-pad"
                  label="Last 4"
                  maxLength={4}
                  onChangeText={(lastFour) => updateForm({ lastFour: lastFour.replace(/\D/g, "") })}
                  placeholder="1234"
                  value={form.lastFour}
                />
              </View>

              <Text style={styles.optionLabel}>Type</Text>
              <View style={styles.typeRow}>
                {accountTypes.map((type) => (
                  <Pressable
                    accessibilityLabel={`Choose ${type}`}
                    accessibilityRole="button"
                    key={type}
                    onPress={() => updateForm({ accountType: type })}
                    style={({ pressed }) => [
                      styles.typePill,
                      form.accountType === type && [
                        styles.typePillActive,
                        { backgroundColor: accentSoft, borderColor: `${accentColor}55` }
                      ],
                      pressed && styles.pressed
                    ]}
                  >
                    <Text
                      style={[
                        styles.typePillText,
                        form.accountType === type && styles.typePillTextActive
                      ]}
                    >
                      {type}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.optionLabel}>Color</Text>
              <View style={styles.colorRow}>
                {colorOptions.map((color) => (
                  <Pressable
                    accessibilityLabel={`Choose color ${color}`}
                    accessibilityRole="button"
                    key={color}
                    onPress={() => updateForm({ color })}
                    style={({ pressed }) => [
                      styles.colorSwatch,
                      { backgroundColor: color },
                      form.color === color && styles.colorSwatchActive,
                      pressed && styles.pressed
                    ]}
                  >
                    {form.color === color ? <Check color={colors.textPrimary} size={15} /> : null}
                  </Pressable>
                ))}
              </View>

              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

              <Pressable
                accessibilityLabel="Save account"
                accessibilityRole="button"
                onPress={handleAddAccount}
                style={({ pressed }) => [
                  styles.saveButton,
                  { backgroundColor: accentColor },
                  pressed && styles.pressed
                ]}
              >
                <Text style={styles.saveButtonText}>Save Account</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.accountList}>
            {accounts.map((account) => (
              <AccountCard
                account={account}
                canDelete={accounts.length > 1}
                key={account.id}
                onDelete={() => void deleteAccount(account.id)}
              />
            ))}
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
};

const AccountCard = ({
  account,
  canDelete,
  onDelete
}: {
  account: MoneyAccount;
  canDelete: boolean;
  onDelete: () => void;
}) => {
  const Icon = account.accountType === "Credit card" ? CreditCard : Landmark;

  return (
    <View style={styles.accountCard}>
      <View style={styles.accountTop}>
        <View style={[styles.accountIcon, { backgroundColor: `${account.color}24` }]}>
          <Icon color={account.color} size={23} strokeWidth={2.5} />
        </View>
        <View style={styles.accountText}>
          <Text style={styles.accountName}>{account.name}</Text>
          <Text style={styles.accountMeta}>
            {account.institution} - {account.accountType} - {account.lastFour}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={`Delete ${account.name}`}
          accessibilityRole="button"
          disabled={!canDelete}
          onPress={onDelete}
          style={({ pressed }) => [
            styles.deleteButton,
            !canDelete && styles.deleteButtonDisabled,
            pressed && canDelete && styles.pressed
          ]}
        >
          <Trash2 color={canDelete ? colors.danger : colors.textMuted} size={17} />
        </Pressable>
      </View>

      <View style={styles.accountDetails}>
        <InfoPill label="Source" value="Statement import" />
        <InfoPill label="Duplicate scope" value="Account + date + merchant + amount" />
      </View>
    </View>
  );
};

const InfoPill = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoPill}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const LabeledInput = ({
  keyboardType = "default",
  label,
  maxLength,
  onChangeText,
  placeholder,
  value
}: {
  keyboardType?: "default" | "number-pad";
  label: string;
  maxLength?: number;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) => (
  <View style={styles.inputWrap}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      keyboardType={keyboardType}
      maxLength={maxLength}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      style={styles.textInput}
      value={value}
    />
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
  content: {
    gap: spacing.md,
    paddingBottom: 118
  },
  summaryCard: {
    minHeight: 108,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.14)",
    padding: spacing.lg
  },
  summaryIcon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: colors.accentSoft
  },
  summaryText: {
    minWidth: 0,
    flex: 1
  },
  summaryTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28
  },
  summarySub: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 3
  },
  sectionHeader: {
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
  addButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md
  },
  addButtonText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  formCard: {
    gap: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.2)",
    backgroundColor: "rgba(17, 25, 35, 0.86)",
    padding: spacing.md
  },
  formTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21
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
  optionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    textTransform: "uppercase"
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  typePill: {
    minHeight: 34,
    justifyContent: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    backgroundColor: "rgba(5, 8, 13, 0.42)",
    paddingHorizontal: spacing.md
  },
  typePillActive: {
    borderColor: "rgba(67, 216, 139, 0.42)",
    backgroundColor: colors.accentSoft
  },
  typePillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  typePillTextActive: {
    color: colors.textPrimary
  },
  colorRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  colorSwatch: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)"
  },
  colorSwatchActive: {
    borderWidth: 2,
    borderColor: colors.textPrimary
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  saveButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    backgroundColor: colors.accent
  },
  saveButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  accountList: {
    gap: spacing.md
  },
  accountCard: {
    gap: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(17, 25, 35, 0.82)",
    padding: spacing.md
  },
  accountTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  accountIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23
  },
  accountText: {
    minWidth: 0,
    flex: 1
  },
  accountName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  accountMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  deleteButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255, 107, 107, 0.12)"
  },
  deleteButtonDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.05)"
  },
  accountDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  infoPill: {
    minHeight: 42,
    justifyContent: "center",
    borderRadius: radii.md,
    backgroundColor: "rgba(5, 8, 13, 0.44)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 13,
    textTransform: "uppercase"
  },
  infoValue: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }]
  }
});
