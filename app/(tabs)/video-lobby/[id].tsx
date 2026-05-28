import { useAppointments } from '@/context/AppointmentsContext';
import { useSocket } from '@/context/SocketContext';
import { useUser } from '@/context/UserContext';
import { apiClient } from '@/lib/api/apiClient';
import { userDAO } from '@/lib/dao/UserDAO';
import { Ionicons } from '@expo/vector-icons';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';

export default function VideoLobbyScreen() {
    const { id } = useGlobalSearchParams();
    const router = useRouter();
    const { user } = useUser();
    const { getAppointmentById, refresh } = useAppointments();
    const { lastMessage } = useSocket();

    const appointmentId = Array.isArray(id) ? id[0] : id || '';
    const appointment = getAppointmentById(appointmentId);
    const isUserRole = user?.role === 'user';
    const participantName = user ? `${user.name} ${user.surname}`.trim() : 'Participant';
    const participantRole: 'user' | 'mechanic' = isUserRole ? 'user' : 'mechanic';

    const [isCreatingRoom, setIsCreatingRoom] = useState(false);
    const [roomUrl, setRoomUrl] = useState<string | null>(null);
    const [roomExpiry, setRoomExpiry] = useState<number | null>(null);
    const [otherPartyName, setOtherPartyName] = useState<string>('');
    const [isCheckingRoom, setIsCheckingRoom] = useState(true);

    // Pulsing animation
    const pulseScale = useSharedValue(1);
    const pulseOpacity = useSharedValue(0.6);

    useEffect(() => {
        pulseScale.value = withRepeat(
            withTiming(1.6, { duration: 1500, easing: Easing.out(Easing.ease) }),
            -1,
            true
        );
        pulseOpacity.value = withRepeat(
            withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
        opacity: pulseOpacity.value,
    }));

    // Fetch the other party's name
    useEffect(() => {
        const fetchOtherParty = async () => {
            try {
                if (isUserRole && appointment?.mechanicId) {
                    const mech = await userDAO.getById(appointment.mechanicId);
                    if (mech) setOtherPartyName(`${mech.name || ''} ${mech.surname || ''}`.trim());
                } else if (!isUserRole && appointment?.userId) {
                    const client = await userDAO.getById(appointment.userId);
                    if (client) setOtherPartyName(`${client.name || ''} ${client.surname || ''}`.trim());
                }
            } catch (e) {
                console.error('Failed to fetch other party:', e);
            }
        };
        fetchOtherParty();
    }, [appointment?.mechanicId, appointment?.userId, isUserRole]);

    // Check if a room already exists (runs once on mount + polls every 3s for mechanic)
    useEffect(() => {
        const checkExistingRoom = async () => {
            try {
                const data = await apiClient.get<{ roomUrl: string; roomName: string; expiry: number; isExpired: boolean }>(
                    `/api/video-room/${appointmentId}`
                );
                if (data && data.roomUrl && !data.isExpired) {
                    setRoomUrl(data.roomUrl);
                    setRoomExpiry(data.expiry);
                    return true; // Room found
                }
            } catch (e) {
                // 404 = no room yet, that's fine
            } finally {
                setIsCheckingRoom(false);
            }
            return false;
        };

        if (!appointmentId) return;

        // Initial check
        checkExistingRoom();

        // Poll every 3 seconds if mechanic is waiting for room
        if (!isUserRole) {
            const interval = setInterval(async () => {
                const found = await checkExistingRoom();
                if (found) clearInterval(interval);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [appointmentId, isUserRole]);

    // Also listen for real-time video_room_ready notifications (WebSocket)
    useEffect(() => {
        if (lastMessage?.type === 'video_room_ready' && lastMessage?.payload?.appointmentId === appointmentId) {
            setRoomUrl(lastMessage.payload.roomUrl);
            setRoomExpiry(lastMessage.payload.expiry);
        }
    }, [lastMessage, appointmentId]);

    const handleStartCall = useCallback(async () => {
        setIsCreatingRoom(true);
        try {
            const data = await apiClient.post<{ roomUrl: string; roomName: string; expiry: number; token: string }>(
                '/api/video-room',
                { appointmentId, participantName, role: participantRole }
            );
            setRoomUrl(data.roomUrl);
            setRoomExpiry(data.expiry);

            router.push({
                pathname: '/video-call/[id]' as any,
                params: { id: appointmentId, roomUrl: data.roomUrl, token: data.token }
            });
        } catch (error) {
            console.error('Failed to create video room:', error);
            Alert.alert('Error', 'Failed to start video call. Please try again.');
        } finally {
            setIsCreatingRoom(false);
        }
    }, [appointmentId, router, participantName, participantRole]);

    const handleJoinCall = useCallback(async () => {
        if (!roomUrl) return;
        try {
            const data = await apiClient.get<{ roomUrl: string; token: string | null }>(
                `/api/video-room/${appointmentId}?participantName=${encodeURIComponent(participantName)}&role=${participantRole}`
            );
            if (!data.token) {
                Alert.alert('Error', 'The video room has expired. Please ask the user to start a new call.');
                return;
            }
            router.push({
                pathname: '/video-call/[id]' as any,
                params: { id: appointmentId, roomUrl: data.roomUrl, token: data.token }
            });
        } catch (error) {
            console.error('Failed to join video call:', error);
            Alert.alert('Error', 'Failed to join video call. Please try again.');
        }
    }, [roomUrl, appointmentId, router, participantName, participantRole]);

    if (!appointment) {
        return (
            <View style={styles.container}>
                <View style={styles.centerContent}>
                    <Text style={styles.errorTitle}>Appointment not found</Text>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
                        <Text style={styles.backLinkText}>Go back</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (isCheckingRoom) {
        return (
            <View style={styles.container}>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#0047AB" />
                    <Text style={styles.loadingText}>Checking video room...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
                    <Ionicons name="chevron-back" size={24} color="#0047AB" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Video Assistance</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Content */}
            <View style={styles.centerContent}>
                {/* Appointment info */}
                <View style={styles.appointmentInfo}>
                    <Text style={styles.appointmentTitle}>{appointment.title || 'Video Call Assistance'}</Text>
                    {appointment.car && (
                        <Text style={styles.appointmentSubtitle}>
                            <Ionicons name="car-sport" size={14} color="#6B7280" /> {appointment.car}
                        </Text>
                    )}
                    {otherPartyName ? (
                        <Text style={styles.appointmentSubtitle}>
                            <Ionicons name="person" size={14} color="#6B7280" /> {otherPartyName}
                        </Text>
                    ) : null}
                </View>

                {/* Pulsing Green Circle */}
                <View style={styles.circleContainer}>
                    {/* Pulse rings */}
                    <Animated.View style={[styles.pulseRing, styles.pulseRingOuter, pulseStyle]} />
                    <Animated.View style={[styles.pulseRing, styles.pulseRingMiddle, pulseStyle]} />

                    {/* Main circle button */}
                    <TouchableOpacity
                        style={[
                            styles.mainCircle,
                            isCreatingRoom && styles.mainCircleDisabled
                        ]}
                        onPress={isUserRole ? handleStartCall : handleJoinCall}
                        disabled={isCreatingRoom || (!isUserRole && !roomUrl)}
                        activeOpacity={0.8}
                    >
                        {isCreatingRoom ? (
                            <ActivityIndicator size="large" color="white" />
                        ) : (
                            <Ionicons name="videocam" size={48} color="white" />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Action Label */}
                <Text style={styles.actionLabel}>
                    {isUserRole ? 'Start Video Chat' : 'Join Video Call'}
                </Text>
                <Text style={styles.actionSubLabel}>
                    {isUserRole
                        ? 'Tap the green circle to start your video call'
                        : roomUrl
                            ? 'Tap the green circle to join the video call'
                            : 'Waiting for the client to start the call...'}
                </Text>

                {/* Room status */}
                {roomUrl && roomExpiry && (
                    <View style={styles.roomStatus}>
                        <View style={styles.roomStatusDot} />
                        <Text style={styles.roomStatusText}>Video room is active</Text>
                    </View>
                )}

                {/* If mechanic and no room yet, show waiting state */}
                {!isUserRole && !roomUrl && (
                    <View style={styles.waitingContainer}>
                        <ActivityIndicator size="small" color="#6B7280" />
                        <Text style={styles.waitingText}>Waiting for the client to initiate...</Text>
                    </View>
                )}
            </View>

            {/* Room will expire notice */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Video calls are limited to 5 minutes for testing purposes.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 56,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
    },
    headerTitle: {
        fontFamily: 'Outfit_700Bold',
        fontSize: 18,
        color: '#1E3A5F',
    },
    centerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    appointmentInfo: {
        alignItems: 'center',
        marginBottom: 40,
    },
    appointmentTitle: {
        fontFamily: 'Outfit_700Bold',
        fontSize: 20,
        color: '#1E3A5F',
        textAlign: 'center',
        marginBottom: 8,
    },
    appointmentSubtitle: {
        fontFamily: 'Outfit_400Regular',
        fontSize: 14,
        color: '#6B7280',
        marginTop: 4,
    },
    circleContainer: {
        width: 200,
        height: 200,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    pulseRing: {
        position: 'absolute',
        borderRadius: 999,
        backgroundColor: '#22C55E',
    },
    pulseRingOuter: {
        width: 200,
        height: 200,
    },
    pulseRingMiddle: {
        width: 160,
        height: 160,
    },
    mainCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#22C55E',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#22C55E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
        zIndex: 10,
    },
    mainCircleDisabled: {
        backgroundColor: '#86EFAC',
    },
    actionLabel: {
        fontFamily: 'Outfit_700Bold',
        fontSize: 24,
        color: '#1E3A5F',
        marginBottom: 8,
    },
    actionSubLabel: {
        fontFamily: 'Outfit_400Regular',
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        paddingHorizontal: 16,
    },
    roomStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 24,
        backgroundColor: '#F0FDF4',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    roomStatusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22C55E',
        marginRight: 8,
    },
    roomStatusText: {
        fontFamily: 'Outfit_500Medium',
        fontSize: 13,
        color: '#16A34A',
    },
    waitingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 24,
        gap: 8,
    },
    waitingText: {
        fontFamily: 'Outfit_400Regular',
        fontSize: 13,
        color: '#6B7280',
    },
    footer: {
        paddingHorizontal: 32,
        paddingBottom: 40,
        alignItems: 'center',
    },
    footerText: {
        fontFamily: 'Outfit_400Regular',
        fontSize: 11,
        color: '#9CA3AF',
        textAlign: 'center',
    },
    errorTitle: {
        fontFamily: 'Outfit_700Bold',
        fontSize: 18,
        color: '#1E3A5F',
    },
    backLink: {
        marginTop: 16,
    },
    backLinkText: {
        fontFamily: 'Outfit_500Medium',
        fontSize: 14,
        color: '#2563EB',
    },
    loadingText: {
        fontFamily: 'Outfit_500Medium',
        fontSize: 14,
        color: '#6B7280',
        marginTop: 12,
    },
});
