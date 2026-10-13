import { LinearGradient } from 'expo-linear-gradient';
import { Car, ClipboardList, Clock, MapPin, ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import type { AppointmentStatus } from '@/context/AppointmentsContext';
import type { AssistanceType } from '@/lib/dao/interfaces';

interface UserRequestCardProps {
    id: string;
    type?: AssistanceType;
    assistanceType?: string;
    title: string;
    car?: string;
    address?: string;
    status: AppointmentStatus;
    onPress: () => void;
    /** Only rendered while the request can still be called off (pending/offered). */
    onCancel?: () => void;
}

/**
 * The user's own assistance request, as seen on their dashboard. Read-only plus
 * "view"/"cancel" — accepting is the mechanic's action and lives in AssistanceCard.
 */
export function UserRequestCard({
    id,
    type,
    assistanceType,
    title,
    car,
    address,
    status,
    onPress,
    onCancel,
}: UserRequestCardProps) {
    const { t } = useTranslation();

    const isWitness = assistanceType === 'witness' || type === 'witness';
    const canCancel = !!onCancel && (status === 'pending' || status === 'offered');

    const getTypeTitle = () => {
        if (isWitness) return t('assistanceCard.headerAccident');
        switch (type) {
            case 'immediate': return t('assistanceCard.headerImmediate');
            case 'scheduled': return t('assistanceCard.headerScheduled');
            case 'videocall': return t('assistanceCard.headerVideoCall');
            default: return t('assistanceCard.headerDefault');
        }
    };

    const getTypeIcon = () => {
        if (isWitness) return <ShieldCheck size={20} color="#1E56E3" />;
        switch (type) {
            case 'scheduled': return <ClipboardList size={20} color="#1E56E3" />;
            default: return <Clock size={20} color="#1E56E3" />;
        }
    };

    const getStatusBadge = () => {
        switch (status) {
            case 'offered':
                return { label: t('dashboard.user.requestStatus.offered'), bg: '#EAF1FF', color: '#1E56E3' };
            case 'accepted':
                return { label: t('dashboard.user.requestStatus.accepted'), bg: '#E7F8F1', color: '#0E8A5F' };
            case 'started':
                return { label: t('dashboard.user.requestStatus.started'), bg: '#E7F8F1', color: '#0E8A5F' };
            default:
                return { label: t('dashboard.user.requestStatus.pending'), bg: '#FEF3C7', color: '#B45309' };
        }
    };

    const badge = getStatusBadge();

    const infoRows = [
        car ? { key: 'vehicle', Icon: Car, label: t('dashboard.user.requestVehicleLabel'), value: car } : null,
        address ? { key: 'location', Icon: MapPin, label: t('dashboard.user.requestLocationLabel'), value: address } : null,
    ].filter((row): row is NonNullable<typeof row> => row !== null);

    return (
        <View
            className="bg-white"
            style={{
                borderRadius: 20,
                padding: 16,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: '#EEF2FA',
                shadowColor: '#0E2F8A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 14,
                elevation: 3,
            }}
        >
            {/* Type + status */}
            <View className="flex-row items-center">
                <View
                    className="justify-center items-center mr-3"
                    style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EAF1FF' }}
                >
                    {getTypeIcon()}
                </View>
                <View className="flex-1">
                    <Text className="font-outfit-bold" style={{ fontSize: 10.5, letterSpacing: 1, color: '#6B7490' }}>
                        {getTypeTitle().toUpperCase()}
                    </Text>
                    <Text
                        className="font-outfit-bold"
                        style={{ fontSize: 18, letterSpacing: -0.3, color: '#0B1530', marginTop: 1 }}
                        numberOfLines={1}
                    >
                        {title}
                    </Text>
                </View>
                <View className="px-2.5 py-1 rounded-full ml-2" style={{ backgroundColor: badge.bg }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 10.5, letterSpacing: 0.8, color: badge.color }}>
                        {badge.label.toUpperCase()}
                    </Text>
                </View>
            </View>

            {/* Info block */}
            {infoRows.length > 0 && (
                <View style={{ marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: '#EEF2FA', overflow: 'hidden' }}>
                    {infoRows.map(({ key, Icon, label, value }, index) => (
                        <View
                            key={key}
                            className="flex-row items-center"
                            style={{
                                paddingVertical: 11,
                                paddingHorizontal: 14,
                                borderBottomWidth: index < infoRows.length - 1 ? 1 : 0,
                                borderBottomColor: '#EEF2FA',
                            }}
                        >
                            <View
                                className="justify-center items-center"
                                style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#EAF1FF', marginRight: 12 }}
                            >
                                <Icon size={17} color="#1E56E3" />
                            </View>
                            <Text className="font-outfit-medium" style={{ fontSize: 12, color: '#6B7490', width: 60 }}>
                                {label}
                            </Text>
                            <Text
                                className="font-outfit-bold flex-1"
                                style={{ fontSize: 13, lineHeight: 17, color: '#0B1530', textAlign: 'right' }}
                                numberOfLines={2}
                            >
                                {value}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Actions */}
            <View className="flex-row gap-3" style={{ marginTop: 14 }}>
                <TouchableOpacity
                    onPress={onPress}
                    activeOpacity={0.85}
                    style={{
                        flex: canCancel ? 0.7 : 1,
                        borderRadius: 14,
                        backgroundColor: '#1E56E3',
                        shadowColor: '#1E56E3',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.3,
                        shadowRadius: 10,
                        elevation: 4,
                    }}
                >
                    <LinearGradient
                        colors={['#1E56E3', '#0B2A8E']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                            borderRadius: 14,
                            paddingVertical: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Text className="text-white font-outfit-bold text-center" style={{ fontSize: 15 }}>
                            {t('dashboard.user.viewRequest')}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>

                {canCancel && (
                    <TouchableOpacity
                        onPress={onCancel}
                        activeOpacity={0.85}
                        className="items-center justify-center border-2"
                        style={{ flex: 0.3, borderRadius: 14, borderColor: '#FCA5A5', backgroundColor: '#FEF0F0' }}
                    >
                        <Text className="text-red-500 font-outfit-bold text-sm">
                            {t('dashboard.user.cancelRequest')}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            <Text className="font-mono text-right" style={{ fontSize: 11, letterSpacing: 0.5, color: '#8C96AE', marginTop: 10 }}>
                #{id.slice(0, 8)}
            </Text>
        </View>
    );
}
