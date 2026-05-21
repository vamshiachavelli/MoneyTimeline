import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  UsersRound
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { PremiumEmptyState } from "@/components/ui/premium-empty-state";
import { Screen } from "@/components/ui/screen";
import { getPersonInitial, usePeopleStore, type MoneyPerson } from "@/features/people/people-store";
import { useAppearanceTheme } from "@/features/settings/use-appearance-theme";
import { getReturnTargetRoute, withReturnTo } from "@/navigation/return-target";
import { formatCurrency } from "@/features/transactions/transaction-ledger";
import { colors, radii, spacing } from "@/styles/theme";
import { useGroupsStore, type MoneyGroup } from "./group-store";

const colorOptions = ["#A855F7", "#F59E42", "#3D7BFF", "#55C989", "#EC4899", "#14B8A6"];

type GroupFormState = {
  color: string;
  memberIds: string[];
  name: string;
};

const initialForm: GroupFormState = {
  color: "#A855F7",
  memberIds: [],
  name: ""
};

export const GroupsScreen = () => {
  const router = useRouter();
  const { accentColor, accentSoft, palette } = useAppearanceTheme();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnRoute = getReturnTargetRoute(params.returnTo);
  const people = usePeopleStore((state) => state.people);
  const loadPeople = usePeopleStore((state) => state.loadPeople);
  const groups = useGroupsStore((state) => state.groups);
  const addGroup = useGroupsStore((state) => state.addGroup);
  const deleteGroup = useGroupsStore((state) => state.deleteGroup);
  const loadGroups = useGroupsStore((state) => state.loadGroups);
  const updateGroup = useGroupsStore((state) => state.updateGroup);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState<GroupFormState>(initialForm);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    void loadPeople();
    void loadGroups();
  }, [loadGroups, loadPeople]);

  const totalOwed = useMemo(
    () => groups.reduce((sum, group) => sum + Math.max(group.balancePreview, 0), 0),
    [groups]
  );
  const totalYouOwe = useMemo(
    () => groups.reduce((sum, group) => sum + Math.abs(Math.min(group.balancePreview, 0)), 0),
    [groups]
  );

  const closeGroups = () => {
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

  const updateForm = (patch: Partial<GroupFormState>) => {
    setForm((currentForm) => ({ ...currentForm, ...patch }));
    setErrorMessage("");
  };

  const resetForm = () => {
    setEditingGroupId(null);
    setErrorMessage("");
    setForm(initialForm);
    setIsEditing(false);
  };

  const startAdd = () => {
    setEditingGroupId(null);
    setErrorMessage("");
    setForm({
      ...initialForm,
      memberIds: people.slice(0, 3).map((person) => person.id)
    });
    setIsEditing((current) => !current);
  };

  const startEdit = (group: MoneyGroup) => {
    setEditingGroupId(group.id);
    setErrorMessage("");
    setForm({
      color: group.color,
      memberIds: group.memberIds,
      name: group.name
    });
    setIsEditing(true);
  };

  const toggleMember = (personId: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      memberIds: currentForm.memberIds.includes(personId)
        ? currentForm.memberIds.filter((id) => id !== personId)
        : [...currentForm.memberIds, personId]
    }));
    setErrorMessage("");
  };

  const saveGroup = async () => {
    const name = form.name.trim();

    if (!name) {
      setErrorMessage("Add a group name.");
      return;
    }

    if (form.memberIds.length === 0) {
      setErrorMessage("Choose at least one person for this group.");
      return;
    }

    const payload = {
      balancePreview: groups.find((group) => group.id === editingGroupId)?.balancePreview ?? 0,
      color: form.color,
      memberIds: form.memberIds,
      name
    };

    if (editingGroupId) {
      await updateGroup(editingGroupId, payload);
    } else {
      await addGroup(payload);
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
            onPress={closeGroups}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft color={colors.textPrimary} size={22} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: accentColor }]}>Groups</Text>
            <Text style={styles.title}>Manage shared circles</Text>
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
              <Text style={styles.summaryTitle}>{groups.length} groups saved</Text>
              <Text style={styles.summarySub}>
                {formatCurrency(totalOwed)} group balance - {formatCurrency(totalYouOwe)} you owe
              </Text>
            </View>
          </LinearGradient>

          <View style={styles.actionRow}>
            <Pressable
              accessibilityLabel="Manage people"
              accessibilityRole="button"
              onPress={() => router.push(withReturnTo("/people", "groups"))}
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  backgroundColor: accentSoft,
                  borderColor: `${accentColor}33`
                },
                pressed && styles.pressed
              ]}
            >
              <UserRound color={accentColor} size={16} strokeWidth={2.5} />
              <Text style={[styles.secondaryButtonText, { color: accentColor }]}>People</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={isEditing ? "Cancel group form" : "Create group"}
              accessibilityRole="button"
              onPress={isEditing ? resetForm : startAdd}
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: accentColor },
                pressed && styles.pressed
              ]}
            >
              <Plus color={colors.background} size={18} strokeWidth={2.8} />
              <Text style={styles.addButtonText}>{isEditing ? "Cancel" : "Create"}</Text>
            </Pressable>
          </View>

          {isEditing ? (
            <View style={[styles.formCard, { borderColor: `${accentColor}33` }]}>
              <Text style={styles.formTitle}>
                {editingGroupId ? "Edit group" : "New group"}
              </Text>
              <LabeledInput
                label="Group name"
                onChangeText={(name) => updateForm({ name })}
                placeholder="Apartment Crew"
                value={form.name}
              />

              <Text style={styles.optionLabel}>Group color</Text>
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

              <View style={styles.memberHeader}>
                <Text style={styles.optionLabel}>Members</Text>
                <Text style={[styles.memberCount, { color: accentColor }]}>
                  {form.memberIds.length} selected
                </Text>
              </View>

              <View style={styles.memberList}>
                {people.length > 0 ? (
                  people.map((person) => (
                    <MemberRow
                      accentColor={accentColor}
                      accentSoft={accentSoft}
                      key={person.id}
                      onToggle={() => toggleMember(person.id)}
                      person={person}
                      selected={form.memberIds.includes(person.id)}
                    />
                  ))
                ) : (
                  <Text style={styles.emptyInlineText}>
                    Add people before creating a group.
                  </Text>
                )}
              </View>

              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

              <Pressable
                accessibilityLabel={editingGroupId ? "Save group changes" : "Save group"}
                accessibilityRole="button"
                onPress={saveGroup}
                style={({ pressed }) => [
                  styles.saveButton,
                  { backgroundColor: accentColor },
                  pressed && styles.pressed
                ]}
              >
                <Text style={styles.saveButtonText}>
                  {editingGroupId ? "Save Changes" : "Save Group"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {groups.length > 0 ? (
            <View style={styles.groupList}>
              {groups.map((group) => (
                <GroupCard
                  accentColor={accentColor}
                  accentSoft={accentSoft}
                  group={group}
                  key={group.id}
                  onDelete={() => void deleteGroup(group.id)}
                  onEdit={() => startEdit(group)}
                  people={people}
                />
              ))}
            </View>
          ) : (
            <PremiumEmptyState
              actionLabel="Create Group"
              icon={UsersRound}
              message="Create circles for roommates, trips, family plans, or recurring shared expenses."
              onAction={startAdd}
              title="No groups yet"
              tone={accentColor}
            />
          )}
        </ScrollView>
      </View>
    </Screen>
  );
};

const GroupCard = ({
  accentColor,
  accentSoft,
  group,
  onDelete,
  onEdit,
  people
}: {
  accentColor: string;
  accentSoft: string;
  group: MoneyGroup;
  onDelete: () => void;
  onEdit: () => void;
  people: MoneyPerson[];
}) => {
  const members = people.filter((person) => group.memberIds.includes(person.id));
  const isOwedToYou = group.balancePreview >= 0;

  return (
    <View style={styles.groupCard}>
      <View style={styles.groupTop}>
        <View style={[styles.groupIcon, { backgroundColor: `${group.color}28` }]}>
          <UsersRound color={group.color} size={23} strokeWidth={2.5} />
        </View>
        <View style={styles.groupCopy}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.groupMeta}>
            {members.length} members - balance preview
          </Text>
        </View>
        <View style={styles.groupActions}>
          <Pressable
            accessibilityLabel={`Edit ${group.name}`}
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
            accessibilityLabel={`Delete ${group.name}`}
            accessibilityRole="button"
            onPress={onDelete}
            style={({ pressed }) => [styles.iconButtonDanger, pressed && styles.pressed]}
          >
            <Trash2 color={colors.danger} size={16} strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>

      <View style={styles.groupBottom}>
        <AvatarStack members={members} />
        <View style={styles.balanceBlock}>
          <Text
            style={[
              styles.balanceValue,
              { color: isOwedToYou ? colors.accent : colors.warning }
            ]}
          >
            {isOwedToYou ? "+" : "-"}
            {formatCurrency(Math.abs(group.balancePreview))}
          </Text>
          <Text style={styles.balanceMeta}>{isOwedToYou ? "you're owed" : "you owe"}</Text>
        </View>
      </View>
    </View>
  );
};

const AvatarStack = ({ members }: { members: MoneyPerson[] }) => (
  <View style={styles.avatarStack}>
    {members.slice(0, 4).map((person, index) => (
      <View
        key={person.id}
        style={[
          styles.memberAvatar,
          {
            backgroundColor: person.color,
            marginLeft: index === 0 ? 0 : -8,
            zIndex: 5 - index
          }
        ]}
      >
        <Text style={styles.memberInitial}>{getPersonInitial(person.name)}</Text>
      </View>
    ))}
    {members.length > 4 ? (
      <View style={[styles.memberAvatar, styles.moreAvatar, { marginLeft: -8 }]}>
        <Text style={styles.memberInitial}>+{members.length - 4}</Text>
      </View>
    ) : null}
  </View>
);

const MemberRow = ({
  accentColor,
  accentSoft,
  onToggle,
  person,
  selected
}: {
  accentColor: string;
  accentSoft: string;
  onToggle: () => void;
  person: MoneyPerson;
  selected: boolean;
}) => (
  <Pressable
    accessibilityLabel={`${selected ? "Remove" : "Add"} ${person.name}`}
    accessibilityRole="button"
    onPress={onToggle}
    style={({ pressed }) => [
      styles.memberRow,
      selected && [
        styles.memberRowSelected,
        { backgroundColor: accentSoft, borderColor: `${accentColor}80` }
      ],
      pressed && styles.pressed
    ]}
  >
    <View style={[styles.memberPickerAvatar, { backgroundColor: person.color }]}>
      <Text style={styles.memberInitial}>{getPersonInitial(person.name)}</Text>
    </View>
    <View style={styles.memberCopy}>
      <Text style={styles.memberName}>{person.name}</Text>
      <Text style={styles.memberMeta}>{selected ? "Included in group" : "Tap to add"}</Text>
    </View>
    <View
      style={[
        styles.memberCheck,
        selected && [
          styles.memberCheckSelected,
          { backgroundColor: accentColor, borderColor: accentColor }
        ]
      ]}
    >
      {selected ? <Check color={colors.background} size={15} strokeWidth={3} /> : null}
    </View>
  </Pressable>
);

const LabeledInput = ({
  label,
  onChangeText,
  placeholder,
  value
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) => (
  <View style={styles.inputWrap}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
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
    color: "#C084FC",
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
    borderColor: "rgba(192, 132, 252, 0.18)",
    padding: spacing.lg
  },
  summaryIcon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: "rgba(168, 85, 247, 0.16)"
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
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  secondaryButton: {
    minHeight: 38,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.22)",
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md
  },
  secondaryButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  addButton: {
    minHeight: 38,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
    borderColor: "rgba(192, 132, 252, 0.22)",
    backgroundColor: "rgba(17, 25, 35, 0.86)",
    padding: spacing.md
  },
  formTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21
  },
  inputWrap: {
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
  memberHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  memberCount: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15
  },
  memberList: {
    gap: spacing.sm
  },
  memberRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    backgroundColor: "rgba(31, 38, 49, 0.74)",
    paddingHorizontal: spacing.md
  },
  memberRowSelected: {
    borderColor: "rgba(67, 216, 139, 0.55)",
    backgroundColor: "rgba(67, 216, 139, 0.1)"
  },
  memberPickerAvatar: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17
  },
  memberInitial: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16
  },
  memberCopy: {
    minWidth: 0,
    flex: 1
  },
  memberName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  memberMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  memberCheck: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(5, 8, 13, 0.48)"
  },
  memberCheckSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent
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
  groupList: {
    gap: spacing.md
  },
  groupCard: {
    gap: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(17, 25, 35, 0.82)",
    padding: spacing.md
  },
  groupTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  groupIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23
  },
  groupCopy: {
    minWidth: 0,
    flex: 1
  },
  groupName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  groupMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  groupActions: {
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
  groupBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  avatarStack: {
    minWidth: 120,
    flexDirection: "row",
    alignItems: "center"
  },
  memberAvatar: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(17, 25, 35, 0.96)"
  },
  moreAvatar: {
    backgroundColor: "rgba(255, 255, 255, 0.12)"
  },
  balanceBlock: {
    alignItems: "flex-end"
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21
  },
  balanceMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
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
  emptyInlineText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }]
  }
});
