import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { MoneyTimelineLogo } from "@/components/brand/moneytimeline-logo";
import { colors, spacing } from "@/styles/theme";

const SPLASH_DURATION_MS = 2200;

export default function SplashRoute() {
  const router = useRouter();
  const logoScale = useSharedValue(0.9);
  const logoOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0.86);
  const ringOpacity = useSharedValue(0.24);
  const progress = useSharedValue(0);
  const footerOpacity = useSharedValue(0);

  useEffect(() => {
    logoScale.value = withTiming(1, {
      duration: 650,
      easing: Easing.out(Easing.cubic)
    });
    logoOpacity.value = withTiming(1, { duration: 520 });
    ringScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1100, easing: Easing.out(Easing.cubic) }),
        withTiming(0.92, { duration: 1100, easing: Easing.inOut(Easing.cubic) })
      ),
      -1,
      true
    );
    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1100 }),
        withTiming(0.18, { duration: 1100 })
      ),
      -1,
      true
    );
    progress.value = withDelay(
      320,
      withTiming(1, {
        duration: SPLASH_DURATION_MS - 520,
        easing: Easing.out(Easing.cubic)
      })
    );
    footerOpacity.value = withDelay(420, withTiming(1, { duration: 520 }));

    const timeout = setTimeout(() => {
      router.replace("/onboarding");
    }, SPLASH_DURATION_MS);

    return () => clearTimeout(timeout);
  }, [footerOpacity, logoOpacity, logoScale, progress, ringOpacity, ringScale, router]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }]
  }));

  const ringAnimatedStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }]
  }));

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }]
  }));

  const footerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: footerOpacity.value
  }));

  return (
    <LinearGradient
      colors={[colors.background, "#07111A", colors.background]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.logoStage}>
            <Animated.View style={[styles.pulseRing, ringAnimatedStyle]} />
            <Animated.View style={logoAnimatedStyle}>
              <MoneyTimelineLogo size={104} />
            </Animated.View>
          </View>

          <Animated.View style={[styles.footer, footerAnimatedStyle]}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, progressAnimatedStyle]} />
            </View>
            <Text style={styles.loadingText}>Preparing your timeline</Text>
          </Animated.View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl
  },
  logoStage: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 250,
    width: "100%"
  },
  pulseRing: {
    position: "absolute",
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: "transparent"
  },
  footer: {
    position: "absolute",
    bottom: 72,
    alignItems: "center",
    gap: spacing.md,
    width: "100%"
  },
  progressTrack: {
    width: 96,
    height: 3,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: colors.border
  },
  progressFill: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.accent,
    transformOrigin: "left"
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18
  }
});
