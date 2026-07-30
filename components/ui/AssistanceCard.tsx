import { Car, ClipboardList, Clock, MapPin, ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

export type AssistanceType = 'immediate' | 'scheduled' | 'videocall' | 'witness';

interface AssistanceCardProps {
    id: string;
    type: AssistanceType;
    assistanceType?: string;
    title: string;
    car: string;
    notes?: string;
    address: string;
    distance?: string;
    budget: string;
    onAccept: () => void;
    isAccepted?: boolean;
}

export function AssistanceCard({ id, type, assistanceType, title, car, notes, address, distance, budget, onAccept, isAccepted }: AssistanceCardProps) {
    const { t } = useTranslation();

    const getHeaderColor = () => {
        switch (type) {
            case 'immediate': return 'bg-blue-700';
            case 'witness': return 'bg-blue-700';
            case 'scheduled': return 'bg-blue-600';
            case 'videocall': return 'bg-cyan-500';
            default:
                if (assistanceType === 'witness') return 'bg-blue-700';
                return 'bg-blue-600';
        }
    };

    const getHeaderTitle = () => {
        if (assistanceType === 'witness') return t('assistanceCard.headerAccident');

        switch (type) {
            case 'immediate': return t('assistanceCard.headerImmediate');
            case 'witness': return t('assistanceCard.headerAccident');
            case 'scheduled': return t('assistanceCard.headerScheduled');
            case 'videocall': return t('assistanceCard.headerVideoCall');
            default: return t('assistanceCard.headerDefault');
        }
    };

    const getIcon = () => {
        if (assistanceType === 'witness' || type === 'witness') return <ShieldCheck size={16} color="white" />;
        switch (type) {
            case 'immediate': return <Clock size={16} color="white" />;
            case 'scheduled': return <ClipboardList size={16} color="white" />;
            case 'videocall': return <Clock size={16} color="white" />;
            default: return <Clock size={16} color="white" />;
        }
    }

    return (
        <View className="bg-blue-50 rounded-xl overflow-hidden mb-4 shadow-sm border border-gray-100">
            {/* Header */}
            <View className={`${getHeaderColor()} px-4 py-3 flex-row items-center gap-2`}>
                {getIcon()}
                <Text className="text-white font-outfit-bold text-base flex-1">{getHeaderTitle()}</Text>
                <Text className="text-white/70 font-mono text-[10px]">#{id.slice(0, 8)}</Text>
            </View>

            {/* Content Body */}
            <View className="p-4">
                <Text className="text-lg font-outfit-bold text-gray-900 mb-2">{title}</Text>

                <View className="flex-row items-center mb-1">
                    <Car size={14} color="#4B5563" />
                    <Text className="text-gray-700 text-sm font-outfit-regular ml-2">{car}</Text>
                </View>

                {notes && (
                    <View className="flex-row items-center mb-4">
                        <ClipboardList size={14} color="#4B5563" />
                        <Text className="text-gray-700 text-sm font-outfit-regular ml-2">{notes}</Text>
                    </View>
                )}

                {/* Large Map Placeholder */}
                <View className="h-32 bg-gray-100 rounded-lg mb-3 relative overflow-hidden border border-gray-200">
                    <View className="absolute top-0 left-0 w-full h-full opacity-30">
                        <View className="absolute inset-0 bg-gray-50" />
                        <View className="absolute top-[-20] left-[-20%] w-[150%] h-4 bg-white border-y border-gray-300 transform -rotate-12" />
                        <View className="absolute bottom-[-10] left-[-20%] w-[150%] h-4 bg-white border-y border-gray-300 transform rotate-6" />
                        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((p) => (
                            <View key={`v-${p}`} className="absolute top-0 w-px h-full bg-gray-300/50" style={{ left: `${p}%` }} />
                        ))}
                        {[10, 25, 40, 55, 70, 85].map((p) => (
                            <View key={`h-${p}`} className="absolute left-0 w-full h-px bg-gray-300/50" style={{ top: `${p}%` }} />
                        ))}
                        <View className="absolute top-[15%] right-[25%] w-8 h-12 bg-green-200/50 rounded-sm" />
                        <View className="absolute top-[45%] left-[10%] w-10 h-8 bg-green-200/50 rounded-sm" />
                        <View className="absolute bottom-[20%] right-[10%] w-14 h-10 bg-blue-100/50 rounded-sm" />
                        <View className="absolute top-[60%] left-[60%] w-6 h-6 bg-gray-300/50 rounded-sm" />
                    </View>
                    <View className="absolute top-1/2 left-1/2 transform -translate-x-2 -translate-y-4">
                        <View className="bg-white p-0.5 rounded-full shadow-sm">
                            <MapPin size={16} color="#0EA5E9" fill="#E0F2FE" />
                        </View>
                    </View>
                </View>

                {/* Footer Info */}
                <Text className="text-base font-outfit-medium text-gray-900 mb-1">{address}</Text>

                {distance && (
                    <View className="flex-row items-center mb-4">
                        <MapPin size={12} color="#6B7280" />
                        <Text className="text-gray-500 text-xs ml-1">{t('assistanceCard.distance', { distance })}</Text>
                    </View>
                )}

                {/* Action Buttons */}
                <View className="flex-row gap-3">
                    <View className="flex-1 bg-white border border-gray-200 rounded-lg py-2.5 items-center justify-center">
                        <Text className="text-blue-900 font-outfit-bold text-sm">{t('assistanceCard.budget', { budget })}</Text>
                    </View>

                    <TouchableOpacity
                        onPress={onAccept}
                        disabled={isAccepted}
                        className={`flex-1 rounded-lg py-2.5 items-center justify-center ${isAccepted ? 'bg-gray-300' : 'bg-emerald-500'}`}
                    >
                        <Text className="text-white font-outfit-bold text-sm">
                            {isAccepted ? t('assistanceCard.accepted') : t('assistanceCard.accept')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
