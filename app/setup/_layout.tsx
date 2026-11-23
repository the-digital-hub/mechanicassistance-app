import { SetupHeader } from "@/components/setup/SetupKit";
import { goBackOr } from "@/lib/navigation/goBackOr";
import { PAGE_BG } from "@/lib/ui/header";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

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
        header: ({ options }) => <SetupHeader title={typeof options.title === "string" ? options.title : setupTitle} onBack={() => goBackOr(router, "/onboarding")} />,
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
    </Stack>
  );
}
