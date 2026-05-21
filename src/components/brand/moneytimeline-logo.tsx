import { TrendingUp } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { useAppearanceTheme } from "@/features/settings/use-appearance-theme";
import { colors, spacing } from "@/styles/theme";

type MoneyTimelineLogoProps = {
  size?: number;
  showWordmark?: boolean;
  centered?: boolean;
};

export const MoneyTimelineLogo = ({
  size = 88,
  showWordmark = true,
  centered = true
}: MoneyTimelineLogoProps) => {
  const { accentColor, accentSoft } = useAppearanceTheme();
  const iconSize = Math.round(size * 0.46);
  const dotSize = Math.max(8, Math.round(size * 0.12));

  return (
    <View style={[styles.container, centered && styles.centered]}>
      <View
        style={[
          styles.mark,
          {
            width: size,
            height: size,
            borderColor: accentColor,
            borderRadius: size / 2,
            backgroundColor: accentSoft,
            shadowColor: accentColor
          }
        ]}
      >
        <View
          style={[
            styles.dot,
            {
              backgroundColor: accentColor,
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              right: Math.round(size * 0.08),
              top: Math.round(size * 0.16)
            }
          ]}
        />
        <TrendingUp color={accentColor} size={iconSize} strokeWidth={2.8} />
      </View>

      {showWordmark ? (
        <View style={[styles.wordmark, centered && styles.centered]}>
          <Text style={styles.name}>
            Money<Text style={[styles.nameAccent, { color: accentColor }]}>Timeline</Text>
          </Text>
          <Text style={styles.tagline}>Your money, day by day.</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg
  },
  centered: {
    alignItems: "center"
  },
  mark: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28
  },
  dot: {
    position: "absolute",
    borderWidth: 2,
    borderColor: colors.background,
    backgroundColor: colors.accent
  },
  wordmark: {
    gap: spacing.xs
  },
  name: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36
  },
  nameAccent: {
    color: colors.accent
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 21
  }
});
