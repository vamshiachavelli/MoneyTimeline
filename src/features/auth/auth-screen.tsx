import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Target,
  TrendingUp,
  UserRound,
  Utensils
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/auth-provider";
import { authService } from "@/features/auth/auth-service";
import { colors, radii, spacing } from "@/styles/theme";

type AuthMode = "login" | "signup";

type AuthScreenProps = {
  mode: AuthMode;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeAuthError = (message: string) => {
  const normalized = message.toLowerCase();

  if (normalized.includes("email rate limit")) {
    return "Supabase has sent too many signup emails. Try signing in with an existing account, wait a bit before creating another account, or disable email confirmation/customize SMTP in Supabase Auth while testing.";
  }

  if (normalized.includes("invalid login")) {
    return "That email and password combination was not found.";
  }

  return message;
};

export const AuthScreen = ({ mode }: AuthScreenProps) => {
  const router = useRouter();
  const { isLoading: isAuthLoading, session } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isSignup = mode === "signup";

  useEffect(() => {
    if (!isAuthLoading && session) {
      router.replace("/calendar");
    }
  }, [isAuthLoading, router, session]);

  const validationMessage = useMemo(() => {
    if (isSignup && fullName.trim().length > 0 && fullName.trim().length < 2) {
      return "Enter your full name.";
    }

    if (email.trim().length > 0 && !emailPattern.test(email.trim())) {
      return "Enter a valid email address.";
    }

    if (password.length > 0 && password.length < 8) {
      return "Password must be at least 8 characters.";
    }

    if (isSignup && confirmPassword.length > 0 && confirmPassword !== password) {
      return "Passwords do not match.";
    }

    return "";
  }, [confirmPassword, email, fullName, isSignup, password]);

  const passwordStrength = password.length >= 12 ? "Strong" : password.length >= 8 ? "Medium" : "Weak";

  const handleSubmit = async () => {
    setError("");

    if (!emailPattern.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (isSignup && fullName.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }

    if (isSignup && confirmPassword !== password) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSignup) {
        const { data, error: signUpError } = await authService.signUp(
          email,
          password,
          fullName
        );

        if (signUpError) {
          throw signUpError;
        }

        if (data.session) {
          router.replace("/calendar");
        }

        return;
      }

      const { error: signInError } = await authService.signIn(email, password);

      if (signInError) {
        throw signInError;
      }

      router.replace("/calendar");
    } catch (authError) {
      const message =
        authError instanceof Error
          ? authError.message
          : "Authentication failed. Please try again.";
      setError(normalizeAuthError(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={["#030508", "#061018", "#020304"]} style={styles.container}>
      <View style={styles.greenAura} />
      <View style={styles.orangeAura} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              isSignup ? styles.signupContent : styles.loginContent
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topSection}>
              <BrandHeader compact={!isSignup} />
              {isSignup ? (
                <SignupHero />
              ) : (
                <LoginHero />
              )}
            </View>

            <View style={styles.bottomContainer}>
              <View style={[styles.formWrap, isSignup && styles.signupFormWrap]}>
                {isSignup ? (
                  <AuthField
                    icon="user"
                    onChangeText={setFullName}
                    placeholder="Full name"
                    textContentType="name"
                    value={fullName}
                  />
                ) : null}

                <AuthField
                  autoCapitalize="none"
                  autoComplete="email"
                  icon="mail"
                  inputMode="email"
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder={isSignup ? "Email address" : "Email address"}
                  textContentType="emailAddress"
                  value={email}
                />

                <AuthField
                  autoCapitalize="none"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  icon="lock"
                  onChangeText={setPassword}
                  placeholder="Password"
                  rightElement={
                    <PasswordToggle
                      showPassword={showPassword}
                      setShowPassword={setShowPassword}
                    />
                  }
                  secureTextEntry={!showPassword}
                  textContentType={isSignup ? "newPassword" : "password"}
                  value={password}
                />

                {isSignup ? (
                  <>
                    <AuthField
                      autoCapitalize="none"
                      autoComplete="new-password"
                      icon="lock"
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm password"
                      rightElement={
                        <PasswordToggle
                          showPassword={showPassword}
                          setShowPassword={setShowPassword}
                        />
                      }
                      secureTextEntry={!showPassword}
                      textContentType="newPassword"
                      value={confirmPassword}
                    />

                    <View style={styles.strengthRow}>
                      <Text style={styles.strengthLabel}>Password strength</Text>
                      <Text style={styles.strengthValue}>{passwordStrength}</Text>
                    </View>
                    <View style={styles.strengthBars}>
                      <View style={styles.strengthBarActive} />
                      <View style={passwordStrength !== "Weak" ? styles.strengthBarActive : styles.strengthBarMuted} />
                      <View style={passwordStrength === "Strong" ? styles.strengthBarActive : styles.strengthBarMuted} />
                      <View style={styles.strengthBarMuted} />
                    </View>
                  </>
                ) : (
                  <Pressable accessibilityRole="button" style={styles.forgotButton}>
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </Pressable>
                )}

                {validationMessage ? (
                  <Text style={styles.validationText}>{validationMessage}</Text>
                ) : null}
                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <Pressable
                  accessibilityLabel={isSignup ? "Create Account" : "Log In"}
                  accessibilityRole="button"
                  disabled={isSubmitting}
                  onPress={handleSubmit}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.pressed
                  ]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={colors.background} />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>
                        {isSignup ? "Create Account" : "Log In"}
                      </Text>
                      <ArrowRight color={colors.background} size={24} strokeWidth={2.8} />
                    </>
                  )}
                </Pressable>

                <SecurityNotice />
              </View>

              <SocialSection stacked={!isSignup} />

              <View style={styles.bottomCopy}>
                <Text style={styles.bottomText}>
                  {isSignup ? "Already have an account?" : "Don't have an account?"}
                </Text>
                <Link href={isSignup ? "/login" : "/signup"} style={styles.bottomLink}>
                  {isSignup ? "Sign in" : "Sign up"}
                </Link>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const SecurityNotice = () => (
  <View style={styles.securityNotice}>
    <LockKeyhole color={colors.accent} size={12} strokeWidth={2.5} />
    <Text style={styles.securityText}>Secured with bank-grade encryption</Text>
  </View>
);

type AuthFieldProps = {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: "email" | "current-password" | "new-password" | "name";
  icon: "mail" | "lock" | "user";
  inputMode?: "email" | "text";
  keyboardType?: "default" | "email-address";
  onChangeText: (value: string) => void;
  placeholder: string;
  rightElement?: React.ReactNode;
  secureTextEntry?: boolean;
  textContentType?: "emailAddress" | "password" | "newPassword" | "name";
  value: string;
};

const AuthField = ({
  autoCapitalize,
  autoComplete,
  icon,
  inputMode,
  keyboardType,
  onChangeText,
  placeholder,
  rightElement,
  secureTextEntry,
  textContentType,
  value
}: AuthFieldProps) => {
  const Icon = icon === "mail" ? Mail : icon === "lock" ? LockKeyhole : UserRound;

  return (
    <View style={styles.field}>
      <Icon color={colors.textSecondary} size={19} strokeWidth={2.2} />
      <TextInput
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        inputMode={inputMode}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#B7C0CC"
        secureTextEntry={secureTextEntry}
        style={styles.input}
        textContentType={textContentType}
        value={value}
      />
      {rightElement}
    </View>
  );
};

const PasswordToggle = ({
  setShowPassword,
  showPassword
}: {
  setShowPassword: (value: boolean | ((value: boolean) => boolean)) => void;
  showPassword: boolean;
}) => (
  <Pressable
    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
    accessibilityRole="button"
    onPress={() => setShowPassword((value) => !value)}
    style={({ pressed }) => [styles.eyeButton, pressed && styles.pressed]}
  >
    {showPassword ? (
      <EyeOff color={colors.textSecondary} size={18} />
    ) : (
      <Eye color={colors.textSecondary} size={18} />
    )}
  </Pressable>
);

const PhoneStatus = () => (
  <View style={styles.statusBar}>
    <Text style={styles.statusTime}>9:41</Text>
    <View style={styles.statusRight}>
      <View style={styles.signalBars}>
        <View style={[styles.signalBar, { height: 7 }]} />
        <View style={[styles.signalBar, { height: 10 }]} />
        <View style={[styles.signalBar, { height: 13 }]} />
      </View>
      <View style={styles.wifi} />
      <View style={styles.battery}>
        <View style={styles.batteryFill} />
      </View>
    </View>
  </View>
);

const BrandHeader = ({ compact }: { compact?: boolean }) => (
  <View style={[styles.brandHeader, compact && styles.brandHeaderCompact]}>
    <View style={styles.brandLogo}>
      <TrendingUp color={colors.accent} size={25} strokeWidth={2.8} />
    </View>
    <Text style={styles.brandText}>
      Money<Text style={styles.greenText}>Timeline</Text>
    </Text>
  </View>
);

const SignupHero = () => (
  <View style={styles.signupHero}>
    <MerchantBubble brand="starbucks" style={styles.signupStarbucks} />
    <MerchantBubble brand="target" style={styles.signupTarget} />
    <MerchantBubble brand="amazon" style={styles.signupAmazon} />
    <MerchantBubble brand="food" style={styles.signupFood} />
    <View style={styles.dottedPathOne} />
    <View style={styles.dottedPathTwo} />
    <Text style={styles.signupTitle}>
      Start your{"\n"}financial <Text style={styles.greenText}>timeline</Text>
    </Text>
    <Text style={styles.signupSubtitle}>
      Visualize. Classify. Split.{"\n"}All in one <Text style={styles.greenText}>beautiful</Text> timeline.
    </Text>
  </View>
);

const LoginHero = () => (
  <View style={styles.loginHero}>
    <FloatingTransaction brand="starbucks" label="Starbucks" amount="-$5.60" style={styles.loginChipOne} />
    <FloatingTransaction brand="uber" label="Uber" amount="-$18.75" style={styles.loginChipTwo} />
    <FloatingTransaction brand="trip" label="Trip to Bali" amount="-$84.20" style={styles.loginChipThree} />
    <FloatingTransaction brand="home" label="Apartment Crew" amount="+$228.75" style={styles.loginChipFour} />
    <Text style={styles.loginTitle}>Welcome back</Text>
    <Text style={styles.loginSubtitle}>
      Your financial story <Text style={styles.greenText}>continues.</Text>
    </Text>
  </View>
);

const SocialSection = ({ stacked }: { stacked?: boolean }) => (
  <View style={styles.socialSection}>
    <View style={styles.dividerRow}>
      <View style={styles.divider} />
      <Text style={styles.dividerText}>or continue with</Text>
      <View style={styles.divider} />
    </View>
    <View style={[styles.socialButtons, stacked && styles.socialButtonsStacked]}>
      <SocialButton label="Continue with Apple" mark="A" />
      <SocialButton label="Continue with Google" mark="G" google />
    </View>
  </View>
);

const SocialButton = ({
  google,
  label,
  mark
}: {
  google?: boolean;
  label: string;
  mark: string;
}) => (
  <Pressable accessibilityRole="button" style={({ pressed }) => [styles.socialButton, pressed && styles.pressed]}>
    <Text style={[styles.socialMark, google && styles.googleMark]}>{mark}</Text>
    <Text style={styles.socialText}>{label}</Text>
  </Pressable>
);

const MerchantBubble = ({
  brand,
  style
}: {
  brand: "amazon" | "food" | "starbucks" | "target";
  style: object;
}) => {
  if (brand === "target") {
    return (
      <View style={[styles.merchantBubble, styles.targetBubble, style]}>
        <Target color="#E11D2E" size={28} strokeWidth={3} />
      </View>
    );
  }

  if (brand === "food") {
    return (
      <View style={[styles.merchantBubble, styles.foodBubble, style]}>
        <Utensils color={colors.textPrimary} size={23} strokeWidth={2.6} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.merchantBubble,
        brand === "starbucks" ? styles.starbucksBubble : styles.amazonBubble,
        style
      ]}
    >
      <Text style={styles.merchantBubbleText}>{brand === "starbucks" ? "S" : "a"}</Text>
    </View>
  );
};

const FloatingTransaction = ({
  amount,
  brand,
  label,
  style
}: {
  amount: string;
  brand: "home" | "starbucks" | "trip" | "uber";
  label: string;
  style: object;
}) => (
  <View style={[styles.transactionChip, style]}>
    <View
      style={[
        styles.transactionIcon,
        brand === "starbucks" && styles.chipStarbucks,
        brand === "uber" && styles.chipUber,
        brand === "trip" && styles.chipTrip,
        brand === "home" && styles.chipHome
      ]}
    >
      <Text style={styles.transactionIconText}>
        {brand === "starbucks" ? "S" : brand === "uber" ? "U" : brand === "trip" ? "T" : "H"}
      </Text>
    </View>
    <View>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipAmount, amount.startsWith("+") && styles.chipPositive]}>{amount}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  safeArea: {
    flex: 1
  },
  keyboardView: {
    flex: 1
  },
  greenAura: {
    position: "absolute",
    left: -110,
    top: 270,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(67, 216, 139, 0.1)"
  },
  orangeAura: {
    position: "absolute",
    right: -120,
    top: 170,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(246, 166, 59, 0.06)"
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    justifyContent: "space-between"
  },
  signupContent: {
    paddingTop: spacing.xs
  },
  loginContent: {
    paddingTop: spacing.xs
  },
  topSection: {
    width: "100%",
    alignItems: "center"
  },
  bottomContainer: {
    width: "100%",
    gap: spacing.lg,
    marginTop: spacing.sm
  },
  securityNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing.xs,
    opacity: 0.9
  },
  securityText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600"
  },
  statusBar: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm
  },
  statusTime: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "800"
  },
  statusRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  signalBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2
  },
  signalBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.textPrimary
  },
  wifi: {
    width: 13,
    height: 13,
    borderTopWidth: 3,
    borderColor: colors.textPrimary,
    borderRadius: 7
  },
  battery: {
    width: 24,
    height: 12,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: 3,
    padding: 2
  },
  batteryFill: {
    flex: 1,
    borderRadius: 2,
    backgroundColor: colors.textPrimary
  },
  brandHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.lg
  },
  brandHeaderCompact: {
    marginTop: spacing["2xl"],
    marginBottom: 42
  },
  brandLogo: {
    width: 45,
    height: 45,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft
  },
  brandText: {
    color: colors.textPrimary,
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 28
  },
  greenText: {
    color: colors.accent
  },
  signupHero: {
    minHeight: 214,
    justifyContent: "center"
  },
  dottedPathOne: {
    position: "absolute",
    left: -12,
    top: 70,
    width: 180,
    height: 120,
    borderTopWidth: 1,
    borderColor: "rgba(165, 177, 194, 0.22)",
    borderStyle: "dashed",
    borderRadius: 90,
    transform: [{ rotate: "18deg" }]
  },
  dottedPathTwo: {
    position: "absolute",
    right: 12,
    top: 120,
    width: 150,
    height: 80,
    borderTopWidth: 1,
    borderColor: "rgba(165, 177, 194, 0.22)",
    borderStyle: "dashed",
    borderRadius: 75,
    transform: [{ rotate: "-12deg" }]
  },
  signupTitle: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 37,
    marginLeft: 66
  },
  signupSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
    marginTop: spacing.md,
    marginLeft: 66
  },
  merchantBubble: {
    position: "absolute",
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 12
  },
  starbucksBubble: {
    backgroundColor: "#0B654B"
  },
  targetBubble: {
    backgroundColor: "#ECEFF3"
  },
  amazonBubble: {
    backgroundColor: "#0E1116"
  },
  foodBubble: {
    backgroundColor: colors.warning
  },
  merchantBubbleText: {
    color: colors.textPrimary,
    fontSize: 25,
    fontWeight: "900"
  },
  signupStarbucks: {
    left: -12,
    top: 42
  },
  signupTarget: {
    left: 14,
    top: 128
  },
  signupAmazon: {
    right: -4,
    top: 112
  },
  signupFood: {
    right: -2,
    top: 18
  },
  formWrap: {
    gap: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(10, 16, 24, 0.82)",
    overflow: "hidden",
    padding: spacing.md
  },
  signupFormWrap: {
    borderWidth: 0,
    backgroundColor: "transparent",
    padding: 0
  },
  field: {
    minHeight: 51,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(17, 25, 35, 0.78)",
    paddingHorizontal: spacing.md
  },
  input: {
    minWidth: 0,
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600"
  },
  eyeButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15
  },
  forgotButton: {
    alignSelf: "flex-end",
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm
  },
  forgotText: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: "800"
  },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs
  },
  strengthLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600"
  },
  strengthValue: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "800"
  },
  strengthBars: {
    flexDirection: "row",
    gap: spacing.xs
  },
  strengthBarActive: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent
  },
  strengthBarMuted: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(67, 216, 139, 0.22)"
  },
  validationText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17
  },
  primaryButton: {
    minHeight: 57,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    marginTop: spacing.md,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 18
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 17,
    fontWeight: "900"
  },
  loginHero: {
    minHeight: 182,
    alignItems: "center",
    justifyContent: "center"
  },
  loginTitle: {
    color: colors.textPrimary,
    fontSize: 35,
    fontWeight: "900",
    lineHeight: 42,
    textAlign: "center"
  },
  loginSubtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 23,
    marginTop: spacing.xs,
    textAlign: "center"
  },
  transactionChip: {
    position: "absolute",
    minWidth: 104,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.11)",
    backgroundColor: "rgba(17, 25, 35, 0.88)",
    padding: spacing.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 14
  },
  loginChipOne: {
    left: -10,
    top: 2,
    transform: [{ rotate: "-7deg" }]
  },
  loginChipTwo: {
    right: -10,
    top: 28,
    transform: [{ rotate: "7deg" }]
  },
  loginChipThree: {
    left: -12,
    bottom: 8,
    transform: [{ rotate: "5deg" }]
  },
  loginChipFour: {
    right: -14,
    bottom: 18,
    transform: [{ rotate: "-6deg" }]
  },
  transactionIcon: {
    width: 27,
    height: 27,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14
  },
  chipStarbucks: {
    backgroundColor: "#0B654B"
  },
  chipUber: {
    backgroundColor: "#050505"
  },
  chipTrip: {
    backgroundColor: colors.accentStrong
  },
  chipHome: {
    backgroundColor: "#A855F7"
  },
  transactionIconText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "900"
  },
  chipLabel: {
    color: colors.textPrimary,
    fontSize: 9,
    fontWeight: "800"
  },
  chipAmount: {
    color: colors.textPrimary,
    fontSize: 9,
    fontWeight: "700"
  },
  chipPositive: {
    color: colors.accent
  },
  socialSection: {
    gap: spacing.lg,
    marginTop: spacing.lg
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)"
  },
  dividerText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600"
  },
  socialButtons: {
    flexDirection: "row",
    gap: spacing.md
  },
  socialButtonsStacked: {
    flexDirection: "column"
  },
  socialButton: {
    minHeight: 54,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(17, 25, 35, 0.78)",
    paddingHorizontal: spacing.sm
  },
  socialMark: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900"
  },
  googleMark: {
    color: "#4285F4"
  },
  socialText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "700"
  },
  bottomCopy: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingBottom: spacing.sm
  },
  bottomText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: "600"
  },
  bottomLink: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "800"
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }]
  }
});
