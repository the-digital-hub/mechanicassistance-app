import { AssistanceCard, AssistanceType } from '@/components/ui/AssistanceCard';
import { KPICard } from '@/components/ui/KPICard';
import { PromotionalCard } from '@/components/ui/PromotionalCard';
import { useAppointments } from '@/context/AppointmentsContext';
import { useMechanicStatus } from '@/context/MechanicStatusContext';
import { useSocket } from '@/context/SocketContext';
import { useUser } from '@/context/UserContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { AssistanceRequest } from '@/lib/dao/interfaces';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { Calendar, Video, Zap, MapPin, Wrench, DollarSign, Star, Award, Circle } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, TouchableOpacity, View, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Mechanics see requests within this radius of their current location.
const MECHANIC_RADIUS_KM = 1000;

/** Best-effort current GPS coords; null if permission denied or lookup fails. */
async function getCurrentCoords(): Promise<{ latitude: number; longitude: number } | null> {
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return null;
        const loc = await Location.getCurrentPositionAsync({});
        return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch {
        return null;
    }
}

const getTimeGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'GOOD MORNING';
    if (hour >= 12 && hour < 18) return 'GOOD AFTERNOON';
    return 'GOOD NIGHT';
};

export default function DashboardScreen() {
    const router = useRouter();
    const { user, isLoading: isUserLoading } = useUser();
    const [filter, setFilter] = useState<AssistanceType | null>(null);
    const [requests, setRequests] = useState<AssistanceRequest[]>([]);
    const [isLoadingRequests, setIsLoadingRequests] = useState(true);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const { appointments } = useAppointments();
    const { lastMessage } = useSocket();
    const { mechanicStatus, setMechanicStatus } = useMechanicStatus();

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

    const loadRequests = async () => {
        if (!user?.id) {
            setIsLoadingRequests(false);
            return;
        }
        setIsLoadingRequests(true);
        try {
            const filters: any = {};
            if (user?.role === 'mechanic') {
                filters.status = 'pending';
                // Localized filtering: show only requests within MECHANIC_RADIUS_KM
                // of the mechanic's *current* location (they may be away from home).
                // Falls back to no geo filter if location permission is denied.
                const coords = await getCurrentCoords();
                if (coords) {
                    filters.lat = coords.latitude;
                    filters.lng = coords.longitude;
                    filters.radiusKm = MECHANIC_RADIUS_KM;
                }
            } else if (user?.role === 'user') {
                filters.userId = user.id;
                filters.status = 'pending';
            }

            if (filter) {
                filters.status = 'pending'; // or filter based on AssistanceType etc
            }

            const data = await assistanceDAO.getAll(filters);
            setRequests(data);
        } catch (error) {
            console.error('Failed to load assistance requests', error);
        } finally {
            setIsLoadingRequests(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            if (user) {
                loadRequests();
            }
        }, [filter, user?.id, user?.addresses])
    );

    // Live updates: a new request broadcast to mechanics, or any status change,
    // triggers a refetch so the feed stays current without leaving the screen.
    useEffect(() => {
        if (!lastMessage || !user?.id) return;
        if (lastMessage.type === 'new_request' || lastMessage.type === 'assistance_update' || lastMessage.type === 'appointment_update') {
            loadRequests();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastMessage]);

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
        const statusOptions = [
            { id: 'available', label: 'Available', color: '#10B981' },
            { id: 'busy', label: 'Busy', color: '#F97316' },
            { id: 'offline', label: 'Offline', color: '#9CA3AF' },
        ];

        return (
            <View className="flex-1">
                <ScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ paddingBottom: 40 }}>
                    <View className="px-6 pt-4">
                    {/* Section Badge */}
                    <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                            {getTimeGreeting()}
                        </Text>
                    </View>

                    {/* Title */}
                    <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
                        Ready to work{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
                    </Text>

                    {/* Subtitle */}
                    <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                        Review new requests in your area
                    </Text>

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

                    {/* KPIs Section */}
                    <View className="flex-row gap-3 mb-8">
                      <KPICard
                        icon={Wrench}
                        iconColor="#0047AB"
                        value={appointments.filter(a => a.status === 'completed').length.toString()}
                        label="Jobs today"
                        bgColor="#E0ECFF"
                      />
                      <KPICard
                        icon={DollarSign}
                        iconColor="#10B981"
                        value={`$${(appointments.filter(a => a.status === 'completed').length * 50).toString()}`}
                        label="Earned today"
                        bgColor="#ECFDF5"
                      />
                      <KPICard
                        icon={Star}
                        iconColor="#F97316"
                        value={(user?.rating || 4.8).toString()}
                        label="Rating"
                        bgColor="#FFF7ED"
                      />
                    </View>

                    {mechanicStatus !== 'offline' && (
                        <>
                            {/* New Requests Title */}
                            <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: '#111827' }} className="mt-2 mb-4">
                                New requests in your area
                            </Text>

                            {/* Requests List */}
                            {isLoadingRequests ? (
                                <View className="items-center justify-center py-8">
                                    <ActivityIndicator size="large" color="#0047AB" />
                                </View>
                            ) : requests.length === 0 ? (
                                <View className="items-center justify-center py-8">
                                    <Text className="text-gray-400 font-outfit-regular text-base">No pending requests in your area</Text>
                                </View>
                            ) : (
                        <View className="gap-4">
                            {requests.map((request) => {
                                const iconType = request.type === 'videocall' ? 'video' : 'urgent';
                                const iconBgColor = iconType === 'urgent' ? '#FEE2E2' : '#DBEAFE';
                                const iconColor = iconType === 'urgent' ? '#DC2626' : '#0047AB';
                                const serviceTypeLabel = request.type === 'videocall' ? 'Video Call Assistance' : request.type === 'scheduled' ? 'Scheduled Assistance' : 'Immediate Assistance';
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
                                        <View className="bg-white rounded-3xl">
                                            {/* Top Section */}
                                            <View className="p-6 pb-4">
                                                <View className="flex-row gap-4">
                                                    {/* Icon */}
                                                    <View
                                                        className="w-16 h-16 rounded-2xl items-center justify-center"
                                                        style={{ backgroundColor: iconBgColor }}
                                                    >
                                                        {iconType === 'video' ? (
                                                            <Video size={32} color={iconColor} />
                                                        ) : (
                                                            <Zap size={32} color={iconColor} />
                                                        )}
                                                    </View>

                                                    {/* Content */}
                                                    <View className="flex-1">
                                                        {/* First Row: Service Type */}
                                                        <View className="flex-row items-center justify-between mb-2">
                                                            <View className="flex-1 pr-2">
                                                                <Text className="text-gray-900 font-outfit-bold text-base">
                                                                    {serviceTypeLabel}
                                                                </Text>
                                                                {badge && (
                                                                    <Text className="text-red-600 font-outfit-bold text-xs tracking-widest">
                                                                        {badge}
                                                                    </Text>
                                                                )}
                                                            </View>
                                                        </View>

                                                        {/* Second Row: Location and Price */}
                                                        <View className="flex-row items-center justify-between">
                                                            <View className="flex-row items-center gap-1 flex-1">
                                                                <MapPin size={14} color="#9CA3AF" />
                                                                <Text className="text-gray-600 font-outfit-regular text-xs">
                                                                    {request.address}{request.distance ? ` · ${request.distance} Km` : ''}
                                                                </Text>
                                                            </View>
                                                            <Text className="text-gray-900 font-outfit-bold text-lg ml-2">
                                                                {request.budget}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>

                                                {/* Vehicle Badge */}
                                                <View className="mt-5 mb-2 p-3 rounded-xl" style={{ backgroundColor: '#F4F8FF' }}>
                                                    <Text className="text-gray-900 font-outfit-semibold text-sm">
                                                        {request.car}
                                                    </Text>
                                                </View>

                                                {/* Issue */}
                                                <View>
                                                    <Text className="text-gray-500 font-outfit-regular text-sm">
                                                        · {request.notes || request.title}
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
                                                    onPress={() => router.push({
                                                        pathname: `/dashboard/${request.id}` as any,
                                                        params: {
                                                            type: request.type,
                                                            assistanceType: request.assistanceType || '',
                                                            title: request.title,
                                                            car: request.car,
                                                            address: request.address,
                                                            budget: request.budget,
                                                            distance: request.distance || '',
                                                            userId: request.userId || '',
                                                            zip: request.zip || '',
                                                            locationLat: request.locationLat ?? '',
                                                            locationLng: request.locationLng ?? '',
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
                                                            View request
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
                        </>
                    )}

                    {/* Promotional Card */}
                    <View className="mt-8 mb-4">
                      <PromotionalCard
                        badge="BOOST YOUR PROFILE"
                        title="Add a new ASE certification"
                        description="Get more visibility and higher-value jobs."
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
            </View>
        );
    }

    if (isLoadingRequests && requests.length === 0) {
        return (
            <View className="flex-1 bg-white justify-center items-center">
                <ActivityIndicator size="large" color="#0047AB" />
            </View>
        );
    }

    // Exclude any requests that are already in the user's active appointments list
    const filteredRequests = requests.filter(req => {
        // If the user currently has this request locally as an active appointment, hide it from the Assist feed
        const isAlreadyAppointment = appointments.some(appt => appt.id === req.id && appt.status !== 'canceled');
        if (isAlreadyAppointment) return false;

        // Otherwise apply the selected visual filter
        if (filter) {
            if (filter === 'witness') return req.assistanceType === 'witness' || req.type === 'witness';
            if (filter === 'immediate') return req.type === 'immediate' && req.assistanceType !== 'witness';
            return req.type === filter;
        }
        return true;
    });

    return (
        <View className="flex-1 px-6 pt-4" style={{ backgroundColor: '#F6F8FC' }}>
            <FlatList
                ListHeaderComponent={
                    <View className="mb-4">
                        {/* Section Badge */}
                        <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                            <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                            <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                                {user?.role?.toLowerCase() === 'mechanic' ? 'FIND JOBS' : getTimeGreeting()}
                            </Text>
                        </View>

                        {/* Title */}
                        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</Text>

                        {/* Subtitle */}
                        <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                            What kind of assistance do you need today?
                        </Text>

                        {/* Assistance Type Cards - Horizontal */}
                        <View className="flex-row gap-3 mb-6 justify-between">
                            {/* Immediate Assistance - Featured Card */}
                            <TouchableOpacity
                                onPress={() => {
                                    if (user?.role === 'user') {
                                        router.push({ pathname: '/(tabs)/request-assistance/select-vehicle', params: { type: 'immediate' } });
                                    } else {
                                        setFilter(filter === 'immediate' ? null : 'immediate');
                                    }
                                }}
                                className="flex-1 rounded-3xl overflow-hidden"
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={['#2B66F8', '#081E72']}
                                    start={{ x: 0, y: 1 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{
                                        borderRadius: 24,
                                        padding: 12,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        minHeight: 120,
                                    }}
                                >
                                    {/* Icon */}
                                    <View className="w-14 h-14 rounded-2xl justify-center items-center mb-3" style={{ backgroundColor: '#4D77EF', borderWidth: 1, borderColor: '#6789F1' }}>
                                        <Zap size={24} color="white" strokeWidth={2} />
                                    </View>

                                    {/* Content */}
                                    <Text className="text-white font-outfit-semibold text-center" style={{ fontSize: 15 }}>Immediate</Text>
                                    <Text className="text-blue-100 font-outfit-semibold text-center" style={{ fontSize: 15 }}>
                                        Assist
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Scheduled Assistance */}
                            <TouchableOpacity
                                onPress={() => {
                                    if (user?.role === 'user') {
                                        router.push({ pathname: '/(tabs)/request-assistance/select-vehicle', params: { type: 'scheduled' } });
                                    } else {
                                        setFilter(filter === 'scheduled' ? null : 'scheduled');
                                    }
                                }}
                                className="flex-1 rounded-3xl overflow-hidden"
                                activeOpacity={0.8}
                            >
                                <View className="bg-white rounded-3xl justify-center items-center p-3" style={{ borderWidth: 1.5, borderColor: '#EEF2FA', minHeight: 120 }}>
                                    <View className="w-14 h-14 rounded-2xl justify-center items-center mb-3" style={{ backgroundColor: '#E9F1FF' }}>
                                        <Calendar size={24} color="#1E56E3" />
                                    </View>
                                    <Text className="text-gray-900 font-outfit-semibold text-center" style={{ fontSize: 15 }}>Scheduled</Text>
                                    <Text className="text-gray-600 font-outfit-semibold text-center mt-1" style={{ fontSize: 15 }}>
                                        Assist
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Video Call Assistance */}
                            <TouchableOpacity
                                onPress={() => {
                                    if (user?.role === 'user') {
                                        router.push({ pathname: '/(tabs)/request-assistance/select-vehicle', params: { type: 'videocall' } });
                                    } else {
                                        setFilter(filter === 'videocall' ? null : 'videocall');
                                    }
                                }}
                                className="flex-1 rounded-3xl overflow-hidden"
                                activeOpacity={0.8}
                            >
                                <View className="bg-white rounded-3xl justify-center items-center p-3" style={{ borderWidth: 1.5, borderColor: '#EEF2FA', minHeight: 120 }}>
                                    <View className="w-14 h-14 rounded-2xl justify-center items-center mb-3" style={{ backgroundColor: '#E9F1FF' }}>
                                        <Video size={24} color="#1E56E3" />
                                    </View>
                                    <Text className="text-gray-900 font-outfit-semibold text-center" style={{ fontSize: 15 }}>Video Call</Text>
                                    <Text className="text-gray-600 font-outfit-semibold text-center mt-1" style={{ fontSize: 15 }}>
                                        DIY
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Active Request Title */}
                        <Text className="text-gray-900 font-outfit-medium text-lg mb-2" style={{ fontSize: 18 }}>Your active request!</Text>

                        {/* Empty State Message */}
                        <Text className="text-gray-500 font-outfit-regular text-base mb-6">
                            No active requests at the moment
                        </Text>

                        {/* DIY Tutorial Card 1 */}
                        <View className="bg-white rounded-3xl p-5 mb-6 flex-row items-center gap-4" style={{ borderWidth: 1.5, borderColor: '#EEF2FA' }}>
                            {/* Icon - Left Column */}
                            <View className="w-16 h-16 rounded-2xl justify-center items-center" style={{ backgroundColor: '#F0F4FB' }}>
                                <Text style={{ fontSize: 32 }}>🚗</Text>
                            </View>

                            {/* Right Column */}
                            <View className="flex-1">
                                {/* Title */}
                                <Text className="text-gray-900 font-outfit-medium mb-1" style={{ fontSize: 17 }}>Replace the wiper blades</Text>

                                {/* Description */}
                                <Text className="text-gray-500 font-outfit-regular text-sm mb-3">
                                    Quick 5-minute DIY · No tools required.
                                </Text>

                                {/* Button */}
                                <TouchableOpacity
                                    className="rounded-full px-4 py-2.5 flex-row items-center gap-2"
                                    style={{ backgroundColor: '#2B66F8', alignSelf: 'flex-start' }}
                                >
                                    <Text style={{ fontSize: 14, color: '#FFFFFF' }}>▶</Text>
                                    <Text className="text-white font-outfit-semibold" style={{ fontSize: 14 }}>Watch DIY tutorial</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Promo Card - Refer & Earn */}
                        <View className="bg-white rounded-3xl p-5 mb-6 flex-row items-center gap-4" style={{ borderWidth: 1.5, borderColor: '#EEF2FA' }}>
                            {/* Left Column */}
                            <View className="flex-1">
                                {/* Subtitle */}
                                <Text className="text-blue-600 font-outfit-semibold text-xs mb-1" style={{ fontSize: 11, letterSpacing: 1 }}>
                                    REFER & EARN
                                </Text>

                                {/* Title */}
                                <Text className="text-gray-900 font-outfit-medium mb-3" style={{ fontSize: 17 }}>Apply now, get $20 back</Text>

                                {/* Button */}
                                <TouchableOpacity
                                    className="rounded-full px-4 py-2.5 flex-row items-center gap-1.5"
                                    style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}
                                >
                                    <Text className="font-outfit-semibold" style={{ fontSize: 14, color: '#0047AB' }}>Start earning</Text>
                                    <Text style={{ fontSize: 14, color: '#0047AB' }}>→</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Icon - Right Column */}
                            <View className="w-16 h-16 rounded-2xl justify-center items-center" style={{ backgroundColor: '#F0F4FB' }}>
                                <Text style={{ fontSize: 32 }}>💰</Text>
                            </View>
                        </View>

                        {/* DIY Tutorial Card 2 */}
                        <View className="bg-white rounded-3xl p-5 mb-6 flex-row items-center gap-4" style={{ borderWidth: 1.5, borderColor: '#EEF2FA' }}>
                            {/* Icon - Left Column */}
                            <View className="w-16 h-16 rounded-2xl justify-center items-center" style={{ backgroundColor: '#F0F4FB' }}>
                                <Text style={{ fontSize: 32 }}>🔧</Text>
                            </View>

                            {/* Right Column */}
                            <View className="flex-1">
                                {/* Title */}
                                <Text className="text-gray-900 font-outfit-medium mb-1" style={{ fontSize: 17 }}>Replace the brake pads</Text>

                                {/* Description */}
                                <Text className="text-gray-500 font-outfit-regular text-sm mb-3">
                                    Intermediate DIY · 30 min · Basic tools
                                </Text>

                                {/* Button */}
                                <TouchableOpacity
                                    className="rounded-full px-4 py-2.5 flex-row items-center gap-2"
                                    style={{ backgroundColor: '#2B66F8', alignSelf: 'flex-start' }}
                                >
                                    <Text style={{ fontSize: 14, color: '#FFFFFF' }}>▶</Text>
                                    <Text className="text-white font-outfit-semibold" style={{ fontSize: 14 }}>Watch DIY tutorial</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Promo Banner - Only for Mechanics */}
                        {user?.role?.toLowerCase().trim() === 'mechanic' && (
                            <View className="bg-blue-50 rounded-xl p-4 flex-row items-center mb-6 border border-blue-100">
                                <View className="flex-1">
                                    <Text className="text-blue-900 font-outfit-semibold text-lg mb-2">Looking for more work?</Text>
                                    <TouchableOpacity
                                        className="bg-blue-600 w-full py-2 rounded-lg"
                                    >
                                        <Text className="text-white font-outfit-semibold text-center text-xs">View opportunities</Text>
                                    </TouchableOpacity>
                                </View>
                                <View className="w-16 h-16 bg-blue-200 rounded-full ml-4" />
                            </View>
                        )}
                    </View>
                }
                data={filteredRequests}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                    const isAccepted = appointments.some(appt => appt.id === item.id && appt.status !== 'canceled');
                    return (
                        <AssistanceCard
                            id={item.id}
                            type={item.type}
                            assistanceType={item.assistanceType}
                            title={item.title}
                            car={item.car}
                            notes={item.notes}
                            address={item.address}
                            distance={item.distance}
                            budget={item.budget}
                            onAccept={() => !isAccepted && router.push({
                                pathname: `/dashboard/${item.id}` as any,
                                params: {
                                    type: item.type,
                                    assistanceType: item.assistanceType || '',
                                    title: item.title,
                                    car: item.car,
                                    address: item.address,
                                    budget: item.budget,
                                    distance: item.distance || '',
                                    userId: item.userId || '',
                                    zip: item.zip || '',
                                    locationLat: item.locationLat ?? '',
                                    locationLng: item.locationLng ?? '',
                                }
                            })}
                            isAccepted={isAccepted}
                        />
                    );
                }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
}
