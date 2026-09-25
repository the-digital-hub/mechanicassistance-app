import { AvailabilityForm } from '@/components/availability/AvailabilityForm';
import {
    availabilityFromUser,
    baseLocationFromAddresses,
    type AvailabilityValue,
} from '@/components/availability/availabilityUtils';
import { useUser } from '@/context/UserContext';
import { userDAO } from '@/lib/dao/UserDAO';
import type { UserData } from '@/lib/dao/interfaces';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, View } from 'react-native';

/**
 * The signup availability step, reopened from the mechanic's profile: same
 * form, hydrated from the account and saved straight to the API.
 */
export default function ProfileAvailabilityScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { user, updateUser } = useUser();
    // Fetched fresh: the cached session user can predate the rows this screen
    // edits, and showing stale hours would let a save overwrite newer ones.
    const [account, setAccount] = useState<UserData | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const userId = user?.id;

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;

        (async () => {
            try {
                const fresh = await userDAO.getById(userId);
                if (!cancelled) setAccount(fresh ?? user);
            } catch {
                if (!cancelled) setAccount(user);
            }
        })();

        return () => {
            cancelled = true;
        };
        // `user` changes identity on every update; the id is what matters here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const handleSubmit = async (value: AvailabilityValue) => {
        if (!userId) return;
        setIsSaving(true);
        try {
            await userDAO.updateAvailability(userId, value);
            // Keep the session copy in step with what was just stored.
            const fresh = await userDAO.getById(userId).catch(() => null);
            if (fresh) {
                await updateUser(
                    {
                        mechanicAvailabilities: fresh.mechanicAvailabilities,
                        mechanicDetails: fresh.mechanicDetails,
                    },
                    false,
                );
            }
            Alert.alert(
                t('profile.availabilityScreen.savedTitle'),
                t('profile.availabilityScreen.savedMessage'),
                [{ text: t('profile.availabilityScreen.ok'), onPress: () => router.navigate('/(tabs)') }],
            );
        } catch {
            Alert.alert(
                t('profile.availabilityScreen.saveErrorTitle'),
                t('profile.availabilityScreen.saveErrorMessage'),
            );
        } finally {
            setIsSaving(false);
        }
    };

    if (!account) {
        return (
            <View className="flex-1 bg-[#EEF2FF] items-center justify-center">
                <ActivityIndicator color="#0047AB" />
            </View>
        );
    }

    return (
        <AvailabilityForm
            initialValue={availabilityFromUser(account)}
            baseLocation={baseLocationFromAddresses(account.addresses)}
            onEditLocation={() => router.push('/(tabs)/addresses')}
            submitLabel={t('setup.availability.saveChanges')}
            submitting={isSaving}
            onSubmit={handleSubmit}
        />
    );
}
