import { useSocket } from '@/context/SocketContext';
import { useUser } from '@/context/UserContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { pricingDAO } from '@/lib/dao/PricingDAO';
import { AssistanceRequest } from '@/lib/dao/interfaces';
import { useFocusEffect, useRouter } from 'expo-router';
import { MapPin, Search, Zap, Video, Clock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

const SERVICE_TYPE_LABEL: Record<string, string> = {
  videocall: 'Video Call Assistance',
  immediate: 'Immediate Assistance',
  scheduled: 'Scheduled Assistance',
  witness: 'Witness Assistance',
};

export default function AssistanceRequestsScreen() {
  const router = useRouter();
  const { user, isLoading: userLoading } = useUser();
  const { lastMessage } = useSocket();
  const [requests, setRequests] = useState<AssistanceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  const loadRequests = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const data = await assistanceDAO.getAll({ status: 'pending' });
      // Best-effort: vehicle issues live in the pricing service, not on
      // assistance_requests. A failed fetch for one request must not block
      // the rest of the feed from loading.
      const withIssues = await Promise.all(
        data.map(async (req) => {
          try {
            return { ...req, vehicleIssues: await pricingDAO.getRequestIssues(req.id) };
          } catch (e) {
            console.warn(`Failed to load vehicle issues for ${req.id}`, e);
            return req;
          }
        })
      );
      setRequests(withIssues);
    } catch (e) {
      console.error('Failed to load assistance requests', e);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadRequests(); }, [loadRequests]));

  useEffect(() => {
    if (!lastMessage) return;
    if (['new_request', 'assistance_update', 'appointment_update'].includes(lastMessage.type)) {
      loadRequests();
    }
  }, [lastMessage]);

  const filterTabs = useMemo(() => {
    const uniqueTypes = [...new Set(requests.map((req) => req.type))];
    return [
      { id: 'all', label: 'All', count: requests.length },
      ...uniqueTypes.map((type) => ({
        id: type,
        label: SERVICE_TYPE_LABEL[type] ?? type,
        count: requests.filter((req) => req.type === type).length,
      })),
    ];
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const serviceLabel = SERVICE_TYPE_LABEL[req.type] ?? req.type;
      const matchesSearch =
        serviceLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (req.address ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (req.car ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (req.notes ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (req.title ?? '').toLowerCase().includes(searchQuery.toLowerCase());

      if (selectedFilter !== 'all') {
        return matchesSearch && req.type === selectedFilter;
      }
      return matchesSearch;
    });
  }, [requests, searchQuery, selectedFilter]);

  if (userLoading || isLoading) {
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

        {filteredRequests.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Text className="text-gray-400 font-outfit-regular text-base">No pending requests in your area</Text>
          </View>
        ) : (
          <View className="gap-4">
            {filteredRequests.map((request) => {
              const iconType = request.type === 'videocall' ? 'video' : 'urgent';
              const iconBgColor = iconType === 'urgent' ? '#FEE2E2' : '#DBEAFE';
              const iconColor = iconType === 'urgent' ? '#DC2626' : '#0047AB';
              const serviceTypeLabel = SERVICE_TYPE_LABEL[request.type] ?? request.type;
              const badge = request.type === 'immediate' ? 'URGENT' : null;

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
                    <View className="p-5 pb-3">
                      {/* Header Row: icon, title/badge/time, budget */}
                      <View className="flex-row items-center">
                        <View
                          className="w-16 h-16 rounded-2xl items-center justify-center mr-4"
                          style={{ backgroundColor: iconBgColor }}
                        >
                          {iconType === 'video' ? (
                            <Video size={30} color={iconColor} />
                          ) : (
                            <Zap size={30} color={iconColor} fill={iconColor} />
                          )}
                        </View>

                        {/* Title + badge + time */}
                        <View className="flex-1 pr-2">
                          <Text className="text-gray-900 font-outfit-bold text-lg" numberOfLines={1}>
                            {serviceTypeLabel}
                          </Text>
                          <View className="flex-row items-center gap-2 mt-1">
                            {badge && (
                              <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: '#FEE2E2' }}>
                                <Text className="font-outfit-bold text-[10px] tracking-widest" style={{ color: '#EF4444' }}>
                                  {badge}
                                </Text>
                              </View>
                            )}
                            <View className="flex-row items-center gap-1">
                              <Clock size={13} color="#9CA3AF" />
                              <Text className="text-gray-500 font-outfit-regular text-sm">Just now</Text>
                            </View>
                          </View>
                        </View>

                        {/* Price */}
                        <View className="items-end">
                          <Text className="font-outfit-bold text-2xl" style={{ color: '#0047AB' }}>
                            {request.price ? `$${request.price}` : request.budget}
                          </Text>
                          <Text className="font-outfit-regular text-sm text-gray-400">price</Text>
                        </View>
                      </View>

                      {/* Info Block: vehicle, issue, address */}
                      <View className="mt-4 rounded-2xl overflow-hidden" style={{ backgroundColor: '#F4F8FF' }}>
                        <View className="px-4 pt-4 pb-3">
                          <Text className="text-gray-900 font-outfit-semibold text-lg">
                            {request.car}
                          </Text>
                          <Text className="text-gray-500 font-outfit-regular text-base mt-0.5">
                            {request.notes || request.title}
                          </Text>
                        </View>
                        <View style={{ height: 1, backgroundColor: '#E1EAFB' }} />
                        <View className="flex-row items-center gap-1.5 px-4 py-3">
                          <MapPin size={15} color="#9CA3AF" />
                          <Text className="text-gray-600 font-outfit-regular text-base">
                            {request.address}{request.distance ? ` · ${String(request.distance).replace(/\s*km/i, '').trim()} mi` : ''}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Buttons Section */}
                    <View className="flex-row px-5 pb-5 gap-3">
                      <TouchableOpacity
                        style={{ flex: 0.65 }}
                        onPress={() => router.push({
                          pathname: `/assist/${request.id}` as any,
                          params: {
                            type: request.type,
                            assistanceType: request.assistanceType || '',
                            title: request.title,
                            car: request.car,
                            address: request.address,
                            budget: request.budget,
                            price: request.price || '',
                            distance: request.distance || '',
                            userId: request.userId || '',
                            zip: request.zip || '',
                            locationLat: request.locationLat ?? '',
                            locationLng: request.locationLng ?? '',
                            vehicleIssues: JSON.stringify(request.vehicleIssues || []),
                          }
                        })}
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
                            View Request
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="py-3 rounded-2xl items-center justify-center"
                        style={{ flex: 0.35, backgroundColor: '#F3F4F6' }}
                        activeOpacity={0.8}
                      >
                        <Text className="text-gray-600 font-outfit-semibold text-lg">
                          Decline
                        </Text>
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
