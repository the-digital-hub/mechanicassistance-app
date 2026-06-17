import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import { useSocket } from '@/context/SocketContext';
import { apiClient } from '@/lib/api/apiClient';

interface UserTrackingTabProps {
    onCancel: () => void;
    onMessage?: () => void;
    mechanic?: any;
    appointmentType?: string;
    appointment?: any;
}

function formatEtaTime(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getTypeLabel(type?: string, assistanceType?: string) {
    if (assistanceType === 'witness' || type === 'witness') return 'ACCIDENT ASSISTANCE';
    if (type === 'immediate') return 'Immediate Assistance';
    if (type === 'videocall' || type === 'video') return 'Video Call Assistance';
    return 'Scheduled Assistance';
}

export function UserTrackingTab({ onCancel, onMessage, mechanic, appointmentType, appointment }: UserTrackingTabProps) {
    const { socket } = useSocket();

    const [etaData, setEtaData] = React.useState<{
        minutesAway: number | null;
        distanceKm: number | null;
        etaTime: string | null;
    }>({ minutesAway: null, distanceKm: null, etaTime: null });
    const [etaLoading, setEtaLoading] = React.useState(true);

    React.useEffect(() => {
        if (!appointment?.id) return;
        if (appointment?.status !== 'started' && appointment?.status !== 'accepted') {
            setEtaLoading(false);
            return;
        }

        apiClient.get(`/api/appointments/${appointment.id}/eta`)
            .then((data: any) => {
                if (data?.available) {
                    setEtaData({
                        minutesAway: data.minutesAway,
                        distanceKm: data.distanceKm,
                        etaTime: data.etaTime,
                    });
                }
            })
            .catch(() => {/* silent fail */})
            .finally(() => setEtaLoading(false));
    }, [appointment?.id, appointment?.status]);

    React.useEffect(() => {
        if (!socket || !appointment?.id) return;

        const handler = (payload: any) => {
            if (payload?.appointmentId !== appointment.id) return;
            setEtaData({
                minutesAway: payload.minutesAway ?? null,
                distanceKm: payload.distanceKm ?? null,
                etaTime: payload.etaTime ?? null,
            });
            setEtaLoading(false);
        };

        socket.on('eta_update', handler);
        return () => { socket.off('eta_update', handler); };
    }, [socket, appointment?.id]);

    return (
        <View style={{ gap: 20 }}>

            {/* Blue Type Banner */}
            <View style={{
                backgroundColor: '#2563EB',
                borderRadius: 14,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
            }}>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 999 }}>
                    <Ionicons name="construct" size={22} color="white" />
                </View>
                <Text style={{ color: 'white', fontFamily: 'Outfit_700Bold', fontSize: 17 }}>
                    {getTypeLabel(appointmentType, appointment?.assistanceType)}
                </Text>
            </View>

            {/* Mechanic Match + ETA */}
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                <Text style={{ color: '#1e3a8a', fontFamily: 'Outfit_700Bold', fontSize: 22, marginBottom: 20 }}>
                    Mechanic Match!
                </Text>

                {/* Circular Progress Ring */}
                <View style={{ width: 130, height: 130, marginBottom: 16, alignItems: 'center', justifyContent: 'center' }}>
                    {/* Background ring */}
                    <View style={{
                        position: 'absolute',
                        width: 130, height: 130,
                        borderRadius: 65,
                        borderWidth: 8,
                        borderColor: '#DBEAFE',
                    }} />
                    {/* Top-right arc (simulated 3/4 fill) */}
                    <View style={{
                        position: 'absolute',
                        width: 130, height: 130,
                        borderRadius: 65,
                        borderWidth: 8,
                        borderColor: '#3B82F6',
                        borderBottomColor: 'transparent',
                        transform: [{ rotate: '45deg' }],
                    }} />
                    {/* Inner circle */}
                    <View style={{
                        width: 100, height: 100,
                        borderRadius: 50,
                        backgroundColor: '#EFF6FF',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Ionicons name="time-outline" size={36} color="#3B82F6" />
                    </View>
                </View>

                {/* Minutes Away */}
                <Text style={{ color: '#1e3a8a', fontFamily: 'Outfit_700Bold', fontSize: 20, marginBottom: 4 }}>
                    {etaLoading ? 'Calculating...' : etaData.minutesAway !== null ? `${etaData.minutesAway} min away` : 'On the way'}
                </Text>

                {/* ETA — large blue */}
                <Text style={{ color: '#2563EB', fontFamily: 'Outfit_700Bold', fontSize: 22, marginBottom: 20 }}>
                    {etaData.etaTime ? `ETA: ${formatEtaTime(etaData.etaTime)}` : etaLoading ? '' : 'ETA: --'}
                </Text>

                {/* Cancel Request */}
                <TouchableOpacity onPress={onCancel} style={{ marginBottom: 12 }}>
                    <Text style={{ color: '#EF4444', fontFamily: 'Outfit_700Bold', fontSize: 14 }}>
                        Cancel Request
                    </Text>
                </TouchableOpacity>

                {/* Footer reference */}
                <Text style={{ color: '#D1D5DB', fontSize: 10, textAlign: 'center', lineHeight: 16 }}>
                    Posted: 07/07/2025 - 03:15 AM{'\n'}
                    ID:#{appointment?.id || '34532-2384-33327'}
                </Text>
            </View>

            {/* Mechanic Card */}
            <View style={{
                backgroundColor: '#F9FAFB',
                borderRadius: 14,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#F3F4F6',
            }}>
                {mechanic ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Image
                            source={{ uri: mechanic.profileImage || 'https://i.pravatar.cc/150?u=mechanic' }}
                            style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#E5E7EB' }}
                        />
                        <View>
                            <Text style={{ color: '#6B7280', fontSize: 12, fontFamily: 'Outfit_500Medium' }}>Mechanic:</Text>
                            <Text style={{ color: '#1e3a8a', fontFamily: 'Outfit_700Bold', fontSize: 16 }}>
                                {mechanic.name || 'Unknown'} {mechanic.surname?.[0] || ''}.
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
                                {[1, 2, 3, 4, 5].map(s => (
                                    <Ionicons key={s} name="star" size={12} color="#3B82F6" />
                                ))}
                            </View>
                        </View>
                    </View>
                ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <ActivityIndicator size="small" color="#3B82F6" />
                        <Text style={{ color: '#9CA3AF', fontSize: 14 }}>Loading mechanic...</Text>
                    </View>
                )}
            </View>

            {/* Action Buttons */}
            <View style={{ gap: 12 }}>
                <TouchableOpacity style={{
                    backgroundColor: '#2563EB',
                    borderRadius: 10,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                }}>
                    <Ionicons name="call" size={20} color="white" />
                    <Text style={{ color: 'white', fontFamily: 'Outfit_700Bold', fontSize: 16 }}>Call</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onMessage}
                    style={{
                        backgroundColor: '#2563EB',
                        borderRadius: 10,
                        paddingVertical: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                    }}
                >
                    <Ionicons name="chatbubble-ellipses" size={20} color="white" />
                    <Text style={{ color: 'white', fontFamily: 'Outfit_700Bold', fontSize: 16 }}>Message</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
