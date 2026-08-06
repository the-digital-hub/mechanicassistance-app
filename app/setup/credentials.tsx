import { Input } from '@/components/ui/Input';
import { AseDAO, AseMechanicData } from '@/lib/dao/AseDAO';
import { ApiError } from '@/lib/api/types';
import { getSetupProgress, saveSetupProgress } from '@/lib/storage';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function CredentialsScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const [aseId, setAseId] = useState('');
    const [mechanic, setMechanic] = useState<AseMechanicData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async () => {
        if (!aseId.trim()) return;
        setIsLoading(true);
        setError(null);
        setMechanic(null);
        try {
            const result = await AseDAO.lookupByAseId(aseId.trim());
            setMechanic(result);
        } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
                setError(t('setup.credentials.notFound'));
            } else {
                setError(t('setup.credentials.searchError'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleContinue = async () => {
        await saveSetupProgress('credentials', { aseId: mechanic?.aseId ?? aseId, validated: !!mechanic });
        const progress = await getSetupProgress();
        const role = (progress.role as Record<string, unknown>)?.role;

        if (role === 'mechanic') {
            router.push('/setup/availability');
        } else {
            router.push('/setup/vehicle-info');
        }
    };

    const formatExpiration = (date: string | null) => {
        if (!date) return t('setup.credentials.noExpiration');
        return new Date(date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    };

    return (
        <ScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
            {/* Section Badge */}
            <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
              <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                {t('setup.credentials.badge')}
              </Text>
            </View>

            {/* Title */}
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
              {t('setup.credentials.title')}
            </Text>

            {/* Subtitle */}
            <Text className="text-gray-500 font-outfit-regular text-base mb-8">
              {t('setup.credentials.subtitle')}
            </Text>

            {/* ASE Logo Area */}
            <View className="mb-6">
                <View className="flex-row items-center mb-4">
                    <View className="bg-blue-600 rounded-full w-10 h-10 items-center justify-center mr-2">
                        <Text className="text-white font-bold text-xs">ASE</Text>
                    </View>
                    <View>
                        <Text className="font-bold text-xs text-gray-800">{t('setup.credentials.instituteLine1')}</Text>
                        <Text className="font-bold text-xs text-gray-800 uppercase">{t('setup.credentials.instituteLine2')}</Text>
                    </View>
                </View>

                <Text className="text-[#0F172A] font-outfit-regular text-sm mb-6">
                    {t('setup.credentials.description')}
                </Text>
            </View>

            {!mechanic ? (
                <View>
                    <Text className="font-outfit-medium text-[#0F172A] mb-2">{t('setup.credentials.memberIdLabel')}</Text>
                    <Input
                        placeholder="ASE-XXXX-XXXX"
                        value={aseId}
                        onChangeText={(text) => { setAseId(text); setError(null); }}
                        containerClassName="bg-white border border-gray-300 rounded-2xl mb-4"
                        autoCapitalize="characters"
                    />

                    {error && (
                        <Text className="text-red-500 font-outfit-regular text-sm mb-4">{error}</Text>
                    )}

                    <TouchableOpacity
                        onPress={handleSearch}
                        activeOpacity={0.8}
                        disabled={isLoading || !aseId.trim()}
                    >
                        <LinearGradient
                            colors={['#2B66F8', '#081E72']}
                            start={{ x: 0, y: 1 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                borderRadius: 10,
                                paddingVertical: 16,
                                paddingHorizontal: 16,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: isLoading || !aseId.trim() ? 0.6 : 1,
                            }}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Text className="text-white font-outfit-bold text-center mr-2">{t('setup.credentials.searchButton')}</Text>
                                    <ChevronRight size={20} color="white" />
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            ) : (
                <View>
                    <Text className="font-outfit-medium text-[#0F172A] mb-1">{t('setup.credentials.memberIdLabel')}</Text>
                    <Text className="text-[#0047AB] font-outfit-medium text-base mb-2">{mechanic.aseId}</Text>
                    <Text className="text-gray-500 font-outfit-regular text-sm mb-6">
                        {mechanic.firstName} {mechanic.lastName}
                    </Text>

                    <View className="space-y-4 mb-8">
                        {mechanic.certifications.length === 0 ? (
                            <Text className="text-gray-400 font-outfit-regular text-sm">{t('setup.credentials.noCertifications')}</Text>
                        ) : (
                            mechanic.certifications.map((cert) => (
                                <View key={cert.id} className="bg-blue-50/50 p-4 rounded-xl">
                                    <Text className="font-outfit-bold text-[#0F172A] mb-1">
                                        {cert.code}{cert.name ? ` - ${cert.name}` : ''}
                                    </Text>
                                    <Text className="text-blue-400 text-xs">
                                        {t('setup.credentials.expiration', { date: formatExpiration(cert.expirationDate) })}
                                    </Text>
                                </View>
                            ))
                        )}
                    </View>

                    <TouchableOpacity
                        onPress={() => setMechanic(null)}
                        activeOpacity={0.8}
                        className="mb-3"
                    >
                        <Text className="text-blue-600 font-outfit-medium text-center text-sm">{t('setup.credentials.searchDifferent')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleContinue}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={['#2B66F8', '#081E72']}
                            start={{ x: 0, y: 1 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                borderRadius: 10,
                                paddingVertical: 16,
                                paddingHorizontal: 16,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Text className="text-white font-outfit-bold text-center mr-2">{t('setup.credentials.validateButton')}</Text>
                            <ChevronRight size={20} color="white" />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
}
