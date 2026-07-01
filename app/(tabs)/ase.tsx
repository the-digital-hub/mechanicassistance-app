import { AseDAO, UserCertificationsData } from '@/lib/dao/AseDAO';
import { useUser } from '@/context/UserContext';
import { ApiError } from '@/lib/api/types';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

export default function ASEScreen() {
    const { user } = useUser();
    const [data, setData] = useState<UserCertificationsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [notLinked, setNotLinked] = useState(false);

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

    const formatExpiration = (date: string | null) => {
        if (!date) return 'No expiration';
        return new Date(date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    };

    return (
        <ScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
            {/* Section Badge */}
            <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
              <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                ASE CERTIFICATIONS
              </Text>
            </View>

            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
              My ASE Certifications
            </Text>

            <Text className="text-gray-500 font-outfit-regular text-base mb-8">
              Certifications validated against ASE records for your member ID.
            </Text>

            {isLoading ? (
                <ActivityIndicator size="large" color="#0047AB" style={{ marginTop: 40 }} />
            ) : notLinked || !data ? (
                <View className="bg-white border border-gray-200 rounded-2xl p-6 items-center">
                    <View className="bg-blue-100 rounded-full w-12 h-12 items-center justify-center mb-4">
                        <Text className="text-blue-600 font-bold text-sm">ASE</Text>
                    </View>
                    <Text className="font-outfit-bold text-gray-900 text-base mb-2 text-center">No ASE membership linked</Text>
                    <Text className="text-gray-500 font-outfit-regular text-sm text-center">
                        Your account doesn't have an ASE Member ID associated yet. Contact support to add your membership.
                    </Text>
                </View>
            ) : (
                <>
                    <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-6">
                        <Text className="text-gray-500 font-outfit-regular text-xs mb-1">ASE Member ID</Text>
                        <Text className="text-[#0047AB] font-outfit-bold text-base">{data.aseId}</Text>
                        <Text className="text-gray-700 font-outfit-regular text-sm mt-1">
                            {data.firstName} {data.lastName}
                        </Text>
                    </View>

                    {data.certifications.length === 0 ? (
                        <Text className="text-gray-400 font-outfit-regular text-sm">No certifications found for this membership.</Text>
                    ) : (
                        <View className="gap-3">
                            {data.certifications.map((cert) => (
                                <View key={cert.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                                    <Text className="font-outfit-bold text-gray-900">
                                        {cert.code}{cert.name ? ` - ${cert.name}` : ''}
                                    </Text>
                                    <Text className="text-gray-500 text-xs mt-1">
                                        Expiration: {formatExpiration(cert.expirationDate)}
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
