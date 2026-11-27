import { FONT, FONT_ASSETS } from "@/lib/ui/fonts";
import { LogBox, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { PAGE_BG } from "@/lib/ui/header";

// The page colour behind the rounded header and the floating tab bar.
const APP_THEME = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: PAGE_BG } };
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AnimatedSplash } from "@/components/brand/AnimatedSplash";
import "react-native-reanimated";

import { GlobalNotificationListener } from "@/components/GlobalNotificationListener";
import { AppAlertHost } from "@/components/ui/AppAlertHost";
import { InAppRequestBanner } from "@/components/InAppRequestBanner";
import { PushNotificationRouter } from "@/components/PushNotificationRouter";
import { AppointmentsProvider } from "@/context/AppointmentsContext";
import { MechanicStatusProvider } from "@/context/MechanicStatusContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { SocketProvider } from "@/context/SocketContext";
import { UpdateRequiredGate } from "@/components/UpdateRequiredGate";
import { UserProvider, useUser } from "@/context/UserContext";
import { onSessionExpired } from "@/lib/auth/session";
import { VerificationProvider } from "@/context/VerificationContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { ConfigService } from "@/lib/config/ConfigService";
import { errorSummary, installGlobalErrorHandler, recordFatalError, shareErrorReport } from "@/lib/errors/globalErrorHandler";
import i18n from "@/lib/i18n";
import { lockPortrait } from "@/lib/orientation";
// Defines the background location task at startup, including headless relaunches.
import "@/lib/location/backgroundLocationTask";
import "../global.css";

// Suppress warnings from dependencies that aren't yet updated for React 19
LogBox.ignoreLogs([
  "props.pointerEvents is deprecated",
  "Accessing element.ref was removed in React 19",
  "Blocked aria-hidden on an element",
  /Blocked aria-hidden on an element/,
  // RNFirebase namespaced API — intentionally kept (see FIREBASE_PHONE_AUTH.md)
  "This method is deprecated (as well as all React Native Firebase namespaced API)",
  // SafeAreaView from RN core — use react-native-safe-area-context (already done)
  "SafeAreaView has been deprecated",
  // ConfigService bootstrap fetch fails in dev/offline — fallback handles it
  "[ConfigService] Could not fetch remote bootstrap config",
  // Firebase Auth internal console warnings
  "[FirebaseAuth]",
  /\[FirebaseAuth\]/,
]);

// Inner component — lives inside UserProvider so it can read auth loading state.
// Keeps the splash screen visible until both fonts and the Firebase session check resolve.
function AppShell() {
  const { isLoading, user } = useUser();
  const router = useRouter();
  const segments = useSegments();

  // Once the session check is done, the animated brand splash takes over from
  // the native one (which it hides as soon as it is on screen, no white flash).
  const [splashDone, setSplashDone] = useState(false);
  const showSplash = !isLoading && !splashDone;

  /**
   * Sends the user to the login screen when the session is unrecoverable.
   *
   * The API client emits this once, however many concurrent requests discovered
   * the 401 — UserContext has already cleared local state by then, and this is
   * the navigation half. Without it the app would sit on a signed-in screen
   * whose every request failed.
   */
  useEffect(
    () =>
      onSessionExpired(() => {
        router.replace("/onboarding");
      }),
    [router],
  );

  /**
   * The way out of the signed-in screens when there is no session: if the app is still inside (tabs) a moment after the user is gone
   * (logging out, or a session lost some other way), go to the entry route, which decides where to land. A navigation made at the same time
   * as the closing of a native modal can be swallowed on iOS, and nothing else would retry it, leaving the profile on its spinner.
   * It does nothing once the screen has already changed (the segments change and cancel the timer).
   */
  const inTabs = segments[0] === "(tabs)";
  useEffect(() => {
    if (isLoading || user || !inTabs) return undefined;
    const timer = setTimeout(() => router.replace("/entry"), 900);
    return () => clearTimeout(timer);
  }, [isLoading, user, inTabs, router]);

  if (isLoading) return null;

  return (
    <UpdateRequiredGate>
      <GlobalNotificationListener />
      <AppAlertHost />
      <PushNotificationRouter />
      <InAppRequestBanner />
      <Stack screenOptions={{ gestureEnabled: false, fullScreenGestureEnabled: false, headerShown: false }}>
        {/* Every (tabs) screen has its own back arrow. With the edge swipe on,
            a second (tabs) entry on this stack could be dragged aside and
            showed the tab navigator underneath, tab bar and all. The nested
            stacks (dashboard/[id], appointments/[id]…) keep their own swipe. */}
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="index" />
        <Stack.Screen name="login" options={{ animation: "fade" }} />
        <Stack.Screen name="choose-role" options={{ gestureEnabled: false, animation: "fade" }} />
        <Stack.Screen name="onboarding" />
        {/* The mechanic availability step has a slider a few points from the
            left edge; the edge swipe-back recognizer stole the drag and slid
            the screen sideways. Disabling it on the child stack alone just
            handed the gesture to this one, which popped the whole setup flow.
            Every setup screen has its own back arrow in the header. */}
        <Stack.Screen name="setup" options={{ gestureEnabled: false, animation: "fade" }} />
        <Stack.Screen name="verify-identity" />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal", headerShown: true }}
        />
      </Stack>
      <StatusBar style={showSplash ? "light" : "dark"} />
      {showSplash ? (
        <AnimatedSplash
          onReady={() => SplashScreen.hideAsync()}
          onFinish={() => setSplashDone(true)}
        />
      ) : null}
    </UpdateRequiredGate>
  );
}

installGlobalErrorHandler();

// Shown by expo-router when a screen throws while rendering, instead of closing the app.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    recordFatalError(error, false);
  }, [error]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#F6F8FC" }}>
      <Text style={{ fontFamily: FONT.medium, fontSize: 20, color: "#0B1530", marginBottom: 8 }}>
        {i18n.t("crash.title")}
      </Text>
      <Text style={{ fontFamily: FONT.regular, fontSize: 14, color: "#6B7490", textAlign: "center", marginBottom: 16 }}>
        {i18n.t("crash.message")}
      </Text>
      {/* The problem itself, selectable (long-press to copy), so a tester can send exactly what failed. */}
      <ScrollView style={{ maxHeight: 220, alignSelf: "stretch", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 12, marginBottom: 16 }}>
        <Text selectable style={{ fontFamily: FONT.regular, fontSize: 13, color: "#0B1530" }}>{errorSummary(error)}</Text>
      </ScrollView>
      <TouchableOpacity
        onPress={retry}
        style={{ backgroundColor: "#1E56E3", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, alignSelf: "stretch", alignItems: "center" }}
      >
        <Text style={{ fontFamily: FONT.medium, fontSize: 15, color: "#FFFFFF" }}>{i18n.t("crash.retry")}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => shareErrorReport(error)}
        style={{ backgroundColor: "#E6EAF2", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, alignSelf: "stretch", alignItems: "center", marginTop: 10 }}
      >
        <Text style={{ fontFamily: FONT.medium, fontSize: 15, color: "#4A5470" }}>{i18n.t("crash.copy")}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, error] = useFonts(FONT_ASSETS);

  useEffect(() => {
    ConfigService.init();
    // The app is portrait-only (app.json allows rotation so that single screens can opt in).
    lockPortrait();
  }, []);

  if (!loaded && !error) {
    return null;
  }

  return (
    <ThemeProvider value={APP_THEME}>
      <UserProvider>
        <SocketProvider>
          <MechanicStatusProvider>
            <VerificationProvider>
              <NotificationsProvider>
                <AppointmentsProvider>
                  <AppShell />
                </AppointmentsProvider>
              </NotificationsProvider>
            </VerificationProvider>
          </MechanicStatusProvider>
        </SocketProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
