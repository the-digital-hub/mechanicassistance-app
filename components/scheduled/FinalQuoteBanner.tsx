import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, FileText } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { useSocket } from '@/context/SocketContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { money, quoteIsOpen } from '@/lib/scheduled/offers';
import { SC } from './ui';

/**
 * On an accepted scheduled service: shows a card when the provider proposed a final price that
 * waits for the owner's decision. Renders nothing otherwise (including on any error).
 */
export function FinalQuoteBanner({ requestId, enabled }: { requestId: string; enabled: boolean }) {
    const { t } = useTranslation();
    const router = useRouter();
    const { lastMessage } = useSocket();
    const [total, setTotal] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!enabled) return;
        try {
            const v = await assistanceDAO.getFinalQuote(requestId);
            setTotal(v && quoteIsOpen(v.quote.status, v.quote.expiresAt) ? v.customerTotal?.amount ?? '' : null);
        } catch {
            setTotal(null);
        }
    }, [requestId, enabled]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    useEffect(() => {
        if (lastMessage?.type === 'assistance_update') load();
    }, [lastMessage, load]);

    if (total === null) return null;

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/request-assistance/scheduled-final-quote' as any, params: { requestId } })}
            className="flex-row items-center"
            style={{ gap: 12, padding: 14, borderRadius: 16, backgroundColor: SC.amberSoft, borderWidth: 1, borderColor: '#F5D9A6' }}
        >
            <FileText size={22} color={SC.amberText} />
            <View className="flex-1">
                <Text className="font-outfit-bold" style={{ fontSize: 14, color: SC.amberText }}>{t('finalQuote.banner.title')}</Text>
                <Text className="font-outfit-regular" style={{ fontSize: 13, color: SC.amberText }}>
                    {total ? t('finalQuote.banner.withTotal', { total: money(total) }) : t('finalQuote.banner.sub')}
                </Text>
            </View>
            <ChevronRight size={18} color={SC.amberText} />
        </TouchableOpacity>
    );
}
