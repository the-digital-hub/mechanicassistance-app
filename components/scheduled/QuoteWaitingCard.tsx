import { Calendar, ChevronRight } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { AttentionTimer } from '@/components/dashboard/AttentionExtras';
import type { AssistanceRequest } from '@/lib/dao/interfaces';
import { refLabel } from '@/lib/refCode';
import { splitJobTitle } from '@/lib/ui/jobTitle';

/**
 * A scheduled request this technician already quoted, in "Your quotes": what it is, the vehicle, the amount sent and how long the customer
 * still has to decide. One button: it opens the sent quote, where it can also be edited.
 */
export function QuoteWaitingCard({ request, onOpen }: { request: AssistanceRequest; onOpen: (id: string) => void }) {
    const { t } = useTranslation();
    const issue = splitJobTitle(request.title).main || request.title;
    const price = request.myQuote?.price ? `$${Number(request.myQuote.price).toFixed(2)}` : null;
    return (
        <TouchableOpacity
            onPress={() => onOpen(request.id)}
            activeOpacity={0.85}
            accessibilityRole="button"
            className="bg-white"
            style={{ borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#EEF2FA', shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 }}
            testID={`quote-card-${request.id}`}
        >
            <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EDE9FE' }}>
                    <Calendar size={20} color="#7C3AED" />
                </View>
                <View className="flex-1" style={{ minWidth: 0 }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 0.8, color: '#6B7490' }}>{t('requestAssistance.header.scheduled').toUpperCase()}</Text>
                    <Text className="font-outfit-bold" style={{ fontSize: 17, lineHeight: 22, color: '#0B1530' }} numberOfLines={2}>{issue}</Text>
                </View>
            </View>

            {request.car ? <Text className="font-outfit-semibold" style={{ fontSize: 15, lineHeight: 21, color: '#0B1530', marginTop: 12 }} numberOfLines={1}>{request.car}</Text> : null}

            {price ? (
                <View style={{ marginTop: 10 }}>
                    <Text className="font-outfit-semibold" style={{ fontSize: 13, lineHeight: 17, color: '#6B7490' }}>{t('scheduledProvider.quoteCard.sent')}</Text>
                    <Text className="font-outfit-bold" style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.5, color: '#0B2A8E' }}>{price}</Text>
                </View>
            ) : null}

            {request.offersCloseAt ? <AttentionTimer spec={{ deadline: request.offersCloseAt, urgentUnderMinutes: 120, label: (time) => t('scheduledProvider.quoteCard.decides', { time }) }} /> : null}

            <View className="flex-row items-center justify-between" style={{ marginTop: 14 }}>
                <Text className="font-outfit-regular" style={{ fontSize: 12, lineHeight: 16, color: '#9CA3AF' }} selectable>{refLabel(request.refCode, request.id)}</Text>
                <View className="flex-row items-center" style={{ gap: 2, minHeight: 36, paddingLeft: 14, paddingRight: 8, borderRadius: 100, backgroundColor: '#EAF1FF' }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: '#1E56E3' }}>{t('scheduledProvider.quoteCard.open')}</Text>
                    <ChevronRight size={18} color="#1E56E3" />
                </View>
            </View>
        </TouchableOpacity>
    );
}
