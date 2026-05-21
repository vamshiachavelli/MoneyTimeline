import { useEffect, useMemo } from "react";

import {
  getAccentOption,
  getThemePalette,
  useAppearanceSettingsStore
} from "@/features/settings/appearance-store";

export const withAlpha = (color: string, alphaHex: string) =>
  color.startsWith("#") && color.length === 7 ? `${color}${alphaHex}` : color;

export const useAppearanceTheme = () => {
  const appearance = useAppearanceSettingsStore((state) => state.appearance);
  const loadAppearance = useAppearanceSettingsStore((state) => state.loadAppearance);

  useEffect(() => {
    void loadAppearance();
  }, [loadAppearance]);

  return useMemo(() => {
    const accent = getAccentOption(appearance.accent);
    const palette = getThemePalette(appearance.theme);

    return {
      accent,
      accentColor: accent.color,
      accentSoft: accent.soft,
      accentStrong: accent.strong,
      appearance,
      palette
    };
  }, [appearance]);
};
