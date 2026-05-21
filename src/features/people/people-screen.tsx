import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserRound,
  UsersRound
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { useAppearanceTheme } from "@/features/settings/use-appearance-theme";
import { getReturnTargetRoute } from "@/navigation/return-target";
import { formatCurrency } from "@/features/transactions/transaction-ledger";
import { colors, radii, spacing } from "@/styles/theme";
import { getPersonInitial, usePeopleStore, type MoneyPerson } from "./people-store";

const colorOptions = ["#3D7BFF", "#A855F7", "#55C989", "#F59E42", "#EC4899", "#14B8A6"];

type PersonFormState = {
  color: string;
  email: string;
  name: string;
  phone: string;
};

const initialForm: PersonFormState = {
  color: "#3D7BFF",
  email: "",
  name: "",
  phone: ""
};

export const PeopleScreen = () => {
  const router = useRouter();
  const { accentColor, accentSoft, palette } = useAppearanceTheme();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnRoute = getReturnTargetRoute(params.returnTo);
  const people = usePeopleStore((state) => state.people);
  const addPerson = usePeopleStore((state) => state.addPerson);
  const deletePerson = usePeopleStore((state) => state.deletePerson);
  const loadPeople = usePeopleStore((state) => state.loadPeople);
  const updatePerson = usePeopleStore((state) => state.updatePerson);
  const [form, setForm] = useState<PersonFormState>(initialForm);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadPeople();
  }, [loadPeople]);

  const totalOwed = useMemo(
    () => people.reduce((sum, person) => sum + Math.max(person.balancePreview, 0), 0),
    [people]
  );
  const totalYouOwe = useMemo(
    () => people.reduce((sum, person) => sum + Math.abs(Math.min(person.balancePreview, 0)), 0),
    [people]
  );

  const closePeople = () => {
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

  const updateForm = (patch: Partial<PersonFormState>) => {
    setForm((currentForm) => ({ ...currentForm, ...patch }));
    setErrorMessage("");
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingPersonId(null);
    setIsAdding(false);
    setErrorMessage("");
  };

  const startAdd = () => {
    setForm(initialForm);
    setEditingPersonId(null);
    setIsAdding((current) => !current);
    setErrorMessage("");
  };

  const startEdit = (person: MoneyPerson) => {
    setForm({
      color: person.color,
      email: person.email ?? "",
      name: person.name,
      phone: person.phone ?? ""
    });
    setEditingPersonId(person.id);
    setIsAdding(true);
    setErrorMessage("");
  };

  const savePerson = async () => {
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();

    if (!name) {
      setErrorMessage("Add a name for this person.");
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMessage("Use a valid email address or leave it blank.");
      return;
    }

    const payload = {
      balancePreview: people.find((person) => person.id === editingPersonId)?.balancePreview ?? 0,
      color: form.color,
      email,
      name,
      phone
    };

    if (editingPersonId) {
      await updatePerson(editingPersonId, payload);
    } else {
      await addPerson(payload);
    }

    resetForm();
  };

  return (
    <Screen>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back to settings"
            accessibilityRole="button"
            onPress={closePeople}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft color={colors.textPrimary} size={22} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: accentColor }]}>People</Text>
            <Text style={styles.title}>Manage split contacts</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={[accentSoft, palette.cardStrong]}
            style={[styles.summaryCard, { borderColor: `${accentColor}33` }]}
          >
            <View style={[styles.summaryIcon, { backgroundColor: accentSoft }]}>
              <UsersRound color={accentColor} size={29} strokeWidth={2.4} />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryTitle}>{people.length} people saved</Text>
              <Text style={styles.summarySub}>
                {formatCurrency(totalOwed)} owed to you - {formatCurrency(totalYouOwe)} you owe
              </Text>
            </View>
          </LinearGradient>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Your people</Text>
              <Text style={styles.sectionMeta}>Used for shared splits and balances</Text>
            </View>
            <Pressable
              accessibilityLabel={isAdding ? "Cancel person form" : "Add person"}
              accessibilityRole="button"
              onPress={isAdding ? resetForm : startAdd}
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: accentColor },
                pressed && styles.pressed
              ]}
            >
              <Plus color={colors.background} size={18} strokeWidth={2.8} />
              <Text style={styles.addButtonText}>{isAdding ? "Cancel" : "Add"}</Text>
            </Pressable>
          </View>

          {isAdding ? (
            <View style={[styles.formCard, { borderColor: `${accentColor}33` }]}>
              <Text style={styles.formTitle}>
                {editingPersonId ? "Edit person" : "New person"}
              </Text>

              <LabeledInput
                label="Name"
                onChangeText={(name) => updateForm({ name })}
                placeholder="Alex"
                value={form.name}
              />

              <View style={styles.inputGrid}>
                <LabeledInput
                  keyboardType="email-address"
                  label="Email optional"
                  onChangeText={(email) => updateForm({ email })}
                  placeholder="alex@email.com"
                  value={form.email}
                />
                <LabeledInput
                  keyboardType="phone-pad"
                  label="Phone optional"
                  onChangeText={(phone) => updateForm({ phone })}
                  placeholder="(555) 010-0000"
                  value={form.phone}
                />
              </View>

              <Text style={styles.optionLabel}>Avatar color</Text>
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
                accessibilityLabel={editingPersonId ? "Save person changes" : "Save person"}
                accessibilityRole="button"
                onPress={savePerson}
                style={({ pressed }) => [
                  styles.saveButton,
                  { backgroundColor: accentColor },
                  pressed && styles.pressed
                ]}
              >
                <Text style={styles.saveButtonText}>
                  {editingPersonId ? "Save Changes" : "Save Person"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {people.length > 0 ? (
            <View style={styles.peopleList}>
              {people.map((person) => (
                <PersonCard
                  accentColor={accentColor}
                  accentSoft={accentSoft}
                  key={person.id}
                  onDelete={() => void deletePerson(person.id)}
                  onEdit={() => startEdit(person)}
                  person={person}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <View style={[styles.emptyIcon, { backgroundColor: accentSoft }]}>
                <UserRound color={accentColor} size={26} strokeWidth={2.4} />
              </View>
              <Text style={styles.emptyTitle}>No people yet</Text>
              <Text style={styles.emptyText}>
                Add friends, family, roommates, or partners before creating shared splits.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
};

const PersonCard = ({
  accentColor,
  accentSoft,
  onDelete,
  onEdit,
  person
}: {
  accentColor: string;
  accentSoft: string;
  onDelete: () => void;
  onEdit: () => void;
  person: MoneyPerson;
}) => {
  const isOwedToYou = person.balancePreview >= 0;

  return (
    <View style={styles.personCard}>
      <View style={styles.personTop}>
        <View style={[styles.personAvatar, { backgroundColor: person.color }]}>
          <Text style={styles.personInitial}>{getPersonInitial(person.name)}</Text>
        </View>
        <View style={styles.personCopy}>
          <Text style={styles.personName}>{person.name}</Text>
          <Text numberOfLines={1} style={styles.personMeta}>
            {person.email || person.phone || "No contact method yet"}
          </Text>
        </View>
        <View style={styles.personActions}>
          <Pressable
            accessibilityLabel={`Edit ${person.name}`}
            accessibilityRole="button"
            onPress={onEdit}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: accentSoft },
              pressed && styles.pressed
            ]}
          >
            <Pencil color={accentColor} size={16} strokeWidth={2.4} />
          </Pressable>
          <Pressable
            accessibilityLabel={`Delete ${person.name}`}
            accessibilityRole="button"
            onPress={onDelete}
            style={({ pressed }) => [styles.iconButtonDanger, pressed && styles.pressed]}
          >
            <Trash2 color={colors.danger} size={16} strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>

      <View style={styles.personDetails}>
        <InfoPill
          icon={Mail}
          label="Email"
          value={person.email || "Not added"}
        />
        <InfoPill
          icon={Phone}
          label="Phone"
          value={person.phone || "Not added"}
        />
        <View style={styles.balancePill}>
          <Text style={styles.infoLabel}>Balance preview</Text>
          <Text
            style={[
              styles.balanceValue,
              { color: isOwedToYou ? colors.accent : colors.warning }
            ]}
          >
            {isOwedToYou ? "+" : "-"}
            {formatCurrency(Math.abs(person.balancePreview))}
          </Text>
          <Text style={styles.infoValue}>{isOwedToYou ? "owes you" : "you owe"}</Text>
        </View>
      </View>
    </View>
  );
};

const InfoPill = ({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) => (
  <View style={styles.infoPill}>
    <View style={styles.infoIconLabel}>
      <Icon color={colors.textMuted} size={13} strokeWidth={2.3} />
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
    <Text numberOfLines={1} style={styles.infoValue}>{value}</Text>
  </View>
);

const LabeledInput = ({
  keyboardType = "default",
  label,
  onChangeText,
  placeholder,
  value
}: {
  keyboardType?: "default" | "email-address" | "phone-pad";
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
  sectionMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
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
  peopleList: {
    gap: spacing.md
  },
  personCard: {
    gap: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(17, 25, 35, 0.82)",
    padding: spacing.md
  },
  personTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  personAvatar: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23
  },
  personInitial: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21
  },
  personCopy: {
    minWidth: 0,
    flex: 1
  },
  personName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  personMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  personActions: {
    flexDirection: "row",
    gap: spacing.xs
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: colors.accentSoft
  },
  iconButtonDanger: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "rgba(255, 107, 107, 0.12)"
  },
  personDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  infoPill: {
    minHeight: 48,
    minWidth: "47%",
    flex: 1,
    justifyContent: "center",
    borderRadius: radii.md,
    backgroundColor: "rgba(5, 8, 13, 0.44)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  infoIconLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
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
  balancePill: {
    minHeight: 48,
    minWidth: "47%",
    flex: 1,
    justifyContent: "center",
    borderRadius: radii.md,
    backgroundColor: "rgba(5, 8, 13, 0.44)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  balanceValue: {
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  emptyCard: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(17, 25, 35, 0.72)",
    padding: spacing.xl
  },
  emptyIcon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: colors.accentSoft
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    textAlign: "center"
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }]
  }
});
