import { Appointment } from '@/context/AppointmentsContext';
import { haversineDistanceKm } from '@/lib/utils';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Calendar, Car, ChevronRight, Clock, MapPin, MessageSquare, ShieldCheck, Trash2, Video } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker } from 'react-native-maps';
import { MAP_PROVIDER } from '@/lib/maps/provider';

/** Format an ISO date string to a human-readable "MM/DD/YYYY - hh:mm AM/PM" */
function formatDate(iso?: string): string {
    if (!iso) return 'N/A';
    return new Date(iso).toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

interface AppointmentCardProps {
    appointment: Appointment;
    onCancel: (id: string) => void;
}

export function AppointmentCard({ appointment, onCancel }: AppointmentCardProps) {
    const router = useRouter();
    const isCanceled = appointment.status === 'canceled';
    const isPending = appointment.status === 'pending';

    const [distanceLabel, setDistanceLabel] = useState<string>('Distance: N/A');

    useEffect(() => {
        if (!appointment.locationLat || !appointment.locationLng) return;
        Location.getLastKnownPositionAsync().then((pos) => {
            if (pos) {
                const km = haversineDistanceKm(
                    pos.coords.latitude,
                    pos.coords.longitude,
                    appointment.locationLat!,
                    appointment.locationLng!,
                );
                setDistanceLabel(`Distance: ${km.toFixed(1)} Km`);
            }
        }).catch(() => { /* permission not granted yet — leave N/A */ });
    }, [appointment.locationLat, appointment.locationLng]);

    const getHeaderStyles = () => {
        const isAccepted = appointment.status === 'accepted';

        if (isPending) {
            return { bg: 'bg-orange-500', icon: Clock, label: 'Pending Request' };
        }

        if (appointment.assistanceType === 'witness' || appointment.type === 'witness') {
            return {
                bg: isAccepted ? 'bg-emerald-600' : 'bg-blue-700',
                icon: ShieldCheck,
                label: isAccepted ? 'Accepted Accident' : 'ACCIDENT ASSISTANCE'
            };
        }

        switch (appointment.type) {
            case 'immediate':
                return {
                    bg: isAccepted ? 'bg-emerald-600' : 'bg-blue-700',
                    icon: Clock,
                    label: isAccepted ? 'Accepted Assistance' : 'Immediate Assistance'
                };
            case 'videocall':
                return {
                    bg: isAccepted ? 'bg-emerald-600' : 'bg-cyan-600',
                    icon: Video,
                    label: isAccepted ? 'Accepted Video Call' : 'Video Call Assistance'
                };
            default:
                if (appointment.status === 'offered') {
                    return { bg: 'bg-blue-600', icon: Clock, label: 'Mechanic Found' };
                }
                return {
                    bg: isAccepted ? 'bg-emerald-600' : 'bg-blue-600',
                    icon: Calendar,
                    label: isAccepted ? 'Accepted Appointment' : 'Scheduled Assistance'
                };
        }
    };

    const header = getHeaderStyles();
    const Icon = header.icon;

    return (
        <TouchableOpacity
            className="bg-white rounded-xl overflow-hidden"
            onPress={() => router.navigate(`/appointments/${appointment.id}`)}
            activeOpacity={0.7}
        >
            {/* Pending Banner */}
            {isPending && (
                <View className="bg-orange-50 p-3 items-center border-b border-orange-100">
                    <Text className="text-orange-600 font-outfit-bold text-base uppercase">Waiting for Mechanic</Text>
                </View>
            )}

            {/* Offered Banner */}
            {appointment.status === 'offered' && (
                <View className="bg-blue-50 p-3 items-center border-b border-blue-100">
                    <Text className="text-blue-600 font-outfit-bold text-base uppercase">Mechanic Offered</Text>
                    <Text className="text-blue-400 text-[10px]">Tap to view offer</Text>
                </View>
            )}

            {/* Accepted Banner */}
            {appointment.status === 'accepted' && (
                <View className="bg-emerald-50 p-3 items-center border-b border-emerald-100">
                    <Text className="text-emerald-600 font-outfit-bold text-base uppercase">Service Accepted</Text>
                    <Text className="text-emerald-400 text-[10px]">Mechanic is on the way</Text>
                </View>
            )}

            {/* Canceled Banner */}
            {isCanceled && (
                <View className="bg-red-50 p-3 items-center border-b border-red-100">
                    <Text className="text-red-600 font-outfit-bold text-base">REQUEST CANCELED</Text>
                </View>
            )}

            <View className={`px-4 py-3 flex-row items-center justify-between ${header.bg}`}>
                <View className="flex-row items-center gap-2">
                    <Icon size={16} color="white" />
                    <Text className="text-white font-outfit-bold text-base">{header.label}</Text>
                </View>
                <Text className="text-white/80 font-outfit-medium text-[10px]">#{appointment.id.slice(0, 8)}...</Text>
            </View>

            <View className="px-4 py-2">
                {!isCanceled && (
                    <Text className="text-lg font-outfit-bold text-gray-900 mb-0.5">
                        {appointment.date} - {appointment.time}
                    </Text>
                )}
                <Text className="text-base font-outfit-bold text-gray-800 mb-0.5">{appointment.title}</Text>

                <View className="flex-row items-center mb-1">
                    <Car size={14} color="#4B5563" />
                    <Text className="text-gray-700 text-sm font-outfit-regular ml-2">{appointment.car}</Text>
                </View>

                <Text className="text-gray-600 text-sm font-outfit-regular mb-2 pl-6">
                    {appointment.notes}
                </Text>

                {/* Map View */}
                <View className="h-32 bg-gray-100 rounded-lg mb-3 relative overflow-hidden border border-gray-200">
                    {appointment.locationLat && appointment.locationLng ? (
                        <MapView
                            provider={MAP_PROVIDER}
                            style={{ flex: 1 }}
                            initialRegion={{
                                latitude: appointment.locationLat,
                                longitude: appointment.locationLng,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01,
                            }}
                            scrollEnabled={false}
                            zoomEnabled={false}
                            rotateEnabled={false}
                            pitchEnabled={false}
                        >
                            <Marker
                                coordinate={{
                                    latitude: appointment.locationLat,
                                    longitude: appointment.locationLng,
                                }}
                            />
                        </MapView>
                    ) : (
                        <View className="flex-1 items-center justify-center">
                            <MapPin size={24} color="#9CA3AF" />
                            <Text className="text-gray-400 font-outfit-regular text-xs mt-1">Location not available</Text>
                        </View>
                    )}
                </View>

                <Text className="text-base font-outfit-medium text-gray-900 mb-1">{appointment.address}</Text>
                {!isCanceled && (
                    <View className="flex-row items-center mb-4">
                        <MapPin size={12} color="#6B7280" />
                        <Text className="text-gray-500 text-xs ml-1">{distanceLabel}</Text>
                    </View>
                )}

                {/* Buttons */}
                {!isCanceled && (
                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            className="w-1/3 rounded-[10px] py-3 items-center justify-center"
                            style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' }}
                        >
                            <Text className="text-gray-900 font-outfit-bold text-sm">Budget: {appointment.budget}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => !isPending && router.push(`/chat/${appointment.id}`)}
                            activeOpacity={0.8}
                            disabled={isPending}
                            className="flex-1"
                        >
                            <LinearGradient
                                colors={isPending ? ['#D1D5DB', '#D1D5DB'] : ['#2B66F8', '#081E72']}
                                start={{ x: 0, y: 1 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    borderRadius: 10,
                                    paddingVertical: 12,
                                    paddingHorizontal: 12,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <MessageSquare size={16} color={isPending ? '#9CA3AF' : 'white'} />
                                <Text className={`font-outfit-bold text-sm ml-2`} style={{ color: isPending ? '#9CA3AF' : 'white' }}>Message</Text>
                                <ChevronRight size={16} color={isPending ? '#9CA3AF' : 'white'} />
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}

                {!isCanceled && (
                    <TouchableOpacity onPress={() => onCancel(appointment.id)} className="mt-4 items-center flex-row justify-center">
                        <Trash2 size={12} color="#9CA3AF" />
                        <Text className="text-gray-400 font-outfit-medium text-xs ml-1">Cancel request</Text>
                    </TouchableOpacity>
                )}

                {isCanceled && (
                    <Text className="text-center text-[10px] text-gray-400 mt-2">
                        Posted: {formatDate(appointment.updatedAt)}
                        {'\n'}ID:#{appointment.id}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );
}
