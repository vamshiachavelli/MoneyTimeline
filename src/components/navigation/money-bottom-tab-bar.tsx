import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import {
  CalendarDays,
  ChartNoAxesColumn,
  Clock3,
  Settings,
  UsersRound
} from "lucide-react-native";
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  getAccentOption,
  getThemePalette,
  useAppearanceSettingsStore
} from "@/features/settings/appearance-store";
import { colors, radii, spacing } from "@/styles/theme";

type RouteName = "calendar" | "timeline" | "shared" | "insights" | "settings";

type IconComponent = typeof CalendarDays;

const tabConfig: Record<RouteName, { icon: IconComponent; label: string }> = {
  calendar: { icon: CalendarDays, label: "Calendar" },
  timeline: { icon: Clock3, label: "Timeline" },
  shared: { icon: UsersRound, label: "Shared" },
  insights: { icon: ChartNoAxesColumn, label: "Insights" },
  settings: { icon: Settings, label: "Settings" }
};

export const MoneyBottomTabBar = ({
  descriptors,
  insets,
  navigation,
  state
}: BottomTabBarProps) => {
  const appearance = useAppearanceSettingsStore((store) => store.appearance);
  const loadAppearance = useAppearanceSettingsStore((store) => store.loadAppearance);
  const accent = getAccentOption(appearance.accent);
  const palette = getThemePalette(appearance.theme);
  const tabAccentColors = useMemo<Record<RouteName, string>>(
    () => ({
      calendar: accent.color,
      timeline: "#38BDF8",
      shared: colors.warning,
      insights: "#A855F7",
      settings: "#F6C343"
    }),
    [accent.color]
  );
  const getActiveColor = (routeName: string) =>
    tabAccentColors[routeName as RouteName] ?? accent.color;

  useEffect(() => {
    void loadAppearance();
  }, [loadAppearance]);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
    >
      <LinearGradient
        colors={palette.navGradient}
        style={[styles.container, { borderColor: `${accent.color}22` }]}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const options = descriptors[route.key]?.options;
          const config = tabConfig[route.name as RouteName];

          if (!config) {
            return null;
          }

          const Icon = config.icon;
          const activeColor = getActiveColor(route.name);
          const color = isFocused ? activeColor : colors.textMuted;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key
            });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityLabel={options?.tabBarAccessibilityLabel ?? config.label}
              accessibilityRole="tab"
              accessibilityState={isFocused ? { selected: true } : undefined}
              onLongPress={onLongPress}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tab,
                isFocused && styles.activeTab,
                isFocused && { backgroundColor: `${activeColor}14` },
                pressed && styles.pressed
              ]}
            >
              <View
                style={[
                  styles.iconWrap,
                  isFocused && { backgroundColor: `${activeColor}18` }
                ]}
              >
                <Icon color={color} size={22} strokeWidth={isFocused ? 2.8 : 2.2} />
              </View>
              <Text
                numberOfLines={1}
                style={[styles.label, isFocused && styles.activeLabel, { color }]}
              >
                {config.label}
              </Text>
            </Pressable>
          );
        })}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    right: 14,
    bottom: 0,
    left: 14
  },
  container: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.34,
    shadowRadius: 24
  },
  tab: {
    minWidth: 58,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: radii.lg,
    paddingVertical: spacing.xs
  },
  activeTab: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)"
  },
  iconWrap: {
    width: 32,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 14
  },
  activeLabel: {
    fontWeight: "900"
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }]
  }
});
