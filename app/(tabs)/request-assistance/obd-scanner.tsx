import { MediaSlot, type Picked } from '@/components/on-site/MediaSlot';
import { useRequestDraft } from '@/context/RequestDraftContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronLeft, ScanLine, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

/**
 * Optional step of the video-call wizard (vehicle information → here → when):
 * "Do you have an OBD scanner?". With one, the owner plugs it in, reads the
 * codes and attaches a photo of its screen or a screenshot / PDF from its app.
 * The file waits in the draft and is uploaded once the request exists, so the
 * mechanic sees the trouble codes before and during the call.
 */

const C = {
    page: '#F6F8FC',
    ink: '#0B1530',
    muted: '#6B7490',
    blue: '#1E56E3',
    blueSoft: 'rgba(30,86,227,0.08)',
    border: '#E1E7F3',
    line: '#EEF2FA',
};

type Answer = 'yes' | 'no' | null;

const STEPS = ['plug', 'ignition', 'read', 'capture'] as const;

export default function ObdScannerScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { obdFile, setObdFile } = useRequestDraft();
    const [answer, setAnswer] = useState<Answer>(obdFile ? 'yes' : null);
    const k = 'requestAssistance.obdScanner';

    const next = () =>
        router.push({
            // Typed routes regenerate on the next dev-server start; until then "when" is unknown.
            pathname: '/request-assistance/when' as never,
            params: { ...params },
        });

    const choose = (value: Exclude<Answer, null>) => {
        setAnswer(value);
        if (value === 'no') setObdFile(null);
    };

    const skip = () => {
        choose('no');
        next();
    };

    // Nothing is uploaded yet: the request does not exist until "When".
    const keep = async (file: Picked) => {
        setObdFile({ uri: file.uri, name: file.name, mimeType: file.mimeType });
    };

    const canContinue = answer === 'no' || (answer === 'yes' && !!obdFile);
    const cta = answer === 'yes' && !obdFile ? t(`${k}.ctaNeedFile`) : t(`${k}.cta`);

    const Option = ({ value, Icon, title, subtitle }: { value: Exclude<Answer, null>; Icon: typeof Check; title: string; subtitle: string }) => {
        const selected = answer === value;
        return (
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => choose(value)}
                testID={`obd-scanner-${value}`}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1.5,
                    borderColor: selected ? C.blue : C.border,
                }}
            >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} color={C.blue} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 15, color: C.ink }}>{title}</Text>
                    <Text className="font-outfit-regular" style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{subtitle}</Text>
                </View>
                <View
                    style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: selected ? C.blue : C.border,
                        backgroundColor: selected ? C.blue : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {selected ? <Check size={12} color="#FFFFFF" /> : null}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View className="flex-1" style={{ backgroundColor: C.page }}>
            {/* Header — same as the other wizard steps */}
            <View
                className="px-6 pt-20 pb-2 flex-row items-center justify-between"
                style={{ backgroundColor: '#F4F5FA', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 3, borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' }}
            >
                <TouchableOpacity onPress={() => router.back()} testID="obd-scanner-back">
                    <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
                        <ChevronLeft size={20} color="#0047AB" />
                    </View>
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 17, color: C.ink, flex: 1, textAlign: 'center' }}>
                    {t(`${k}.headerTitle`)}
                </Text>
                <TouchableOpacity onPress={skip} testID="obd-scanner-skip" className="w-10 items-end">
                    <Text className="font-outfit-semibold" style={{ fontSize: 13, color: C.blue }}>{t(`${k}.skip`)}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 14 }}>
                <View>
                    <View className="flex-row items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">{t(`${k}.badge`)}</Text>
                    </View>
                    <Text className="font-outfit-bold" style={{ fontSize: 26, color: C.ink }}>{t(`${k}.title`)}</Text>
                    <Text className="font-outfit-regular" style={{ fontSize: 14, color: C.muted, marginTop: 6, lineHeight: 20 }}>
                        {t(`${k}.subtitle`)}
                    </Text>
                </View>

                <Option value="yes" Icon={ScanLine} title={t(`${k}.yesTitle`)} subtitle={t(`${k}.yesSubtitle`)} />
                <Option value="no" Icon={X} title={t(`${k}.noTitle`)} subtitle={t(`${k}.noSubtitle`)} />

                {answer === 'yes' ? (
                    <>
                        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16, gap: 12 }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: C.ink }}>{t(`${k}.howTitle`)}</Text>
                            {STEPS.map((step, i) => (
                                <View key={step} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                                        <Text className="font-outfit-bold" style={{ fontSize: 12, color: C.blue }}>{i + 1}</Text>
                                    </View>
                                    <Text className="font-outfit-regular" style={{ flex: 1, fontSize: 13.5, color: C.muted, lineHeight: 19 }}>
                                        {t(`${k}.steps.${step}`)}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        <View style={{ marginHorizontal: -16 }}>
                            <MediaSlot
                                key={obdFile?.uri ?? 'none'}
                                kind="file"
                                height={150}
                                placeholder={t(`${k}.placeholder`)}
                                customUpload={keep}
                                existingFileName={obdFile ? obdFile.name ?? obdFile.uri.split('/').pop() : undefined}
                            />
                        </View>
                        <Text className="font-outfit-regular" style={{ fontSize: 12, color: C.muted, lineHeight: 17 }}>
                            {t(`${k}.privacy`)}
                        </Text>
                    </>
                ) : null}
            </ScrollView>

            {/* Sticky action */}
            <View style={{ backgroundColor: C.page, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18 }}>
                <TouchableOpacity onPress={next} disabled={!canContinue} activeOpacity={0.85} testID="obd-scanner-continue">
                    {canContinue ? (
                        <LinearGradient
                            colors={['#2B66F8', '#081E72']}
                            start={{ x: 0, y: 1 }}
                            end={{ x: 1, y: 0 }}
                            style={{ borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
                        >
                            <Text className="text-white font-outfit-bold" style={{ fontSize: 16 }}>{cta}</Text>
                        </LinearGradient>
                    ) : (
                        <View style={{ borderRadius: 12, paddingVertical: 16, alignItems: 'center', backgroundColor: '#B9C0CF' }}>
                            <Text className="text-white font-outfit-bold" style={{ fontSize: 16 }}>{cta}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}
