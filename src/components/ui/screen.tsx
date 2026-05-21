import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getThemePalette,
  useAppearanceSettingsStore
} from "@/features/settings/appearance-store";
import { colors, spacing } from "@/styles/theme";

type ScreenProps = PropsWithChildren<{
  withGradient?: boolean;
}>;

export const Screen = ({ children, withGradient = true }: ScreenProps) => {
  const appearance = useAppearanceSettingsStore((state) => state.appearance);
  const loadAppearance = useAppearanceSettingsStore((state) => state.loadAppearance);
  const palette = getThemePalette(appearance.theme);

  useEffect(() => {
    void loadAppearance();
  }, [loadAppearance]);

  const content = (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );

  if (!withGradient) {
    return <View style={[styles.container, { backgroundColor: palette.background }]}>{content}</View>;
  }

  return (
    <LinearGradient
      colors={palette.gradient}
      style={styles.container}
    >
      {content}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  safeArea: {
    flex: 1
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg
  }
});
