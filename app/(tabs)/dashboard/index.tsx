import { AssistanceCard, AssistanceType } from '@/components/ui/AssistanceCard';
import { useAppointments } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { AssistanceRequest } from '@/lib/dao/interfaces';
import { useFocusEffect, useRouter } from 'expo-router';
import { Calendar, Clock, SlidersHorizontal, Video, Zap, ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function AssistFeedScreen() {
    const router = useRouter();
    const [filter, setFilter] = useState<AssistanceType | null>(null);
    const [requests, setRequests] = useState<AssistanceRequest[]>([]);
    const [isLoadingRequests, setIsLoadingRequests] = useState(true);
    const { user, isLoading: isUserLoading } = useUser();
    const { appointments } = useAppointments();

    const loadRequests = async () => {
        if (!user?.id) {
            setIsLoadingRequests(false);
            return;
        }
        setIsLoadingRequests(true);
        try {
            const filters: any = {};
            if (user?.role === 'mechanic') {
                // Localized filtering: show only requests in the same ZIP code
                if (user?.addresses?.[0]?.zip) {
                    filters.zip = user.addresses[0].zip;
                }
                filters.status = 'pending';
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

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.replace('/login');
        }
    }, [isUserLoading, user]);

    if (isUserLoading || (isLoadingRequests && requests.length === 0)) {
        return (
            <View className="flex-1 bg-white justify-center items-center">
                <ActivityIndicator size="large" color="#0047AB" />
            </View>
        );
    }

    if (user?.role === 'mechanic' && !user.isOnline) {
        return (
            <View className="flex-1 bg-white justify-center items-center px-6">
                <Text className="text-lg font-outfit-bold text-center text-gray-900 mb-4">
                    You are currently offline
                </Text>
                <Text className="text-center text-gray-500 mb-6 font-outfit-medium">
                    Please go to your Profile to go On-Line and see assistance requests.
                </Text>
                <TouchableOpacity
                    className="bg-blue-600 py-3 px-6 rounded-lg"
                    onPress={() => router.push('/(tabs)')}
                >
                    <Text className="text-white font-outfit-bold">Go to Profile</Text>
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
        <View className="flex-1 bg-white px-6 pt-4">
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
                        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">Welcome back</Text>

                        {/* Subtitle */}
                        <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                            What kind of assistance do you need today?
                        </Text>

                        {/* Assistance Type Cards */}
                        <View className="gap-3 mb-6">
                            {/* Immediate Assistance - Featured Card */}
                            <TouchableOpacity
                                onPress={() => setFilter(filter === 'immediate' ? null : 'immediate')}
                                className="rounded-3xl overflow-hidden"
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={['#2B66F8', '#081E72']}
                                    start={{ x: 0, y: 1 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{
                                        borderRadius: 24,
                                        padding: 16,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                    }}
                                >
                                    {/* Icon */}
                                    <View className="w-16 h-16 rounded-2xl justify-center items-center mr-4" style={{ backgroundColor: '#4D77EF', borderWidth: 1, borderColor: '#6789F1' }}>
                                        <Zap size={32} color="white" strokeWidth={2} />
                                    </View>

                                    {/* Content */}
                                    <View className="flex-1">
                                        <Text className="text-white font-outfit-bold text-lg">Immediate</Text>
                                        <Text className="text-blue-100 font-outfit-regular text-sm mt-1">
                                            Assist
                                        </Text>
                                    </View>

                                    {/* Arrow */}
                                    <View className="w-10 h-10 bg-white rounded-full justify-center items-center ml-3">
                                        <ChevronRight size={20} color="#1D4ED8" strokeWidth={3} />
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Scheduled Assistance */}
                            <TouchableOpacity
                                onPress={() => setFilter(filter === 'scheduled' ? null : 'scheduled')}
                                className="rounded-3xl overflow-hidden"
                                activeOpacity={0.8}
                            >
                                <View className="bg-white rounded-3xl px-4 py-4 flex-row items-center" style={{ borderWidth: 1.5, borderColor: '#EEF2FA' }}>
                                    <View className="w-16 h-16 rounded-2xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                                        <Calendar size={28} color="#1E56E3" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-gray-900 font-outfit-bold text-lg">Scheduled</Text>
                                        <Text className="text-gray-600 font-outfit-regular text-sm mt-1">
                                            Assist
                                        </Text>
                                    </View>
                                    <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#F4F8FF' }}>
                                        <ChevronRight size={20} color="#6B7280" />
                                    </View>
                                </View>
                            </TouchableOpacity>

                            {/* Video Call Assistance */}
                            <TouchableOpacity
                                onPress={() => setFilter(filter === 'videocall' ? null : 'videocall')}
                                className="rounded-3xl overflow-hidden"
                                activeOpacity={0.8}
                            >
                                <View className="bg-white rounded-3xl p-4 flex-row items-center" style={{ borderWidth: 1.5, borderColor: '#EEF2FA' }}>
                                    <View className="w-16 h-16 rounded-2xl justify-center items-center mr-4" style={{ backgroundColor: '#E9F1FF' }}>
                                        <Video size={28} color="#1E56E3" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-gray-900 font-outfit-bold text-lg">Video Call</Text>
                                        <Text className="text-gray-600 font-outfit-regular text-sm mt-1">
                                            DIY
                                        </Text>
                                    </View>
                                    <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#F4F8FF' }}>
                                        <ChevronRight size={20} color="#6B7280" />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Promo Banner - Only for Mechanics */}
                        {user?.role?.toLowerCase().trim() === 'mechanic' && (
                            <View className="bg-blue-50 rounded-xl p-4 flex-row items-center mb-6 border border-blue-100">
                                <View className="flex-1">
                                    <Text className="text-blue-900 font-outfit-bold text-lg mb-2">Looking for more work?</Text>
                                    <TouchableOpacity
                                        className="bg-blue-600 w-full py-2 rounded-lg"
                                    >
                                        <Text className="text-white font-outfit-bold text-center text-xs">View opportunities</Text>
                                    </TouchableOpacity>
                                </View>
                                <View className="w-16 h-16 bg-blue-200 rounded-full ml-4" />
                            </View>
                        )}

                        {/* Filter Header */}
                        <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-lg font-outfit-bold text-blue-900">Last minute Opportunities!</Text>
                            <TouchableOpacity onPress={() => router.push('/dashboard/filter')}>
                                <SlidersHorizontal size={20} color="#0047AB" />
                            </TouchableOpacity>
                        </View>
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
                                    zip: item.zip || ''
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
