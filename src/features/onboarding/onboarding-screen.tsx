import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  CalendarDays,
  Car,
  ChartNoAxesColumn,
  ChevronRight,
  Clock3,
  Coffee,
  Gamepad2,
  Home,
  Plane,
  Search,
  Settings,
  SlidersHorizontal,
  ShoppingCart,
  Target,
  UserRound,
  UsersRound,
  Utensils,
  Music2
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import Animated, { FadeInDown, FadeInUp, Layout } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radii, spacing } from "@/styles/theme";

type SlideId = "calendar" | "classify" | "split" | "memory";

type Slide = {
  id: SlideId;
  title: Array<{ text: string; accent?: boolean }>;
  body: Array<{ text: string; accent?: "green" | "orange" }>;
};

const slides: Slide[] = [
  {
    id: "calendar",
    title: [
      { text: "Track life\nthrough " },
      { text: "money", accent: true }
    ],
    body: [
      { text: "Visualize. Classify. Split.\nAll on a " },
      { text: "beautiful", accent: "green" },
      { text: " timeline." }
    ]
  },
  {
    id: "classify",
    title: [
      { text: "Classify in\n" },
      { text: "seconds", accent: true }
    ],
    body: [
      { text: "Swipe left for " },
      { text: "personal", accent: "green" },
      { text: ",\nswipe right for " },
      { text: "shared", accent: "orange" },
      { text: "." }
    ]
  },
  {
    id: "split",
    title: [
      { text: "Split with\nyour " },
      { text: "group", accent: true }
    ],
    body: [
      { text: "Equal, percentage, or " },
      { text: "exact", accent: "green" },
      { text: ".\nAlways know " },
      { text: "who owes what", accent: "orange" },
      { text: "." }
    ]
  },
  {
    id: "memory",
    title: [
      { text: "Your financial\n" },
      { text: "memory", accent: true }
    ],
    body: [
      { text: "Every transaction tells a story.\nWe help you " },
      { text: "read it", accent: "orange" },
      { text: "." }
    ]
  }
];

export const OnboardingScreen = () => {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const activeSlideRef = useRef(0);
  const programmaticSlideRef = useRef<number | null>(null);
  const { height, width } = useWindowDimensions();
  const [activeSlide, setActiveSlide] = useState(0);
  const phoneWidth = Math.min(306, width - spacing.xl * 2, (height - 360) / 1.5);

  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: 0, animated: false });
      activeSlideRef.current = 0;
      programmaticSlideRef.current = null;
      setActiveSlide(0);
    }, 0);

    return () => clearTimeout(timeout);
  }, []);

  const getScrollOffsetX = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollEvent = event as unknown as {
      currentTarget?: { scrollLeft?: number };
      nativeEvent?: {
        contentOffset?: { x?: number };
        target?: { scrollLeft?: number };
      };
      target?: { scrollLeft?: number };
    };

    return (
      scrollEvent.nativeEvent?.contentOffset?.x ??
      scrollEvent.currentTarget?.scrollLeft ??
      scrollEvent.target?.scrollLeft ??
      scrollEvent.nativeEvent?.target?.scrollLeft ??
      0
    );
  };

  const updateActiveSlide = (offsetX: number) => {
    const nextIndex = Math.min(Math.max(Math.round(offsetX / width), 0), slides.length - 1);
    const programmaticIndex = programmaticSlideRef.current;

    if (programmaticIndex !== null) {
      const targetOffset = width * programmaticIndex;

      if (Math.abs(offsetX - targetOffset) < width * 0.08) {
        programmaticSlideRef.current = null;
      }

      if (activeSlideRef.current !== programmaticIndex) {
        activeSlideRef.current = programmaticIndex;
        setActiveSlide(programmaticIndex);
      }

      return;
    }

    if (nextIndex !== activeSlideRef.current) {
      activeSlideRef.current = nextIndex;
      setActiveSlide(nextIndex);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    updateActiveSlide(getScrollOffsetX(event));
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    updateActiveSlide(getScrollOffsetX(event));
  };

  const goToSlide = (index: number) => {
    const targetIndex = Math.min(Math.max(index, 0), slides.length - 1);
    programmaticSlideRef.current = targetIndex;
    activeSlideRef.current = targetIndex;
    scrollRef.current?.scrollTo({ x: width * targetIndex, animated: true });
    setActiveSlide(targetIndex);
  };

  const handleGetStarted = () => {
    if (activeSlide < slides.length - 1) {
      goToSlide(activeSlide + 1);
      return;
    }

    router.replace("/calendar");
  };

  return (
    <LinearGradient
      colors={["#020407", "#07131C", "#020407"]}
      style={styles.container}
    >
      <View style={styles.greenGlow} />
      <View style={styles.orangeGlow} />
      <View style={styles.screenFrame} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          onScroll={handleScroll}
          onScrollEndDrag={handleScrollEnd}
          scrollEventThrottle={16}
          style={styles.carousel}
        >
          {slides.map((slide, index) => (
            <OnboardingSlide
              key={slide.id}
              active={index === activeSlide}
              phoneWidth={phoneWidth}
              slide={slide}
              width={width}
            />
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots} accessibilityRole="tablist">
            {slides.map((slide, index) => (
              <Pressable
                key={slide.id}
                accessibilityLabel={`Go to onboarding slide ${index + 1}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: index === activeSlide }}
                onPress={() => goToSlide(index)}
                style={[
                  styles.dot,
                  index === activeSlide ? styles.dotActive : styles.dotInactive
                ]}
              />
            ))}
          </View>

          <Pressable
            accessibilityLabel="Get started"
            accessibilityRole="button"
            onPress={handleGetStarted}
            style={({ pressed }) => [styles.ctaPressable, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={[colors.accent, "#29C975"]}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={styles.cta}
            >
              <Text style={[styles.ctaText, activeSlide === 0 && styles.ctaTextLight]}>
                Get Started
              </Text>
              <ArrowRight
                color={activeSlide === 0 ? colors.textPrimary : colors.background}
                size={30}
                strokeWidth={2.8}
              />
            </LinearGradient>
          </Pressable>

          <Pressable
            accessibilityLabel="Sign in"
            accessibilityRole="button"
            onPress={() => router.push("/login")}
            style={({ pressed }) => [styles.signIn, pressed && styles.pressed]}
          >
            <Text style={styles.signInText}>
              Already have an account? <Text style={styles.signInAccent}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

type OnboardingSlideProps = {
  active: boolean;
  phoneWidth: number;
  slide: Slide;
  width: number;
};

const OnboardingSlide = ({ active, phoneWidth, slide, width }: OnboardingSlideProps) => (
  <View style={[styles.slide, { width }]}>
    <Animated.View
      entering={active ? FadeInUp.duration(420) : undefined}
      layout={Layout.springify().damping(18).stiffness(140)}
      style={[styles.copy, slide.id === "calendar" && styles.calendarCopy]}
    >
      <Text style={styles.title}>
        {slide.title.map((part, index) => (
          <Text key={`${slide.id}-title-${index}`} style={part.accent && styles.greenText}>
            {part.text}
          </Text>
        ))}
      </Text>
      <Text style={styles.body}>
        {slide.body.map((part, index) => (
          <Text
            key={`${slide.id}-body-${index}`}
            style={
              part.accent === "green"
                ? styles.greenText
                : part.accent === "orange"
                  ? styles.orangeText
                  : undefined
            }
          >
            {part.text}
          </Text>
        ))}
      </Text>
    </Animated.View>

    <Animated.View
      entering={active ? FadeInDown.delay(120).duration(460) : undefined}
      layout={Layout.springify().damping(18).stiffness(140)}
      style={[styles.mockupWrap, slide.id === "calendar" && styles.calendarMockupWrap]}
    >
      <PhoneMockup
        variant={slide.id}
        width={
          slide.id === "calendar" || slide.id === "classify"
              ? phoneWidth * 0.9
              : phoneWidth
        }
      />
    </Animated.View>
  </View>
);

const PhoneMockup = ({ variant, width }: { variant: SlideId; width: number }) => {
  const height = width * (variant === "calendar" || variant === "classify" ? 1.68 : 1.5);

  return (
    <View style={[styles.phoneFrame, { width, height }]}>
      <View style={styles.phoneSideLeft} />
      <View style={styles.phoneSideRight} />
      <LinearGradient
        colors={["#111923", "#02070B"]}
        style={[
          styles.phoneScreen,
          variant === "calendar" && styles.calendarPhoneScreen,
          variant === "classify" && styles.classifyPhoneScreen,
          { borderRadius: width * 0.13 }
        ]}
      >
        {variant === "calendar" ? (
          <CalendarMockup />
        ) : (
          <>
            <PhoneStatusBar />
            <PhoneHeader />
          </>
        )}
        {variant === "classify" ? <ClassifyMockup /> : null}
        {variant === "split" ? <SplitMockup /> : null}
        {variant === "memory" ? <MemoryMockup /> : null}
      </LinearGradient>
      {variant === "classify" ? (
        <>
          <ArrowLeft color={colors.accent} size={28} style={styles.leftArrow} />
          <ArrowRight color={colors.warning} size={28} style={styles.rightArrow} />
        </>
      ) : null}
      {variant === "split" ? (
        <>
          <BalanceCallout side="left" text={"They owe\nyou\n+$228.75"} tone="green" />
          <BalanceCallout side="right" text={"You owe\nthem\n-$84.20"} tone="orange" />
        </>
      ) : null}
    </View>
  );
};

const CalendarMockup = () => {
  const days = [
    { label: "30" },
    { label: "1", icon: Utensils, color: "#F43F6B" },
    { label: "1" },
    { label: "2" },
    { label: "3" },
    { label: "5", icon: ShoppingCart, color: colors.accent },
    { label: "7" },
    { label: "8" },
    { label: "9", icon: Camera, color: "#FF8A24" },
    { label: "12", icon: Car, color: "#FF8A24" },
    { label: "12", active: true },
    { label: "14" },
    { label: "14", icon: Building2, color: colors.accent },
    { label: "16", activeFill: true },
    { label: "18", icon: Plane, color: colors.accent },
    { label: "18", activeFill: true },
    { label: "19" },
    { label: "20" },
    { label: "21", icon: Music2, color: "#A855F7" },
    { label: "23" },
    { label: "24" },
    { label: "25" },
    { label: "26" },
    { label: "27" },
    { label: "28" },
    { label: "29" },
    { label: "30" },
    { label: "31" },
    { label: "1", muted: true },
    { label: "2", muted: true }
  ];

  return (
    <View style={styles.calendarMockup}>
      <PhoneStatusBar />
      <PhoneHeader />

      <View style={styles.dayCard}>
        <View>
          <Text style={styles.phoneTitle}>May 2026</Text>
          <Text style={styles.phoneSubtle}>Net +$452 - 8 money moments</Text>
        </View>
        <SlidersHorizontal color={colors.textSecondary} size={20} />
      </View>

      <View style={styles.calendarPanel}>
        <View style={styles.calendarWeekdays}>
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <Text key={`${day}-${index}`} style={styles.calendarWeekday}>
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {days.map((day, index) => {
            const Icon = day.icon;

            return (
              <View key={`${day.label}-${index}`} style={styles.calendarDayCell}>
                {Icon ? (
                  <LinearGradient
                    colors={[day.color, `${day.color}B8`]}
                    style={styles.calendarIconDay}
                  >
                    <Icon color={colors.textPrimary} size={16} strokeWidth={2.8} />
                  </LinearGradient>
                ) : (
                  <View
                    style={[
                      styles.calendarDateBubble,
                      day.active && styles.calendarActiveDate,
                      day.activeFill && styles.calendarFilledDate
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarDateText,
                        day.active && styles.calendarActiveText,
                        day.activeFill && styles.calendarFilledDateText,
                        day.muted && styles.calendarMutedText
                      ]}
                    >
                      {day.label}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.calendarBottomNav}>
        <MiniTab active icon={CalendarDays} label="Calendar" />
        <MiniTab icon={Clock3} label="Timeline" />
        <MiniTab icon={UsersRound} label="Shared" />
        <MiniTab icon={ChartNoAxesColumn} label="Insights" />
        <MiniTab icon={Settings} label="Settings" />
      </View>
    </View>
  );
};

const PhoneStatusBar = () => (
  <View style={styles.statusBar}>
    <Text style={styles.statusTime}>9:41</Text>
    <View style={styles.statusRight}>
      <View style={styles.signalBars}>
        <View style={[styles.signalBar, { height: 6 }]} />
        <View style={[styles.signalBar, { height: 9 }]} />
        <View style={[styles.signalBar, { height: 12 }]} />
      </View>
      <View style={styles.wifiDot} />
      <View style={styles.battery}>
        <View style={styles.batteryFill} />
      </View>
    </View>
  </View>
);

const PhoneHeader = () => (
  <View style={styles.phoneHeader}>
    <Image
      accessibilityIgnoresInvertColors
      source={require("../../../assets/adaptive-icon.png")}
      style={styles.phoneLogo}
    />
    <Text style={styles.phoneBrand}>
      Money<Text style={styles.greenText}>Timeline</Text>
    </Text>
    <View style={styles.phoneHeaderActions}>
      <Search color={colors.textPrimary} size={18} />
      <SlidersHorizontal color={colors.textPrimary} size={18} />
    </View>
  </View>
);

const ClassifyMockup = () => (
  <View style={styles.classifyContent}>
    <View style={styles.dayCard}>
      <View>
        <Text style={styles.phoneTitle}>May 1, 2026</Text>
        <Text style={styles.phoneSubtle}>Total $218.97</Text>
      </View>
      <SlidersHorizontal color={colors.textSecondary} size={20} />
    </View>

    <TransactionCard merchant="Uber Eats" amount="-$24.10" initial="U" color="#3278F6" />
    <View style={styles.swipeLayer}>
      <View style={[styles.swipeReveal, styles.personalReveal]}>
        <UserRound color={colors.textPrimary} size={20} />
        <View>
          <Text style={styles.revealTitle}>Personal</Text>
          <Text style={styles.revealSubtext}>For you only</Text>
        </View>
      </View>
      <View style={styles.liftedTransaction}>
        <TransactionCard
          merchant="Uber Eats"
          amount="-$24.10"
          color="#3278F6"
          initial="U"
        />
      </View>
    </View>

    <TransactionCard merchant="Trader Joe's" amount="-$67.42" initial="T" color="#FF7A22" />
    <View style={styles.swipeLayer}>
      <View style={styles.sharedReveal}>
        <UsersRound color={colors.textPrimary} size={20} />
        <View>
          <Text style={styles.revealTitle}>Shared</Text>
          <Text style={styles.revealSubtext}>Split with others</Text>
        </View>
      </View>
      <View style={styles.sharedLiftedTransaction}>
        <TransactionCard
          amount=""
          merchant="Trader Joe's"
          color="#A855F7"
          initial="C"
        />
      </View>
    </View>

    <TransactionCard merchant="Shell Gas Station" amount="-$45.00" initial="S" color="#F43F6B" />
  </View>
);

const SplitMockup = () => (
  <View style={styles.splitContent}>
    <View style={styles.sharedTitleRow}>
      <Text style={styles.phoneTitle}>Shared</Text>
      <View style={styles.sharedIconBubble}>
        <UsersRound color={colors.warning} size={17} strokeWidth={2.7} />
      </View>
      <View style={styles.addButton}>
        <Text style={styles.addButtonText}>+</Text>
      </View>
    </View>
    <Text style={styles.phoneSubtle}>$268.97 shared - 5 transactions</Text>

    <LinearGradient
      colors={["rgba(246, 166, 59, 0.32)", "rgba(246, 166, 59, 0.08)"]}
      style={styles.owedCard}
    >
      <Text style={styles.owedLabel}>TOTAL OWED TO YOU</Text>
      <Text style={styles.owedValue}>$228.75</Text>
      <Text style={styles.phoneSubtle}>6 people - 5 transactions</Text>
      <UsersRound color="rgba(246, 166, 59, 0.42)" size={70} style={styles.owedIcon} />
    </LinearGradient>

    <Text style={styles.sectionLabel}>GROUPS</Text>
    <GroupBalanceRow
      amount="+$228.75"
      icon={Home}
      iconColor="#B143E6"
      members={6}
      name="Apartment Crew"
      positive
    />
    <GroupBalanceRow
      amount="-$84.20"
      icon={Plane}
      iconColor={colors.accentStrong}
      members={4}
      name="Trip to Bali"
    />
    <GroupBalanceRow
      amount="+$12.50"
      icon={Gamepad2}
      iconColor="#3278F6"
      members={5}
      name="Game Night"
      positive
    />

    <View style={styles.phoneBottomNav}>
      <MiniTab icon={CalendarDays} label="Calendar" />
      <MiniTab icon={Clock3} label="Timeline" />
      <MiniTab active icon={UsersRound} label="Shared" />
      <MiniTab icon={ChartNoAxesColumn} label="Insights" />
      <MiniTab icon={Settings} label="Settings" />
    </View>
  </View>
);

const MemoryMockup = () => (
  <View style={styles.memoryContent}>
    <Text style={styles.memoryMonth}>May 2026</Text>
    {[
      {
        amount: "-$332.10",
        brand: "Delta",
        color: "#1457B8",
        date: "May 1",
        icon: Plane,
        merchant: "Vegas Trip",
        note: "Flight - Delta",
        photoTone: "blue"
      },
      {
        amount: "-$5.60",
        brand: "Starbucks",
        color: "#00704A",
        date: "May 2",
        icon: Coffee,
        merchant: "Starbucks",
        note: "Morning coffee",
        photoTone: "green"
      },
      {
        amount: "-$68.40",
        brand: "Dinner",
        color: colors.warning,
        date: "May 3",
        icon: Utensils,
        merchant: "Dinner with friends",
        note: "Split with 3 people",
        photoTone: "orange"
      },
      {
        amount: "-$42.18",
        brand: "Target",
        color: "#FFFFFF",
        date: "May 5",
        icon: Target,
        merchant: "Target",
        note: "Essentials",
        photoTone: "red"
      },
      {
        amount: "-$18.75",
        brand: "Uber",
        color: "#050505",
        date: "May 7",
        icon: Car,
        merchant: "Uber",
        note: "Late night ride",
        photoTone: "black"
      }
    ].map((item) => (
      <TimelineItem key={item.merchant} item={item} />
    ))}
  </View>
);

const TransactionCard = ({
  amount,
  color,
  initial,
  merchant
}: {
  amount?: string;
  color: string;
  initial: string;
  merchant: string;
}) => (
  <View style={styles.transactionCard}>
    <View style={[styles.avatar, { backgroundColor: color }]}>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
    <View style={styles.transactionInfo}>
      <Text numberOfLines={1} style={styles.transactionMerchant}>
        {merchant}
      </Text>
      <Text style={styles.phoneSubtle}>12:45 PM</Text>
    </View>
    {amount ? (
      <Text numberOfLines={1} style={styles.transactionAmount}>
        {amount}
      </Text>
    ) : null}
  </View>
);

type IconComponent = typeof Plane;

const GroupBalanceRow = ({
  amount,
  icon: Icon,
  iconColor,
  members,
  name,
  positive
}: {
  amount: string;
  icon: IconComponent;
  iconColor: string;
  members: number;
  name: string;
  positive?: boolean;
}) => (
  <View style={styles.groupRow}>
    <View style={[styles.groupIcon, { backgroundColor: iconColor }]}>
      <Icon color={colors.textPrimary} size={19} strokeWidth={2.6} />
    </View>
    <View style={styles.groupInfo}>
      <Text style={styles.groupName}>{name}</Text>
      <Text style={styles.phoneSubtle}>{members} members</Text>
    </View>
    <View style={styles.groupAmountWrap}>
      <Text style={[styles.groupAmount, positive ? styles.greenText : styles.orangeText]}>
        {amount}
      </Text>
      <Text style={styles.phoneSubtle}>{positive ? "you're owed" : "you owe"}</Text>
    </View>
    <ChevronRight color={colors.textMuted} size={18} />
  </View>
);

const MiniTab = ({
  active,
  icon: Icon,
  label
}: {
  active?: boolean;
  icon: IconComponent;
  label: string;
}) => (
  <View style={[styles.miniTab, active && styles.miniTabActive]}>
    <Icon
      color={active ? colors.warning : colors.textMuted}
      size={18}
      strokeWidth={2.3}
    />
    <Text style={[styles.miniTabText, active && styles.miniTabTextActive]}>{label}</Text>
  </View>
);

const TimelineItem = ({
  item
}: {
  item: {
    amount: string;
    brand: string;
    color: string;
    date: string;
    icon: IconComponent;
    merchant: string;
    note: string;
    photoTone: string;
  };
}) => {
  const Icon = item.icon;

  return (
    <View style={styles.timelineItem}>
      <View style={[styles.timelineIcon, { backgroundColor: item.color }]}>
        {item.brand === "Uber" ? (
          <Text style={styles.uberLogo}>Uber</Text>
        ) : item.brand === "Starbucks" ? (
          <Text style={styles.starbucksLogo}>S</Text>
        ) : (
          <Icon
            color={item.brand === "Target" ? "#D71920" : colors.textPrimary}
            size={22}
            strokeWidth={2.7}
          />
        )}
      </View>

      <View style={styles.memoryCard}>
        <View style={styles.memoryText}>
          <Text style={styles.memoryDate}>{item.date}</Text>
          <Text style={styles.memoryMerchant}>{item.merchant}</Text>
          <Text style={styles.phoneSubtle}>{item.note}</Text>
        </View>
        <View style={styles.memoryRight}>
          <Text style={styles.memoryAmount}>{item.amount}</Text>
          <MemoryVisual tone={item.photoTone} />
        </View>
      </View>
    </View>
  );
};

const MemoryVisual = ({ tone }: { tone: string }) => {
  const palettes: Record<string, [string, string]> = {
    black: ["#151515", "#3278F6"],
    blue: ["#123A78", "#FF7A22"],
    green: ["#0B3A2C", "#D9A441"],
    orange: ["#5B2C11", "#F6A63B"],
    red: ["#F6F7FB", "#D71920"]
  };
  const palette = palettes[tone] ?? ["#172231", colors.accent];

  return (
    <LinearGradient colors={palette} style={styles.memoryVisual}>
      {tone === "red" ? (
        <Target color="#D71920" size={24} strokeWidth={3} />
      ) : tone === "green" ? (
        <Coffee color={colors.textPrimary} size={22} strokeWidth={2.6} />
      ) : tone === "black" ? (
        <Car color={colors.textPrimary} size={22} strokeWidth={2.6} />
      ) : tone === "blue" ? (
        <Plane color={colors.textPrimary} size={22} strokeWidth={2.6} />
      ) : (
        <Utensils color={colors.textPrimary} size={22} strokeWidth={2.6} />
      )}
    </LinearGradient>
  );
};

const FloatingPill = ({
  amount,
  context,
  side,
  tone
}: {
  amount: string;
  context: "calendar" | "classify";
  side: "left" | "right";
  tone: "green" | "orange";
}) => (
  <View
    style={[
      styles.floatingPill,
      context === "classify" && side === "left" ? styles.floatingClassifyLeft : null,
      context === "classify" && side === "right" ? styles.floatingClassifyRight : null,
      context === "calendar" && side === "left" ? styles.floatingCalendarLeft : null,
      context === "calendar" && side === "right" ? styles.floatingCalendarRight : null,
      tone === "green" ? styles.floatingGreen : styles.floatingOrange
    ]}
  >
    <Text style={styles.floatingPillText}>{amount}</Text>
  </View>
);

const BalanceCallout = ({
  side,
  text,
  tone
}: {
  side: "left" | "right";
  text: string;
  tone: "green" | "orange";
}) => (
  <View
    style={[
      styles.balanceCallout,
      side === "left" ? styles.balanceLeft : styles.balanceRight,
      tone === "green" ? styles.calloutGreen : styles.calloutOrange
    ]}
  >
    <Text style={styles.balanceCalloutText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  safeArea: {
    flex: 1,
    zIndex: 1
  },
  screenFrame: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.md,
    bottom: spacing.sm,
    left: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(120, 132, 148, 0.36)",
    borderRadius: 34
  },
  greenGlow: {
    position: "absolute",
    top: 88,
    left: -88,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(67, 216, 139, 0.09)"
  },
  orangeGlow: {
    position: "absolute",
    right: -118,
    bottom: 130,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(246, 166, 59, 0.07)"
  },
  carousel: {
    flex: 1
  },
  slide: {
    flex: 1,
    overflow: "hidden",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl
  },
  copy: {
    minHeight: 178,
    justifyContent: "flex-end"
  },
  calendarCopy: {
    minHeight: 156
  },
  title: {
    color: colors.textPrimary,
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 50,
    textShadowColor: "rgba(255, 255, 255, 0.16)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 18
  },
  body: {
    marginTop: spacing.lg,
    color: colors.textSecondary,
    fontSize: 21,
    fontWeight: "500",
    letterSpacing: 0,
    lineHeight: 30
  },
  greenText: {
    color: colors.accent
  },
  orangeText: {
    color: colors.warning
  },
  mockupWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 154
  },
  calendarMockupWrap: {
    justifyContent: "center",
    paddingTop: 0,
    paddingBottom: 154
  },
  phoneFrame: {
    borderRadius: 44,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.22)",
    backgroundColor: "#060A0F",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 28 },
    shadowOpacity: 0.5,
    shadowRadius: 34
  },
  phoneSideLeft: {
    position: "absolute",
    left: -4,
    top: 112,
    width: 4,
    height: 58,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.12)"
  },
  phoneSideRight: {
    position: "absolute",
    right: -4,
    top: 180,
    width: 4,
    height: 70,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.12)"
  },
  phoneScreen: {
    flex: 1,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: spacing.lg
  },
  calendarPhoneScreen: {
    padding: spacing.md
  },
  classifyPhoneScreen: {
    overflow: "visible",
    padding: spacing.md
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs
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
  wifiDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderTopWidth: 3,
    borderColor: colors.textPrimary
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
  phoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft
  },
  phoneLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.34)",
    backgroundColor: "rgba(67, 216, 139, 0.08)"
  },
  phoneBrand: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 22
  },
  phoneHeaderActions: {
    flexDirection: "row",
    gap: spacing.md
  },
  calendarMockup: {
    flex: 1,
    gap: spacing.sm,
    paddingBottom: 62
  },
  calendarPanel: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(17, 25, 35, 0.72)",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm
  },
  calendarBottomNav: {
    position: "absolute",
    right: -spacing.md,
    bottom: 0,
    left: -spacing.md,
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: "rgba(5, 8, 13, 0.94)",
    paddingHorizontal: spacing.xs,
    paddingTop: 4,
    paddingBottom: 7
  },
  calendarWeekdays: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs
  },
  calendarWeekday: {
    color: "#4B5563",
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 24
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.xs
  },
  calendarDayCell: {
    width: "14.285%",
    height: 35,
    alignItems: "center",
    justifyContent: "center"
  },
  calendarDateBubble: {
    minWidth: 30,
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15
  },
  calendarFilledDate: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.26,
    shadowRadius: 10
  },
  calendarActiveDate: {
    borderWidth: 1,
    borderColor: "rgba(67, 216, 139, 0.42)",
    backgroundColor: "rgba(67, 216, 139, 0.10)"
  },
  calendarDateText: {
    color: "#AAB4C1",
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 24
  },
  calendarActiveText: {
    color: colors.accent
  },
  calendarFilledDateText: {
    color: colors.textPrimary
  },
  calendarMutedText: {
    color: "#4D5867"
  },
  calendarIconDay: {
    width: 31,
    height: 31,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 11
  },
  phoneTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 26
  },
  phoneSubtle: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: "500",
    lineHeight: 12
  },
  classifyContent: {
    flex: 1,
    gap: 7,
    paddingTop: spacing.sm
  },
  dayCard: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(17, 25, 35, 0.82)",
    padding: spacing.sm
  },
  transactionCard: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(17, 25, 35, 0.94)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  avatar: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15
  },
  avatarText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900"
  },
  transactionInfo: {
    flex: 1
  },
  transactionMerchant: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17
  },
  transactionAmount: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17
  },
  swipeLayer: {
    minHeight: 48,
    justifyContent: "center"
  },
  swipeReveal: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md
  },
  personalReveal: {
    width: "76%",
    backgroundColor: "rgba(67, 216, 139, 0.9)"
  },
  sharedReveal: {
    alignSelf: "flex-end",
    width: "76%",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: "rgba(246, 166, 59, 0.94)",
    paddingHorizontal: spacing.md
  },
  revealTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18
  },
  revealSubtext: {
    color: "rgba(255, 255, 255, 0.84)",
    fontSize: 10,
    fontWeight: "700"
  },
  liftedTransaction: {
    position: "absolute",
    right: -52,
    width: "74%",
    transform: [{ rotate: "4deg" }]
  },
  sharedLiftedTransaction: {
    position: "absolute",
    left: -50,
    width: "80%"
  },
  floatingPill: {
    position: "absolute",
    minWidth: 74,
    alignItems: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: "rgba(23, 34, 49, 0.96)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.26,
    shadowRadius: 18
  },
  floatingCalendarLeft: {
    left: -16,
    top: 160
  },
  floatingCalendarRight: {
    right: -16,
    top: 286
  },
  floatingClassifyLeft: {
    left: -58,
    top: 236
  },
  floatingClassifyRight: {
    right: -58,
    top: 392
  },
  floatingGreen: {
    borderColor: "rgba(67, 216, 139, 0.28)"
  },
  floatingOrange: {
    borderColor: "rgba(246, 166, 59, 0.3)"
  },
  floatingPillText: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: "900"
  },
  leftArrow: {
    position: "absolute",
    left: -20,
    top: 286
  },
  rightArrow: {
    position: "absolute",
    right: -20,
    top: 432
  },
  splitContent: {
    flex: 1,
    gap: 2,
    paddingTop: spacing.sm
  },
  sharedTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  sharedIconBubble: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "rgba(246, 166, 59, 0.2)"
  },
  addButton: {
    marginLeft: "auto",
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(246, 166, 59, 0.22)",
    backgroundColor: "rgba(246, 166, 59, 0.12)"
  },
  addButtonText: {
    color: colors.warning,
    fontSize: 28,
    fontWeight: "300",
    lineHeight: 32
  },
  owedCard: {
    minHeight: 58,
    justifyContent: "center",
    gap: spacing.xs,
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(246, 166, 59, 0.28)",
    marginTop: spacing.xs,
    padding: spacing.md
  },
  owedLabel: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0
  },
  owedValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26
  },
  owedIcon: {
    position: "absolute",
    right: 18,
    bottom: 14
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: spacing.sm
  },
  groupRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(17, 25, 35, 0.92)",
    padding: spacing.xs
  },
  groupIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12
  },
  groupInfo: {
    flex: 1
  },
  groupName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "800"
  },
  groupAmountWrap: {
    alignItems: "flex-end"
  },
  groupAmount: {
    fontSize: 12,
    fontWeight: "900"
  },
  phoneBottomNav: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    minHeight: 42,
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: "rgba(5, 8, 13, 0.92)",
    paddingTop: spacing.sm
  },
  miniTab: {
    minWidth: 39,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: radii.md,
    paddingHorizontal: 3,
    paddingVertical: 5
  },
  miniTabActive: {
    backgroundColor: "rgba(246, 166, 59, 0.12)"
  },
  miniTabText: {
    color: colors.textMuted,
    fontSize: 6,
    fontWeight: "800",
    lineHeight: 8
  },
  miniTabTextActive: {
    color: colors.warning
  },
  balanceCallout: {
    position: "absolute",
    width: 80,
    alignItems: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(17, 25, 35, 0.96)"
  },
  balanceLeft: {
    left: -31,
    top: 190
  },
  balanceRight: {
    right: -31,
    top: 282
  },
  calloutGreen: {
    borderColor: "rgba(67, 216, 139, 0.34)"
  },
  calloutOrange: {
    borderColor: "rgba(246, 166, 59, 0.34)"
  },
  balanceCalloutText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
    textAlign: "center"
  },
  memoryContent: {
    flex: 1,
    paddingTop: spacing.md
  },
  memoryMonth: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22,
    marginBottom: spacing.sm
  },
  timelineRail: {
    position: "absolute",
    top: 48,
    bottom: 42,
    left: 28,
    width: 2,
    backgroundColor: colors.accent
  },
  timelineItem: {
    minHeight: 39,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: 4
  },
  timelineIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.24)",
    zIndex: 2
  },
  uberLogo: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900"
  },
  starbucksLogo: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "900"
  },
  memoryCard: {
    flex: 1,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(17, 25, 35, 0.92)",
    padding: spacing.sm
  },
  memoryText: {
    flex: 1,
    minWidth: 0
  },
  memoryDate: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: "600"
  },
  memoryMerchant: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14
  },
  memoryRight: {
    alignItems: "flex-end",
    gap: spacing.xs
  },
  memoryAmount: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "900"
  },
  memoryVisual: {
    width: 45,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm
  },
  totalSpentCard: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.md,
    backgroundColor: "rgba(17, 25, 35, 0.96)",
    marginTop: spacing.xs,
    padding: spacing.sm
  },
  totalSpentTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "800"
  },
  totalSpentRight: {
    alignItems: "flex-end"
  },
  totalSpentAmount: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "900"
  },
  totalSpentAccent: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800"
  },
  footer: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  dot: {
    height: 10,
    borderRadius: 5
  },
  dotActive: {
    width: 28,
    backgroundColor: colors.accent
  },
  dotInactive: {
    width: 10,
    backgroundColor: "rgba(255, 255, 255, 0.22)"
  },
  ctaPressable: {
    width: "100%",
    maxWidth: 520
  },
  cta: {
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    borderRadius: radii.xl
  },
  ctaText: {
    color: colors.background,
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 31
  },
  ctaTextLight: {
    color: colors.textPrimary
  },
  signIn: {
    paddingVertical: spacing.xs
  },
  signInText: {
    color: colors.textMuted,
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 23
  },
  signInAccent: {
    color: colors.accent
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }]
  }
});
