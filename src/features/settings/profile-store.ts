import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import type { Profile } from "@/types/database";

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
  hydrateProfile: (profile: ProfileSettings) => Promise<void>;
  loadedUserId: string | null;
  loadProfile: (userId?: string | null) => Promise<void>;
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
const getProfileStorageKey = (userId?: string | null) =>
  userId ? `${profileStorageKey}.${userId}` : profileStorageKey;

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

const persistProfile = async (profile: ProfileSettings, userId?: string | null) => {
  await AsyncStorage.setItem(getProfileStorageKey(userId), JSON.stringify(profile));
};

export const useProfileSettingsStore = create<ProfileSettingsState>((set, get) => ({
  hasLoaded: false,
  hydrateProfile: async (profile) => {
    set({ profile });
    await persistProfile(profile, get().loadedUserId);
  },
  loadedUserId: null,
  loadProfile: async (userId) => {
    const normalizedUserId = userId ?? null;

    if (get().hasLoaded && get().loadedUserId === normalizedUserId) {
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(getProfileStorageKey(normalizedUserId));
      const profile = stored ? sanitizeProfile(JSON.parse(stored)) : defaultProfile;

      set({
        hasLoaded: true,
        loadedUserId: normalizedUserId,
        profile
      });
    } catch {
      set({
        hasLoaded: true,
        loadedUserId: normalizedUserId,
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
    await persistProfile(nextProfile, get().loadedUserId);
  }
}));

export const syncProfileFromRemote = ({
  authEmail,
  currentProfile,
  remoteProfile
}: {
  authEmail: string;
  currentProfile: ProfileSettings;
  remoteProfile: Profile | null;
}): ProfileSettings => {
  if (!remoteProfile) {
    return {
      ...currentProfile,
      email: authEmail.trim().toLowerCase()
    };
  }

  const firstName = remoteProfile.first_name ?? "";
  const lastName = remoteProfile.last_name ?? "";
  const displayName = remoteProfile.display_name ?? `${firstName} ${lastName}`.trim();

  return {
    ...currentProfile,
    email: authEmail.trim().toLowerCase(),
    firstName,
    fullName: displayName,
    lastName,
    phone: remoteProfile.phone ?? "",
    updatedAt: remoteProfile.updated_at
  };
};

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
