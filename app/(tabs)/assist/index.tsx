import { useAppointments } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'expo-router';
import { ChevronRight, MapPin, Phone, Search, Zap, Video } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface RequestCard {
  id: string;
  userName: string;
  userPhone: string;
  location: string;
  distance: string;
  description: string;
  status: string;
}

export default function AssistanceRequestsScreen() {
  const router = useRouter();
  const { user, isLoading: userLoading } = useUser();
  const { appointments, isLoading: appointmentsLoading } = useAppointments();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  const requestExamples = [
    {
      id: '1',
      serviceType: 'Video Call Assistance',
      location: 'Hollywood, FL',
      distance: '1.3',
      timeAgo: '32 min ago',
      price: '$45',
      vehicle: 'Ford F-150 2019',
      issue: 'Dashboard warning light',
      status: 'pending',
      iconType: 'video',
      badge: null,
    },
    {
      id: '2',
      serviceType: 'Immediate Assistance',
      location: 'Weston, FL',
      distance: '2.2',
      timeAgo: '3 min ago',
      price: '$150',
      vehicle: 'Honda Accord 2022',
      issue: "Won't start",
      status: 'offered',
      iconType: 'urgent',
      badge: 'URGENT',
    },
    {
      id: '3',
      serviceType: 'Immediate Assistance',
      location: 'Pembroke Pines, FL',
      distance: '3.4',
      timeAgo: '52 min ago',
      price: '$180',
      vehicle: 'Nissan Altima 2018',
      issue: 'Flat tire',
      status: 'pending',
      iconType: 'urgent',
      badge: 'URGENT',
    },
  ];

  const requests = useMemo(() => {
    return requestExamples.map((req) => req);
  }, []);

  const filterTabs = useMemo(() => {
    const uniqueServices = [...new Set(requests.map((req) => req.serviceType))];
    const tabs = [
      { id: 'all', label: 'All', count: requests.length },
      ...uniqueServices.map((service) => ({
        id: service.toLowerCase().replace(/\s+/g, '-'),
        label: service,
        count: requests.filter((req) => req.serviceType === service).length,
      })),
    ];
    return tabs;
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Filter by search query
      const matchesSearch =
        req.serviceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.vehicle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.issue.toLowerCase().includes(searchQuery.toLowerCase());

      // Filter by selected service type
      if (selectedFilter !== 'all') {
        const matchesFilter = req.serviceType.toLowerCase().replace(/\s+/g, '-') === selectedFilter;
        return matchesSearch && matchesFilter;
      }

      return matchesSearch;
    });
  }, [requests, searchQuery, selectedFilter]);

  if (userLoading || appointmentsLoading) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#0047AB" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 40 }}>
        {/* Section Badge */}
        <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
          <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
            PENDING ASSISTANCE REQUESTS
          </Text>
        </View>

        {/* Title */}
        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
          Find your next job
        </Text>

        {/* Subtitle */}
        <Text className="text-gray-500 font-outfit-regular text-base mb-6">
          Filter incoming requests by status, service type, and distance.
        </Text>

        {/* Search Bar */}
        <View className="flex-row items-center bg-white rounded-2xl px-4 mb-6 border border-gray-200">
          <Search size={20} color="#9CA3AF" />
          <TextInput
            placeholder="Search by vehicle, area, or issue"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-3 py-3 font-outfit-regular text-base"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
          <View className="flex-row gap-3">
            {filterTabs.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setSelectedFilter(tab.id)}
                activeOpacity={0.8}
              >
                <View
                  className="px-4 py-2 rounded-full border"
                  style={{
                    backgroundColor: selectedFilter === tab.id ? '#2B66F8' : '#FFFFFF',
                    borderColor: selectedFilter === tab.id ? '#2B66F8' : '#E5E7EB',
                  }}
                >
                  <Text
                    className="font-outfit-semibold text-sm"
                    style={{
                      color: selectedFilter === tab.id ? '#FFFFFF' : '#6B7280',
                    }}
                  >
                    {tab.label} · {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {filteredRequests.length > 0 && (
          <View className="gap-4">
            {filteredRequests.map((request) => {
              const iconBgColor = request.iconType === 'urgent' ? '#FEE2E2' : '#DBEAFE';
              const iconColor = request.iconType === 'urgent' ? '#DC2626' : '#0047AB';

              return (
                <View
                  key={request.id}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.12,
                    shadowRadius: 8,
                    elevation: 6,
                    marginBottom: 4,
                  }}
                >
                  <View className="bg-white rounded-3xl overflow-hidden">
                    {/* Top Section */}
                  <View className="p-6 pb-4">
                    <View className="flex-row gap-4">
                      {/* Icon spanning two rows */}
                      <View
                        className="w-16 h-16 rounded-2xl items-center justify-center"
                        style={{ backgroundColor: iconBgColor }}
                      >
                        {request.iconType === 'video' ? (
                          <Video size={32} color={iconColor} />
                        ) : (
                          <Zap size={32} color={iconColor} />
                        )}
                      </View>

                      {/* Right side content */}
                      <View className="flex-1">
                        {/* First Row: Service Type and Time */}
                        <View className="flex-row items-center justify-between mb-2">
                          <View className="flex-1 pr-2">
                            <Text className="text-gray-900 font-outfit-bold text-lg">
                              {request.serviceType}
                            </Text>
                            {request.badge && (
                              <Text className="text-red-600 font-outfit-bold text-xs tracking-widest">
                                {request.badge}
                              </Text>
                            )}
                          </View>
                          <Text className="text-gray-400 font-outfit-regular text-xs">
                            {request.timeAgo}
                          </Text>
                        </View>

                        {/* Second Row: Location and Price */}
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-1 flex-1">
                            <MapPin size={14} color="#9CA3AF" />
                            <Text className="text-gray-600 font-outfit-regular text-sm">
                              {request.location} · {request.distance} Km
                            </Text>
                          </View>
                          <Text className="text-gray-900 font-outfit-bold text-lg ml-2">
                            {request.price}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Vehicle Badge */}
                    <View className="mt-5 mb-2 p-3 rounded-xl" style={{ backgroundColor: '#F4F8FF' }}>
                      <Text className="text-gray-900 font-outfit-semibold text-sm">
                        {request.vehicle}
                      </Text>
                    </View>

                    {/* Issue */}
                    <View>
                      <Text className="text-gray-500 font-outfit-regular text-sm">
                        · {request.issue}
                      </Text>
                    </View>
                  </View>

                  {/* Buttons Section */}
                  <View className="flex-row px-6 pb-6 gap-3">
                    <TouchableOpacity
                      style={{ flex: 0.35 }}
                      className="py-3 rounded-2xl border border-gray-300 items-center"
                      activeOpacity={0.8}
                    >
                      <Text className="text-gray-600 font-outfit-semibold text-lg">
                        Decline
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 0.65 }}
                      onPress={() => router.push(`/appointments/${request.id}`)}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#2B66F8', '#081E72']}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                          borderRadius: 16,
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text className="text-white font-outfit-semibold text-lg">
                          Accept request
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
