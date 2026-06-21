import { useUser } from "@/context/UserContext";
import { Tabs, useNavigation, useRouter, usePathname } from "expo-router";
import {
  Bell,
  Calendar,
  ChevronLeft,
  FileText,
  LifeBuoy,
  User as UserIcon,
  Wrench,
} from "lucide-react-native";
import React from "react";
import { Image, Platform, TouchableOpacity, View } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function NotificationHeaderRight() {
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => router.push("/(tabs)/notifications")}
      style={{ marginRight: 16 }}
      className="justify-center items-center"
    >
      <Bell size={24} color="#0047AB" />
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
  const navigation = useNavigation();
  const router = useRouter();
  const { user } = useUser();
  const pathname = usePathname();

  const isRequestAssistanceRoot = pathname === "/request-assistance" || pathname === "/request-assistance/";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#0047AB",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E5E5E5",
          height: Platform.OS === "ios" ? 88 : 68,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
        },
        headerShown: true,
        headerTitleAlign: "center",
        headerTintColor: "#0047AB",
        headerStyle: {
          backgroundColor: "#F4F5FA",
        },
        headerTitleStyle: {
          fontFamily: "Outfit_500Medium",
          fontSize: 18,
          color: "#1A1A1A",
        },
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ marginLeft: 16 }}
          >
            <ChevronLeft size={24} color="#0047AB" />
          </TouchableOpacity>
        ),
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <LifeBuoy size={24} color={color} />,
          headerLeft: () => null,
          headerRight: () => <NotificationHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="assist"
        options={{
          href: user?.role === "mechanic" ? undefined : null,
          title: "Requests",
          tabBarIcon: ({ color }) => <FileText size={24} color={color} />,
          headerLeft: () => null,
          headerRight: () => <NotificationHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="request-assistance"
        options={{
          href: user?.role === "mechanic" ? null : undefined,
          title: "Requests",
          tabBarIcon: ({ color }) => <Wrench size={24} color={color} />,
          headerShown: isRequestAssistanceRoot,
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
          title: "Appointments",
          tabBarIcon: ({ color }) => <Calendar size={24} color={color} />,
          headerLeft: () => null,
          headerRight: () => <NotificationHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          title: "Notifications",
          tabBarIcon: ({ color }) => <Bell size={24} color={color} />,
          headerLeft: () => null,
          headerRight: () => <NotificationHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <ProfileTabIcon color={color} />,
          headerLeft: () => null, // Hide back button on root tab
          headerRight: () => <NotificationHeaderRight />,
        }}
      />

      {/* Hidden Profile Routes */}
      <Tabs.Screen
        name="personal-info"
        options={{
          href: null,
          title: "Profile",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.navigate("/(tabs)")}
              style={{ marginLeft: 16 }}
            >
              <ChevronLeft size={24} color="#0047AB" />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="ase"
        options={{
          href: null,
          title: "Profile",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.navigate("/(tabs)")}
              style={{ marginLeft: 16 }}
            >
              <ChevronLeft size={24} color="#0047AB" />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          href: null,
          title: "Profile",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.navigate("/(tabs)")}
              style={{ marginLeft: 16 }}
            >
              <ChevronLeft size={24} color="#0047AB" />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="promotions"
        options={{
          href: null,
          title: "Profile",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.navigate("/(tabs)")}
              style={{ marginLeft: 16 }}
            >
              <ChevronLeft size={24} color="#0047AB" />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="help"
        options={{
          href: null,
          title: "Profile",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.navigate("/(tabs)")}
              style={{ marginLeft: 16 }}
            >
              <ChevronLeft size={24} color="#0047AB" />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="privacy"
        options={{
          href: null,
          title: "Profile",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.navigate("/(tabs)")}
              style={{ marginLeft: 16 }}
            >
              <ChevronLeft size={24} color="#0047AB" />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="live-chat"
        options={{
          href: null,
          title: "Profile",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.navigate("/(tabs)")}
              style={{ marginLeft: 16 }}
            >
              <ChevronLeft size={24} color="#0047AB" />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{
          href: null,
          title: "Profile",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.navigate("/(tabs)")}
              style={{ marginLeft: 16 }}
            >
              <ChevronLeft size={24} color="#0047AB" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Hidden deep-nav routes — keep tab bar visible */}
      <Tabs.Screen name="chat" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="call" options={{ href: null, headerShown: false }} />
      <Tabs.Screen
        name="video-lobby"
        options={{ href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="video-call"
        options={{ href: null, headerShown: false }}
      />
    </Tabs>
  );
}
