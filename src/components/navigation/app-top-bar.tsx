import { usePathname, useRouter } from "expo-router";
import { Search, TrendingUp, Upload } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppearanceTheme } from "@/features/settings/use-appearance-theme";
import { getReturnTargetForPathname, withReturnTo } from "@/navigation/return-target";
import { colors, spacing } from "@/styles/theme";

export const AppTopBar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const returnTarget = getReturnTargetForPathname(pathname);
  const { accentColor, accentSoft, palette } = useAppearanceTheme();

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <Pressable
          accessibilityLabel="Open splash screen"
          accessibilityRole="button"
          onPress={() => router.push("/splash")}
          style={({ pressed }) => [
            styles.logoButton,
            { backgroundColor: accentSoft, borderColor: accentColor },
            pressed && styles.pressed
          ]}
        >
          <TrendingUp color={accentColor} size={17} strokeWidth={2.8} />
        </Pressable>

        <Text style={styles.wordmark}>
          Money<Text style={[styles.wordmarkAccent, { color: accentColor }]}>Timeline</Text>
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityLabel="Search"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: palette.surface },
            pressed && styles.pressed
          ]}
        >
          <Search color={colors.textSecondary} size={19} strokeWidth={2.4} />
        </Pressable>

        <Pressable
          accessibilityLabel="Import statement"
          accessibilityRole="button"
          onPress={() => router.push(withReturnTo("/import", returnTarget))}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: palette.surface },
            pressed && styles.pressed
          ]}
        >
          <Upload color={colors.textSecondary} size={19} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    paddingBottom: spacing.md
  },
  brand: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  logoButton: {
    width: 29,
    height: 29,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft
  },
  wordmark: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 22
  },
  wordmarkAccent: {
    color: colors.accent
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: colors.surface
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }]
  }
});
