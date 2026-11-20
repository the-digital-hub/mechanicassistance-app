import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "@/context/UserContext";
import { useMechanicStatus } from "@/context/MechanicStatusContext";
import { Tabs, useRouter, usePathname } from "expo-router";
import {
  Bell,
  Calendar,
  Circle,
  FileText,
  LifeBuoy,
  User as UserIcon,
  Wrench,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Image, Modal, Platform, Pressable, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { HapticTab } from "@/components/haptic-tab";
import { HeaderBackButton } from "@/components/ui/HeaderBackButton";
import { RoundedHeaderBackground } from "@/components/ui/RoundedHeaderBackground";
import { RoundedTabBar } from "@/components/ui/RoundedTabBar";
import { createScrollIntent } from "@/lib/ui/tabBarVisibility";
import { ATTACHED_TAB_BAR, HEADER_OVERLAP, PAGE_BG, TAB_BAR_HEIGHT } from "@/lib/ui/header";
import { NotificationBell } from "@/components/NotificationBell";
import { MechanicLocationBroadcaster } from "@/components/MechanicLocationBroadcaster";
import { LocationRevalidator } from "@/components/LocationRevalidator";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { goBackOr } from "@/lib/navigation/goBackOr";
import { useTranslation } from "react-i18next";
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';

function MechanicStatusHeaderLeft() {
  return <MechanicStatusBadge />;
}

function PersonalInfoHeaderLeft() {
  const router = useRouter();
  return <HeaderBackButton onPress={() => goBackOr(router, "/(tabs)")} />;
}

function PersonalInfoHeaderRight() {
  const router = useRouter();
  const { user } = useUser();

  if (user?.role === 'mechanic') {
    return null;
  }

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
        style={{ marginLeft: 16, backgroundColor: styles.bgColor, borderWidth: 1, borderColor: '#E5E7EB' }}
        className="flex-row items-center gap-2 px-3 py-1.5 rounded-full"
      >
        <Circle size={8} color={styles.dotColor} fill={styles.dotColor} />
        <Text style={{ color: styles.textColor }} className="font-outfit-semibold text-[13px]">
          {getStatusLabel()}
        </Text>
      </TouchableOpacity>

      <Modal supportedOrientations={MODAL_ORIENTATIONS} transparent visible={showModal} animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          {/* Tapping outside the card closes it. */}
          <Pressable style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} onPress={() => setShowModal(false)} accessible={false} testID="status-modal-backdrop" />
          <View className="bg-white w-full rounded-2xl p-6 items-center">
            <Text className="text-lg font-outfit-bold text-gray-900 mb-6 text-center">
              {t('profile.modals.changeStatus')}
            </Text>

            <View className="w-full gap-3">
              {statusOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => {
                    setMechanicStatus(option.id).catch(() => undefined);
                    setShowModal(false);
                  }}
                  activeOpacity={0.8}
                  className={`flex-row items-start gap-3 p-4 rounded-xl border ${
                    mechanicStatus === option.id ? 'bg-blue-50 border-blue-200' : 'border-gray-200'
                  }`}
                >
                  <View className="mt-0.5">
                    <Circle size={10} color={getStatusColor(option.id)} fill={getStatusColor(option.id)} />
                  </View>
                  <View className="flex-1">
                    <Text className={`font-outfit-semibold text-base ${
                      mechanicStatus === option.id ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {option.label}
                    </Text>
                    <Text className="text-gray-600 font-outfit-regular text-[13px] mt-1">
                      {option.description}
                    </Text>
                  </View>
                  {mechanicStatus === option.id && (
                    <View className="w-5 h-5 rounded-full bg-blue-600 mt-0.5" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
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

function ProfileTabIcon({ color }: { color: string }) {
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
  // The native header is transparent, so the page runs under its rounded lower edge; the page starts HEADER_OVERLAP above the header's bottom.
  const sceneUnderHeader = { backgroundColor: PAGE_BG, paddingTop: Math.max(0, insets.top + (Platform.OS === "ios" ? 44 : 56) - HEADER_OVERLAP) };
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
      onTouchStart={(e) => scrollIntent.start(e.nativeEvent.pageX, e.nativeEvent.pageY)}
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
        // Attached to the bottom edge, top corners rounded (see lib/ui/header.ts).
        tabBarStyle: {
          ...ATTACHED_TAB_BAR,
          height: TAB_BAR_HEIGHT,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
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
        headerBackground: () => <RoundedHeaderBackground />,
        headerTitleStyle: {
          fontFamily: "Outfit_500Medium",
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
          tabBarIcon: ({ color }) => <LifeBuoy size={24} color={color} />,
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
          headerLeft: () => null,
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
            fontFamily: "Outfit_500Medium",
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
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
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
          href: null,
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="availability"
        options={{
          href: null,
          // The name the profile menu gives this section.
          title: t('profile.menu.schedule'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="phone-change"
        options={{
          href: null,
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="email-change"
        options={{
          href: null,
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="service-base"
        options={{
          href: null,
          title: t('profile.menu.schedule'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="payment-cards"
        options={{
          href: null,
          title: t('profile.menu.paymentCards'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="payment-activity"
        options={{
          href: null,
          title: t('wallet.activity.title'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="ase"
        options={{
          href: null,
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="certification-form"
        options={{
          href: null,
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="other-certifications"
        options={{
          href: null,
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="legal-documents"
        options={{
          href: null,
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          href: null,
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="promotions"
        options={{
          href: null,
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="help"
        options={{
          href: null,
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="privacy"
        options={{
          href: null,
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="live-chat"
        options={{
          href: null,
          title: t('tabs.profile'),
          headerLeft: () => <HeaderBackButton onPress={() => goBackOr(router, "/(tabs)")} />,
        }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{
          href: null,
          title: t('tabs.profile'),
          headerLeft: () => <HeaderBackButton onPress={() => goBackOr(router, "/(tabs)")} />,
        }}
      />
      <Tabs.Screen
        name="addresses"
        options={{
          href: null,
          title: t('tabs.profile'),
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderTopColor: "#E5E5E5",
            height: Platform.OS === "ios" ? 88 : 68,
            paddingTop: 8,
            paddingBottom: Platform.OS === "ios" ? 28 : 8,
          },
        }}
      />

      {/* Hidden deep-nav routes — keep tab bar visible */}
      <Tabs.Screen name="chat" options={{ href: null, headerShown: false, sceneStyle: sceneNoHeader }} />
      <Tabs.Screen name="call" options={{ href: null, headerShown: false, sceneStyle: sceneNoHeader }} />
      <Tabs.Screen
        name="video-lobby"
        options={{ href: null, headerShown: false, sceneStyle: sceneNoHeader }}
      />
      {/* The call is full screen: no tab bar under it (sideways it would take a third of the height). */}
      <Tabs.Screen
        name="video-call"
        options={{ href: null, headerShown: false, sceneStyle: sceneNoHeader, tabBarStyle: { display: "none" } }}
      />
    </Tabs>
    </View>
    </>
  );
}
