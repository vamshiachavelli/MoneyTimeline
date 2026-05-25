import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Camera,
  Check,
  Image as ImageIcon,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingUp,
  UserRound,
  WalletCards,
  X
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/features/auth/auth-provider";
import {
  getProfileDisplayEmail,
  getProfileDisplayName,
  getProfileInitials,
  syncProfileFromRemote,
  useProfileSettingsStore,
  type ProfileAvatarIcon
} from "@/features/settings/profile-store";
import { useAppearanceTheme } from "@/features/settings/use-appearance-theme";
import {
  getReturnTargetParam,
  getReturnTargetRoute
} from "@/navigation/return-target";
import { profileService } from "@/services/supabase/profile-service";
import { colors, radii, spacing } from "@/styles/theme";

type ProfileForm = {
  avatarIcon: ProfileAvatarIcon;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
};

const avatarOptions: Array<{
  icon: typeof UserRound;
  id: ProfileAvatarIcon;
  label: string;
}> = [
  { icon: UserRound, id: "initials", label: "Initials" },
  { icon: Sparkles, id: "sparkles", label: "Spark" },
  { icon: TrendingUp, id: "trend", label: "Timeline" },
  { icon: WalletCards, id: "wallet", label: "Wallet" },
  { icon: UserRound, id: "user", label: "Person" }
];

const toTitleName = (value: string) =>
  value
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");

const getFallbackName = (email: string, metadataName?: unknown) => {
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  return toTitleName(email.split("@")[0] ?? "") || "Arjun Mehta";
};

const splitName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const [firstName = "", ...rest] = parts;

  return {
    firstName,
    lastName: rest.join(" ")
  };
};

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidPhone = (phone: string) => {
  if (!phone) {
    return true;
  }

  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
};

export const ProfileScreen = () => {
  const router = useRouter();
  const { accentColor, accentSoft, accentStrong, palette } = useAppearanceTheme();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTarget = getReturnTargetParam(params.returnTo) ?? "settings";
  const returnRoute = getReturnTargetRoute(returnTarget) ?? "/settings";
  const { user } = useAuth();
  const profile = useProfileSettingsStore((state) => state.profile);
  const hydrateProfile = useProfileSettingsStore((state) => state.hydrateProfile);
  const loadProfile = useProfileSettingsStore((state) => state.loadProfile);
  const updateProfile = useProfileSettingsStore((state) => state.updateProfile);
  const fallbackEmail = user?.email ?? "";
  const fallbackName = getFallbackName(fallbackEmail, user?.user_metadata?.full_name);
  const displayName = getProfileDisplayName(profile, fallbackName);
  const displayEmail = getProfileDisplayEmail(profile, fallbackEmail);
  const fallbackSplitName = splitName(displayName);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState<ProfileForm>(() => ({
    avatarIcon: profile.avatarIcon,
    email: displayEmail,
    firstName: profile.firstName || fallbackSplitName.firstName,
    lastName: profile.lastName || fallbackSplitName.lastName,
    phone: profile.phone
  }));
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    void loadProfile(user?.id);
  }, [loadProfile, user?.id]);

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
      .catch(() => {
        if (!isMounted) {
          return;
        }

        return hydrateProfile({
          ...useProfileSettingsStore.getState().profile,
          email: user.email ?? ""
        });
      });

    return () => {
      isMounted = false;
    };
  }, [hydrateProfile, user?.email, user?.id]);

  useEffect(() => {
    setForm({
      avatarIcon: profile.avatarIcon,
      email: getProfileDisplayEmail(profile, fallbackEmail),
      firstName: profile.firstName || fallbackSplitName.firstName,
      lastName: profile.lastName || fallbackSplitName.lastName,
      phone: profile.phone
    });
  }, [
    fallbackEmail,
    fallbackSplitName.firstName,
    fallbackSplitName.lastName,
    profile.avatarIcon,
    profile.email,
    profile.firstName,
    profile.lastName,
    profile.phone
  ]);

  const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
  const initials = getProfileInitials(fullName || displayName);
  const avatarOption = useMemo(
    () => avatarOptions.find((option) => option.id === form.avatarIcon) ?? avatarOptions[0],
    [form.avatarIcon]
  );
  const AvatarIcon = avatarOption.icon;

  const updateForm = (patch: Partial<ProfileForm>) => {
    setForm((currentForm) => ({ ...currentForm, ...patch }));
    setErrorMessage("");
    setNotice("");
    setSaveState("idle");
    setDeleteArmed(false);
  };

  const closeProfile = () => {
    router.replace(returnRoute);
  };

  const saveProfile = async () => {
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();

    if (firstName.length < 2) {
      setErrorMessage("First name needs at least 2 characters.");
      return;
    }

    if (lastName.length < 1) {
      setErrorMessage("Last name is required.");
      return;
    }

    if (!isValidEmail(email)) {
      setErrorMessage("Use a valid email address.");
      return;
    }

    if (!isValidPhone(phone)) {
      setErrorMessage("Use a valid phone number or leave it blank.");
      return;
    }

    setSaveState("saving");

    try {
      if (user?.id) {
        await profileService.upsertProfile({
          firstName,
          id: user.id,
          lastName,
          phone
        });
      }

      await updateProfile({
        avatarIcon: form.avatarIcon,
        email: user?.email ?? email,
        firstName,
        lastName,
        phone
      });
      setSaveState("saved");
      setNotice("Profile saved.");
    } catch (error) {
      setSaveState("idle");
      setErrorMessage(
        error instanceof Error ? error.message : "Could not save profile. Please try again."
      );
    }
  };

  const showImagePlaceholder = () => {
    setNotice("Image upload placeholder - camera roll support arrives after MVP.");
    setErrorMessage("");
  };

  const handleDeleteAccount = () => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      setNotice("Delete account is protected. Tap again when Part 2 account deletion is ready.");
      return;
    }

    setNotice("Account deletion placeholder - no data was deleted.");
  };

  return (
    <Screen>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back to settings"
            accessibilityRole="button"
            onPress={closeProfile}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft color={colors.textPrimary} size={22} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: accentColor }]}>Profile</Text>
            <Text style={styles.title}>Edit your identity</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={[accentSoft, palette.cardStrong]}
            style={[styles.heroCard, { borderColor: `${accentColor}33` }]}
          >
            <View style={styles.avatarStage}>
              <LinearGradient
                colors={[accentColor, accentStrong]}
                style={styles.avatarRing}
              >
                <View style={styles.avatar}>
                  {form.avatarIcon === "initials" ? (
                    <Text style={styles.avatarText}>{initials}</Text>
                  ) : (
                    <AvatarIcon color={accentColor} size={36} strokeWidth={2.5} />
                  )}
                </View>
              </LinearGradient>
              <View style={styles.heroCopy}>
                <Text style={styles.heroName}>{fullName || displayName}</Text>
                <Text numberOfLines={1} style={styles.heroEmail}>
                  {form.email}
                </Text>
              </View>
            </View>

            <View style={styles.mediaActions}>
              <Pressable
                accessibilityLabel="Upload profile image"
                accessibilityRole="button"
                onPress={showImagePlaceholder}
                style={({ pressed }) => [styles.mediaButton, pressed && styles.pressed]}
              >
                <Camera color={accentColor} size={16} strokeWidth={2.5} />
                <Text style={styles.mediaButtonText}>Upload Image</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Choose profile icon"
                accessibilityRole="button"
                onPress={() => setNotice("Choose an icon below for now.")}
                style={({ pressed }) => [styles.mediaButton, pressed && styles.pressed]}
              >
                <ImageIcon color={colors.textSecondary} size={16} strokeWidth={2.5} />
                <Text style={styles.mediaButtonText}>Select Icon</Text>
              </Pressable>
            </View>
          </LinearGradient>

          {notice ? (
            <View
              style={[
                styles.noticeBanner,
                { backgroundColor: accentSoft, borderColor: `${accentColor}33` }
              ]}
            >
              <ShieldAlert color={accentColor} size={17} strokeWidth={2.5} />
              <Text style={[styles.noticeText, { color: accentColor }]}>{notice}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile details</Text>
            <View style={styles.inputGrid}>
              <ProfileInput
                label="First name"
                onChangeText={(firstName) => updateForm({ firstName })}
                placeholder="Arjun"
                value={form.firstName}
              />
              <ProfileInput
                label="Last name"
                onChangeText={(lastName) => updateForm({ lastName })}
                placeholder="Mehta"
                value={form.lastName}
              />
            </View>
            <ProfileInput
              autoCapitalize="none"
              editable={false}
              keyboardType="email-address"
              label="Email from sign in"
              onChangeText={(email) => updateForm({ email })}
              placeholder="you@email.com"
              value={form.email}
            />
            <ProfileInput
              keyboardType="phone-pad"
              label="Phone number"
              onChangeText={(phone) => updateForm({ phone })}
              placeholder="(555) 010-0000"
              value={form.phone}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Avatar icon</Text>
              <Text style={[styles.sectionMeta, { color: accentColor }]}>
                {avatarOption.label}
              </Text>
            </View>
            <View style={styles.avatarOptionRow}>
              {avatarOptions.map((option) => {
                const Icon = option.icon;
                const active = form.avatarIcon === option.id;

                return (
                  <Pressable
                    accessibilityLabel={`Choose ${option.label} avatar`}
                    accessibilityRole="button"
                    key={option.id}
                    onPress={() => updateForm({ avatarIcon: option.id })}
                    style={({ pressed }) => [
                      styles.avatarOption,
                      active && [
                        styles.avatarOptionActive,
                        { backgroundColor: accentColor, borderColor: `${accentColor}80` }
                      ],
                      pressed && styles.pressed
                    ]}
                  >
                    {option.id === "initials" ? (
                      <Text style={[styles.avatarOptionInitials, active && styles.avatarOptionTextActive]}>
                        {initials}
                      </Text>
                    ) : (
                      <Icon
                        color={active ? colors.background : colors.textSecondary}
                        size={19}
                        strokeWidth={2.5}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Pressable
            accessibilityLabel="Save profile changes"
            accessibilityRole="button"
            disabled={saveState === "saving"}
            onPress={() => void saveProfile()}
            style={({ pressed }) => [
              styles.saveButton,
              { backgroundColor: accentColor },
              pressed && styles.pressed
            ]}
          >
            {saveState === "saved" ? (
              <Check color={colors.background} size={18} strokeWidth={3} />
            ) : (
              <Save color={colors.background} size={18} strokeWidth={2.7} />
            )}
            <Text style={styles.saveButtonText}>
              {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving" : "Save Changes"}
            </Text>
          </Pressable>

          <View style={styles.dangerCard}>
            <View style={styles.dangerIcon}>
              <Trash2 color={colors.danger} size={20} strokeWidth={2.5} />
            </View>
            <View style={styles.dangerCopy}>
              <Text style={styles.dangerTitle}>Delete account</Text>
              <Text style={styles.dangerText}>
                Protected for now. Future account deletion will require a two-step confirmation.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Delete account"
              accessibilityRole="button"
              onPress={handleDeleteAccount}
              style={({ pressed }) => [styles.deleteButton, deleteArmed && styles.deleteButtonArmed, pressed && styles.pressed]}
            >
              <Text style={styles.deleteButtonText}>{deleteArmed ? "Armed" : "Delete"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
};

const ProfileInput = ({
  autoCapitalize = "words",
  editable = true,
  keyboardType,
  label,
  onChangeText,
  placeholder,
  value
}: {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  editable?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) => (
  <View style={styles.inputBlock}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      autoCapitalize={autoCapitalize}
      editable={editable}
      keyboardType={keyboardType}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      style={[styles.input, !editable && styles.inputDisabled]}
      value={value}
    />
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  header: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
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
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 31
  },
  content: {
    gap: spacing.md,
    paddingBottom: 118
  },
  heroCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: spacing.lg
  },
  avatarStage: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  avatarRing: {
    width: 82,
    height: 82,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 41
  },
  avatar: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 36,
    backgroundColor: "#172231"
  },
  avatarText: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: "900"
  },
  heroCopy: {
    minWidth: 0,
    flex: 1
  },
  heroName: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28
  },
  heroEmail: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  mediaActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  mediaButton: {
    minHeight: 40,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    paddingHorizontal: spacing.sm
  },
  mediaButtonText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17
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
  section: {
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(14, 21, 31, 0.82)",
    padding: spacing.md
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  sectionMeta: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15
  },
  inputGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  inputBlock: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 14,
    textTransform: "uppercase"
  },
  input: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(5, 8, 13, 0.72)",
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
    paddingHorizontal: spacing.md
  },
  inputDisabled: {
    color: colors.textSecondary,
    backgroundColor: "rgba(5, 8, 13, 0.38)"
  },
  avatarOptionRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  avatarOption: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.05)"
  },
  avatarOptionActive: {
    borderColor: "rgba(67, 216, 139, 0.5)",
    backgroundColor: colors.accent
  },
  avatarOptionInitials: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17
  },
  avatarOptionTextActive: {
    color: colors.background
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17
  },
  saveButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md
  },
  saveButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  dangerCard: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.22)",
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    padding: spacing.md
  },
  dangerIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255, 107, 107, 0.13)"
  },
  dangerCopy: {
    minWidth: 0,
    flex: 1
  },
  dangerTitle: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  dangerText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16
  },
  deleteButton: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: "rgba(255, 107, 107, 0.14)",
    paddingHorizontal: spacing.md
  },
  deleteButtonArmed: {
    backgroundColor: "rgba(255, 107, 107, 0.28)"
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }]
  }
});
