import { useRouter } from 'expo-router';
import { RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';

import { useUser } from '@/context/UserContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { draftFromRequest, saveDraft } from '@/lib/scheduled/draft';
import { SC } from './ui';
import { appAlert } from '@/lib/ui/appAlert';

/** On a past scheduled request: opens the scheduling wizard seeded with the same vehicle, place and services. */
export function RequestAgainButton({ requestId }: { requestId: string }) {
    const { t } = useTranslation();
    const router = useRouter();
    const { user } = useUser();
    const [busy, setBusy] = useState(false);

    const press = async () => {
        if (!user?.id || busy) return;
        setBusy(true);
        try {
            const req = await assistanceDAO.getById(requestId);
            if (!req) throw new Error('request not found');
            await saveDraft(`user:${user.id}`, draftFromRequest(req));
            router.push({ pathname: '/request-assistance/scheduled' as any, params: { type: 'scheduled', entry: String(Date.now()) } });
        } catch (error) {
            console.error('Failed to start a new request from a past one:', error);
            appAlert(t('scheduled.requestAgain.error'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <TouchableOpacity
            onPress={press}
            disabled={busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            className="flex-row items-center justify-center"
            style={{ gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: SC.blue, backgroundColor: '#FFFFFF' }}
        >
            {busy ? <ActivityIndicator color={SC.blue} /> : <RotateCcw size={18} color={SC.blue} />}
            <Text className="font-outfit-bold" style={{ fontSize: 15, color: SC.blue }}>{t('scheduled.requestAgain.action')}</Text>
        </TouchableOpacity>
    );
}
