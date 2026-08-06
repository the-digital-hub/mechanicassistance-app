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
        if (isWitness) return <ShieldCheck size={20} color="#0047AB" />;
        switch (type) {
            case 'scheduled': return <ClipboardList size={20} color="#0047AB" />;
            default: return <Clock size={20} color="#0047AB" />;
        }
    };

    const getStatusBadge = () => {
        switch (status) {
            case 'offered':
                return { label: t('dashboard.user.requestStatus.offered'), bg: '#E9F1FF', color: '#0047AB' };
            case 'accepted':
                return { label: t('dashboard.user.requestStatus.accepted'), bg: '#ECFDF5', color: '#047857' };
            case 'started':
                return { label: t('dashboard.user.requestStatus.started'), bg: '#ECFDF5', color: '#047857' };
            default:
                return { label: t('dashboard.user.requestStatus.pending'), bg: '#FEF3C7', color: '#B45309' };
        }
    };

    const badge = getStatusBadge();

    return (
        <View
            className="bg-white rounded-3xl mb-4 p-5"
            style={{
                borderWidth: 1.5,
                borderColor: '#EEF2FA',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 8,
                elevation: 6,
            }}
        >
            {/* Type + status */}
            <View className="flex-row items-center mb-4">
                <View
                    className="w-11 h-11 rounded-2xl justify-center items-center mr-3"
                    style={{ backgroundColor: '#E9F1FF' }}
                >
                    {getTypeIcon()}
                </View>
                <View className="flex-1">
                    <Text className="text-gray-500 font-outfit-semibold text-xs tracking-widest">
                        {getTypeTitle().toUpperCase()}
                    </Text>
                    <Text className="text-gray-900 font-outfit-medium" style={{ fontSize: 17 }} numberOfLines={1}>
                        {title}
                    </Text>
                </View>
                <View className="px-2.5 py-1 rounded-full ml-2" style={{ backgroundColor: badge.bg }}>
                    <Text className="font-outfit-semibold text-[10px] tracking-widest" style={{ color: badge.color }}>
                        {badge.label.toUpperCase()}
                    </Text>
                </View>
            </View>

            {/* Info block */}
            {(!!car || !!address) && (
                <View className="rounded-2xl mb-4" style={{ backgroundColor: '#F4F8FF' }}>
                    {!!car && (
                        <View
                            className="flex-row items-center px-4 py-3"
                            style={address ? { borderBottomWidth: 1, borderBottomColor: '#E1EAFB' } : undefined}
                        >
                            <Car size={14} color="#4B5563" />
                            <Text className="text-gray-700 font-outfit-regular text-sm ml-2 flex-1" numberOfLines={1}>
                                {car}
                            </Text>
                        </View>
                    )}
                    {!!address && (
                        <View className="flex-row items-center px-4 py-3">
                            <MapPin size={14} color="#4B5563" />
                            <Text className="text-gray-700 font-outfit-regular text-sm ml-2 flex-1" numberOfLines={2}>
                                {address}
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {/* Actions */}
            <View className="flex-row gap-3">
                <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ flex: canCancel ? 0.7 : 1 }}>
                    <LinearGradient
                        colors={['#2B66F8', '#081E72']}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                            borderRadius: 10,
                            paddingVertical: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Text className="text-white font-outfit-bold text-center">
                            {t('dashboard.user.viewRequest')}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>

                {canCancel && (
                    <TouchableOpacity
                        onPress={onCancel}
                        activeOpacity={0.85}
                        className="items-center justify-center border-2"
                        style={{ flex: 0.3, borderRadius: 10, borderColor: '#FCA5A5', backgroundColor: '#FEF0F0' }}
                    >
                        <Text className="text-red-500 font-outfit-bold text-sm">
                            {t('dashboard.user.cancelRequest')}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            <Text className="text-gray-400 font-mono text-[10px] mt-3 text-right">#{id.slice(0, 8)}</Text>
        </View>
    );
}
