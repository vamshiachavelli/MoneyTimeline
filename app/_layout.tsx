import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useMemo } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  getAccentOption,
  getThemePalette,
  useAppearanceSettingsStore
} from "@/features/settings/appearance-store";
import { AppProviders } from "@/providers/app-providers";

SplashScreen.preventAutoHideAsync();

const AppNavigationTheme = ({ children }: { children: React.ReactNode }) => {
  const appearance = useAppearanceSettingsStore((state) => state.appearance);
  const loadAppearance = useAppearanceSettingsStore((state) => state.loadAppearance);
  const accent = getAccentOption(appearance.accent);
  const palette = getThemePalette(appearance.theme);

  useEffect(() => {
    void loadAppearance();
  }, [loadAppearance]);

  const navigationTheme = useMemo(
    () => ({
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        background: palette.background,
        card: palette.surface,
        border: palette.surfaceStrong,
        primary: accent.color,
        text: "#F7FAFC"
      }
    }),
    [accent.color, palette.background, palette.surface, palette.surfaceStrong]
  );

  return <ThemeProvider value={navigationTheme}>{children}</ThemeProvider>;
};

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProviders>
          <AppNavigationTheme>
            <Slot />
          </AppNavigationTheme>
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
