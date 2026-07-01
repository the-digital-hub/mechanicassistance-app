import { useUser } from "@/context/UserContext";
import { useMechanicStatus } from "@/context/MechanicStatusContext";
import { Tabs, useNavigation, useRouter, usePathname } from "expo-router";
import {
  Bell,
  Calendar,
  ChevronLeft,
  Circle,
  FileText,
  LifeBuoy,
  User as UserIcon,
  Wrench,
} from "lucide-react-native";
import React, { useState } from "react";
import { Image, Modal, Platform, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { HapticTab } from "@/components/haptic-tab";
import { useColorScheme } from "@/hooks/use-color-scheme";

function MechanicStatusHeaderLeft() {
  return <MechanicStatusBadge />;
}

function ProfileHeaderLeft() {
  const router = useRouter();
  return (
    <View className="flex-row items-center gap-3">
      <TouchableOpacity
        onPress={() => router.navigate("/(tabs)")}
        style={{ marginLeft: 8 }}
      >
        <ChevronLeft size={24} color="#0047AB" />
      </TouchableOpacity>
      <MechanicStatusHeaderLeft />
    </View>
  );
}

function PersonalInfoHeaderLeft() {
  const router = useRouter();
  const { user } = useUser();

  if (user?.role === 'mechanic') {
    return <MechanicStatusBadge />;
  }

  return (
    <TouchableOpacity
      onPress={() => router.navigate("/(tabs)")}
      style={{ marginLeft: 16 }}
    >
      <ChevronLeft size={24} color="#0047AB" />
    </TouchableOpacity>
  );
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
      <Bell size={24} color="#0047AB" />
    </TouchableOpacity>
  );
}

function AddressesHeaderLeft() {
  const router = useRouter();
  const { user } = useUser();

  // For mechanics, show badge; for users, show back button
  if (user?.role?.toLowerCase().trim() === 'mechanic') {
    return <MechanicStatusBadge />;
  }

  return (
    <TouchableOpacity
      onPress={() => router.navigate("/(tabs)")}
      style={{ marginLeft: 16 }}
    >
      <ChevronLeft size={24} color="#0047AB" />
    </TouchableOpacity>
  );
}

function MechanicStatusBadge() {
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
    if (mechanicStatus === 'available') return 'Available';
    if (mechanicStatus === 'busy') return 'Busy';
    return 'Offline';
  };

  const getStatusColor = (status: 'available' | 'busy' | 'offline') => {
    if (status === 'available') return '#10B981';
    if (status === 'busy') return '#F97316';
    return '#9CA3AF';
  };

  const statusOptions: Array<{ id: 'available' | 'busy' | 'offline', label: string, description: string }> = [
    {
      id: 'available',
      label: 'Available',
      description: 'Visible to owners and can receive new requests'
    },
    {
      id: 'busy',
      label: 'Busy',
      description: 'Visible but won\'t receive new requests'
    },
    {
      id: 'offline',
      label: 'Offline',
      description: 'Not visible to owners and won\'t receive requests'
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
        <Text style={{ color: styles.textColor }} className="font-outfit-semibold text-xs">
          {getStatusLabel()}
        </Text>
      </TouchableOpacity>

      <Modal transparent visible={showModal} animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-white w-full rounded-2xl p-6 items-center">
            <Text className="text-lg font-outfit-bold text-gray-900 mb-6 text-center">
              Change your status
            </Text>

            <View className="w-full gap-3">
              {statusOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => {
                    setMechanicStatus(option.id);
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
                    <Text className="text-gray-600 font-outfit-regular text-xs mt-1">
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
          headerLeft: () => <MechanicStatusHeaderLeft />,
          headerRight: () => <NotificationHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="assist"
        options={{
          href: user?.role === "mechanic" ? undefined : null,
          title: "Requests",
          tabBarIcon: ({ color }) => <Wrench size={24} color={color} />,
          headerLeft: () => <MechanicStatusHeaderLeft />,
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
          headerLeft: () => <MechanicStatusHeaderLeft />,
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
          headerLeft: () => <MechanicStatusHeaderLeft />,
          headerRight: () => <NotificationHeaderRight />,
        }}
      />

      {/* Hidden Profile Routes */}
      <Tabs.Screen
        name="personal-info"
        options={{
          href: null,
          title: "Profile",
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="ase"
        options={{
          href: null,
          title: "Profile",
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          href: null,
          title: "Profile",
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="promotions"
        options={{
          href: null,
          title: "Profile",
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="help"
        options={{
          href: null,
          title: "Profile",
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="privacy"
        options={{
          href: null,
          title: "Profile",
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          title: "Profile",
          headerLeft: () => <PersonalInfoHeaderLeft />,
          headerRight: () => <PersonalInfoHeaderRight />,
        }}
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
      <Tabs.Screen
        name="addresses"
        options={{
          href: null,
          title: "Profile",
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
