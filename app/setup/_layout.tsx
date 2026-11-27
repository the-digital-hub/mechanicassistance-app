import { SetupHeader } from "@/components/setup/SetupKit";
import { PAGE_BG } from "@/lib/ui/header";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

/**
 * Back from a setup screen. Inside setup it goes to the previous step. From the first step it goes back only when the screen under it is
 * really the welcome or the login (where "Create account" came from). Otherwise (the registration was resumed from `/`, so the router put the
 * tabs under it) a plain back landed on the tabs, whose guard sent it to `/`, which resumed the registration at the phone again: the first tap
 * seemed to do nothing and the second one worked. That case leaves straight to the welcome.
 */
function leaveSetup(router: ReturnType<typeof useRouter>, navigation: { getState: () => { index: number }; goBack: () => void; getParent: () => { getState: () => { index: number; routes: { name: string }[] } } | undefined }) {
  if (navigation.getState().index > 0) {
    navigation.goBack();
    return;
  }
  const root = navigation.getParent()?.getState();
  const below = root ? root.routes[root.index - 1]?.name : undefined;
  if (below === "onboarding" || below === "login") router.back();
  else router.replace("/onboarding");
}

export default function SetupLayout() {
  const router = useRouter();
  const { t } = useTranslation();
  const setupTitle = t("setup.accountSetupTitle");

  return (
    <Stack
      screenOptions={{
        // No edge swipe-back anywhere in setup: the availability step's service
        // radius slider sits a few points from the left edge, and the edge
        // recognizer stole the drag and slid the screen sideways. Every screen
        // here has its own back arrow in the header.
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
        // The same rounded header and small back arrow as the wizards (SetupKit.SetupHeader), not the native one. Back goes to the previous step; a
        // step that is the first of its stack (a registration resumed half-way, or reached by a redirect) has nothing behind it, so it leaves to the welcome
        // screen instead of doing nothing and leaving the person stuck there.
        header: ({ options, navigation }) => <SetupHeader title={typeof options.title === "string" ? options.title : setupTitle} onBack={() => leaveSetup(router, navigation)} />,
        contentStyle: { backgroundColor: PAGE_BG },
      }}
    >
      <Stack.Screen name="index" options={{ title: setupTitle }} />
      <Stack.Screen name="otp" options={{ title: setupTitle }} />
      <Stack.Screen
        name="role-selection"
        options={{ title: setupTitle }}
      />
      <Stack.Screen name="basic-info" options={{ title: setupTitle }} />
      <Stack.Screen
        name="address"
        options={{ title: setupTitle }}
      />
      <Stack.Screen name="credentials" options={{ title: setupTitle }} />
      <Stack.Screen name="dealer-info" options={{ title: setupTitle }} />
      <Stack.Screen name="expertise" options={{ title: t("setup.availabilityTitle") }} />
      <Stack.Screen name="availability" options={{ title: setupTitle }} />
      <Stack.Screen name="legal-documents" options={{ title: setupTitle }} />
      <Stack.Screen name="identity" options={{ title: setupTitle }} />
      <Stack.Screen name="vehicle-info" options={{ title: setupTitle }} />
      <Stack.Screen name="success" options={{ headerShown: false }} />
      <Stack.Screen name="legal" options={{ headerShown: false }} />
    </Stack>
  );
}
