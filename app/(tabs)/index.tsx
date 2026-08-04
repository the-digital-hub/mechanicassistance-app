import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { useAppointments } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { useMechanicStatus } from '@/context/MechanicStatusContext';
import { mediaDAO } from '@/lib/dao/MediaDAO';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, Camera, Car, ChevronLeft, ChevronRight, Circle, CreditCard, Heart, HelpCircle, Lock, LogOut, MapPin, PlugZap, Settings, User } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isLoading, updateUser, logout } = useUser();
  const { appointments } = useAppointments();
  const { mechanicStatus, setMechanicStatus } = useMechanicStatus();

  const isOnline = user?.isOnline || false;

  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [localProfileUri, setLocalProfileUri] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (result.canceled) return;
    const localUri = result.assets[0].uri;
    setLocalProfileUri(localUri);
    setIsUploadingPhoto(true);
    try {
      const uploaded = await mediaDAO.uploadPhoto(localUri);
      await updateUser({ profileImage: uploaded.url });
    } catch {
      Alert.alert('Upload Failed', 'Could not upload profile photo. Please try again.');
      setLocalProfileUri(null);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  const handleStatusToggle = (targetStatus: boolean) => {
    if (targetStatus) {
      setShowOnlineModal(true);
    } else {
      // Check active appointments
      const hasActiveAppointments = appointments.some(appt =>
        ['accepted', 'scheduled', 'started'].includes(appt.status) && appt.status !== 'canceled' && appt.status !== 'completed'
      );

      if (hasActiveAppointments) {
        if (Platform.OS === 'web') {
          window.alert("You cannot go offline while you have active appointments.");
        } else {
          Alert.alert(
            "Cannot go offline",
            "You cannot go offline while you have active appointments.",
            [{ text: "OK" }]
          );
        }
      } else {
        setShowOfflineModal(true);
      }
    }
  };

  const setAvailability = async (isOnline: boolean, closeModal: () => void) => {
    try {
      await updateUser({ isOnline });
      closeModal();
    } catch {
      Alert.alert('Update Failed', 'Could not change your availability. Please try again.');
    }
  };

  const confirmOnline = () => setAvailability(true, () => setShowOnlineModal(false));

  const confirmOffline = () => setAvailability(false, () => setShowOfflineModal(false));

  const handleLogout = async () => {
    await logout();
    setShowLogoutModal(false);
    router.replace('/login');
  };

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

  return (
    <View className="flex-1 px-6 pt-4" style={{ backgroundColor: '#F6F8FC' }}>
      {isLoading || !user ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0047AB" />
        </View>
      ) : (
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Section Badge */}
        <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
          <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
            MY PROFILE
          </Text>
        </View>

        {/* Title */}
        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">Your account, your preferences</Text>

        {/* Subtitle */}
        <Text className="text-gray-500 font-outfit-regular text-base mb-8">
          Manage your personal info, vehicles and app settings.
        </Text>

        {/* User Info Card */}
        <View className="bg-white rounded-3xl p-8 mb-8 items-center" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 10, elevation: 5 }}>
          {/* User Info Section */}
          <View className="relative">
            {/* Avatar Circle with Initials or Image */}
            <View className="w-28 h-28 rounded-full justify-center items-center overflow-hidden" style={{ backgroundColor: '#0047AB', shadowColor: '#0047AB', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 }}>
              {localProfileUri ? (
                <Image source={{ uri: localProfileUri }} className="w-full h-full" />
              ) : user.profileImage ? (
                <Image source={{ uri: user.profileImage }} className="w-full h-full" />
              ) : (
                <Text className="text-5xl font-outfit-bold text-white">
                  {user.name && user.surname ? (user.name[0] + user.surname[0]).toUpperCase() : 'U'}
                </Text>
              )}
              {isUploadingPhoto && (
                <View className="absolute inset-0 bg-black/40 items-center justify-center">
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
          </View>

          {/* Name */}
          <Text className="text-3xl font-outfit-bold mt-4 mb-2" style={{ color: '#2B66F8' }}>
            {user.name} {user.surname}
          </Text>

          {/* Role Badge */}
          <View className="px-4 py-2 rounded-full" style={{ backgroundColor: '#E9F1FF' }}>
            <Text className="text-blue-600 font-outfit-semibold text-sm capitalize">
              {user.role === 'mechanic' ? 'Mechanic' : 'Vehicle Owner'}
            </Text>
          </View>
        </View>

        {/* Status Block - Only for Mechanics */}
        {user?.role === 'mechanic' && (
          <View className="bg-white rounded-3xl p-6 mb-8" style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 3,
          }}>
            {/* Header with Title */}
            <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 18, color: '#111827' }} className="mb-4">
              Available to provide services
            </Text>

            {/* Status Options */}
            <View className="flex-row gap-2 mb-4">
              {statusOptions.map((option) => {
                const optionStyles = (() => {
                  switch (option.id) {
                    case 'available':
                      return { bgColor: '#ECFDF5', borderColor: '#D1FAE5', textColor: '#111827' };
                    case 'busy':
                      return { bgColor: '#FEF3C7', borderColor: '#FCD34D', textColor: '#111827' };
                    case 'offline':
                      return { bgColor: '#F3F4F6', borderColor: '#D1D5DB', textColor: '#6B7280' };
                    default:
                      return { bgColor: '#F3F4F6', borderColor: '#D1D5DB', textColor: '#6B7280' };
                  }
                })();

                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => setMechanicStatus(option.id)}
                    className="flex-1 py-3 px-4 rounded-2xl flex-row items-center justify-center gap-2"
                    style={{
                      backgroundColor: mechanicStatus === option.id ? optionStyles.bgColor : '#F9FAFB',
                      borderColor: mechanicStatus === option.id ? optionStyles.borderColor : '#E5E7EB',
                      borderWidth: 1,
                    }}
                  >
                    <Circle size={8} color={getStatusColor(option.id)} fill={getStatusColor(option.id)} />
                    <Text style={{ color: mechanicStatus === option.id ? optionStyles.textColor : '#9CA3AF', fontFamily: 'Outfit_600SemiBold', fontSize: 13 }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Description */}
            <Text style={{ color: '#4B5563', fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 20 }}>
              {mechanicStatus === 'available'
                ? 'You are visible to nearby owners and can receive new requests.'
                : mechanicStatus === 'busy'
                ? 'You are visible but won\'t receive new requests.'
                : 'You are not visible to owners and won\'t receive requests.'}
            </Text>
          </View>
        )}

        {/* Menu Items Card */}
        {(() => {
          const menuItems = [
            { icon: User, label: 'Personal information', route: '/personal-info' },
            { icon: MapPin, label: 'My Addresses', route: '/(tabs)/addresses' },
            ...(user.role?.toLowerCase().trim() !== 'mechanic' ? [
              { icon: Car || User, label: 'My Vehicles', route: '/vehicles' },
            ] : []),
            ...(user.role === 'mechanic' ? [
              { icon: Award, label: 'ASE Certifications', route: '/ase' },
              { icon: CreditCard, label: 'Bank Account / payments', route: '/payments' },
              { icon: Heart, label: 'Promotions', route: '/promotions' },
            ] : []),
            { icon: HelpCircle, label: 'Help Center', route: '/help' },
            { icon: Lock, label: 'Privacy Policy', route: '/privacy' },
            { icon: Settings, label: 'Settings', route: '/settings' },
            { icon: LogOut, label: 'Log out', action: () => setShowLogoutModal(true), color: '#EF4444' },
          ];
          return (
        <View className="mb-6" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 10, elevation: 5 }}>
          <View className="bg-white rounded-3xl overflow-hidden">
            {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              className="flex-row items-center px-6 py-4"
              style={{ borderBottomWidth: index < menuItems.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6' }}
              onPress={item.action ? item.action : () => {
                if (item.route) router.push(item.route as any);
              }}
            >
              <View className={`w-12 h-12 rounded-full ${item.color ? 'bg-red-50' : 'bg-blue-50'} justify-center items-center mr-4`}>
                <item.icon size={24} color={item.color || '#0047AB'} />
              </View>
              <Text className={`flex-1 font-outfit-semibold text-lg ${item.color ? 'text-red-500' : 'text-gray-900'}`}>
                {item.label}
              </Text>
              <ChevronRight size={24} color={item.color ? '#EF4444' : '#0047AB'} />
            </TouchableOpacity>
            ))}
          </View>
        </View>
          );
        })()}

        {/* Language Selector Card */}
        <View className="bg-white rounded-3xl p-6" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 10, elevation: 5 }}>
          <Text className="font-outfit-semibold text-base mb-4" style={{ color: '#2B66F8' }}>Select Language</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => setLanguage('en')}
              className="flex-1 py-3 rounded-2xl border-2 items-center justify-center"
              style={{
                borderColor: language === 'en' ? '#2B66F8' : '#E5E7EB',
                backgroundColor: language === 'en' ? '#E9F1FF' : '#FFFFFF'
              }}
            >
              <Text className="font-outfit-semibold text-base" style={{ color: language === 'en' ? '#2B66F8' : '#9CA3AF' }}>English</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setLanguage('es')}
              className="flex-1 py-3 rounded-2xl border-2 items-center justify-center"
              style={{
                borderColor: language === 'es' ? '#2B66F8' : '#E5E7EB',
                backgroundColor: language === 'es' ? '#E9F1FF' : '#FFFFFF'
              }}
            >
              <Text className="font-outfit-semibold text-base" style={{ color: language === 'es' ? '#2B66F8' : '#9CA3AF' }}>Spanish</Text>
            </TouchableOpacity>
          </View>
        </View>

      {/* Online Confirmation Modal */}
      <Modal transparent visible={showOnlineModal} animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-white w-full rounded-2xl p-6 items-center">
            <View className="w-20 h-20 bg-green-500 rounded-full justify-center items-center mb-6">
              <PlugZap size={40} color="white" />
            </View>
            <Text className="text-lg font-outfit-bold text-center text-gray-900 mb-6">
              Confirm you want to be On-Line providing your services?
            </Text>
            <View className="flex-row gap-3 w-full">
              <TouchableOpacity
                className="flex-1 py-3 rounded-lg border border-gray-300 bg-white"
                onPress={() => setShowOnlineModal(false)}
              >
                <Text className="text-center font-outfit-bold text-gray-900">No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1"
                onPress={confirmOnline}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#2B66F8', '#081E72']}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 8,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text className="text-center font-outfit-bold text-white">Yes</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Offline Confirmation Modal */}
      <Modal transparent visible={showOfflineModal} animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-white w-full rounded-2xl p-6 items-center">
            <View className="w-20 h-20 bg-red-600 rounded-full justify-center items-center mb-6">
              <PlugZap size={40} color="white" style={{ transform: [{ rotate: '45deg' }] }} />
            </View>
            <Text className="text-lg font-outfit-bold text-center text-gray-900 mb-6">
              Are you sure you want to be Off-Line providing your services?
            </Text>
            <View className="flex-row gap-3 w-full">
              <TouchableOpacity
                className="flex-1 py-3 rounded-lg border border-gray-300 bg-white"
                onPress={() => setShowOfflineModal(false)}
              >
                <Text className="text-center font-outfit-bold text-gray-900">No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1"
                onPress={confirmOffline}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#2B66F8', '#081E72']}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 8,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text className="text-center font-outfit-bold text-white">Yes</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        title="Are you sure you want to Log out?"
        message=""
        icon={LogOut}
        iconColor="#00A8E8"
        confirmButtonColor="#0047AB"
        confirmText="Yes"
        cancelText="No"
      />

      {/* Status Modal */}
      {showStatusModal && (
        <Modal transparent visible={showStatusModal} animationType="fade">
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
                      setShowStatusModal(false);
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
      )}
      </ScrollView>
      )}
    </View>
  );
}
