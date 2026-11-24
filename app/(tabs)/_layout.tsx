import { FONT } from '@/lib/ui/fonts';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "@/context/UserContext";
import { useMechanicStatus } from "@/context/MechanicStatusContext";
import { Tabs, useRouter, usePathname } from "expo-router";
import {
  Bell,
  Calendar,
  Circle,
  FileText,
  CircleGauge,
  User as UserIcon,
  Wrench,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { ColorValue, Image, Platform, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { HapticTab } from "@/components/haptic-tab";
import { HeaderBackButton } from "@/components/ui/HeaderBackButton";
import { RoundedHeaderBackground } from "@/components/ui/RoundedHeaderBackground";
import { RoundedTabBar } from "@/components/ui/RoundedTabBar";
import { createScrollIntent } from "@/lib/ui/tabBarVisibility";
import { FLOATING_TAB_BAR, HEADER_OVERLAP, PAGE_BG, PILL_HEIGHT } from "@/lib/ui/header";
import { NotificationBell } from "@/components/NotificationBell";
import { MechanicLocationBroadcaster } from "@/components/MechanicLocationBroadcaster";
import { LocationRevalidator } from "@/components/LocationRevalidator";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { goBackOr } from "@/lib/navigation/goBackOr";
import { useTranslation } from "react-i18next";
import { MechanicStatusSheet } from '@/components/profile/MechanicStatusSheet';

/** The brand's isologo, where the technician has their availability badge: the vehicle owner's root screens. Tapping it goes to the dashboard. */
function BrandMark() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.navigate("/(tabs)/dashboard")}
      activeOpacity={0.7}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Mechanic Assistance"
      testID="header-brand-mark"
      style={{ marginLeft: 16 }}
    >
      <Image
        source={require("@/assets/images/mechanic_assistance_isologo.png")}
        style={{ width: 36, height: 36 }}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
}

/** Top left of the root screens: the technician's availability badge, the owner's isologo. A back arrow replaces either. */
function MechanicStatusHeaderLeft() {
  const { user } = useUser();
  return user?.role === "mechanic" ? <MechanicStatusBadge /> : <BrandMark />;
}

function PersonalInfoHeaderLeft() {
  const router = useRouter();
  return <HeaderBackButton onPress={() => goBackOr(router, "/(tabs)")} />;
}

function PersonalInfoHeaderRight() {
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => router.push("/(tabs)/notifications")}
      style={{ marginRight: 16 }}
      className="justify-center items-center"
    >
      <NotificationBell />
    </TouchableOpacity>
  );
}

function AddressesHeaderLeft() {
  const router = useRouter();
  return <HeaderBackButton onPress={() => goBackOr(router, "/(tabs)")} />;
}

function MechanicStatusBadge() {
  const { t } = useTranslation();
  const { user } = useUser();
  const { mechanicStatus, setMechanicStatus } = useMechanicStatus();
  const [showModal, setShowModal] = useState(false);

  if (user?.role !== 'mechanic') {
    return null;
  }

  const getStatusStyles = () => {
    switch (mechanicStatus) {
      case 'available':
        return { bgColor: '#ECFDF5', textColor: '#111827', dotColor: '#10B981' };
      case 'busy':
        return { bgColor: '#FEF3C7', textColor: '#111827', dotColor: '#F97316' };
      case 'offline':
        return { bgColor: '#F3F4F6', textColor: '#6B7280', dotColor: '#9CA3AF' };
      default:
        return { bgColor: '#ECFDF5', textColor: '#111827', dotColor: '#10B981' };
    }
  };

  const getStatusLabel = () => {
    if (mechanicStatus === 'available') return t('profile.availability.available');
    if (mechanicStatus === 'busy') return t('profile.availability.busy');
    return t('profile.availability.offline');
  };

  const getStatusColor = (status: 'available' | 'busy' | 'offline') => {
    if (status === 'available') return '#10B981';
    if (status === 'busy') return '#F97316';
    return '#9CA3AF';
  };

  const statusOptions: Array<{ id: 'available' | 'busy' | 'offline', label: string, description: string }> = [
    {
      id: 'available',
      label: t('profile.availability.available'),
      description: t('profile.availability.availableDesc')
    },
    {
      id: 'busy',
      label: t('profile.availability.busy'),
      description: t('profile.availability.busyDesc')
    },
    {
      id: 'offline',
      label: t('profile.availability.offline'),
      description: t('profile.availability.offlineDesc')
    },
  ];

  const styles = getStatusStyles();

  return (
    <>
      <TouchableOpacity
        onPress={() => setShowModal(true)}
        style={{ marginLeft: 16, flexShrink: 1, backgroundColor: styles.bgColor, borderWidth: 1, borderColor: '#E5E7EB' }}
        className="flex-row items-center gap-2 px-3 py-1.5 rounded-full"
      >
        <Circle size={8} color={styles.dotColor} fill={styles.dotColor} />
        {/* One line on small screens too ("Desconectado" split in two): it shrinks a little instead. */}
        <Text style={{ color: styles.textColor, flexShrink: 1 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} className="font-outfit-semibold text-[13px]">
          {getStatusLabel()}
        </Text>
      </TouchableOpacity>

      <MechanicStatusSheet
        visible={showModal}
        title={t('profile.modals.changeStatus')}
        current={mechanicStatus === 'busy' || mechanicStatus === 'offline' ? mechanicStatus : 'available'}
        options={statusOptions}
        onPick={(id) => setMechanicStatus(id).catch(() => undefined)}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

export function NotificationHeaderRight() {
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => router.push("/(tabs)/notifications")}
      style={{ marginRight: 16 }}
      className="justify-center items-center"
    >
      <NotificationBell />
    </TouchableOpacity>
  );
}

function ProfileTabIcon({ color }: { color: ColorValue }) {
  const { user } = useUser();
  return (
    <View
      className="w-7 h-7 rounded-full bg-blue-50 justify-center items-center overflow-hidden"
      style={{ borderColor: color, borderWidth: 1 }}
    >
      {user?.profileImage ? (
        <Image source={{ uri: user.profileImage }} className="w-full h-full" />
      ) : (
        <UserIcon size={20} color={color} />
      )}
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useUser();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  // Android edge-to-edge: the system buttons / gesture bar are drawn over the bottom of the screen, so the tab bar grows by their height.
  const androidBottomInset = Platform.OS === "android" ? insets.bottom : 0;
  // The native header is transparent, so the page runs under its rounded lower edge; the page starts HEADER_OVERLAP above the header's bottom.
  const [headerHeight, setHeaderHeight] = useState(insets.top + (Platform.OS === "ios" ? 44 : 56));
  const sceneUnderHeader = { backgroundColor: PAGE_BG, paddingTop: Math.max(0, headerHeight - HEADER_OVERLAP) };
  const sceneNoHeader = { backgroundColor: PAGE_BG, paddingTop: 0 };

  const isRequestAssistanceRoot = pathname === "/request-assistance" || pathname === "/request-assistance/";
  // The mechanic's quote screens (build, review, sent...) draw their own wizard header.
  const isScheduledQuote = pathname.startsWith("/assist/scheduled-request");
  // Only the appointment detail itself (/appointments/<id>) borrows the tab
  // header's back button: check-in, review and cancel-reason draw their own.
  const hasOwnHeader = /^\/appointments\/(receipt|review|check-in)\//.test(pathname);
  const isAppointmentDetail =
    /^\/appointments\/[^/]+$/.test(pathname) && pathname !== "/appointments/cancel-reason";

  // A finger dragging over any screen tells whether the person scrolls down (the tab bar tucks away) or back up (it returns).
  const scrollIntent = useMemo(() => createScrollIntent(), []);

  return (
    <>
    <MechanicLocationBroadcaster />
    <LocationRevalidator />
    <View
      style={{ flex: 1 }}
      onTouchStart={(e) => scrollIntent.start(e.nativeEvent.pageX, e.nativeEvent.pageY, Number(e.nativeEvent.target) || undefined)}
      onTouchMove={(e) => scrollIntent.move(e.nativeEvent.pageX, e.nativeEvent.pageY)}
    >
    <Tabs
      // Back follows the order the user actually visited tabs in. The default
      // ("firstRoute") sends every cross-tab back to Dashboard.
      backBehavior="history"
      tabBar={(props) => <RoundedTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: "#0047AB",
        tabBarInactiveTintColor: "#8E8E93",
        // A floating pill, with room around it (see lib/ui/header.ts).
        tabBarStyle: {
          ...FLOATING_TAB_BAR,
          height: PILL_HEIGHT,
          paddingBottom: 0,
        },
        headerShown: true,
        headerTitleAlign: "center",
        headerTintColor: "#0047AB",
        // The header is a rounded surface drawn by headerBackground; the bar itself stays transparent so the corners show the page.
        headerStyle: { backgroundColor: "transparent" },
        headerShadowVisible: false,
        // The scene behind the header corners is the page colour, so the corners blend with the body.
        headerTransparent: true,
        sceneStyle: sceneUnderHeader,
        headerBackground: () => <RoundedHeaderBackground onHeight={setHeaderHeight} />,
        headerTitleStyle: {
          fontFamily: FONT.medium,
          fontSize: 18,
          color: "#1A1A1A",
        },
        headerLeft: () => <HeaderBackButton onPress={() => goBackOr(router, "/(tabs)/dashboard")} />,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('tabs.dashboard'),
          tabBarIcon: ({ color }) => <CircleGauge size={24} color={color} />,
          headerLeft: () => <MechanicStatusHeaderLeft />,
          headerRight: () => <NotificationHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="assist"
        options={{
          href: user?.role === "mechanic" ? undefined : null,
          headerShown: !isScheduledQuote,
          sceneStyle: isScheduledQuote ? sceneNoHeader : sceneUnderHeader,
          title: t('tabs.requests'),
          tabBarIcon: ({ color }) => <Wrench size={24} color={color} />,
          headerLeft: () => <MechanicStatusHeaderLeft />,
          headerRight: () => <NotificationHeaderRight />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('assist', { screen: 'index' });
          },
        })}
      />
      <Tabs.Screen
        name="request-assistance"
        options={{
          href: user?.role === "mechanic" ? null : undefined,
          title: t('tabs.requests'),
          tabBarIcon: ({ color }) => <Wrench size={24} color={color} />,
          headerShown: isRequestAssistanceRoot,
          sceneStyle: isRequestAssistanceRoot ? sceneUnderHeader : sceneNoHeader,
          headerLeft: () => <BrandMark />,
          headerRight: () => <NotificationHeaderRight />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('request-assistance', { screen: 'index' });
          },
        })}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: t('tabs.appointments'),
          // Receipt, review and check-in draw their own header (back + their name): no second one stacked above it.
          headerShown: !hasOwnHeader,
          sceneStyle: hasOwnHeader ? sceneNoHeader : sceneUnderHeader,
          tabBarIcon: ({ color }) => <Calendar size={24} color={color} />,
          headerTitleStyle: {
            fontFamily: FONT.medium,
            fontSize: 18,
            color: "#1A1A1A",
          },
          headerLeft: () =>
            isAppointmentDetail ? (
              <HeaderBackButton
                onPress={() => goBackOr(router, "/(tabs)/appointments")}
                testID="appointment-detail-back"
              />
            ) : (
              <MechanicStatusHeaderLeft />
            ),
          headerRight: () => <NotificationHeaderRight />,
        }}
        listeners={({ navigation }) => ({
          // Tapping the tab always shows the list, even when the stack was
          // entered straight on a detail from another tab or a notification.
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('appointments', { screen: 'index' });
          },
        })}
      />
      {/* Screens in the navigator with no tab of their own: `tabBarItemStyle: { display: "none" }` takes their slot out of the bar. (`href: null` no longer
          works for this since Expo Router 58: a tab hidden that way redirects to the dashboard instead of opening. And a null `tabBarButton` leaves an
          empty slot that squeezes the real tabs to one side.) */}
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('tabs.notifications'),
          tabBarIcon: ({ color }) => <Bell size={24} color={color} />,
          headerLeft: () => null,
          headerRight: () => <NotificationHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => <ProfileTabIcon color={color} />,
          headerLeft: () => <MechanicStatusHeaderLeft />,
          headerRight: () => <NotificationHeaderRight />,
        }}
      />

      {/* Hidden Profile Routes */}
      <Tabs.Screen
        name="personal-info"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="availability"
        options={{
          tabBarItemStyle: { display: "none" },
          // The name the profile menu gives this section.
          title: t('profile.menu.schedule'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="phone-change"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="email-change"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="service-base"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('profile.menu.schedule'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="payment-cards"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('profile.menu.paymentCards'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="payment-activity"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('wallet.activity.title'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="ase"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="certification-form"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="other-certifications"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="legal-documents"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="promotions"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="help"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="privacy"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="membership"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="live-chat"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('tabs.profile'),
          headerLeft: () => <HeaderBackButton onPress={() => goBackOr(router, "/(tabs)")} />,
        }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('tabs.profile'),
          headerLeft: () => <HeaderBackButton onPress={() => goBackOr(router, "/(tabs)")} />,
        }}
      />
      <Tabs.Screen
        name="addresses"
        options={{
          tabBarItemStyle: { display: "none" },
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
          tabBarStyle: { ...FLOATING_TAB_BAR, height: PILL_HEIGHT, paddingBottom: 0 },
        }}
      />

      {/* Hidden deep-nav routes — keep tab bar visible */}
      <Tabs.Screen name="chat" options={{ tabBarItemStyle: { display: "none" }, headerShown: false, sceneStyle: sceneNoHeader }} />
      <Tabs.Screen
        name="video-lobby"
        options={{ tabBarItemStyle: { display: "none" }, headerShown: false, sceneStyle: sceneNoHeader }}
      />
      {/* The call is full screen: no tab bar under it (sideways it would take a third of the height). */}
      <Tabs.Screen
        name="video-call"
        options={{ tabBarItemStyle: { display: "none" }, headerShown: false, sceneStyle: sceneNoHeader, tabBarStyle: { display: "none" } }}
      />
    </Tabs>
    </View>
    </>
  );
}
