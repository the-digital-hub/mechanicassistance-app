import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View, Dimensions } from 'react-native';
import { AO } from '@/components/offer/OfferSections';
import { RequestObdPanel, useRequestObd } from './RequestObdPanel';
import { SHEET } from '@/lib/ui/sheet';
import { SheetHandle } from '@/components/ui/SheetHandle';
import { SlideModal } from '@/components/ui/SlideModal';

/**
 * The OBD scanner report over a live call, so neither side has to hang up to
 * read the codes. Same panel as the assistance's "OBD" tab.
 */
export function ObdCallSheet({ visible, requestId, role, state, onClose }: {
    visible: boolean;
    requestId: string;
    role: 'owner' | 'mechanic';
    state: ReturnType<typeof useRequestObd>;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    return (
        <SlideModal visible={visible} onClose={onClose} dim="rgba(0,0,0,0.4)">
            <View
                style={{ ...SHEET, backgroundColor: AO.page, paddingTop: 12, paddingBottom: 34, maxHeight: Dimensions.get('window').height * 0.75 }}
                testID="obd-call-sheet"
            >
                <SheetHandle />
                <Text className="font-outfit-bold" style={{ fontSize: 17, color: AO.text, paddingHorizontal: 20 }}>
                    {t('appointments.videoCall.obd.sheetTitle')}
                </Text>
                <ScrollView contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
                    <RequestObdPanel requestId={requestId} role={role} editable state={state} />
                </ScrollView>
            </View>
        </SlideModal>
    );
}
