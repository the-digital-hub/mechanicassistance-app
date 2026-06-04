import { AssistanceCard, AssistanceType } from '@/components/ui/AssistanceCard';
import { useAppointments } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { AssistanceRequest } from '@/lib/dao/interfaces';
import { useFocusEffect, useRouter } from 'expo-router';
import { Calendar, Clock, ShieldCheck, SlidersHorizontal, Video } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';

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

    const FilterIcon = ({ type, icon: Icon, label, color }: { type: AssistanceType, icon: any, label: string, color: string }) => (
        <TouchableOpacity
            onPress={() => {
                if (user?.role === 'user') {
                    router.push('/request-assistance');
                } else {
                    setFilter(filter === type ? null : type);
                }
            }}
            className="items-center w-[22%]"
        >
            <View className={`w-14 h-14 rounded-full justify-center items-center mb-1 bg-gray-100 ${filter === type ? 'border-2 border-blue-500' : ''}`}>
                <Icon size={24} color={color} />
            </View>
            <Text className={`text-[10px] font-outfit-medium text-center ${filter === type ? 'text-blue-600' : 'text-gray-600'}`}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View className="flex-1 bg-white px-4 pt-4">
            <FlatList
                ListHeaderComponent={
                    <View className="mb-4">
                        {/* Filter Icons */}
                        <View className="flex-row justify-between px-2 mb-6">
                            <FilterIcon type="immediate" icon={Clock} label="Immediate" color="#1D4ED8" />
                            <FilterIcon type="witness" icon={ShieldCheck} label="Accident" color="#1D4ED8" />
                            <FilterIcon type="scheduled" icon={Calendar} label="Scheduled" color="#3B82F6" />
                            <FilterIcon type="videocall" icon={Video} label="Video Call" color="#06caf0" />
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
