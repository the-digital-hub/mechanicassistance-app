import { Ionicons } from '@expo/vector-icons';
import { BadgeCheck, Camera, ClipboardCheck, IdCard, Lock, ScanFace } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { StepTips } from '@/components/setup/StepTips';
import { EmptyStateIcon } from '@/components/ui/EmptyStateIcon';
import { TYPE } from '@/lib/ui/type';

/**
 * "What happens next" of the identity check: a face being scanned with a lock on it (checked and kept safe), and the steps as tips
 * (have your driver's license at hand, scan it, a selfie, the result). The same in the sign-up step and in the Verify identity screen.
 */
export function IdentitySteps() {
    const { t } = useTranslation();
    return (
        <View className="mb-5" style={{ backgroundColor: '#F4F8FF', borderRadius: 16, borderWidth: 1, borderColor: '#E1EAFB', padding: 16 }}>
            <View className="items-center" style={{ marginBottom: 14 }}>
                <View style={{ width: 112, height: 112 }}>
                    <EmptyStateIcon icon={ScanFace} />
                    <View
                        className="items-center justify-center"
                        style={{ position: 'absolute', right: 6, bottom: 8, width: 34, height: 34, borderRadius: 17, backgroundColor: '#1E56E3', borderWidth: 3, borderColor: '#F4F8FF' }}
                        testID="identity-lock"
                    >
                        <Lock size={16} color="#FFFFFF" />
                    </View>
                </View>
            </View>
            <Text className="font-outfit-semibold mb-3 text-center" style={{ ...TYPE.body, color: '#0B1530' }}>
                {t('setup.identity.stepsIntro')}
            </Text>
            <StepTips
                testID="identity-steps"
                steps={[
                    { key: 'ready', icon: ClipboardCheck, label: t('setup.identity.labelReady'), text: t('setup.identity.stepReady') },
                    { key: 'doc', icon: IdCard, label: t('setup.identity.labelDoc'), text: t('setup.identity.step1') },
                    { key: 'selfie', icon: Camera, label: t('setup.identity.labelSelfie'), text: t('setup.identity.step2') },
                    { key: 'result', icon: BadgeCheck, label: t('setup.identity.labelResult'), text: t('setup.identity.step3') },
                ]}
            />
        </View>
    );
}

/**
 * "Before you start": who processes the ID and what is kept, and the box to say it was understood. Consent lives in our product, not in
 * the SDK: Didit's docs are explicit that creating a session does not by itself prove the user was told what happens to their data.
 * `checkbox` off: only the information (a session that is picked up again, where it was already accepted).
 */
export function IdentityConsent({ checked, onToggle, checkbox = true }: { checked: boolean; onToggle: () => void; checkbox?: boolean }) {
    const { t } = useTranslation();
    return (
        <View className="bg-white" style={{ borderRadius: 16, borderWidth: 1, borderColor: '#EEF2FA', padding: 16 }}>
            <Text className="font-outfit-semibold mb-2" style={{ ...TYPE.body, color: '#0B1530' }}>
                {t('setup.identity.consentTitle')}
            </Text>
            <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490', marginBottom: checkbox ? 16 : 0 }}>
                {t('setup.identity.consentBody')}
            </Text>
            {checkbox ? (
                <TouchableOpacity onPress={onToggle} activeOpacity={0.7} className="flex-row items-center gap-3" accessibilityRole="checkbox" accessibilityState={{ checked }}>
                    <View className="w-6 h-6 rounded-md justify-center items-center border-2" style={{ borderColor: checked ? '#0047AB' : '#CBD5E1', backgroundColor: checked ? '#0047AB' : 'transparent' }}>
                        {checked && <Ionicons name="checkmark" size={16} color="white" />}
                    </View>
                    <Text className="font-outfit-regular flex-1" style={{ ...TYPE.helper, color: '#0B1530' }}>
                        {t('setup.identity.accept')}
                    </Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}
