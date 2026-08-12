import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import type { ParsedAddress } from '@/lib/places';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

export default function LocationAddressScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { type } = params;

    const [query, setQuery] = useState('');

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

    const handleSelect = (address: ParsedAddress) => {
        const addressLabel =
            address.formatted ||
            `${address.street}, ${address.city} ${address.zip}`.trim();

        // `lat`/`lon` are the keys location-map already reads — keep them.
        router.push({
            pathname: '/request-assistance/location-map',
            params: {
                ...params,
                selectedAddress: JSON.stringify({
                    label: addressLabel,
                    lat: address.locationLat,
                    lon: address.locationLng,
                    zip: address.zip,
                    full: address,
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

                <AddressAutocomplete
                    value={query}
                    onChangeText={setQuery}
                    onSelect={handleSelect}
                    placeholder={t('requestAssistance.locationAddress.placeholder')}
                    containerClassName="bg-gray-50 border-gray-200"
                    autoFocus
                />
            </View>
        </View>
    );
}
