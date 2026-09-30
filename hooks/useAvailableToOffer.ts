import { useMechanicStatus } from '@/context/MechanicStatusContext';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

/**
 * Makes sure an offline mechanic goes available before offering.
 *
 * An offline mechanic still sees the pending requests (so nothing that came in
 * while they were away is lost), but an offer from someone who is "not working"
 * would mislead the customer. Instead of blocking, this asks once and, on yes,
 * switches the status and lets the offer continue. Busy mechanics are not asked.
 *
 * Resolves true when the offer may proceed.
 */
export function useAvailableToOffer() {
    const { t } = useTranslation();
    const { mechanicStatus, setMechanicStatus } = useMechanicStatus();

    return useCallback((): Promise<boolean> => {
        if (mechanicStatus !== 'offline') return Promise.resolve(true);
        return new Promise((resolve) => {
            Alert.alert(
                t('requestDetail.offlineOfferTitle'),
                t('requestDetail.offlineOfferMessage'),
                [
                    { text: t('requestDetail.offlineOfferCancel'), style: 'cancel', onPress: () => resolve(false) },
                    {
                        text: t('requestDetail.offlineOfferConfirm'),
                        onPress: () => {
                            setMechanicStatus('available')
                                .then((applied) => resolve(applied === 'available'))
                                .catch(() => resolve(false));
                        },
                    },
                ],
                { cancelable: true, onDismiss: () => resolve(false) }
            );
        });
    }, [mechanicStatus, setMechanicStatus, t]);
}
