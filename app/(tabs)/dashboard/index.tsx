import { KPICard } from '@/components/ui/KPICard';
import { PromotionalCard } from '@/components/ui/PromotionalCard';
import { UserRequestCard } from '@/components/ui/UserRequestCard';
import { MechanicActiveJobCard } from '@/components/ui/MechanicActiveJobCard';
import { useAppointments, type Appointment } from '@/context/AppointmentsContext';
import { MechanicFeedStatusBanner } from '@/components/MechanicFeedStatusBanner';
import { useMechanicStatus } from '@/context/MechanicStatusContext';
import type { MechanicStatus } from '@/lib/dao/interfaces';
import { useSocket } from '@/context/SocketContext';
import { assistanceTypeRoute, codeFor, i18nKeyFor, iconFor, useAssistanceTypeCatalog } from '@/lib/assistance-types';
import { useUser } from '@/context/UserContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { AssistanceRequest, type AssistanceTypeCatalogItem } from '@/lib/dao/interfaces';
import { translatedName } from '@/lib/i18n/catalogTranslations';
import { RequestIssueText } from '@/components/ui/RequestIssueText';
import { buildMechanicFeedFilters } from '@/lib/mechanic-feed';
import { useFocusEffect, useRouter } from 'expo-router';
import { Calendar, Video, Zap, MapPin, Wrench, DollarSign, Star, Award, Circle, Clock, Car, Lock } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScrollPressGuard } from '@/hooks/useScrollPressGuard';
import { ApiError } from '@/lib/api/types';
import { ActivityIndicator, Alert, FlatList, Platform, ScrollView, Text, TouchableOpacity, View, Modal, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/** Returns a translation key for the current time of day — resolve with t() at the call site. */
const getTimeGreetingKey = (): string => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'dashboard.greeting.morning';
    if (hour >= 12 && hour < 18) return 'dashboard.greeting.afternoon';
    return 'dashboard.greeting.night';
};

// Horizontal padding of the user dashboard (20 on each side) and the grid gap,
// used to size three buttons per row.
const DASHBOARD_PADDING_X = 20;
const TYPE_GRID_GAP = 10;
const TYPE_GRID_COLUMNS = 3;
// How long a tapped type shows its selected skin before the wizard opens.
const TYPE_SELECT_DELAY_MS = 150;

type DashboardTypeButtonProps = {
    item: AssistanceTypeCatalogItem;
    title: string;
    subtitle: string | null;
    selected: boolean;
    width: number;
    onPress?: () => void;
};

/**
 * One assistance type on the owner dashboard. The selected type (the first of the
 * catalog until the owner taps another) gets the gradient skin, the rest the white
 * one — the same catalog as the type picker, drawn as compact buttons.
 */
function DashboardTypeButton({ item, title, subtitle, selected, width, onPress }: DashboardTypeButtonProps) {
    const Icon = iconFor(item);
    const label = subtitle ? `${title}\n${subtitle}` : title;

    const content = (
        <>
            <View
                className="justify-center items-center mb-2.5"
                style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: selected ? 'rgba(255,255,255,0.18)' : '#EAF1FF',
                }}
            >
                <Icon size={22} color={selected ? '#FFFFFF' : '#1E56E3'} strokeWidth={1.8} />
            </View>
            <Text
                className="font-outfit-bold text-center"
                style={{ fontSize: 12, lineHeight: 15, color: selected ? '#FFFFFF' : '#0B1530' }}
            >
                {label}
            </Text>
        </>
    );

    const tileStyle = {
        borderRadius: 18,
        minHeight: 112,
        paddingVertical: 14,
        paddingHorizontal: 6,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={0.8}
            style={{
                width,
                opacity: onPress ? 1 : 0.5,
                borderRadius: 18,
                backgroundColor: selected ? '#1E56E3' : '#FFFFFF',
                shadowColor: selected ? '#1E56E3' : '#0E2F8A',
                shadowOffset: { width: 0, height: selected ? 8 : 2 },
                shadowOpacity: selected ? 0.35 : 0.05,
                shadowRadius: selected ? 12 : 6,
                elevation: selected ? 6 : 1,
            }}
        >
            {selected ? (
                <LinearGradient colors={['#1E56E3', '#0B2A8E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={tileStyle}>
                    {content}
                </LinearGradient>
            ) : (
                <View style={[tileStyle, { borderWidth: 1, borderColor: '#EEF2FA' }]}>{content}</View>
            )}
        </TouchableOpacity>
    );
}

export default function DashboardScreen() {
    const router = useRouter();
    const { scrollProps, guard } = useScrollPressGuard();
    const { t } = useTranslation();
    const { user, isLoading: isUserLoading } = useUser();
    const { types: assistanceTypes, languageId } = useAssistanceTypeCatalog();
    const { width: screenWidth } = useWindowDimensions();
    const typeButtonWidth =
        (screenWidth - DASHBOARD_PADDING_X * 2 - TYPE_GRID_GAP * (TYPE_GRID_COLUMNS - 1)) / TYPE_GRID_COLUMNS;
    const [filter, setFilter] = useState<string | null>(null);
    // Owner's tapped assistance type; null falls back to the first of the catalog.
    const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
    const typeSelectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [requests, setRequests] = useState<AssistanceRequest[]>([]);
    const [isLoadingRequests, setIsLoadingRequests] = useState(true);
    // Declining hides the request right away and persists it server-side (the
    // feed stops returning it to this mechanic until the rejection expires). If
    // the call fails the request comes back.
    const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set());
    const handleDecline = (id: string) => {
        setDeclinedIds((prev) => new Set(prev).add(id));
        assistanceDAO.reject(id).catch(() => {
            setDeclinedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        });
    };
    const [showStatusModal, setShowStatusModal] = useState(false);
    const { appointments, getActiveRequests, refresh: refreshAppointments, isLoading: isLoadingAppointments } = useAppointments();
    const { lastMessage } = useSocket();
    const { mechanicStatus, setMechanicStatus, isUpdatingStatus } = useMechanicStatus();

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
        if (mechanicStatus === 'available') return t('dashboard.mechanic.status.available.label');
        if (mechanicStatus === 'busy') return t('dashboard.mechanic.status.busy.label');
        return t('dashboard.mechanic.status.offline.label');
    };

    const getStatusColor = (status: 'available' | 'busy' | 'offline') => {
        if (status === 'available') return '#10B981';
        if (status === 'busy') return '#F97316';
        return '#9CA3AF';
    };

    const statusOptions: Array<{ id: MechanicStatus; label: string; description: string }> = [
        {
            id: 'available',
            label: t('dashboard.mechanic.status.available.label'),
            description: t('dashboard.mechanic.status.available.description')
        },
        {
            id: 'busy',
            label: t('dashboard.mechanic.status.busy.label'),
            description: t('dashboard.mechanic.status.busy.description')
        },
        {
            id: 'offline',
            label: t('dashboard.mechanic.status.offline.label'),
            description: t('dashboard.mechanic.status.offline.description')
        },
    ];

    const styles = getStatusStyles();

    // Relative time for request cards. The backend may send `date` or `updatedAt`;
    // if neither is a parseable timestamp we fall back to "just now" rather than
    // showing a broken value.
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

    // Mechanic-only feed. The user's own requests come from AppointmentsContext
    // (see activeRequests below), which already merges assistance_requests with
    // appointments and keeps the appointment's status when both exist.
    // The spinner is only for the first load. A refetch (status change, socket
    // event) keeps the current list on screen until the new one lands, instead
    // of swapping it for a spinner and back — that read as the screen flashing.
    const hasLoadedRequests = useRef(false);
    const loadRequests = async () => {
        if (!user?.id || user.role !== 'mechanic') {
            setIsLoadingRequests(false);
            return;
        }
        if (!hasLoadedRequests.current) setIsLoadingRequests(true);
        try {
            // Same filters as the assist tab, so one account cannot see two
            // different feeds. Falls back to no geo filter if location
            // permission is denied.
            const data = await assistanceDAO.getAll(await buildMechanicFeedFilters());
            setRequests(data);
            hasLoadedRequests.current = true;
        } catch (error) {
            console.error('Failed to load assistance requests', error);
        } finally {
            setIsLoadingRequests(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            if (!user) return;
            setSelectedTypeId(null);
            if (user.role === 'mechanic') {
                loadRequests();
            } else {
                refreshAppointments();
            }
        }, [filter, user?.id, user?.addresses])
    );

    useEffect(() => () => {
        if (typeSelectTimer.current) clearTimeout(typeSelectTimer.current);
    }, []);

    // Live updates: a new request broadcast to mechanics, or any status change,
    // triggers a refetch so the feed stays current without leaving the screen.
    // 'socket_connect' is included because server events are ephemeral: one
    // broadcast while this socket was down is never replayed, so the reconnect
    // itself has to be what re-syncs the feed.
    useEffect(() => {
        if (!lastMessage || !user?.id) return;
        if (['new_request', 'assistance_update', 'appointment_update', 'socket_connect', 'app_resumed'].includes(lastMessage.type)) {
            loadRequests();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastMessage]);

    // Going available again: refetch so every request nobody took while the
    // mechanic was away is on screen right away.
    useEffect(() => {
        if (mechanicStatus === 'available' && user?.role === 'mechanic') loadRequests();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mechanicStatus]);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.replace('/login');
        }
    }, [isUserLoading, user, router]);

    if (isUserLoading) {
        return (
            <View className="flex-1 bg-white justify-center items-center">
                <ActivityIndicator size="large" color="#0047AB" />
            </View>
        );
    }

    // Dashboard for mechanics
    if (user?.role === 'mechanic') {
        const statusOptions: Array<{ id: MechanicStatus; label: string; description: string; color: string }> = [
            { id: 'available', label: t('dashboard.mechanic.status.available.label'), description: t('dashboard.mechanic.status.available.description'), color: '#10B981' },
            { id: 'busy', label: t('dashboard.mechanic.status.busy.label'), description: t('dashboard.mechanic.status.busy.description'), color: '#F97316' },
            { id: 'offline', label: t('dashboard.mechanic.status.offline.label'), description: t('dashboard.mechanic.status.offline.description'), color: '#9CA3AF' },
        ];
        // Accepted onward: pending/offered rows are requests still being bid on, not jobs.
        const activeJobs = getActiveRequests().filter((a) => a.status !== 'pending' && a.status !== 'offered');

        return (
            <View className="flex-1">
                <ScrollView {...scrollProps} style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ paddingBottom: 40 }}>
                    <View className="px-6 pt-4">
                    {/* Section Badge */}
                    <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                            {t(getTimeGreetingKey())}
                        </Text>
                    </View>

                    {/* Title */}
                    <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
                        {t('dashboard.mechanic.readyToWork')}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
                    </Text>

                    {/* Subtitle */}
                    <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                        {t('dashboard.mechanic.reviewSubtitle')}
                    </Text>

                    {/* Active jobs — otherwise only reachable from the Appointments tab */}
                    {activeJobs.length > 0 && (
                        <View className="mb-4">
                            <Text className="font-outfit-bold" style={{ fontSize: 18, letterSpacing: -0.3, color: '#0B1530', marginBottom: 12 }}>
                                {t('dashboard.mechanic.activeJob.title')}
                            </Text>
                            {activeJobs.map((job) => (
                                <MechanicActiveJobCard key={job.id} appointment={job} />
                            ))}
                        </View>
                    )}

                    {/* Status Block */}
                    <View className="bg-white rounded-3xl p-6 mb-8" style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.08,
                        shadowRadius: 4,
                        elevation: 3,
                    }}>
                        {/* Header with Title */}
                        <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 18, color: '#111827' }} className="mb-4">
                            {t('dashboard.mechanic.availableToProvide')}
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
                                        onPress={() => { setMechanicStatus(option.id).catch(() => undefined); }}
                                        disabled={isUpdatingStatus}
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
                                ? t('dashboard.mechanic.descAvailable')
                                : mechanicStatus === 'busy'
                                ? t('dashboard.mechanic.descBusy')
                                : t('dashboard.mechanic.descOffline')}
                        </Text>
                    </View>

                    {/* KPIs Section */}
                    <View className="flex-row gap-3 mb-8">
                      <KPICard
                        icon={Wrench}
                        iconColor="#0047AB"
                        value={appointments.filter(a => a.status === 'completed').length.toString()}
                        label={t('dashboard.mechanic.jobsToday')}
                        bgColor="#E0ECFF"
                      />
                      <KPICard
                        icon={DollarSign}
                        iconColor="#10B981"
                        value={`$${(appointments.filter(a => a.status === 'completed').length * 50).toString()}`}
                        label={t('dashboard.mechanic.earnedToday')}
                        bgColor="#ECFDF5"
                      />
                      <KPICard
                        icon={Star}
                        iconColor="#F97316"
                        value={(user?.rating || 4.8).toString()}
                        label={t('dashboard.mechanic.rating')}
                        bgColor="#FFF7ED"
                      />
                    </View>

                            {/* New Requests Title */}
                            <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: '#111827' }} className="mt-2 mb-4">
                                {t('dashboard.mechanic.newRequestsTitle')}
                            </Text>

                            <MechanicFeedStatusBanner />

                            {/* Requests List */}
                            {isLoadingRequests ? (
                                <View className="items-center justify-center py-8">
                                    <ActivityIndicator size="large" color="#0047AB" />
                                </View>
                            ) : requests.filter((r) => !declinedIds.has(r.id)).length === 0 ? (
                                <View className="items-center justify-center py-8">
                                    <Text className="text-gray-400 font-outfit-regular text-base">{t('dashboard.mechanic.noPendingRequests')}</Text>
                                </View>
                            ) : (
                        <View className="gap-4">
                            {requests.filter((r) => !declinedIds.has(r.id)).map((request) => {
                                const iconType = request.type === 'videocall' ? 'video' : request.type === 'scheduled' ? 'scheduled' : 'urgent';
                                const iconBgColor = iconType === 'urgent' ? '#FEE2E2' : iconType === 'scheduled' ? '#EDE9FE' : '#DBEAFE';
                                const iconColor = iconType === 'urgent' ? '#DC2626' : iconType === 'scheduled' ? '#7C3AED' : '#0047AB';
                                const serviceTypeLabel = request.type === 'videocall' ? t('requestAssistance.header.videoCall') : request.type === 'scheduled' ? t('requestAssistance.header.scheduled') : t('requestAssistance.header.immediate');
                                const badge = request.type === 'immediate' ? t('dashboard.mechanic.urgent') : null;

                                // Hide the street; show only city/state (+ zip) once.
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
                                                        {request.price ? `$${request.price}` : request.budget || t('dashboard.mechanic.priceCalculating')}
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
                                            <View className="flex-row gap-3 px-5 py-4 border-t border-gray-100">
                                                <TouchableOpacity
                                                    style={{ flex: 0.65 }}
                                                    onPress={guard(() => router.push({
                                                        pathname: `/assist/${request.id}` as any,
                                                        params: {
                                                            type: request.type,
                                                            assistanceType: request.assistanceType || '',
                                                            title: request.title,
                                                            notes: request.notes || '',
                                                            car: request.car,
                                                            address: request.address,
                                                            budget: request.budget,
                                                            distance: request.distance || '',
                                                            userId: request.userId || '',
                                                            zip: request.zip || '',
                                                            locationLat: request.locationLat ?? '',
                                                            locationLng: request.locationLng ?? '',
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
                                                <TouchableOpacity
                                                    className="py-3 rounded-2xl items-center justify-center"
                                                    style={{ flex: 0.35, backgroundColor: '#F3F4F6' }}
                                                    activeOpacity={0.8}
                                                    onPress={guard(() => handleDecline(request.id))}
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

                    {/* Promotional Card */}
                    <View className="mt-8 mb-4">
                      <PromotionalCard
                        badge={t('dashboard.mechanic.promoBadge')}
                        title={t('dashboard.mechanic.promoTitle')}
                        description={t('dashboard.mechanic.promoDescription')}
                        icon={Award}
                        onPress={() => router.push('/(tabs)/ase')}
                      />
                    </View>
                    </View>
                </ScrollView>

                {/* Status Modal */}
                {showStatusModal && (
                    <Modal transparent visible={showStatusModal} animationType="fade">
                        <View className="flex-1 bg-black/50 justify-center items-center px-6">
                            <View className="bg-white w-full rounded-2xl p-6 items-center">
                                <Text className="text-lg font-outfit-bold text-gray-900 mb-6 text-center">
                                    {t('dashboard.mechanic.changeStatus')}
                                </Text>

                                <View className="w-full gap-3">
                                    {statusOptions.map((option) => (
                                        <TouchableOpacity
                                            key={option.id}
                                            onPress={() => {
                                                setMechanicStatus(option.id).catch(() => undefined);
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
            </View>
        );
    }

    const activeRequests = getActiveRequests();

    if (isLoadingAppointments && activeRequests.length === 0) {
        return (
            <View className="flex-1 bg-white justify-center items-center">
                <ActivityIndicator size="large" color="#0047AB" />
            </View>
        );
    }

    // Catalog translation first; otherwise the short bundled copy for the types the
    // app has always shipped. A type the app does not know gets its catalog name only.
    const typeButtonCopy = (item: AssistanceTypeCatalogItem) => {
        const hasTranslation = item.translations?.some(tr => tr.languageId === languageId);
        const key = i18nKeyFor(item);
        if (!hasTranslation && key) {
            return {
                title: t(`dashboard.user.cards.${key}Title`),
                subtitle: t(`dashboard.user.cards.${key}Subtitle`),
            };
        }
        return { title: translatedName(item, languageId), subtitle: null };
    };

    // Owners start a request; any other role toggles the list filter. A type with no
    // resolvable code can do neither, so its button renders disabled.
    const typeButtonPress = (item: AssistanceTypeCatalogItem) => {
        const code = codeFor(item);
        if (!code) return undefined;
        if (user?.role === 'user') {
            // No identity gate: verification is optional for users.
            const route = assistanceTypeRoute(item);
            if (!route) return undefined;
            return () => {
                setSelectedTypeId(item.id);
                if (typeSelectTimer.current) clearTimeout(typeSelectTimer.current);
                typeSelectTimer.current = setTimeout(() => router.push(route), TYPE_SELECT_DELAY_MS);
            };
        }
        return () => {
            setSelectedTypeId(item.id);
            setFilter(filter === code ? null : code);
        };
    };

    // Everything the user has in flight, narrowed by the visual type filter.
    const filteredRequests = activeRequests.filter(req => {
        if (!filter) return true;
        if (filter === 'witness') return req.assistanceType === 'witness' || req.type === 'witness';
        if (filter === 'immediate') return req.type === 'immediate' && req.assistanceType !== 'witness';
        return req.type === filter;
    });

    const openRequest = (req: Appointment) => {
        // pending/offered have no appointment row yet — the searching screen is the
        // canonical "waiting for a mechanic" view and handles the offer hand-off.
        if (req.status === 'pending' || req.status === 'offered') {
            router.push({
                pathname: '/(tabs)/request-assistance/searching',
                params: { requestId: req.id, type: req.type }
            });
            return;
        }
        router.push(`/(tabs)/appointments/${req.id}` as any, { withAnchor: true });
    };

    const doCancelRequest = async (id: string) => {
        try {
            await assistanceDAO.updateStatus(id, '', 'canceled');
        } catch (error) {
            // A failure used to be swallowed here: the card just stayed put and the
            // user had no way to tell why. The backend's reason goes under the message.
            console.error('Failed to cancel assistance request', error);
            const reason = error instanceof ApiError ? error.message : '';
            const message = [t('dashboard.user.cancelFailedMessage'), reason].filter(Boolean).join('\n\n');
            if (Platform.OS === 'web') window.alert(`${t('dashboard.user.cancelFailedTitle')}\n\n${message}`);
            else Alert.alert(t('dashboard.user.cancelFailedTitle'), message);
        } finally {
            // Also on failure: a request already gone (404) or canceled before a
            // later step failed must not linger on the dashboard.
            await refreshAppointments();
        }
    };

    const cancelRequest = (id: string) => {
        if (Platform.OS === 'web') {
            if (window.confirm(t('dashboard.user.cancelConfirmTitle'))) void doCancelRequest(id);
            return;
        }
        Alert.alert(t('dashboard.user.cancelConfirmTitle'), t('dashboard.user.cancelConfirmMessage'), [
            { text: t('dashboard.user.cancelConfirmNo'), style: 'cancel' },
            { text: t('dashboard.user.cancelConfirmYes'), style: 'destructive', onPress: () => void doCancelRequest(id) },
        ]);
    };

    const selectedId = selectedTypeId ?? assistanceTypes[0]?.id;

    return (
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC', paddingHorizontal: DASHBOARD_PADDING_X, paddingTop: 18 }}>
            <FlatList
                {...scrollProps}
                ListHeaderComponent={
                    <View>
                        {/* Section Badge */}
                        <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#EAF1FF', alignSelf: 'flex-start', marginBottom: 12 }}>
                            <View className="rounded-full" style={{ width: 5, height: 5, backgroundColor: '#1E56E3' }} />
                            <Text className="font-outfit-bold" style={{ fontSize: 10.5, letterSpacing: 1.3, color: '#1E56E3' }}>
                                {user?.role?.toLowerCase() === 'mechanic' ? 'FIND JOBS' : t(getTimeGreetingKey())}
                            </Text>
                        </View>

                        {/* Title */}
                        <Text className="font-outfit-bold" style={{ fontSize: 28, lineHeight: 32, letterSpacing: -0.7, color: '#0B1530' }}>
                            {t('dashboard.user.title')}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
                        </Text>

                        {/* Subtitle */}
                        <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, marginTop: 8, color: '#6B7490' }}>
                            {t('dashboard.user.subtitle')}
                        </Text>

                        {/* Assistance Type Buttons — same catalog as the type picker */}
                        <View className="flex-row flex-wrap" style={{ gap: TYPE_GRID_GAP, marginTop: 18 }}>
                            {assistanceTypes.map(item => (
                                <DashboardTypeButton
                                    key={item.id}
                                    item={item}
                                    selected={item.id === selectedId}
                                    width={typeButtonWidth}
                                    {...typeButtonCopy(item)}
                                    onPress={typeButtonPress(item)}
                                />
                            ))}
                        </View>

                        {/* Active Request Title */}
                        <Text className="font-outfit-bold" style={{ fontSize: 18, letterSpacing: -0.3, color: '#0B1530', marginTop: 24, marginBottom: 12 }}>
                            {t('dashboard.user.activeRequestTitle')}
                        </Text>

                        {/* Empty State Message (only when no active requests) */}
                        {filteredRequests.length === 0 && (
                            <Text className="font-outfit-regular mb-2" style={{ fontSize: 14, color: '#6B7490' }}>
                                {t('dashboard.user.noActiveRequests')}
                            </Text>
                        )}
                    </View>
                }
                data={filteredRequests}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <UserRequestCard
                        id={item.id}
                        type={item.type}
                        assistanceType={item.assistanceType}
                        title={item.title}
                        car={item.car}
                        address={item.address}
                        status={item.status}
                        onPress={guard(() => openRequest(item))}
                        onCancel={guard(() => cancelRequest(item.id))}
                    />
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
}
