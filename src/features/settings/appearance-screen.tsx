import { LinearGradient } from "expo-linear-gradient";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  CalendarDays,
  ChartNoAxesColumn,
  Check,
  Clock3,
  MonitorSmartphone,
  Moon,
  Palette,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UsersRound,
  WalletCards
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import {
  accentOptions,
  appIconOptions,
  getAccentOption,
  getAppIconOption,
  getThemePalette,
  getThemeOption,
  themeOptions,
  useAppearanceSettingsStore,
  type AccentPreference,
  type AppIconPreference,
  type ThemePreference
} from "@/features/settings/appearance-store";
import {
  getReturnTargetParam,
  getReturnTargetRoute
} from "@/navigation/return-target";
import { colors, radii, spacing } from "@/styles/theme";

type AppearanceForm = {
  accent: AccentPreference;
  appIcon: AppIconPreference;
  theme: ThemePreference;
};

const iconMap: Record<AppIconPreference, typeof TrendingUp> = {
  spark: Sparkles,
  timeline: TrendingUp,
  vault: ShieldCheck,
  wallet: WalletCards
};

const themeIconMap: Record<ThemePreference, typeof Moon> = {
  dark: Moon,
  midnight: Sparkles,
  system: MonitorSmartphone
};

const quickTabs: Array<{
  icon: typeof CalendarDays;
  label: string;
  route: Href;
}> = [
  { icon: CalendarDays, label: "Calendar", route: "/calendar" },
  { icon: Clock3, label: "Timeline", route: "/timeline" },
  { icon: UsersRound, label: "Shared", route: "/shared" },
  { icon: ChartNoAxesColumn, label: "Insights", route: "/insights" },
  { icon: SettingsIcon, label: "Settings", route: "/settings" }
];

export const AppearanceScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTarget = getReturnTargetParam(params.returnTo) ?? "settings";
  const returnRoute = getReturnTargetRoute(returnTarget) ?? "/settings";
  const appearance = useAppearanceSettingsStore((state) => state.appearance);
  const loadAppearance = useAppearanceSettingsStore((state) => state.loadAppearance);
  const updateAppearance = useAppearanceSettingsStore((state) => state.updateAppearance);
  const [form, setForm] = useState<AppearanceForm>({
    accent: appearance.accent,
    appIcon: appearance.appIcon,
    theme: appearance.theme
  });
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    void loadAppearance();
  }, [loadAppearance]);

  useEffect(() => {
    setForm({
      accent: appearance.accent,
      appIcon: appearance.appIcon,
      theme: appearance.theme
    });
  }, [appearance.accent, appearance.appIcon, appearance.theme]);

  const accent = useMemo(() => getAccentOption(form.accent), [form.accent]);
  const selectedIcon = useMemo(() => getAppIconOption(form.appIcon), [form.appIcon]);
  const selectedTheme = useMemo(() => getThemeOption(form.theme), [form.theme]);
  const palette = useMemo(() => getThemePalette(form.theme), [form.theme]);
  const PreviewIcon = iconMap[form.appIcon];

  const updateForm = (patch: Partial<AppearanceForm>) => {
    setForm((currentForm) => ({ ...currentForm, ...patch }));
    setNotice("");
    setSaveState("idle");
  };

  const closeAppearance = () => {
    router.replace(returnRoute);
  };

  const saveAppearance = async () => {
    setSaveState("saving");
    await updateAppearance(form);
    setSaveState("saved");
    setNotice("Appearance saved.");
  };

  return (
    <Screen>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back to settings"
            accessibilityRole="button"
            onPress={closeAppearance}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: palette.surface },
              pressed && styles.pressed
            ]}
          >
            <ArrowLeft color={colors.textPrimary} size={22} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: accent.color }]}>Appearance</Text>
            <Text style={styles.title}>Make it feel yours</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={[`${accent.color}38`, palette.cardStrong]}
            style={[styles.previewCard, { borderColor: `${accent.color}44` }]}
          >
            <View style={styles.previewTop}>
              <LinearGradient colors={[accent.color, accent.strong]} style={styles.previewIconRing}>
                <View style={styles.previewIcon}>
                  <PreviewIcon color={colors.background} size={28} strokeWidth={2.7} />
                </View>
              </LinearGradient>
              <View style={styles.previewText}>
                <Text style={styles.previewTitle}>MoneyTimeline</Text>
                <Text style={styles.previewSubtitle}>
                  {accent.label} accent, {selectedTheme.label.toLowerCase()} theme
                </Text>
              </View>
              <View style={[styles.previewPill, { backgroundColor: accent.soft }]}>
                <Text style={[styles.previewPillText, { color: accent.color }]}>
                  {selectedIcon.label}
                </Text>
              </View>
            </View>

            <View style={[styles.phonePreview, { backgroundColor: palette.card }]}>
              <View style={styles.phoneHeader}>
                <View>
                  <Text style={styles.phoneMonth}>May 2026</Text>
                  <Text style={styles.phoneMeta}>21 transactions</Text>
                </View>
                <View style={[styles.phoneSearch, { backgroundColor: accent.soft }]}>
                  <Palette color={accent.color} size={17} strokeWidth={2.6} />
                </View>
              </View>

              <View style={[styles.phoneTotalCard, { backgroundColor: palette.cardStrong }]}>
                <Text style={[styles.phoneTotalLabel, { color: accent.color }]}>TOTAL SPENT</Text>
                <Text style={styles.phoneTotalValue}>$945.32</Text>
                <View style={styles.previewBars}>
                  {[16, 28, 22, 34, 26, 39].map((height, index) => (
                    <View
                      key={`${height}-${index}`}
                      style={[
                        styles.previewBar,
                        {
                          backgroundColor: accent.color,
                          height
                        }
                      ]}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.phoneNav}>
                {["Calendar", "Timeline", "Shared", "Settings"].map((label) => {
                  const active = label === "Settings";

                  return (
                    <Pressable
                      accessibilityLabel={`Open ${label} tab`}
                      accessibilityRole="button"
                      key={label}
                      onPress={() => router.replace(
                        quickTabs.find((tab) => tab.label === label)?.route ?? "/settings"
                      )}
                      style={({ pressed }) => [
                        styles.phoneNavItem,
                        active && { backgroundColor: accent.soft },
                        pressed && styles.pressed
                      ]}
                    >
                      <Text
                        style={[
                          styles.phoneNavText,
                          active && { color: accent.color }
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </LinearGradient>

          {notice ? (
            <View style={[styles.noticeBanner, { backgroundColor: accent.soft, borderColor: `${accent.color}44` }]}>
              <Check color={accent.color} size={17} strokeWidth={2.7} />
              <Text style={[styles.noticeText, { color: accent.color }]}>{notice}</Text>
            </View>
          ) : null}

          <View style={[styles.section, { backgroundColor: palette.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Accent color</Text>
              <Text style={[styles.sectionMeta, { color: accent.color }]}>{accent.label}</Text>
            </View>
            <View style={styles.swatchGrid}>
              {accentOptions.map((option) => {
                const active = form.accent === option.id;

                return (
                  <Pressable
                    accessibilityLabel={`Choose ${option.label} accent`}
                    accessibilityRole="button"
                    key={option.id}
                    onPress={() => updateForm({ accent: option.id })}
                    style={({ pressed }) => [
                      styles.swatchButton,
                      active && {
                        borderColor: option.color,
                        backgroundColor: option.soft
                      },
                      pressed && styles.pressed
                    ]}
                  >
                    <View style={[styles.swatch, { backgroundColor: option.color }]} />
                    <Text style={styles.swatchLabel}>{option.label}</Text>
                    {active ? <Check color={option.color} size={16} strokeWidth={3} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: palette.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Theme preference</Text>
              <Text style={[styles.sectionMeta, { color: accent.color }]}>{selectedTheme.label}</Text>
            </View>
            <View style={styles.optionStack}>
              {themeOptions.map((option) => {
                const Icon = themeIconMap[option.id];
                const active = form.theme === option.id;

                return (
                  <SelectableRow
                    active={active}
                    accentColor={accent.color}
                    accentSoft={accent.soft}
                    icon={Icon}
                    key={option.id}
                    onPress={() => updateForm({ theme: option.id })}
                    subtitle={option.subtitle}
                    title={option.label}
                  />
                );
              })}
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: palette.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>App icon</Text>
              <Text style={[styles.sectionMeta, { color: accent.color }]}>{selectedIcon.label}</Text>
            </View>
            <View style={styles.optionStack}>
              {appIconOptions.map((option) => {
                const Icon = iconMap[option.id];
                const active = form.appIcon === option.id;

                return (
                  <SelectableRow
                    active={active}
                    accentColor={accent.color}
                    accentSoft={accent.soft}
                    icon={Icon}
                    key={option.id}
                    onPress={() => updateForm({ appIcon: option.id })}
                    subtitle={option.subtitle}
                    title={option.label}
                  />
                );
              })}
            </View>
            <Text style={styles.sectionFootnote}>
              App icon preference is saved now. Native icon switching will use this choice during release setup.
            </Text>
          </View>

          <Pressable
            accessibilityLabel="Save appearance"
            accessibilityRole="button"
            disabled={saveState === "saving"}
            onPress={() => void saveAppearance()}
            style={({ pressed }) => [
              styles.saveButton,
              { backgroundColor: accent.color },
              pressed && styles.pressed
            ]}
          >
            {saveState === "saved" ? (
              <Check color={colors.background} size={18} strokeWidth={3} />
            ) : (
              <Save color={colors.background} size={18} strokeWidth={2.7} />
            )}
            <Text style={styles.saveButtonText}>
              {saveState === "saved"
                ? "Saved"
                : saveState === "saving"
                  ? "Saving"
                  : "Save Appearance"}
            </Text>
          </Pressable>
        </ScrollView>
        <LinearGradient
          colors={palette.navGradient}
          style={[styles.quickNav, { borderColor: `${accent.color}22` }]}
        >
          {quickTabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.label === "Settings";
            const tabColor = active ? accent.color : colors.textMuted;

            return (
              <Pressable
                accessibilityLabel={`Open ${tab.label} tab`}
                accessibilityRole="button"
                accessibilityState={active ? { selected: true } : undefined}
                key={tab.label}
                onPress={() => router.replace(tab.route)}
                style={({ pressed }) => [
                  styles.quickNavItem,
                  active && { backgroundColor: accent.soft },
                  pressed && styles.pressed
                ]}
              >
                <Icon color={tabColor} size={20} strokeWidth={active ? 2.8 : 2.2} />
                <Text style={[styles.quickNavLabel, { color: tabColor }]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </LinearGradient>
      </View>
    </Screen>
  );
};

const SelectableRow = ({
  accentColor,
  accentSoft,
  active,
  icon: Icon,
  onPress,
  subtitle,
  title
}: {
  accentColor: string;
  accentSoft: string;
  active: boolean;
  icon: typeof Moon;
  onPress: () => void;
  subtitle: string;
  title: string;
}) => (
  <Pressable
    accessibilityLabel={title}
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [
      styles.optionRow,
      active && {
        borderColor: `${accentColor}88`,
        backgroundColor: accentSoft
      },
      pressed && styles.pressed
    ]}
  >
    <View style={[styles.optionIcon, { backgroundColor: active ? accentColor : "rgba(255, 255, 255, 0.06)" }]}>
      <Icon color={active ? colors.background : colors.textSecondary} size={19} strokeWidth={2.5} />
    </View>
    <View style={styles.optionText}>
      <Text style={styles.optionTitle}>{title}</Text>
      <Text style={styles.optionSubtitle}>{subtitle}</Text>
    </View>
    {active ? <Check color={accentColor} size={18} strokeWidth={3} /> : null}
  </Pressable>
);

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  header: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: colors.surface
  },
  headerCopy: {
    minWidth: 0,
    flex: 1
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 15,
    textTransform: "uppercase"
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 31
  },
  content: {
    gap: spacing.md,
    paddingBottom: 132
  },
  previewCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.34,
    shadowRadius: 28
  },
  previewTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  previewIconRing: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 29
  },
  previewIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.9)"
  },
  previewText: {
    minWidth: 0,
    flex: 1
  },
  previewTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24
  },
  previewSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  previewPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  previewPillText: {
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 14
  },
  phonePreview: {
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(5, 8, 13, 0.72)",
    marginTop: spacing.lg,
    padding: spacing.md
  },
  phoneHeader: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  phoneMonth: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  phoneMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  phoneSearch: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18
  },
  phoneTotalCard: {
    minHeight: 94,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    padding: spacing.md
  },
  phoneTotalLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 14
  },
  phoneTotalValue: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 31
  },
  previewBars: {
    height: 40,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginTop: spacing.xs
  },
  previewBar: {
    width: 5,
    borderRadius: 3
  },
  phoneNav: {
    flexDirection: "row",
    gap: spacing.xs
  },
  phoneNavItem: {
    minWidth: 0,
    flex: 1,
    alignItems: "center",
    borderRadius: radii.md,
    paddingVertical: spacing.sm
  },
  phoneNavText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "900",
    lineHeight: 13
  },
  quickNav: {
    position: "absolute",
    right: 0,
    bottom: 12,
    left: 0,
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.34,
    shadowRadius: 24
  },
  quickNavItem: {
    minWidth: 0,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: radii.lg,
    paddingVertical: spacing.xs
  },
  quickNavLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 14
  },
  noticeBanner: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  noticeText: {
    minWidth: 0,
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16
  },
  section: {
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(14, 21, 31, 0.82)",
    padding: spacing.md
  },
  sectionHeader: {
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19
  },
  sectionMeta: {
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15
  },
  swatchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  swatchButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  swatch: {
    width: 20,
    height: 20,
    borderRadius: 10
  },
  swatchLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17
  },
  optionStack: {
    gap: spacing.sm
  },
  optionRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(5, 8, 13, 0.6)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  optionIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17
  },
  optionText: {
    minWidth: 0,
    flex: 1
  },
  optionTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18
  },
  optionSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15
  },
  sectionFootnote: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 15
  },
  saveButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 18
  },
  saveButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }]
  }
});
