import {
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_700Bold,
} from "@expo-google-fonts/outfit";
import { LogBox } from "react-native";

import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { GlobalNotificationListener } from "@/components/GlobalNotificationListener";
import { AppointmentsProvider } from "@/context/AppointmentsContext";
import { MechanicStatusProvider } from "@/context/MechanicStatusContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { SocketProvider } from "@/context/SocketContext";
import { UserProvider, useUser } from "@/context/UserContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { ConfigService } from "@/lib/config/ConfigService";
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
  const { isLoading } = useUser();

  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => {
        SplashScreen.hideAsync();
      }, 3000);
    }
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <>
      <GlobalNotificationListener />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="setup" />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal", headerShown: true }}
        />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, error] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_700Bold,
  });

  useEffect(() => {
    ConfigService.init();
  }, []);

  if (!loaded && !error) {
    return null;
  }

  return (
    <ThemeProvider value={DefaultTheme}>
      <UserProvider>
        <MechanicStatusProvider>
          <SocketProvider>
            <NotificationsProvider>
              <AppointmentsProvider>
                <AppShell />
              </AppointmentsProvider>
            </NotificationsProvider>
          </SocketProvider>
        </MechanicStatusProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
