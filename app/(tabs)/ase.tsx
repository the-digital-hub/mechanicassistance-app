import { TYPE } from '@/lib/ui/type';
import { Input } from '@/components/ui/Input';
import { AseDAO, AseVerifyResult, UserCertificationsData } from '@/lib/dao/AseDAO';
import { useUser } from '@/context/UserContext';
import { ApiError } from '@/lib/api/types';
import { formatAseId, isCompleteAseId, toAseIdRaw } from '@/lib/ase-id';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { AlertCircle, User } from 'lucide-react-native';
import { SETUP_BG, SetupFooter, SetupHeading } from '@/components/setup/SetupKit';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';

export default function ASEScreen() {
    const { t } = useTranslation();
    const { user, updateUser } = useUser();
    const [data, setData] = useState<UserCertificationsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [notLinked, setNotLinked] = useState(false);

    // Input+lookup state (shown when not linked)
    const [aseId, setAseId] = useState('');
    const [verified, setVerified] = useState<AseVerifyResult | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isAssociating, setIsAssociating] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    useEffect(() => {
        if (!user?.id) {
            setIsLoading(false);
            return;
        }
        AseDAO.getUserCertifications(user.id)
            .then(setData)
            .catch((err) => {
                if (err instanceof ApiError && err.statusCode === 404) {
                    setNotLinked(true);
                }
            })
            .finally(() => setIsLoading(false));
    }, [user?.id]);

    // The ASE record must belong to the name on the account, so an ID that is
    // registered to somebody else is rejected instead of linked.
    // `aseId` holds the raw characters; the input renders the masked value.
    const maskedAseId = formatAseId(aseId);
    const canSearch = isCompleteAseId(aseId) && !!user?.name?.trim() && !!user?.surname?.trim();

    const handleSearch = async () => {
        if (!canSearch || !user) return;
        setIsSearching(true);
        setSearchError(null);
        setVerified(null);
        try {
            const result = await AseDAO.verify(maskedAseId, user.name.trim(), user.surname.trim());
            if (result.matched) {
                setVerified(result);
            } else {
                setSearchError(t('ase.mismatch'));
            }
        } catch (err) {
            if (err instanceof ApiError && err.statusCode === 404) {
                setSearchError(t('ase.notFound'));
            } else {
                setSearchError(t('ase.searchError'));
            }
        } finally {
            setIsSearching(false);
        }
    };

    const handleAssociate = async () => {
        if (!user?.id || !verified?.aseId) return;
        setIsAssociating(true);
        setSearchError(null);
        try {
            // users-service links the record and flips aseStatus, returning the
            // refreshed user — which is what clears the profile badge.
            const updated = await AseDAO.linkForUser(user.id, verified.aseId);
            await updateUser({ mechanicDetails: updated.mechanicDetails }, false);
            const certifications = await AseDAO.getUserCertifications(user.id);
            setData(certifications);
            setNotLinked(false);
        } catch (err) {
            setSearchError(t('ase.linkFailed'));
        } finally {
            setIsAssociating(false);
        }
    };

    const formatExpiration = (date: string | null) => {
        if (!date) return t('ase.noExpiration');
        return new Date(date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    };

    const card = { padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF2FA' } as const;
    const holder = [user?.name, user?.surname].filter(Boolean).join(' ');
    const linked = !isLoading && !(notLinked || !data);

    return (
        <View className="flex-1" style={{ backgroundColor: SETUP_BG }}>
            <KeyboardAwareScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingTop: 32, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
                <SetupHeading badge={t('ase.badge')} title={t('ase.title')} subtitle={t('ase.subtitle')} />

                {isLoading ? (
                    <ActivityIndicator size="large" color="#0047AB" style={{ marginTop: 40 }} />
                ) : notLinked || !data ? (
                    <View>
                        {/* ASE branding */}
                        <View style={{ ...card, marginBottom: 20 }}>
                            <View className="flex-row items-center mb-3">
                                <View className="bg-blue-600 rounded-full w-10 h-10 items-center justify-center mr-3">
                                    <Text className="text-white font-outfit-bold" style={TYPE.caption}>ASE</Text>
                                </View>
                                <View className="flex-1">
                                    <Text className="font-outfit-bold" style={{ ...TYPE.caption, color: '#0B1530' }}>{t('ase.instituteLine1')}</Text>
                                    <Text className="font-outfit-bold uppercase" style={{ ...TYPE.caption, color: '#0B1530' }}>{t('ase.instituteLine2')}</Text>
                                </View>
                            </View>
                            <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490' }}>{t('ase.description')}</Text>
                        </View>

                        {!verified ? (
                            <View style={{ padding: 16, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF2FA' }}>
                                <Text className="font-outfit-semibold" style={{ ...TYPE.body, color: '#0B1530', marginBottom: 8 }}>{t('ase.memberIdLabel')}</Text>
                                <Input
                                    placeholder="ASE-XXXX-XXXX"
                                    value={maskedAseId}
                                    onChangeText={(text) => { setAseId(toAseIdRaw(text)); setSearchError(null); }}
                                    containerClassName="bg-[#F6F8FC] border border-[#E4EAF5] rounded-[14px]"
                                    autoCorrect={false}
                                    keyboardType="number-pad"
                                    maxLength={13}
                                />
                                {holder ? (
                                    <View className="flex-row items-center" style={{ gap: 12, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#EEF2FA' }}>
                                        <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EAF1FF' }}>
                                            <User size={20} color="#1E56E3" />
                                        </View>
                                        <View className="flex-1" style={{ minWidth: 0 }}>
                                            <Text className="font-outfit-semibold" style={{ ...TYPE.caption, color: '#6B7490' }}>{t('setup.credentials.holderLabel')}</Text>
                                            <Text className="font-outfit-bold" style={{ ...TYPE.body, color: '#0B1530' }} numberOfLines={1}>{holder}</Text>
                                            <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490' }}>{t('setup.credentials.holderHint')}</Text>
                                        </View>
                                    </View>
                                ) : null}
                            </View>
                        ) : (
                            <View>
                                <View style={{ ...card, marginBottom: 16 }}>
                                    <Text className="font-outfit-semibold" style={{ ...TYPE.helper, color: '#6B7490', marginBottom: 2 }}>{t('ase.memberIdLabel')}</Text>
                                    <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, color: '#1E56E3' }}>{verified.aseId}</Text>
                                </View>
                                <View style={{ gap: 12 }}>
                                    {(verified.certifications ?? []).length === 0 ? (
                                        <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490' }}>{t('ase.noCertifications')}</Text>
                                    ) : (
                                        (verified.certifications ?? []).map((cert) => (
                                            <View key={cert.id} style={{ padding: 16, borderRadius: 16, backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#E1EAFB' }}>
                                                <Text className="font-outfit-bold" style={{ ...TYPE.body, color: '#0B1530', marginBottom: 2 }}>
                                                    {cert.code}{cert.name ? ` - ${cert.name}` : ''}
                                                </Text>
                                                <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490' }}>
                                                    {t('ase.expiration', { date: formatExpiration(cert.expirationDate) })}
                                                </Text>
                                            </View>
                                        ))
                                    )}
                                </View>
                            </View>
                        )}

                        {/* The problem, as an alert row: icon tile, soft red, readable. */}
                        {searchError && (
                            <View className="flex-row items-center" style={{ gap: 12, marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FBD5D5' }}>
                                <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FDE2E2' }}>
                                    <AlertCircle size={22} color="#DC2626" />
                                </View>
                                <Text className="flex-1 font-outfit-semibold" style={{ ...TYPE.helper, color: '#B42318' }}>{searchError}</Text>
                            </View>
                        )}
                    </View>
                ) : (
                    <>
                        <View style={{ ...card, marginBottom: 16 }}>
                            <Text className="font-outfit-semibold" style={{ ...TYPE.helper, color: '#6B7490', marginBottom: 2 }}>{t('ase.memberIdLabel')}</Text>
                            <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, color: '#1E56E3' }}>{data.aseId}</Text>
                            <Text className="font-outfit-regular" style={{ ...TYPE.body, color: '#0B1530', marginTop: 2 }}>
                                {data.firstName} {data.lastName}
                            </Text>
                        </View>

                        {data.certifications.length === 0 ? (
                            <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490' }}>{t('ase.noCertificationsMembership')}</Text>
                        ) : (
                            <View style={{ gap: 12 }}>
                                {data.certifications.map((cert) => (
                                    <View key={cert.id} style={{ padding: 16, borderRadius: 16, backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#E1EAFB' }}>
                                        <Text className="font-outfit-bold" style={{ ...TYPE.body, color: '#0B1530', marginBottom: 2 }}>
                                            {cert.code}{cert.name ? ` - ${cert.name}` : ''}
                                        </Text>
                                        <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490' }}>
                                            {t('ase.expiration', { date: formatExpiration(cert.expirationDate) })}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </>
                )}
            </KeyboardAwareScrollView>

            {isLoading || linked ? null : !verified ? (
                <SetupFooter label={t('ase.searchButton')} onPress={handleSearch} disabled={!canSearch} loading={isSearching} />
            ) : (
                <SetupFooter
                    label={t('ase.linkButton')}
                    onPress={handleAssociate}
                    loading={isAssociating}
                    secondaryLabel={t('ase.searchDifferent')}
                    onSecondary={() => { setVerified(null); setSearchError(null); }}
                    secondaryDisabled={isAssociating}
                />
            )}
        </View>
    );
}
