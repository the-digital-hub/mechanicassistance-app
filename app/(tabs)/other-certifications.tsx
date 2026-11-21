import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { AO } from '@/components/offer/OfferSections';
import { Footer } from '@/components/scheduled/ui';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { certificationsDAO, formatExpiry, isExpired, type Certification } from '@/lib/dao/CertificationsDAO';
import { Trash2 } from 'lucide-react-native';
import { KEYBOARD_SCROLL_PROPS } from '@/lib/ui/keyboard';

const K = 'certifications';

const TYPE_ICON = { manufacturer: 'car-sport-outline', industry: 'ribbon-outline', other: 'medal-outline' } as const;

/** Certifications besides ASE: brand (e.g. Audi direct), industry (e.g. AATI) and others. */
export default function OtherCertificationsScreen() {
    const { t } = useTranslation();
    const [items, setItems] = React.useState<Certification[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [loadFailed, setLoadFailed] = React.useState(false);
    const router = useRouter();
    const [removing, setRemoving] = React.useState<Certification | null>(null);

    const load = React.useCallback(() => {
        setLoading(true);
        certificationsDAO
            .list()
            .then((l) => { setItems(l); setLoadFailed(false); })
            .catch(() => setLoadFailed(true))
            .finally(() => setLoading(false));
    }, []);
    // Back from the form: the list is read again, so what was added or edited shows up.
    useFocusEffect(load);
    const openForm = (item?: Certification) =>
        router.push(item ? { pathname: '/certification-form', params: { data: JSON.stringify(item) } } : '/certification-form');

    const confirmRemove = async () => {
        const target = removing;
        setRemoving(null);
        if (!target) return;
        try {
            await certificationsDAO.remove(target.id);
            setItems((prev) => prev.filter((x) => x.id !== target.id));
        } catch {
            load();
        }
    };

    const chip = (label: string, bg: string, fg: string) => (
        <View key={label} style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: bg }}>
            <Text className="font-outfit-bold" style={{ fontSize: 13, color: fg }}>{label}</Text>
        </View>
    );

    return (
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
            <ConfirmationModal
                visible={removing !== null}
                title={t(`${K}.removeTitle`)}
                message={t(`${K}.removeBody`)}
                icon={Trash2}
                confirmText={t(`${K}.remove`)}
                cancelText={t(`${K}.cancel`)}
                confirmButtonColor="#EF4444"
                onConfirm={confirmRemove}
                onClose={() => setRemoving(null)}
            />

            <ScrollView {...KEYBOARD_SCROLL_PROPS} className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 28, gap: 12 }}>
                <View style={{ marginTop: 8 }}>
<View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">{t(`${K}.badge`)}</Text>
                </View>
</View>
                <Text className="text-gray-900 font-outfit-medium text-3xl">{t(`${K}.title`)}</Text>
                <Text className="text-gray-500 font-outfit-regular text-base" style={{ marginBottom: 8 }}>{t(`${K}.subtitle`)}</Text>

                {loading ? (
                    <ActivityIndicator color="#0047AB" style={{ marginTop: 24 }} />
                ) : items.length === 0 ? (
                    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 36 }}>
                        <Ionicons name="ribbon-outline" size={40} color={AO.mutedLight} />
                        <Text className="font-outfit-bold" style={{ fontSize: 17, color: AO.text }}>{t(`${K}.emptyTitle`)}</Text>
                        <Text className="font-outfit-regular" style={{ fontSize: 15, color: AO.muted, textAlign: 'center' }}>{t(loadFailed ? `${K}.loadFailed` : `${K}.emptyBody`)}</Text>
                    </View>
                ) : (
                    items.map((c) => {
                        const expired = isExpired(c.expiresAt);
                        const status = c.status === 'verified' ? chip(t(`${K}.status.verified`), AO.greenSoft, AO.greenText)
                            : c.status === 'declined' ? chip(t(`${K}.status.declined`), '#FDECEC', '#B42318')
                            : chip(t(`${K}.status.pending`), '#FFF4E5', '#B25E09');
                        return (
                            <TouchableOpacity
                                key={c.id}
                                onPress={() => openForm(c)}
                                onLongPress={() => setRemoving(c)}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: AO.borderSoft, padding: 14 }}
                                testID="certification-card"
                            >
                                <View className="flex-row items-start" style={{ gap: 12 }}>
                                    <View className="items-center justify-center" style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: AO.blueSoft }}>
                                        <Ionicons name={TYPE_ICON[c.type]} size={22} color={AO.blue} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text className="font-outfit-bold" style={{ fontSize: 17, color: AO.text }}>{c.issuer ? `${c.issuer} · ${c.name}` : c.name}</Text>
                                        <Text className="font-outfit-regular" style={{ fontSize: 14, color: AO.muted, marginTop: 2 }}>
                                            {[t(`${K}.types.${c.type}`), c.credentialId ? `ID ${c.credentialId}` : null].filter(Boolean).join(' · ')}
                                        </Text>
                                        <View className="flex-row flex-wrap" style={{ gap: 6, marginTop: 8 }}>
                                            {status}
                                            {c.expiresAt
                                                ? expired
                                                    ? chip(t(`${K}.expired`, { date: formatExpiry(c.expiresAt) }), '#FDECEC', '#B42318')
                                                    : chip(t(`${K}.validUntil`, { date: formatExpiry(c.expiresAt) }), AO.blueSoft, AO.blue)
                                                : null}
                                        </View>
                                        {c.status === 'declined' && c.declineReason ? (
                                            <Text className="font-outfit-regular" style={{ fontSize: 14, color: '#B42318', marginTop: 8 }}>{c.declineReason}</Text>
                                        ) : null}
                                    </View>
                                    <TouchableOpacity onPress={() => setRemoving(c)} hitSlop={10} accessibilityLabel={t(`${K}.remove`)}>
                                        <Trash2 size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>

            <Footer label={t(`${K}.add`)} onPress={() => openForm()} />
        </View>
    );
}
