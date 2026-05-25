import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export type ProfileSettings = {
  avatarIcon: ProfileAvatarIcon;
  email: string;
  firstName: string;
  fullName: string;
  lastName: string;
  phone: string;
  updatedAt: string | null;
};

export type ProfileAvatarIcon = "initials" | "sparkles" | "trend" | "user" | "wallet";

type ProfileSettingsState = {
  hasLoaded: boolean;
  loadProfile: () => Promise<void>;
  profile: ProfileSettings;
  updateProfile: (
    patch: Partial<
      Pick<
        ProfileSettings,
        "avatarIcon" | "email" | "firstName" | "fullName" | "lastName" | "phone"
      >
    >
  ) => Promise<void>;
};

const profileStorageKey = "moneytimeline.profileSettings.v1";

const defaultProfile: ProfileSettings = {
  avatarIcon: "initials",
  email: "",
  firstName: "",
  fullName: "",
  lastName: "",
  phone: "",
  updatedAt: null
};

const profileAvatarIcons: ProfileAvatarIcon[] = ["initials", "sparkles", "trend", "user", "wallet"];

const isProfileAvatarIcon = (value: unknown): value is ProfileAvatarIcon =>
  typeof value === "string" && profileAvatarIcons.includes(value as ProfileAvatarIcon);

const splitLegacyName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const [firstName = "", ...rest] = parts;

  return {
    firstName,
    lastName: rest.join(" ")
  };
};

const sanitizeProfile = (value: unknown): ProfileSettings => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultProfile;
  }

  const profile = value as Record<string, unknown>;
  const legacyFullName = typeof profile.fullName === "string" ? profile.fullName : "";
  const legacyName = splitLegacyName(legacyFullName);
  const firstName =
    typeof profile.firstName === "string" ? profile.firstName : legacyName.firstName;
  const lastName = typeof profile.lastName === "string" ? profile.lastName : legacyName.lastName;
  const fullName = `${firstName} ${lastName}`.trim() || legacyFullName.trim();

  return {
    avatarIcon: isProfileAvatarIcon(profile.avatarIcon) ? profile.avatarIcon : "initials",
    email: typeof profile.email === "string" ? profile.email : "",
    firstName,
    fullName,
    lastName,
    phone: typeof profile.phone === "string" ? profile.phone : "",
    updatedAt: typeof profile.updatedAt === "string" ? profile.updatedAt : null
  };
};

const persistProfile = async (profile: ProfileSettings) => {
  await AsyncStorage.setItem(profileStorageKey, JSON.stringify(profile));
};

export const useProfileSettingsStore = create<ProfileSettingsState>((set, get) => ({
  hasLoaded: false,
  loadProfile: async () => {
    if (get().hasLoaded) {
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(profileStorageKey);
      const profile = stored ? sanitizeProfile(JSON.parse(stored)) : defaultProfile;

      set({
        hasLoaded: true,
        profile
      });
    } catch {
      set({
        hasLoaded: true,
        profile: defaultProfile
      });
    }
  },
  profile: defaultProfile,
  updateProfile: async (patch) => {
    const firstName = patch.firstName?.trim() ?? get().profile.firstName;
    const lastName = patch.lastName?.trim() ?? get().profile.lastName;
    const nextProfile: ProfileSettings = {
      ...get().profile,
      ...patch,
      avatarIcon: patch.avatarIcon ?? get().profile.avatarIcon,
      email: patch.email?.trim().toLowerCase() ?? get().profile.email,
      firstName,
      fullName: patch.fullName?.trim() ?? `${firstName} ${lastName}`.trim(),
      lastName,
      phone: patch.phone?.trim() ?? get().profile.phone,
      updatedAt: new Date().toISOString()
    };

    set({ profile: nextProfile });
    await persistProfile(nextProfile);
  }
}));

export const getProfileDisplayName = (profile: ProfileSettings, fallbackName: string) =>
  profile.fullName.trim() ||
  `${profile.firstName} ${profile.lastName}`.trim() ||
  fallbackName;

export const getProfileDisplayEmail = (profile: ProfileSettings, fallbackEmail: string) =>
  profile.email.trim() || fallbackEmail;

export const isProfileForEmail = (profile: ProfileSettings, email: string) => {
  const profileEmail = profile.email.trim().toLowerCase();

  return !profileEmail || profileEmail === email.trim().toLowerCase();
};

export const getProfileInitials = (name: string) => {
  const parts = name.split(" ").filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "MT";
};
