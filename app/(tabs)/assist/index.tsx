import { MechanicFeedStatusBanner } from '@/components/MechanicFeedStatusBanner';
import { useMechanicStatus } from '@/context/MechanicStatusContext';
import { useSocket } from '@/context/SocketContext';
import { useUser } from '@/context/UserContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { useMarketplaceFeed } from '@/lib/scheduled/useMarketplaceFeed';
import { Note } from '@/components/scheduled/ui';
import { buildMechanicFeedFilters } from '@/lib/mechanic-feed';
import { pricingDAO } from '@/lib/dao/PricingDAO';
import { AssistanceRequest } from '@/lib/dao/interfaces';
import { useFocusEffect, useRouter } from 'expo-router';
import { Radar, Search, Zap, Video, Calendar, Clock, Car, Wrench, Lock, DollarSign } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TYPE } from '@/lib/ui/type';
import { RequestIssueText } from '@/components/ui/RequestIssueText';
import { useScrollPressGuard } from '@/hooks/useScrollPressGuard';
import { ActivityIndicator, Animated, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

/** "Listening for new requests": a small chip whose dot breathes, so the empty feed feels alive. */
function ListeningChip({ label }: { label: string }) {
  const pulse = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View className="flex-row items-center self-center rounded-full" style={{ gap: 8, marginTop: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#E8F7EF' }}>
      <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#12A150', opacity: pulse }} />
      <Text className="font-outfit-semibold" style={{ fontSize: 13, color: '#0E7A3E' }}>{label}</Text>
    </View>
  );
}

export default function AssistanceRequestsScreen() {
  const router = useRouter();
  const { scrollProps, guard } = useScrollPressGuard();
  const { t } = useTranslation();
  const { user, isLoading: userLoading } = useUser();
  const { lastMessage } = useSocket();
  const { mechanicStatus } = useMechanicStatus();
  const [requests, setRequests] = useState<AssistanceRequest[]>([]);
  const marketplaceFeed = useMarketplaceFeed(user?.role === 'mechanic', lastMessage);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  // Declining hides the request right away and persists it server-side (the
  // feed stops returning it to this mechanic until the rejection expires). If
  // the call fails the request comes back.
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set());
  const handleDecline = useCallback((id: string) => {
    setDeclinedIds((prev) => new Set(prev).add(id));
    assistanceDAO.reject(id).catch(() => {
      setDeclinedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  }, []);
  const visibleRequests = useMemo(
    () => [...requests, ...marketplaceFeed.items].filter((req) => !declinedIds.has(req.id)),
    [requests, marketplaceFeed.items, declinedIds]
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
      // Shared with the dashboard: both mechanic feeds must ask the backend
      // the same question, geo center included.
      const data = await assistanceDAO.getAll(await buildMechanicFeedFilters());
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

  // 'socket_connect' is in the list on purpose: server events are ephemeral and
  // never replayed, so a request broadcast while this socket was down (app
  // backgrounded, token refresh, reconnect) would otherwise stay invisible
  // until the screen is left and focused again.
  useEffect(() => {
    if (!lastMessage) return;
    if (['new_request', 'assistance_update', 'appointment_update', 'socket_connect', 'app_resumed'].includes(lastMessage.type)) {
      loadRequests();
    }
  }, [lastMessage]);

  // Going available again: refetch so every request nobody took while the
  // mechanic was away is on screen right away.
  useEffect(() => {
    if (mechanicStatus === 'available') loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mechanicStatus]);

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
      <ScrollView {...scrollProps} contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 40 }}>
        {/* Section Badge */}
        <View style={{ marginTop: 8 }}>
          <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
          <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
            {t('assist.badge')}
          </Text>
        </View>
        </View>

        {/* Title */}
        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
          {t('assist.title')}
        </Text>

        {/* Subtitle */}
        <Text className="text-gray-500 font-outfit-regular text-base mb-6">
          {t('assist.subtitle')}
        </Text>

        <MechanicFeedStatusBanner />

        {marketplaceFeed.problem && marketplaceFeed.problem !== 'generic' ? (
          <View className="mb-6">
            <Note tone="amber" title={t(`scheduledProvider.problems.${marketplaceFeed.problem}.title`)}>
              {t(`scheduledProvider.problems.${marketplaceFeed.problem}.body`)}
            </Note>
          </View>
        ) : null}

        {/* Search and filters only make sense when there is something to search through */}
        {visibleRequests.length > 0 && (
          <>
        <View className="flex-row items-center bg-white rounded-2xl px-4 mb-6 border border-gray-200">
          <Search size={20} color="#9CA3AF" />
          <TextInput
            placeholder={t('assist.searchPlaceholder')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-3 py-3 font-outfit-regular"
            style={{ fontSize: 16, letterSpacing: 0, textAlign: 'left' }}
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
          </>
        )}

        {filteredRequests.length === 0 ? (
          <View className="items-center" style={{ paddingTop: 40, paddingBottom: 24, paddingHorizontal: 12 }}>
            <View className="items-center justify-center" style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: '#EAF1FF' }}>
              <View className="items-center justify-center" style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFFFFF', shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4 }}>
                <Radar size={34} color="#1E56E3" />
              </View>
            </View>
            <Text className="font-outfit-semibold text-center" style={{ fontSize: 20, color: '#0B1530', marginTop: 20 }}>
              {t('dashboard.mechanic.emptyFeedTitle')}
            </Text>
            <Text className="font-outfit-regular text-center" style={{ ...TYPE.helper, color: '#6B7490', marginTop: 8, maxWidth: 300 }}>
              {t(mechanicStatus === 'available' ? 'dashboard.mechanic.emptyFeedHint' : 'dashboard.mechanic.emptyFeedOffline')}
            </Text>
            {mechanicStatus === 'available' && <ListeningChip label={t('dashboard.mechanic.emptyFeedListening')} />}
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
                              <Text className="font-outfit-bold text-[12px] tracking-widest" style={{ color: '#EF4444' }}>
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
                          {request.price ? `$${request.price}` : request.budget || (request.type === 'scheduled' ? t('scheduledProvider.sendQuote') : t('dashboard.mechanic.priceCalculating'))}
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
                    <View className={`flex-row items-center px-5 py-4 ${iconType === 'video' ? '' : 'border-b border-gray-100'}`}>
                      <View className="w-11 h-11 rounded-xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                        <Wrench size={20} color="#0047AB" />
                      </View>
                      <View className="flex-1">
                        <Text className="font-outfit-semibold text-xs tracking-widest text-gray-400 mb-0.5">{t('dashboard.mechanic.assistanceNeeded')}</Text>
                        <RequestIssueText requestId={request.id} fallback={request.notes || request.title} className="font-outfit-bold text-base text-gray-900" />
                      </View>
                    </View>

                    {/* Address (blurred street, city/state shown) — none for a remote video call */}
                    {iconType !== 'video' && (
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
                    )}

                    {/* Buttons Row (inside card) */}
                    <View className="gap-3 px-5 py-4 border-t border-gray-100">
                      <TouchableOpacity
                        onPress={guard(() => router.push({
                          pathname: (request.type === 'scheduled' ? '/assist/scheduled-request' : `/assist/${request.id}`) as any,
                          params: {
                              requestId: request.id,
                            type: request.type,
                            assistanceType: request.assistanceType || '',
                            title: request.title,
                            notes: request.notes || '',
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
                        }))}
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
                      {request.type !== 'scheduled' && (
                      <TouchableOpacity
                        className="py-4 rounded-[14px] items-center justify-center"
                        style={{ backgroundColor: '#E6EAF2' }}
                        activeOpacity={0.8}
                        onPress={guard(() => handleDecline(request.id))}
                      >
                        <Text className="font-outfit-bold text-lg" style={{ color: '#4A5470' }}>
                          {t('dashboard.mechanic.decline')}
                        </Text>
                      </TouchableOpacity>
                      )}
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
