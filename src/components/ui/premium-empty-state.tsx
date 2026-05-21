import { LinearGradient } from "expo-linear-gradient";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppearanceTheme } from "@/features/settings/use-appearance-theme";
import { colors, radii, spacing } from "@/styles/theme";

type PremiumEmptyStateProps = {
  actionLabel?: string;
  icon: LucideIcon;
  message: string;
  onAction?: () => void;
  tone?: string;
  title: string;
};

export const PremiumEmptyState = ({
  actionLabel,
  icon: Icon,
  message,
  onAction,
  tone,
  title
}: PremiumEmptyStateProps) => {
  const { accentColor, palette } = useAppearanceTheme();
  const resolvedTone = tone ?? accentColor;

  return (
    <LinearGradient
      colors={[palette.cardStrong, palette.background]}
      style={styles.card}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: `${resolvedTone}1f`, borderColor: `${resolvedTone}33` }
        ]}
      >
        <Icon color={resolvedTone} size={28} strokeWidth={2.5} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: resolvedTone },
            pressed && styles.pressed
          ]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    minHeight: 210,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 28
  },
  iconWrap: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 30,
    borderWidth: 1
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24,
    marginTop: spacing.sm,
    textAlign: "center"
  },
  message: {
    maxWidth: 270,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    textAlign: "center"
  },
  actionButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg
  },
  actionText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }]
  }
});
