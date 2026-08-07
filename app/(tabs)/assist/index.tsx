import { useSocket } from '@/context/SocketContext';
import { useUser } from '@/context/UserContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { pricingDAO } from '@/lib/dao/PricingDAO';
import { AssistanceRequest } from '@/lib/dao/interfaces';
import { useFocusEffect, useRouter } from 'expo-router';
import { Search, Zap, Video, Calendar, Clock, Car, Wrench, Lock, DollarSign } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function AssistanceRequestsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, isLoading: userLoading } = useUser();
  const { lastMessage } = useSocket();
  const [requests, setRequests] = useState<AssistanceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  // Declined requests are hidden locally only — there's no backend support yet
  // to persist a decline, so this resets on reload. See docs/PENDING-decline-request-action.md.
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set());
  const handleDecline = useCallback((id: string) => {
    setDeclinedIds((prev) => new Set(prev).add(id));
  }, []);
  const visibleRequests = useMemo(
    () => requests.filter((req) => !declinedIds.has(req.id)),
    [requests, declinedIds]
  );

  // Same service-type labels used across the app (dashboard, cards, request detail).
  const getServiceTypeLabel = useCallback((type: string) => {
    switch (type) {
      case 'videocall': return t('requestAssistance.header.videoCall');
      case 'immediate': return t('requestAssistance.header.immediate');
      case 'scheduled': return t('requestAssistance.header.scheduled');
      case 'witness': return t('requestAssistance.header.accident');
      default: return type;
    }
  }, [t]);

  // Relative time for request cards — same logic as the dashboard's mechanic feed.
  const formatTimeAgo = (raw?: string) => {
    if (!raw) return t('dashboard.timeAgo.justNow');
    const then = new Date(raw).getTime();
    if (isNaN(then)) return t('dashboard.timeAgo.justNow');
    const mins = Math.floor((Date.now() - then) / 60000);
    if (mins < 1) return t('dashboard.timeAgo.justNow');
    if (mins < 60) return t('dashboard.timeAgo.minutes', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('dashboard.timeAgo.hours', { count: hours });
    const days = Math.floor(hours / 24);
    return t('dashboard.timeAgo.days', { count: days });
  };

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
    const uniqueTypes = [...new Set(visibleRequests.map((req) => req.type))];
    return [
      { id: 'all', label: t('assist.all'), count: visibleRequests.length },
      ...uniqueTypes.map((type) => ({
        id: type,
        label: getServiceTypeLabel(type),
        count: visibleRequests.filter((req) => req.type === type).length,
      })),
    ];
  }, [visibleRequests, t, getServiceTypeLabel]);

  const filteredRequests = useMemo(() => {
    return visibleRequests.filter((req) => {
      const serviceLabel = getServiceTypeLabel(req.type);
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
  }, [visibleRequests, searchQuery, selectedFilter, getServiceTypeLabel]);

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
            {t('assist.badge')}
          </Text>
        </View>

        {/* Title */}
        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
          {t('assist.title')}
        </Text>

        {/* Subtitle */}
        <Text className="text-gray-500 font-outfit-regular text-base mb-6">
          {t('assist.subtitle')}
        </Text>

        {/* Search Bar */}
        <View className="flex-row items-center bg-white rounded-2xl px-4 mb-6 border border-gray-200">
          <Search size={20} color="#9CA3AF" />
          <TextInput
            placeholder={t('assist.searchPlaceholder')}
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
            <Text className="text-gray-400 font-outfit-regular text-base">{t('dashboard.mechanic.noPendingRequests')}</Text>
          </View>
        ) : (
          <View className="gap-4">
            {filteredRequests.map((request) => {
              const iconType = request.type === 'videocall' ? 'video' : request.type === 'scheduled' ? 'scheduled' : 'urgent';
              const iconBgColor = iconType === 'urgent' ? '#FEE2E2' : iconType === 'scheduled' ? '#EDE9FE' : '#DBEAFE';
              const iconColor = iconType === 'urgent' ? '#DC2626' : iconType === 'scheduled' ? '#7C3AED' : '#0047AB';
              const serviceTypeLabel = request.type === 'videocall'
                ? t('requestAssistance.header.videoCall')
                : request.type === 'scheduled'
                  ? t('requestAssistance.header.scheduled')
                  : request.type === 'witness'
                    ? t('requestAssistance.header.accident')
                    : t('requestAssistance.header.immediate');
              const badge = request.type === 'immediate' ? t('dashboard.mechanic.urgent') : null;

              // Hide the street; show only city/state (+ zip) once — same as the dashboard feed.
              const addressParts = String(request.address || '').split(',').map((p) => p.trim()).filter(Boolean);
              const cityLine = addressParts.length > 1
                ? `${addressParts.slice(1).join(', ')}${request.zip ? ` · ${request.zip}` : ''}`
                : String(request.address || '');

              const cardShadow = {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 8,
                elevation: 6,
              };

              return (
                <View key={request.id} className="mb-2">
                  {/* Combined Card: header + details */}
                  <View className="bg-white rounded-3xl mb-3" style={cardShadow}>
                    {/* Header Row: service type + urgency + time */}
                    <View className="p-5 flex-row items-center border-b border-gray-100">
                      <View
                        className="w-14 h-14 rounded-2xl items-center justify-center mr-4"
                        style={{ backgroundColor: iconBgColor }}
                      >
                        {iconType === 'video' ? (
                          <Video size={26} color={iconColor} />
                        ) : iconType === 'scheduled' ? (
                          <Calendar size={26} color={iconColor} />
                        ) : (
                          <Zap size={26} color={iconColor} fill={iconColor} />
                        )}
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-gray-900 font-outfit-bold text-lg" numberOfLines={1}>
                            {serviceTypeLabel}
                          </Text>
                          {badge && (
                            <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: '#FEE2E2' }}>
                              <Text className="font-outfit-bold text-[10px] tracking-widest" style={{ color: '#EF4444' }}>
                                {badge}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View className="flex-row items-center gap-1 mt-1">
                          <Clock size={13} color="#9CA3AF" />
                          <Text className="text-gray-500 font-outfit-regular text-sm">{formatTimeAgo(request.date || request.updatedAt)}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Budget */}
                    <View className="flex-row items-center px-5 py-4 border-b border-gray-100">
                      <View className="w-11 h-11 rounded-xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                        <DollarSign size={20} color="#0047AB" />
                      </View>
                      <View className="flex-1">
                        <Text className="font-outfit-semibold text-xs tracking-widest text-gray-400 mb-0.5">{t('dashboard.mechanic.budget')}</Text>
                        <Text className="font-outfit-bold text-base text-gray-900">
                          {request.price ? `$${request.price}` : request.budget}
                        </Text>
                      </View>
                    </View>

                    {/* Vehicle */}
                    <View className="flex-row items-center px-5 py-4 border-b border-gray-100">
                      <View className="w-11 h-11 rounded-xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                        <Car size={20} color="#0047AB" />
                      </View>
                      <View className="flex-1">
                        <Text className="font-outfit-semibold text-xs tracking-widest text-gray-400 mb-0.5">{t('dashboard.mechanic.vehicle')}</Text>
                        <Text className="font-outfit-bold text-base text-gray-900">{request.car}</Text>
                      </View>
                    </View>

                    {/* Assistance needed */}
                    <View className="flex-row items-center px-5 py-4 border-b border-gray-100">
                      <View className="w-11 h-11 rounded-xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                        <Wrench size={20} color="#0047AB" />
                      </View>
                      <View className="flex-1">
                        <Text className="font-outfit-semibold text-xs tracking-widest text-gray-400 mb-0.5">{t('dashboard.mechanic.assistanceNeeded')}</Text>
                        <Text className="font-outfit-bold text-base text-gray-900">{request.notes || request.title}</Text>
                      </View>
                    </View>

                    {/* Address (blurred street, city/state shown) */}
                    <View className="flex-row px-5 py-4">
                      <View className="w-11 h-11 rounded-xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                        <Lock size={20} color="#0047AB" />
                      </View>
                      <View className="flex-1">
                        <Text className="font-outfit-semibold text-xs tracking-widest text-gray-400 mb-1.5">{t('dashboard.mechanic.address')}</Text>
                        <View className="h-4 rounded-md mb-1.5" style={{ backgroundColor: '#E5E7EB', width: '75%' }} />
                        <Text className="font-outfit-bold text-base text-gray-900">{cityLine}</Text>
                        <Text className="font-outfit-regular text-sm text-gray-400 mt-0.5">{t('dashboard.mechanic.addressUnlock')}</Text>
                      </View>
                    </View>

                    {/* Buttons Row (inside card) */}
                    <View className="flex-row gap-3 px-5 py-4 border-t border-gray-100">
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
                            date: request.date || request.updatedAt || '',
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
                            paddingVertical: 14,
                            paddingHorizontal: 16,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text className="text-white font-outfit-semibold text-lg">
                            {t('dashboard.mechanic.viewRequest')}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="py-3 rounded-2xl items-center justify-center"
                        style={{ flex: 0.35, backgroundColor: '#F3F4F6' }}
                        activeOpacity={0.8}
                        onPress={() => handleDecline(request.id)}
                      >
                        <Text className="text-gray-600 font-outfit-semibold text-lg">
                          {t('dashboard.mechanic.decline')}
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
