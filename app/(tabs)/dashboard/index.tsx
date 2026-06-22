import { AssistanceCard, AssistanceType } from '@/components/ui/AssistanceCard';
import { useAppointments } from '@/context/AppointmentsContext';
import { useSocket } from '@/context/SocketContext';
import { useUser } from '@/context/UserContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { AssistanceRequest } from '@/lib/dao/interfaces';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { Calendar, Clock, SlidersHorizontal, Video, Zap, ChevronRight, Circle, MapPin } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
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
    const { appointments } = useAppointments();
    const { lastMessage } = useSocket();
    const [mechanicStatus, setMechanicStatus] = useState<'available' | 'busy' | 'offline'>('available');
    const [mechanicRequests, setMechanicRequests] = useState<any[]>([]);
    const [isLoadingMechanicRequests, setIsLoadingMechanicRequests] = useState(true);

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
    }, [isUserLoading, user]);

    if (isUserLoading) {
        return (
            <View className="flex-1 bg-white justify-center items-center">
                <ActivityIndicator size="large" color="#0047AB" />
            </View>
        );
    }

    // Dashboard for mechanics
    if (user?.role === 'mechanic') {
        const loadMechanicRequests = useCallback(async () => {
            setIsLoadingMechanicRequests(true);
            try {
                const exampleRequests = [
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
                setMechanicRequests(exampleRequests);
            } catch (error) {
                console.error('Failed to load mechanic requests', error);
            } finally {
                setIsLoadingMechanicRequests(false);
            }
        }, []);

        useEffect(() => {
            loadMechanicRequests();
        }, [loadMechanicRequests]);

        const getStatusColor = (status: 'available' | 'busy' | 'offline') => {
            if (status === 'available') return '#10B981';
            if (status === 'busy') return '#F97316';
            return '#9CA3AF';
        };

        const statusOptions = [
            { id: 'available', label: 'Available', color: '#10B981' },
            { id: 'busy', label: 'Busy', color: '#F97316' },
            { id: 'offline', label: 'Offline', color: '#9CA3AF' },
        ];

        return (
            <ScrollView className="flex-1" style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ paddingBottom: 40 }}>
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
                        Set your status and review new requests in your area
                    </Text>

                    {/* Status Card */}
                    <View className="bg-white rounded-3xl p-6 mb-8" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6 }}>
                        {/* Header */}
                        <View className="mb-6">
                            <Text className="text-gray-900 font-outfit-bold text-xl">
                                Available to provide services
                            </Text>
                        </View>

                        {/* Status Selector */}
                        <View className="flex-row gap-2 mb-6 bg-gray-100 p-1.5 rounded-2xl">
                            {statusOptions.map((option) => (
                                <TouchableOpacity
                                    key={option.id}
                                    onPress={() => setMechanicStatus(option.id as 'available' | 'busy' | 'offline')}
                                    className="flex-1 py-2.5 rounded-xl flex-row items-center justify-center gap-2"
                                    style={{
                                        backgroundColor: mechanicStatus === option.id ? 'white' : 'transparent',
                                    }}
                                >
                                    <View
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: option.color }}
                                    />
                                    <Text
                                        className="font-outfit-semibold text-sm"
                                        style={{
                                            color: mechanicStatus === option.id ? '#1F2937' : '#6B7280',
                                        }}
                                    >
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Description Text */}
                        <Text className="text-gray-600 font-outfit-regular text-sm">
                            {mechanicStatus === 'available' && 'You are visible to nearby owners and can receive new requests.'}
                            {mechanicStatus === 'busy' && 'You are visible to nearby owners but won\'t receive new requests.'}
                            {mechanicStatus === 'offline' && 'You are not visible to nearby owners and won\'t receive requests.'}
                        </Text>
                    </View>

                    {mechanicStatus !== 'offline' && (
                        <>
                            {/* New Requests Title */}
                            <Text className="text-gray-900 font-outfit-bold text-lg mt-2 mb-4">
                                New requests in your area
                            </Text>

                            {/* Requests List */}
                            {isLoadingMechanicRequests ? (
                                <View className="items-center justify-center py-8">
                                    <ActivityIndicator size="large" color="#0047AB" />
                                </View>
                            ) : (
                        <View className="gap-4">
                            {mechanicRequests.map((request) => {
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
                                        <View className="bg-white rounded-3xl">
                                            {/* Top Section */}
                                            <View className="p-6 pb-4">
                                                <View className="flex-row gap-4">
                                                    {/* Icon */}
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

                                                    {/* Content */}
                                                    <View className="flex-1">
                                                        {/* First Row: Service Type and Time */}
                                                        <View className="flex-row items-center justify-between mb-2">
                                                            <View className="flex-1 pr-2">
                                                                <Text className="text-gray-900 font-outfit-bold text-base">
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
                                                                <Text className="text-gray-600 font-outfit-regular text-xs">
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
                                                    onPress={() => router.push(`/dashboard/${request.id}`)}
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
                        </>
                    )}
                </View>
            </ScrollView>
        );
    }

    if (isLoadingRequests && requests.length === 0) {
        return (
            <View className="flex-1 bg-white justify-center items-center">
                <ActivityIndicator size="large" color="#0047AB" />
            </View>
        );
    }

    if (user?.role === 'mechanic' && !user.isOnline) {
        return (
            <View className="flex-1 bg-white justify-center items-center px-6">
                <Text className="text-lg font-outfit-semibold text-center text-gray-900 mb-4">
                    You are currently offline
                </Text>
                <Text className="text-center text-gray-500 mb-6 font-outfit-medium">
                    Please go to your Profile to go On-Line and see assistance requests.
                </Text>
                <TouchableOpacity
                    className="bg-blue-600 py-3 px-6 rounded-lg"
                    onPress={() => router.push('/(tabs)')}
                >
                    <Text className="text-white font-outfit-semibold">Go to Profile</Text>
                </TouchableOpacity>
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
                                {user?.role?.toLowerCase() === 'mechanic' ? 'FIND JOBS' : 'NEED HELP'}
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
