import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, Clock } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { FixedLocationMap } from '@/components/ui/FixedLocationMap';
import { useRequestRoute } from '@/hooks/useRequestRoute';
import type { AssistanceRequest } from '@/lib/dao/interfaces';

/**
 * The bottom of an immediate request's card: the zone on a small map, how far it is and how long it would take, and then the one
 * action ("Send offer") with Decline under it. What used to need a detail screen to see is here, so offering is one tap and one
 * confirmation instead of three steps.
 */
export function ImmediateOfferPanel({ request, onSend, onDecline }: {
    request: AssistanceRequest;
    onSend: (request: AssistanceRequest, eta: string | null) => void;
    onDecline: (id: string) => void;
}) {
    const { t } = useTranslation();
    const hasLocation = typeof request.locationLat === 'number' && typeof request.locationLng === 'number';
    const { distKm, etaText } = useRequestRoute(request.id, request.locationLat, request.locationLng);

    return (
        <View>
            {hasLocation ? (
                <View className="px-5 pb-1">
                    <FixedLocationMap latitude={request.locationLat as number} longitude={request.locationLng as number} approximate seed={request.id} height={110} />
                    <Text className="font-outfit-medium" style={{ fontSize: 13, color: '#8C96AE', marginTop: 6 }}>{t('appointments.list.card.approximateArea')}</Text>
                </View>
            ) : null}
            {etaText || distKm !== null ? (
                <View className="flex-row px-5 py-3" style={{ gap: 12 }}>
                    <View className="flex-1 flex-row items-center" style={{ gap: 10 }} testID="request-distance">
                        <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EAF1FF' }}>
                            <ArrowUpRight size={20} color="#1E56E3" />
                        </View>
                        <View>
                            <Text className="font-outfit-semibold text-xs tracking-widest" style={{ color: '#6B7490' }}>{t('requestDetail.distance')}</Text>
                            <Text className="font-outfit-bold text-lg" style={{ color: '#0B1530' }}>{distKm !== null ? `${(distKm * 0.621371).toFixed(1)} mi` : '—'}</Text>
                        </View>
                    </View>
                    <View className="flex-1 flex-row items-center" style={{ gap: 10 }} testID="request-eta">
                        <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EAF1FF' }}>
                            <Clock size={20} color="#1E56E3" />
                        </View>
                        <View>
                            <Text className="font-outfit-semibold text-xs tracking-widest" style={{ color: '#6B7490' }}>{t('requestDetail.eta')}</Text>
                            <Text className="font-outfit-bold text-lg" style={{ color: '#0B1530' }}>{etaText || '—'}</Text>
                        </View>
                    </View>
                </View>
            ) : null}

            <View className="gap-2 px-5 py-4 border-t border-gray-100">
                <TouchableOpacity onPress={() => onSend(request, etaText)} activeOpacity={0.8} accessibilityRole="button" testID="request-send-offer">
                    <LinearGradient
                        colors={['#10B981', '#047857']}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={{ borderRadius: 14, minHeight: 52, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Text className="text-white font-outfit-semibold text-lg">{t('requestDetail.confirmOffer')}</Text>
                    </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                    className="items-center justify-center"
                    style={{ minHeight: 52, borderRadius: 14, backgroundColor: '#E6EAF2' }}
                    activeOpacity={0.8}
                    onPress={() => onDecline(request.id)}
                    accessibilityRole="button"
                >
                    <Text className="font-outfit-semibold text-lg" style={{ color: '#4A5470' }}>{t('dashboard.mechanic.decline')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
