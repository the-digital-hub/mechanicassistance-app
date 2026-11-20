import { MeshBackground } from "@/components/brand/MeshBackground";
import { setAppLanguage, type SupportedLanguage } from "@/lib/i18n";
import { TYPE } from "@/lib/ui/type";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CalendarClock, ChevronRight, ShieldCheck, Video } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Dimensions,
  PanResponder,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");
const CYAN = "#83D4ED";
const PHOTO_H = height * 0.6;
// The photo starts a bit lower so the big logo sits on the sky, not on the technician.
const PHOTO_SHIFT = 150;

/** Fades and lifts its children in, staggered by `index`. */
function Reveal({ index, children }: { index: number; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 600,
      delay: 450 + index * 110,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, index]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Welcome screen for a signed-out visitor: the site's voice (phrases, photo,
 * ASE badge) over the brand backdrop, one clear way to create an account and
 * one to log in.
 */
const Onboarding = () => {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const lang: SupportedLanguage = i18n.language?.startsWith("es") ? "es" : "en";
  const insets = useSafeAreaInsets();

  // The blue card rises on entry; tapping an action grows it to fill the screen
  // and the next screen continues on the same backdrop.
  const [sheetH, setSheetH] = useState(height * 0.5);
  const enter = useRef(new Animated.Value(0)).current; // card slides up (native)
  const zoom = useRef(new Animated.Value(0)).current; // photo settles (native)
  const expand = useRef(new Animated.Value(0)).current; // card fills the screen (JS)
  const leaving = useRef(false);
  // The blue card follows the finger a little, like a card on a spring, and settles back on release.
  const drag = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => !leaving.current && Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(-36, Math.min(70, g.dy * 0.4))),
      onPanResponderRelease: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true, damping: 14, stiffness: 160 }).start(),
      onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(enter, { toValue: 1, friction: 10, tension: 45, useNativeDriver: true }),
      Animated.timing(zoom, { toValue: 1, duration: 1600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [enter, zoom]);

  // Coming back from login/setup: the card is a card again.
  useFocusEffect(
    useCallback(() => {
      leaving.current = false;
      expand.setValue(0);
    }, [expand]),
  );

  const go = (path: "/login" | "/setup") => {
    if (leaving.current) return;
    leaving.current = true;
    Animated.timing(expand, {
      toValue: 1,
      duration: 460,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(() => router.push(path));
  };

  const fadeOut = { opacity: expand.interpolate({ inputRange: [0, 0.55], outputRange: [1, 0], extrapolate: "clamp" }) };

  const chips = [
    { icon: ShieldCheck, label: t("welcome.chipAse") },
    { icon: CalendarClock, label: t("welcome.chipFlex") },
    { icon: Video, label: t("welcome.chipVideo") },
  ];

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Photo from the website */}
      <View style={styles.photoWrap} pointerEvents="none">
        <Animated.Image
          source={require("@/assets/images/welcome_mechanic.jpg")}
          style={[styles.photo, { transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1.14, 1] }) }] }]}
          resizeMode="cover"
        />
        {/* Same two layers the website puts on this photo: a vertical navy fade and a 135° blue-to-cyan wash */}
        <LinearGradient
          colors={["rgba(7,19,38,0.02)", "rgba(6,19,41,0.16)", "rgba(6,19,41,0.81)"]}
          locations={[0, 0.52, 1]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["rgba(40,71,143,0.30)", "rgba(29,104,168,0.14)", "rgba(131,212,237,0.14)"]}
          locations={[0, 0.48, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* The sky behind the logo fades to white, so the brand-colour logo reads on its own */}
        <LinearGradient
          colors={[
            "rgba(255,255,255,1)",
            "rgba(255,255,255,1)",
            "rgba(255,255,255,0.9)",
            "rgba(255,255,255,0.5)",
            "rgba(255,255,255,0.15)",
            "rgba(255,255,255,0)",
          ]}
          locations={[0, 0.55, 0.7, 0.83, 0.93, 1]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 290 }}
          pointerEvents="none"
        />
      </View>

      {/* Top bar: logo + login */}
      <Animated.View style={fadeOut} pointerEvents="box-none">
      <Reveal index={-2}>
        <View style={[styles.topBar, { paddingTop: insets.top + 14 }]}>
          <View style={styles.logoBlock}>
            <Image source={require("@/assets/images/brand_ring_color.png")} style={styles.topLogo} resizeMode="contain" />
            <Image source={require("@/assets/images/brand_wordmark_color.png")} style={styles.topWord} resizeMode="contain" />
          </View>
        </View>
      </Reveal>
      </Animated.View>

      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, fadeOut, { zIndex: 20 }]}>
        {/* Outside the animated wrappers so it always receives touches */}
          <TouchableOpacity
          onPress={() => go("/login")}
          accessibilityRole="button"
          accessibilityLabel={t("welcome.login")}
          style={[styles.loginPill, { top: insets.top + 10 }]}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.loginPillText}>{t("welcome.login")}</Text>
        </TouchableOpacity>

        {/* Quiet language switch, available from the very first screen */}
        <View style={[styles.langWrap, { top: insets.top + 12 }]}>
          {(["en", "es"] as SupportedLanguage[]).map((code, i) => (
            <React.Fragment key={code}>
              {i > 0 ? <Text style={styles.langSep}>|</Text> : null}
              <TouchableOpacity
                onPress={() => setAppLanguage(code)}
                accessibilityRole="button"
                accessibilityState={{ selected: lang === code }}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              >
                <Text style={[styles.langText, lang === code && styles.langTextOn]}>{code.toUpperCase()}</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents="box-none"
        {...pan.panHandlers}
        style={[
          styles.sheetWrap,
          { transform: [{ translateY: Animated.add(enter.interpolate({ inputRange: [0, 1], outputRange: [sheetH + 60, 0] }), drag) }] },
        ]}
      >
      <Animated.View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (!leaving.current && Math.abs(h - sheetH) > 1 && h < height * 0.9) setSheetH(h);
        }}
        style={[
          styles.sheet,
          {
            // 40px extra: the card reaches past the bottom edge so lifting it never uncovers the photo behind.
            paddingBottom: Math.max(insets.bottom, 16) + 12 + 40,
            minHeight: expand.interpolate({ inputRange: [0, 1], outputRange: [0, height] }),
            borderTopLeftRadius: expand.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }),
            borderTopRightRadius: expand.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }),
          },
        ]}
      >
        <MeshBackground />
        <Animated.View style={fadeOut}>
        <Reveal index={1}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowLine} />
            <Text style={styles.eyebrow}>{t("welcome.eyebrow")}</Text>
          </View>
        </Reveal>

        <Reveal index={2}>
          <Text style={styles.title}>
            <Text style={{ color: CYAN }}>{t("welcome.titleA")}</Text>
            {"\n"}
            {t("welcome.titleB")}
          </Text>
        </Reveal>

        <Reveal index={3}>
          <Text style={styles.sub}>{t("welcome.sub")}</Text>
        </Reveal>

        <Reveal index={4}>
          <View style={styles.chips}>
            {chips.map(({ icon: Icon, label }) => (
              <View key={label} style={styles.chip}>
                <Icon size={15} color={CYAN} />
                <Text style={styles.chipText}>{label}</Text>
              </View>
            ))}
          </View>
        </Reveal>

        <Reveal index={5}>
          <View style={{ gap: 12, marginTop: 22 }}>
            {/* On a brand-blue surface the app's buttons switch to their inverse variant:
                white primary with a blue label, translucent outline secondary. Same radius, height and type as the rest. */}
            <TouchableOpacity
              onPress={() => go("/setup")}
              activeOpacity={0.85}
              accessibilityRole="button"
              style={styles.cta}
            >
              <Text style={styles.ctaText}>{t("welcome.create")}</Text>
              <ChevronRight size={20} color="#1E56E3" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => go("/login")}
              activeOpacity={0.85}
              accessibilityRole="button"
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>{t("welcome.haveAccount")}</Text>
            </TouchableOpacity>
          </View>
        </Reveal>
        </Animated.View>
      </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#061A66" },
  photoWrap: { position: "absolute", top: 0, left: 0, width, height: PHOTO_H, backgroundColor: "#FFFFFF" },
  photo: { width, height: PHOTO_H - PHOTO_SHIFT, marginTop: PHOTO_SHIFT },

  topBar: { paddingHorizontal: 20, alignItems: "center" },
  logoBlock: { alignItems: "center" },
  topLogo: { width: 92, height: 92 },
  topWord: { width: 250, height: 250 * (51 / 947), marginTop: 12 },
  loginPill: {
    position: "absolute",
    right: 20,
    zIndex: 20,
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 14,
    justifyContent: "center",
    backgroundColor: "#EAF1FF",
    borderWidth: 1.5,
    borderColor: "#CFDDF8",
  },
  langWrap: {
    position: "absolute",
    left: 20,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(7,19,38,0.32)",
  },
  langText: { color: "rgba(255,255,255,0.65)", fontFamily: "Outfit_500Medium", fontSize: 13, letterSpacing: 0.6 },
  langTextOn: { color: "#FFFFFF", fontFamily: "Outfit_700Bold" },
  langSep: { color: "rgba(255,255,255,0.35)", fontSize: 13 },
  loginPillText: { color: "#1E56E3", fontFamily: "Outfit_700Bold", fontSize: 15 },

  sheetWrap: { position: "absolute", left: 0, right: 0, bottom: -40 },
  sheet: {
    justifyContent: "flex-end",
    paddingTop: 28,
    paddingHorizontal: 24,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
    backgroundColor: "#0B2A8E",
  },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  eyebrowLine: { width: 28, height: 2, borderRadius: 1, backgroundColor: CYAN },
  eyebrow: {
    flex: 1,
    color: "#DDE8FF",
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: "#FFFFFF",
    fontFamily: "Outfit_700Bold",
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -1,
  },
  sub: {
    color: "#C9D6EE",
    fontFamily: "Outfit_400Regular",
    fontSize: 17,
    lineHeight: 24,
    marginTop: 12,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 18 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  chipText: { color: "#FFFFFF", fontFamily: "Outfit_500Medium", fontSize: 13 },

  cta: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    shadowColor: "#061A66",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  ctaText: { ...TYPE.button, color: "#1E56E3", fontFamily: "Outfit_700Bold" },
  secondary: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.45)",
  },
  secondaryText: { ...TYPE.button, color: "#FFFFFF", fontFamily: "Outfit_700Bold" },
});

export default Onboarding;
