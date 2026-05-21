import { StyleSheet, Text, View } from "react-native";

import { AppTopBar } from "@/components/navigation/app-top-bar";
import { Screen } from "@/components/ui/screen";
import { useAppearanceTheme } from "@/features/settings/use-appearance-theme";
import { colors, radii, spacing, typography } from "@/styles/theme";

type PlaceholderScreenProps = {
  title: string;
  subtitle: string;
};

export const PlaceholderScreen = ({ title, subtitle }: PlaceholderScreenProps) => {
  const { palette } = useAppearanceTheme();

  return (
    <Screen>
      <AppTopBar />
      <View style={styles.center}>
        <View style={[styles.card, { backgroundColor: palette.card }]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center"
  },
  card: {
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    padding: spacing.xl
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary
  }
});
