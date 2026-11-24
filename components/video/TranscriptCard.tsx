import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

import { AO } from '@/components/offer/OfferSections';
import { appAlert } from '@/lib/ui/appAlert';
import { videoCallDAO } from '@/lib/dao/VideoCallDAO';
import { FLOATING_FOOTER } from '@/lib/ui/floatingFooter';
import { getConsents } from '@/lib/video/consent';
import { type TranscriptLine, getLocalTranscript } from '@/lib/video/transcriptStore';
import { buildTranscriptHtml } from '@/lib/video/transcriptPdf';
import { reportBrand } from '@/lib/pdf/brand';
import { TYPE } from '@/lib/ui/type';
import { SheetDim } from '@/components/ui/SheetDim';
import { LinearGradient } from 'expo-linear-gradient';
import { SHEET } from '@/lib/ui/sheet';
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';

const K = 'appointments.videoCall.transcript';

/** The saved transcript when the server has one, else what this phone heard in the call. */
async function loadTranscript(appointmentId: string, role: 'owner' | 'mechanic'): Promise<{ lines: TranscriptLine[]; onThisPhoneOnly: boolean }> {
    try {
        const server = await videoCallDAO.getTranscript(appointmentId);
        if (server?.lines?.length) {
            return {
                onThisPhoneOnly: false,
                lines: server.lines.map((l) => ({
                    id: l.id,
                    speaker: l.role === role ? 'me' : 'other',
                    name: l.name ?? '',
                    text: l.text,
                    at: Date.parse(l.at) || 0,
                })),
            };
        }
    } catch {
        /* the server could not be reached: fall back to this phone's copy */
    }
    return { lines: await getLocalTranscript(appointmentId), onThisPhoneOnly: true };
}

/** Whether a call has a transcript, by call id, shared by every list card (the list re-renders on each focus). */
const availability = new Map<string, boolean>();

/**
 * True when the call has a saved transcript (the server's, else the copy this phone kept). Used by the list card to
 * decide whether to show the "Call transcript" row at all. `known` is the list row's own `hasTranscript`, so a backend
 * that sends it needs no request per card. `false` while unknown, and for any failure.
 */
export function useHasTranscript(appointmentId: string, role: 'owner' | 'mechanic', enabled: boolean, known?: boolean): boolean {
    const [has, setHas] = React.useState(() => availability.get(appointmentId) ?? known === true);
    React.useEffect(() => {
        if (!enabled) return;
        // The list row says the server has one: nothing to ask.
        if (known === true) {
            setHas(true);
            return;
        }
        const cached = availability.get(appointmentId);
        if (cached !== undefined) {
            setHas(cached);
            return;
        }
        let alive = true;
        // The server says there is none (or an older backend says nothing): this phone may still hold its own copy,
        // and only an older backend is asked for the server's.
        const lookup = known === false
            ? getLocalTranscript(appointmentId).then((lines) => lines.length > 0)
            : loadTranscript(appointmentId, role).then((r) => r.lines.length > 0);
        lookup
            .then((found) => {
                availability.set(appointmentId, found);
                if (alive) setHas(found);
            })
            .catch(() => undefined);
        return () => { alive = false; };
    }, [appointmentId, role, enabled, known]);
    return has;
}

const clock = (at: number) => (at ? new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');

/**
 * A button that opens what was said in the video call, line by line. Shown in the Status tab of
 * both sides; the sheet says when the text is only the copy this phone kept.
 */
export function TranscriptCard({ appointmentId, role, info, variant = 'card' }: {
    appointmentId: string;
    role: 'owner' | 'mechanic';
    /** What the downloaded PDF says about the call. */
    info?: { ref?: string | null; vehicle?: string | null; callDate?: string | null; durationMinutes?: number | null; selfName?: string | null };
    /** `row`: only a small "View" button, for a data row of the list card (the sheet is the same). */
    variant?: 'card' | 'row';
}) {
    const { t, i18n } = useTranslation();
    const [exporting, setExporting] = React.useState(false);

    const downloadPdf = async () => {
        if (!data?.lines.length || exporting) return;
        setExporting(true);
        try {
            const consents = await getConsents(appointmentId);
            // The brand in colour and the app's font go inside the page as data (without them the header says the name in text).
            const brand = await reportBrand();
            const html = buildTranscriptHtml({
                ref: info?.ref,
                vehicle: info?.vehicle,
                callDate: info?.callDate,
                durationLabel: info?.durationMinutes ? t('requestAssistance.when.durationValue', { count: info.durationMinutes }) : null,
                role,
                selfName: info?.selfName,
                lines: data.lines,
                consents,
                locale: i18n.language,
                brand,
                labels: {
                    title: t(`${K}.pdf.title`), reference: t(`${K}.pdf.reference`), vehicle: t(`${K}.pdf.vehicle`), callDate: t(`${K}.pdf.callDate`),
                    duration: t(`${K}.pdf.duration`), generated: t(`${K}.pdf.generated`), consentTitle: t(`${K}.pdf.consentTitle`),
                    consentNone: t(`${K}.pdf.consentNone`), consentPrecall: t(`${K}.pdf.consentPrecall`), consentRequest: t(`${K}.pdf.consentRequest`),
                    consentAnswerYes: t(`${K}.pdf.consentAnswerYes`), consentAnswerNo: t(`${K}.pdf.consentAnswerNo`),
                    owner: t(`${K}.pdf.owner`), mechanic: t(`${K}.pdf.mechanic`), conversation: t(`${K}.pdf.conversation`),
                    empty: t(`${K}.pdf.empty`), notice: t(`${K}.pdf.notice`),
                },
            });
            // Loaded here so a build made before these modules were added does not break the whole app.
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const Print = require('expo-print') as typeof import('expo-print');
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const Sharing = require('expo-sharing') as typeof import('expo-sharing');
            // Margins on every page (iOS ignores the CSS ones), so a page cut never lands on the edge of the sheet.
            const { uri } = await Print.printToFileAsync({ html, margins: { left: 36, right: 36, top: 36, bottom: 36 } });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t(`${K}.pdf.title`) });
            }
        } catch {
            appAlert(t(`${K}.pdf.failedTitle`), t(`${K}.pdf.failedBody`));
        } finally {
            setExporting(false);
        }
    };
    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [data, setData] = React.useState<{ lines: TranscriptLine[]; onThisPhoneOnly: boolean } | null>(null);

    // Only a call that has a transcript shows the card: no captions turned on, nothing to show.
    const [available, setAvailable] = React.useState(false);
    React.useEffect(() => {
        let cancelled = false;
        loadTranscript(appointmentId, role).then((result) => {
            if (cancelled) return;
            setAvailable(result.lines.length > 0);
            setData(result);
        });
        return () => { cancelled = true; };
    }, [appointmentId, role]);

    const show = () => {
        setOpen(true);
        setLoading(true);
        loadTranscript(appointmentId, role)
            .then(setData)
            .finally(() => setLoading(false));
    };

    if (!available) return null;

    return (
        <>
            {variant === 'row' ? (
                <TouchableOpacity
                    onPress={show}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    className="flex-row items-center"
                    style={{ gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: AO.blueSoft }}
                    testID="transcript-row-view"
                >
                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.blue }}>{t(`${K}.view`)}</Text>
                    <Ionicons name="chevron-forward" size={14} color={AO.blue} />
                </TouchableOpacity>
            ) : (
            <TouchableOpacity
                onPress={show}
                activeOpacity={0.85}
                accessibilityRole="button"
                className="flex-row items-center"
                style={{ gap: 12, padding: 14, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: AO.borderSoft }}
                testID="transcript-card"
            >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: AO.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="document-text-outline" size={20} color={AO.blue} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, lineHeight: 22, color: AO.text }}>{t(`${K}.title`)}</Text>
                    <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: AO.muted }}>{t(`${K}.subtitle`)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={AO.mutedLight} />
            </TouchableOpacity>

            )}

            <Modal supportedOrientations={MODAL_ORIENTATIONS} transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
                <SheetDim color="rgba(11,21,48,0.35)" />
                <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} />
                <View style={{ ...SHEET, height: '75%', overflow: 'hidden' }} testID="transcript-sheet">
                    {/* The fixed top: rounded; the lines slide under a very short fade of white (no shadow, no hard edge). */}
                    <View
                        className="flex-row items-center"
                        style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, zIndex: 2 }}
                    >
                        <Text className="font-outfit-bold" style={{ flex: 1, fontSize: 18, color: AO.text }}>{t(`${K}.title`)}</Text>
                        <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t(`${K}.close`)}>
                            <Ionicons name="close" size={24} color={AO.muted} />
                        </TouchableOpacity>
                    </View>
                    {loading ? (
                        <ActivityIndicator color={AO.blue} style={{ marginTop: 40 }} />
                    ) : (
                        <View style={{ flex: 1 }}>
                        <FlatList
                            style={{ flex: 1 }}
                            data={data?.lines ?? []}
                            keyExtractor={(l) => l.id}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 10 }}
                            ListHeaderComponent={
                                data?.lines.length && data.onThisPhoneOnly ? (
                                    <Text className="font-outfit-regular" style={{ fontSize: 13, lineHeight: 18, color: AO.muted, marginBottom: 4 }}>{t(`${K}.localOnly`)}</Text>
                                ) : null
                            }
                            ListEmptyComponent={
                                <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: AO.muted, textAlign: 'center', paddingVertical: 32 }}>{t(`${K}.empty`)}</Text>
                            }
                            renderItem={({ item }) => (
                                <View style={{ alignSelf: item.speaker === 'me' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                                    <Text className="font-outfit-semibold" style={{ fontSize: 12, color: AO.mutedLight, marginBottom: 2, textAlign: item.speaker === 'me' ? 'right' : 'left' }}>
                                        {item.speaker === 'me' ? t(`${K}.you`) : item.name || t(`${K}.other`)}{item.at ? ` · ${clock(item.at)}` : ''}
                                    </Text>
                                    <View style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: item.speaker === 'me' ? AO.blue : AO.page }}>
                                        <Text className="font-outfit-regular" style={{ fontSize: 16, lineHeight: 22, color: item.speaker === 'me' ? '#FFFFFF' : AO.text }}>{item.text}</Text>
                                    </View>
                                </View>
                            )}
                        />
                        <LinearGradient
                            pointerEvents="none"
                            colors={['#FFFFFF', 'rgba(255,255,255,0)']}
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 14 }}
                        />
                        </View>
                    )}
                    <View style={[FLOATING_FOOTER, { paddingBottom: 28 }]}>
                        <TouchableOpacity
                            onPress={downloadPdf}
                            disabled={!data?.lines.length || exporting}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            className="flex-row items-center justify-center"
                            style={{ gap: 10, minHeight: 52, borderRadius: 14, backgroundColor: AO.blue, opacity: data?.lines.length ? 1 : 0.45 }}
                            testID="transcript-download-pdf"
                        >
                            {exporting ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="download-outline" size={20} color="#FFFFFF" />}
                            <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#FFFFFF' }}>{t(`${K}.download`)}</Text>
                        </TouchableOpacity>
                        <Text className="font-outfit-regular" style={{ fontSize: 13, lineHeight: 18, color: AO.muted, textAlign: 'center', marginTop: 8 }}>{t(`${K}.consentNote`)}</Text>
                    </View>
                </View>
            </Modal>
        </>
    );
}
