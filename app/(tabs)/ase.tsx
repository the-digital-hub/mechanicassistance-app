import { Input } from '@/components/ui/Input';
import { AseDAO, AseMechanicData, UserCertificationsData } from '@/lib/dao/AseDAO';
import { useUser } from '@/context/UserContext';
import { ApiError } from '@/lib/api/types';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';

export default function ASEScreen() {
    const { t } = useTranslation();
    const { user } = useUser();
    const [data, setData] = useState<UserCertificationsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [notLinked, setNotLinked] = useState(false);

    // Input+lookup state (shown when not linked)
    const [aseId, setAseId] = useState('');
    const [mechanic, setMechanic] = useState<AseMechanicData | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isAssociating, setIsAssociating] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    useEffect(() => {
        if (!user?.id) {
            setIsLoading(false);
            return;
        }
        AseDAO.getUserCertifications(user.id)
            .then(setData)
            .catch((err) => {
                if (err instanceof ApiError && err.status === 404) {
                    setNotLinked(true);
                }
            })
            .finally(() => setIsLoading(false));
    }, [user?.id]);

    const handleSearch = async () => {
        if (!aseId.trim()) return;
        setIsSearching(true);
        setSearchError(null);
        setMechanic(null);
        try {
            const result = await AseDAO.lookupByAseId(aseId.trim());
            setMechanic(result);
        } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
                setSearchError(t('ase.notFound'));
            } else {
                setSearchError(t('ase.searchError'));
            }
        } finally {
            setIsSearching(false);
        }
    };

    const handleAssociate = async () => {
        if (!user?.id || !mechanic) return;
        setIsAssociating(true);
        setSearchError(null);
        try {
            await AseDAO.associate(user.id, mechanic.aseId);
            const certifications = await AseDAO.getUserCertifications(user.id);
            setData(certifications);
            setNotLinked(false);
        } catch (err) {
            setSearchError(t('ase.linkFailed'));
        } finally {
            setIsAssociating(false);
        }
    };

    const formatExpiration = (date: string | null) => {
        if (!date) return t('ase.noExpiration');
        return new Date(date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    };

    return (
        <ScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
            {/* Section Badge */}
            <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
              <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                {t('ase.badge')}
              </Text>
            </View>

            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
              {t('ase.title')}
            </Text>

            <Text className="text-gray-500 font-outfit-regular text-base mb-8">
              {t('ase.subtitle')}
            </Text>

            {isLoading ? (
                <ActivityIndicator size="large" color="#0047AB" style={{ marginTop: 40 }} />
            ) : notLinked || !data ? (
                <View>
                    {/* ASE branding */}
                    <View className="flex-row items-center mb-6">
                        <View className="bg-blue-600 rounded-full w-10 h-10 items-center justify-center mr-3">
                            <Text className="text-white font-bold text-xs">ASE</Text>
                        </View>
                        <View>
                            <Text className="font-bold text-xs text-gray-800">{t('ase.instituteLine1')}</Text>
                            <Text className="font-bold text-xs text-gray-800 uppercase">{t('ase.instituteLine2')}</Text>
                        </View>
                    </View>

                    <Text className="text-[#0F172A] font-outfit-regular text-sm mb-6">
                        {t('ase.description')}
                    </Text>

                    {!mechanic ? (
                        <View>
                            <Text className="font-outfit-medium text-[#0F172A] mb-2">{t('ase.memberIdLabel')}</Text>
                            <Input
                                placeholder="ASE-XXXX-XXXX"
                                value={aseId}
                                onChangeText={(text) => { setAseId(text); setSearchError(null); }}
                                containerClassName="bg-white border border-gray-300 rounded-2xl mb-4"
                                autoCapitalize="characters"
                            />

                            {searchError && (
                                <Text className="text-red-500 font-outfit-regular text-sm mb-4">{searchError}</Text>
                            )}

                            <TouchableOpacity
                                onPress={handleSearch}
                                activeOpacity={0.8}
                                disabled={isSearching || !aseId.trim()}
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
                                        opacity: isSearching || !aseId.trim() ? 0.6 : 1,
                                    }}
                                >
                                    {isSearching ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <Text className="text-white font-outfit-bold text-center mr-2">{t('ase.searchButton')}</Text>
                                            <ChevronRight size={20} color="white" />
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View>
                            <Text className="font-outfit-medium text-[#0F172A] mb-1">{t('ase.memberIdLabel')}</Text>
                            <Text className="text-[#0047AB] font-outfit-medium text-base mb-1">{mechanic.aseId}</Text>
                            <Text className="text-gray-500 font-outfit-regular text-sm mb-6">
                                {mechanic.firstName} {mechanic.lastName}
                            </Text>

                            <View className="space-y-4 mb-8">
                                {mechanic.certifications.length === 0 ? (
                                    <Text className="text-gray-400 font-outfit-regular text-sm">{t('ase.noCertifications')}</Text>
                                ) : (
                                    mechanic.certifications.map((cert) => (
                                        <View key={cert.id} className="bg-blue-50/50 p-4 rounded-xl">
                                            <Text className="font-outfit-bold text-[#0F172A] mb-1">
                                                {cert.code}{cert.name ? ` - ${cert.name}` : ''}
                                            </Text>
                                            <Text className="text-blue-400 text-xs">
                                                {t('ase.expiration', { date: formatExpiration(cert.expirationDate) })}
                                            </Text>
                                        </View>
                                    ))
                                )}
                            </View>

                            {searchError && (
                                <Text className="text-red-500 font-outfit-regular text-sm mb-4">{searchError}</Text>
                            )}

                            <TouchableOpacity
                                onPress={() => { setMechanic(null); setSearchError(null); }}
                                activeOpacity={0.8}
                                className="mb-3"
                            >
                                <Text className="text-blue-600 font-outfit-medium text-center text-sm">{t('ase.searchDifferent')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleAssociate}
                                activeOpacity={0.8}
                                disabled={isAssociating}
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
                                        opacity: isAssociating ? 0.6 : 1,
                                    }}
                                >
                                    {isAssociating ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <Text className="text-white font-outfit-bold text-center mr-2">{t('ase.linkButton')}</Text>
                                            <ChevronRight size={20} color="white" />
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            ) : (
                <>
                    <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-6">
                        <Text className="text-gray-500 font-outfit-regular text-xs mb-1">{t('ase.memberIdLabel')}</Text>
                        <Text className="text-[#0047AB] font-outfit-bold text-base">{data.aseId}</Text>
                        <Text className="text-gray-700 font-outfit-regular text-sm mt-1">
                            {data.firstName} {data.lastName}
                        </Text>
                    </View>

                    {data.certifications.length === 0 ? (
                        <Text className="text-gray-400 font-outfit-regular text-sm">{t('ase.noCertificationsMembership')}</Text>
                    ) : (
                        <View className="gap-3">
                            {data.certifications.map((cert) => (
                                <View key={cert.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                                    <Text className="font-outfit-bold text-gray-900">
                                        {cert.code}{cert.name ? ` - ${cert.name}` : ''}
                                    </Text>
                                    <Text className="text-gray-500 text-xs mt-1">
                                        {t('ase.expiration', { date: formatExpiration(cert.expirationDate) })}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </>
            )}
        </ScrollView>
    );
}
