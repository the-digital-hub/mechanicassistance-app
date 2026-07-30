import { Input } from '@/components/ui/Input';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, MapPin } from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';

export default function LocationAddressScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { type } = params;

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const getTitle = () => {
        switch (type) {
            case 'immediate': return t('requestAssistance.header.immediate');
            case 'scheduled': return t('requestAssistance.header.scheduled');
            case 'videocall': return t('requestAssistance.header.videoCall');
            case 'witness': return t('requestAssistance.header.accident');
            default: return t('requestAssistance.header.default');
        }
    };

    const getBadgeText = () => {
        switch (type) {
            case 'immediate': return t('requestAssistance.badge.immediate');
            case 'scheduled': return t('requestAssistance.badge.scheduled');
            case 'videocall': return t('requestAssistance.badge.videoCall');
            case 'witness': return t('requestAssistance.badge.accident');
            default: return t('requestAssistance.badge.default');
        }
    };

    const searchAddress = async (text: string) => {
        setQuery(text);
        if (text.length < 3) return;

        setIsSearching(true);
        try {
            // Bias the search with ", FL" and increase limit to get more candidates for local filtering
            const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(text + ", FL")}&limit=10`);
            const data = await response.json();

            // Filter results to only include Florida
            const flResults = (data.features || []).filter((f: any) => {
                const state = f.properties?.state?.toLowerCase();
                return state === 'florida' || state === 'fl';
            });

            setResults(flResults.slice(0, 5)); // Show top 5 FL results
        } catch (error) {
            console.error(error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelect = (feature: any) => {
        const { geometry, properties } = feature;
        const [lon, lat] = geometry.coordinates;

        // Include city and postcode in label for better display and parsing
        const addressLabel = `${properties.name || properties.street || ''}, ${properties.city || ''} ${properties.postcode || ''}`.trim();

        // Pass back to map
        router.push({
            pathname: '/request-assistance/location-map',
            params: {
                ...params,
                selectedAddress: JSON.stringify({
                    label: addressLabel,
                    lat,
                    lon,
                    zip: properties.postcode || '',
                    full: feature,
                })
            }
        });
    };

    return (
        <View className="flex-1 bg-white">
            {/* Custom Header */}
            <View className="px-6 pt-20 pb-2 flex-row items-center justify-between" style={{ backgroundColor: '#F4F5FA', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 3, borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
                        <ChevronLeft size={20} color="#0047AB" />
                    </View>
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>
                    {getTitle()}
                </Text>
                <View className="w-6" />
            </View>

            <View className="px-6 pt-6 pb-6">
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                        {getBadgeText()}
                    </Text>
                </View>

                <Text className="text-gray-900 font-outfit-medium text-3xl mb-2">{t('requestAssistance.locationAddress.title')}</Text>

                <Text className="text-gray-500 font-outfit-regular text-base mb-6">
                    {t('requestAssistance.locationAddress.subtitle')}
                </Text>

                <Input
                    value={query}
                    onChangeText={searchAddress}
                    placeholder={t('requestAssistance.locationAddress.placeholder')}
                    containerClassName="bg-gray-50 border-gray-200 mb-4"
                    autoFocus
                />

                {isSearching && <ActivityIndicator color="#0047AB" />}

                <FlatList
                    data={results}
                    keyExtractor={(item, index) => index.toString()}
                    scrollEnabled={false}
                    renderItem={({ item }) => {
                        const props = item.properties;
                        const mainText = props.name || props.street || '';
                        const subText = `${props.city || ''}, ${props.state || ''} ${props.postcode || ''}`;

                        return (
                            <TouchableOpacity
                                onPress={() => handleSelect(item)}
                                className="flex-row items-center py-4 border-b border-gray-50"
                            >
                                <View className="w-10 h-10 bg-blue-50 rounded-full justify-center items-center mr-4">
                                    <MapPin size={20} color="#0047AB" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-outfit-bold text-gray-900">{mainText}</Text>
                                    <Text className="font-outfit-regular text-gray-500 text-xs">{subText}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            </View>
        </View>
    );
}
