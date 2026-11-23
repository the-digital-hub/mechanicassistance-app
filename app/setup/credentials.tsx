import { Input } from '@/components/ui/Input';
import { AseDAO, AseVerifyResult } from '@/lib/dao/AseDAO';
import { ApiError } from '@/lib/api/types';
import { formatAseId, isCompleteAseId, toAseIdRaw } from '@/lib/ase-id';
import { getSetupProgress, saveSetupProgress } from '@/lib/storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Info, User } from 'lucide-react-native';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SETUP_BG, SetupFooter, SetupHeading } from '@/components/setup/SetupKit';
import { TYPE } from '@/lib/ui/type';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';

export default function CredentialsScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const [aseId, setAseId] = useState('');
    const [verified, setVerified] = useState<AseVerifyResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // The ASE record is matched against the name entered on the basic-info
    // step, so an ID registered to somebody else is rejected.
    const [name, setName] = useState('');
    const [surname, setSurname] = useState('');

    useEffect(() => {
        (async () => {
            const progress = await getSetupProgress();
            const basicInfo = (progress.basicInfo ?? {}) as Record<string, unknown>;
            setName(typeof basicInfo.name === 'string' ? basicInfo.name : '');
            setSurname(typeof basicInfo.surname === 'string' ? basicInfo.surname : '');
        })();
    }, []);

    // `aseId` holds the raw characters; the input renders the masked value.
    const maskedAseId = formatAseId(aseId);
    const canSearch = isCompleteAseId(aseId) && !!name.trim() && !!surname.trim();

    // Only mechanics reach this screen (address.tsx branches on role).
    const goToNextStep = () => router.push('/setup/availability');

    const handleSearch = async () => {
        if (!canSearch) return;
        setIsLoading(true);
        setError(null);
        setVerified(null);
        try {
            const result = await AseDAO.verify(maskedAseId, name.trim(), surname.trim());
            if (result.matched) {
                setVerified(result);
            } else {
                // The ID exists but is registered to a different name.
                setError(t('setup.credentials.mismatch'));
            }
        } catch (err) {
            // So the real cause (status, backend code, message) is in the log, not just "an error occurred".
            console.warn('[credentials] ASE verify failed', err instanceof ApiError ? { status: err.statusCode, message: err.apiMessage, detail: err.apiError } : err);
            if (err instanceof ApiError && err.statusCode === 404) {
                setError(t('setup.credentials.notFound'));
            } else if (err instanceof ApiError && err.statusCode === 403) {
                // The sign-up token is not accepted on this route yet (backlog AO): say so, and that it can be done later.
                setError(t('setup.credentials.unavailable'));
            } else {
                setError(t('setup.credentials.searchError'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleContinue = async () => {
        await saveSetupProgress('credentials', { aseId: verified?.aseId ?? maskedAseId, validated: true });
        goToNextStep();
    };

    /**
     * Skips ASE verification. The account is created with aseStatus "pending"
     * and the mechanic finishes later from the ASE screen, prompted by the
     * badge on their profile.
     */
    const handleSkip = async () => {
        await saveSetupProgress('credentials', { skipped: true });
        goToNextStep();
    };

    const formatExpiration = (date: string | null) => {
        if (!date) return t('setup.credentials.noExpiration');
        return new Date(date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    };

    const card = { padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF2FA' } as const;

    return (
        <View className="flex-1" style={{ backgroundColor: SETUP_BG }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <KeyboardAwareScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingTop: 18, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
                    <SetupHeading screen="credentials" badge={t('setup.credentials.badge')} title={t('setup.credentials.title')} subtitle={t('setup.credentials.subtitle')} />

                    {/* ASE Logo Area */}
                    <View style={{ ...card, marginBottom: 20 }}>
                        <View className="flex-row items-center mb-3">
                            <View className="bg-blue-600 rounded-full w-10 h-10 items-center justify-center mr-3">
                                <Text className="text-white font-outfit-bold" style={TYPE.caption}>ASE</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="font-outfit-bold" style={{ ...TYPE.caption, color: '#0B1530' }}>{t('setup.credentials.instituteLine1')}</Text>
                                <Text className="font-outfit-bold uppercase" style={{ ...TYPE.caption, color: '#0B1530' }}>{t('setup.credentials.instituteLine2')}</Text>
                            </View>
                        </View>

                        <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490' }}>
                            {t('setup.credentials.description')}
                        </Text>
                    </View>

                    {!verified ? (
                        <View>
                            {/* One card: the ID and, right under it, the name it has to match. */}
                            <View style={{ padding: 16, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF2FA' }} testID="ase-id-card">
                            <Text className="font-outfit-semibold" style={{ ...TYPE.body, color: '#0B1530', marginBottom: 8 }}>{t('setup.credentials.memberIdLabel')}</Text>
                            <Input
                                placeholder="ASE-XXXX-XXXX"
                                value={maskedAseId}
                                onChangeText={(text) => { setAseId(toAseIdRaw(text)); setError(null); }}
                                containerClassName="bg-[#F6F8FC] border border-[#E4EAF5] rounded-[14px]"
                                autoCorrect={false}
                                keyboardType="number-pad"
                                maxLength={13}
                            />

                                {(name || surname) ? (
                                    <View className="flex-row items-center" style={{ gap: 12, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#EEF2FA' }} testID="ase-holder">
                                        <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EAF1FF' }}>
                                            <User size={20} color="#1E56E3" />
                                        </View>
                                        <View className="flex-1" style={{ minWidth: 0 }}>
                                            <Text className="font-outfit-semibold" style={{ ...TYPE.caption, color: '#6B7490' }}>{t('setup.credentials.holderLabel')}</Text>
                                            <Text className="font-outfit-bold" style={{ ...TYPE.body, color: '#0B1530' }} numberOfLines={1}>{[name, surname].filter(Boolean).join(' ')}</Text>
                                            <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490' }}>{t('setup.credentials.holderHint')}</Text>
                                        </View>
                                    </View>
                                ) : null}
                            </View>

                            {/* The problem, as an alert row: icon tile, soft red, readable. */}
                            {error && (
                                <View className="flex-row items-center" style={{ gap: 12, marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FBD5D5' }} testID="ase-error">
                                    <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FDE2E2' }}>
                                        <AlertCircle size={22} color="#DC2626" />
                                    </View>
                                    <Text className="flex-1 font-outfit-semibold" style={{ ...TYPE.helper, color: '#B42318' }}>{error}</Text>
                                </View>
                            )}

                            {/* The way out: a minimal soft badge, icon and one line. */}
                            <View className="flex-row items-center self-start" style={{ gap: 8, marginTop: 14, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: '#EAF1FF' }} testID="ase-later-hint">
                                <Info size={16} color="#1E56E3" />
                                <Text className="flex-shrink font-outfit-semibold" style={{ ...TYPE.helper, color: '#1E56E3' }}>{t('setup.credentials.skipHint')}</Text>
                            </View>
                        </View>
                    ) : (
                        <View>
                            <View style={{ ...card, marginBottom: 16 }}>
                                <Text className="font-outfit-semibold" style={{ ...TYPE.helper, color: '#6B7490', marginBottom: 2 }}>{t('setup.credentials.memberIdLabel')}</Text>
                                <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, color: '#1E56E3' }}>{verified.aseId}</Text>
                            </View>

                            <View style={{ gap: 12 }}>
                                {(verified.certifications ?? []).length === 0 ? (
                                    <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490' }}>{t('setup.credentials.noCertifications')}</Text>
                                ) : (
                                    (verified.certifications ?? []).map((cert) => (
                                        <View key={cert.id} style={{ padding: 16, borderRadius: 16, backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#E1EAFB' }}>
                                            <Text className="font-outfit-bold" style={{ ...TYPE.body, color: '#0B1530', marginBottom: 2 }}>
                                                {cert.code}{cert.name ? ` - ${cert.name}` : ''}
                                            </Text>
                                            <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490' }}>
                                                {t('setup.credentials.expiration', { date: formatExpiration(cert.expirationDate) })}
                                            </Text>
                                        </View>
                                    ))
                                )}
                            </View>
                        </View>
                    )}
                </KeyboardAwareScrollView>

                {!verified ? (
                    <SetupFooter
                        label={t('setup.credentials.searchButton')}
                        onPress={handleSearch}
                        disabled={!canSearch}
                        loading={isLoading}
                        secondaryLabel={t('setup.credentials.skipButton')}
                        onSecondary={handleSkip}
                        secondaryDisabled={isLoading}
                    />
                ) : (
                    <SetupFooter
                        label={t('setup.credentials.validateButton')}
                        onPress={handleContinue}
                        secondaryLabel={t('setup.credentials.searchDifferent')}
                        onSecondary={() => setVerified(null)}
                    />
                )}
            </KeyboardAvoidingView>
        </View>
    );
}
