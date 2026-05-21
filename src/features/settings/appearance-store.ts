import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export type AccentPreference = "blue" | "emerald" | "gold" | "rose" | "violet";
export type AppIconPreference = "spark" | "timeline" | "vault" | "wallet";
export type ThemePreference = "dark" | "midnight" | "system";

export type AppearanceSettings = {
  accent: AccentPreference;
  appIcon: AppIconPreference;
  theme: ThemePreference;
  updatedAt: string | null;
};

export type ThemePalette = {
  background: string;
  card: string;
  cardStrong: string;
  gradient: readonly [string, string, string];
  navGradient: readonly [string, string];
  surface: string;
  surfaceStrong: string;
};

type AppearanceSettingsState = {
  appearance: AppearanceSettings;
  hasLoaded: boolean;
  loadAppearance: () => Promise<void>;
  updateAppearance: (patch: Partial<Omit<AppearanceSettings, "updatedAt">>) => Promise<void>;
};

export const accentOptions: Array<{
  color: string;
  id: AccentPreference;
  label: string;
  soft: string;
  strong: string;
}> = [
  {
    color: "#43D88B",
    id: "emerald",
    label: "Emerald",
    soft: "rgba(67, 216, 139, 0.16)",
    strong: "#19B86C"
  },
  {
    color: "#4A8CFF",
    id: "blue",
    label: "Sapphire",
    soft: "rgba(74, 140, 255, 0.16)",
    strong: "#2F6FEA"
  },
  {
    color: "#A855F7",
    id: "violet",
    label: "Violet",
    soft: "rgba(168, 85, 247, 0.16)",
    strong: "#8B3FE7"
  },
  {
    color: "#F6A63B",
    id: "gold",
    label: "Gold",
    soft: "rgba(246, 166, 59, 0.16)",
    strong: "#D58417"
  },
  {
    color: "#F45B93",
    id: "rose",
    label: "Rose",
    soft: "rgba(244, 91, 147, 0.16)",
    strong: "#D83B76"
  }
];

export const themeOptions: Array<{ id: ThemePreference; label: string; subtitle: string }> = [
  {
    id: "dark",
    label: "Dark",
    subtitle: "Premium graphite UI"
  },
  {
    id: "midnight",
    label: "Midnight",
    subtitle: "Deeper black canvas"
  },
  {
    id: "system",
    label: "System",
    subtitle: "Follow device setting"
  }
];

export const themePalettes: Record<ThemePreference, ThemePalette> = {
  dark: {
    background: "#05080D",
    card: "rgba(14, 21, 31, 0.82)",
    cardStrong: "rgba(17, 25, 35, 0.94)",
    gradient: ["#05080D", "#07121B", "#05080D"],
    navGradient: ["rgba(17, 25, 35, 0.96)", "rgba(8, 13, 21, 0.98)"],
    surface: "#111923",
    surfaceStrong: "#172231"
  },
  midnight: {
    background: "#000103",
    card: "rgba(7, 10, 15, 0.9)",
    cardStrong: "rgba(9, 13, 19, 0.98)",
    gradient: ["#000000", "#03070D", "#000000"],
    navGradient: ["rgba(8, 11, 17, 0.98)", "rgba(0, 1, 3, 0.99)"],
    surface: "#070B10",
    surfaceStrong: "#0E141D"
  },
  system: {
    background: "#05080D",
    card: "rgba(12, 22, 34, 0.84)",
    cardStrong: "rgba(15, 28, 42, 0.94)",
    gradient: ["#05080D", "#081523", "#05080D"],
    navGradient: ["rgba(15, 26, 40, 0.96)", "rgba(7, 12, 20, 0.98)"],
    surface: "#101B29",
    surfaceStrong: "#17283A"
  }
};

export const appIconOptions: Array<{ id: AppIconPreference; label: string; subtitle: string }> = [
  {
    id: "timeline",
    label: "Timeline",
    subtitle: "Original MoneyTimeline mark"
  },
  {
    id: "wallet",
    label: "Wallet",
    subtitle: "Finance-first icon"
  },
  {
    id: "spark",
    label: "Spark",
    subtitle: "Premium green pulse"
  },
  {
    id: "vault",
    label: "Vault",
    subtitle: "Private and secure"
  }
];

const appearanceStorageKey = "moneytimeline.appearanceSettings.v1";

const defaultAppearance: AppearanceSettings = {
  accent: "emerald",
  appIcon: "timeline",
  theme: "dark",
  updatedAt: null
};

const isAccentPreference = (value: unknown): value is AccentPreference =>
  typeof value === "string" && accentOptions.some((option) => option.id === value);

const isAppIconPreference = (value: unknown): value is AppIconPreference =>
  typeof value === "string" && appIconOptions.some((option) => option.id === value);

const isThemePreference = (value: unknown): value is ThemePreference =>
  typeof value === "string" && themeOptions.some((option) => option.id === value);

const sanitizeAppearance = (value: unknown): AppearanceSettings => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultAppearance;
  }

  const appearance = value as Record<string, unknown>;

  return {
    accent: isAccentPreference(appearance.accent) ? appearance.accent : defaultAppearance.accent,
    appIcon: isAppIconPreference(appearance.appIcon)
      ? appearance.appIcon
      : defaultAppearance.appIcon,
    theme: isThemePreference(appearance.theme) ? appearance.theme : defaultAppearance.theme,
    updatedAt: typeof appearance.updatedAt === "string" ? appearance.updatedAt : null
  };
};

const persistAppearance = async (appearance: AppearanceSettings) => {
  await AsyncStorage.setItem(appearanceStorageKey, JSON.stringify(appearance));
};

export const useAppearanceSettingsStore = create<AppearanceSettingsState>((set, get) => ({
  appearance: defaultAppearance,
  hasLoaded: false,
  loadAppearance: async () => {
    if (get().hasLoaded) {
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(appearanceStorageKey);
      const appearance = stored ? sanitizeAppearance(JSON.parse(stored)) : defaultAppearance;

      set({
        appearance,
        hasLoaded: true
      });
    } catch {
      set({
        appearance: defaultAppearance,
        hasLoaded: true
      });
    }
  },
  updateAppearance: async (patch) => {
    const nextAppearance: AppearanceSettings = {
      ...get().appearance,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    set({ appearance: nextAppearance });
    await persistAppearance(nextAppearance);
  }
}));

export const getAccentOption = (accent: AccentPreference) =>
  accentOptions.find((option) => option.id === accent) ?? accentOptions[0];

export const getAppIconOption = (appIcon: AppIconPreference) =>
  appIconOptions.find((option) => option.id === appIcon) ?? appIconOptions[0];

export const getThemeOption = (theme: ThemePreference) =>
  themeOptions.find((option) => option.id === theme) ?? themeOptions[0];

export const getThemePalette = (theme: ThemePreference) =>
  themePalettes[theme] ?? themePalettes.dark;
