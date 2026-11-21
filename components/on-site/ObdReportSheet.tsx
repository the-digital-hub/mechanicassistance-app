import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, NativeScrollEvent, NativeSyntheticEvent, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { ObdPanel } from '@/components/on-site/ObdPanel';
import { OS } from '@/components/on-site/ui';
import { SlideModal } from '@/components/ui/SlideModal';
import type { Appointment } from '@/context/AppointmentsContext';
import { type OnSiteVisit, onSiteDAO } from '@/lib/dao/OnSiteDAO';
import { refLabel } from '@/lib/refCode';
import { SHEET } from '@/lib/ui/sheet';
import { TYPE } from '@/lib/ui/type';
import { splitJobTitle } from '@/lib/ui/jobTitle';

/** The kind of assistance, as the cards name it. */
export function assistanceKind(a: Pick<Appointment, 'assistanceType' | 'type'>): 'accident' | 'videocall' | 'scheduled' | 'immediate' {
    return a.assistanceType === 'witness' ? 'accident' : a.type === 'videocall' ? 'videocall' : a.type === 'scheduled' ? 'scheduled' : 'immediate';
}

const SIDE = 20;
const GAP = 12;

/** A report counts as handed in once it is no longer missing (uploaded and being read, ready, or typed in). */
const reported = (v: OnSiteVisit | null) => !!v && v.obdStatus !== 'none' && v.obdStatus !== 'failed';

/** One assistance of the pager: which one it is (kind, what was wrong, vehicle, code) and its own OBD panel. */
function ObdPage({ appointment, width, onVisit }: { appointment: Appointment; width: number; onVisit: (visit: OnSiteVisit) => void }) {
    const { t } = useTranslation();
    const { height } = useWindowDimensions();
    const [visit, setVisit] = React.useState<OnSiteVisit | null>(null);
    const [failed, setFailed] = React.useState(false);
    const id = appointment.id;

    React.useEffect(() => {
        let cancelled = false;
        onSiteDAO.get(id)
            .then((v) => { if (!cancelled) { setVisit(v); setFailed(!v); } })
            .catch(() => { if (!cancelled) setFailed(true); });
        return () => { cancelled = true; };
    }, [id]);

    const issue = splitJobTitle(appointment.title).main;
    return (
        <View style={{ width }}>
            <ScrollView style={{ maxHeight: height * 0.62 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
                {/* Which assistance this report is for, so it is never uploaded to the wrong one. */}
                <View className="flex-row items-center mb-3" style={{ gap: 12, padding: 14, borderRadius: 16, backgroundColor: OS.blueSofter, borderWidth: 1, borderColor: OS.blueSoft }} testID="obd-report-identity">
                    <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFFFFF' }}>
                        <Ionicons name="car-sport-outline" size={22} color={OS.blue} />
                    </View>
                    <View className="flex-1" style={{ minWidth: 0 }}>
                        <Text className="font-outfit-bold" style={{ fontSize: 15, lineHeight: 20, color: OS.text }} numberOfLines={2}>
                            {[t(`appointments.detail.types.${assistanceKind(appointment)}`), issue].filter(Boolean).join(' · ')}
                        </Text>
                        {appointment.car ? <Text className="font-outfit-semibold" style={{ fontSize: 14, lineHeight: 20, color: OS.text }} numberOfLines={1}>{appointment.car}</Text> : null}
                        <Text className="font-outfit-regular" style={{ fontSize: 12, lineHeight: 16, color: '#9CA3AF', marginTop: 2 }} selectable>{refLabel(appointment.refCode, appointment.id)}</Text>
                    </View>
                </View>
                {visit ? (
                    <ObdPanel appointmentId={id} visit={visit} onVisit={(v) => { setVisit(v); onVisit(v); }} />
                ) : failed ? (
                    <Text className="font-outfit-regular text-center px-8 py-6" style={{ fontSize: 15, color: OS.muted }}>{t('appointments.onSite.common.error')}</Text>
                ) : (
                    <View className="items-center py-8"><ActivityIndicator color={OS.blue} /></View>
                )}
            </ScrollView>
        </View>
    );
}

/**
 * The scanner reports still missing, from below and without leaving the dashboard: one page per closed service, side by side, to swipe
 * through like the pending ratings. Each page says which assistance it is and holds the same OBD panel as the close-out, minus the payment and
 * the rest of that page. Once a report is in, the sheet moves on to the next one missing and closes itself when none is left.
 */
export function ObdReportSheet({ appointments, onClose, onChanged }: {
    /** The services missing a report when the sheet was opened; null (or empty) keeps it closed. */
    appointments: Appointment[] | null;
    onClose: () => void;
    /** A report was uploaded or typed in: the reminder can be re-checked. */
    onChanged?: () => void;
}) {
    const { t } = useTranslation();
    const open = !!appointments && appointments.length > 0;
    // The pages of this opening stay where they are: one that got its report stays in place until the sheet moves on.
    const [list, setList] = React.useState<Appointment[]>([]);
    React.useEffect(() => { if (open) setList(appointments as Appointment[]); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    const [measured, setMeasured] = React.useState(0);
    const { width: screen } = useWindowDimensions();
    const pageWidth = measured || screen - SIDE * 2;
    const scroller = React.useRef<ScrollView>(null);
    const [done, setDone] = React.useState<Set<string>>(new Set());
    const [page, setPage] = React.useState(0);

    React.useEffect(() => { if (open) { setDone(new Set()); setPage(0); } }, [open]);

    const goTo = (i: number) => {
        const next = Math.min(Math.max(0, i), Math.max(0, list.length - 1));
        scroller.current?.scrollTo({ x: next * (pageWidth + GAP), animated: true });
        setPage(next);
    };
    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / (pageWidth + GAP)));

    const handIn = (id: string, index: number, v: OnSiteVisit) => {
        onChanged?.();
        if (!reported(v)) return;
        const next = new Set(done).add(id);
        setDone(next);
        const another = [...list.keys()].find((n) => n > index && !next.has(list[n].id)) ?? [...list.keys()].find((n) => !next.has(list[n].id));
        if (another === undefined) setTimeout(onClose, 900);
        else setTimeout(() => goTo(another), 700);
    };

    return (
        <SlideModal visible={open} onClose={onClose} avoidKeyboard>
            <View style={{ ...SHEET, paddingTop: 16 }} testID="obd-report-sheet">
                <View className="flex-row items-center justify-between px-5 pb-3">
                    <Text className="font-outfit-bold" style={{ fontSize: 22, letterSpacing: -0.4, color: OS.text }}>{t('appointments.closeout.obdTitle')}</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#EEF1F6' }}>
                        <Ionicons name="close" size={16} color="#4B5563" />
                    </TouchableOpacity>
                </View>
                <View style={{ paddingHorizontal: SIDE }} onLayout={(e) => setMeasured(Math.floor(e.nativeEvent.layout.width))}>
                    <ScrollView
                        ref={scroller}
                        horizontal
                        snapToInterval={pageWidth + GAP}
                        snapToAlignment="start"
                        disableIntervalMomentum
                        decelerationRate="fast"
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        onMomentumScrollEnd={onScroll}
                        contentContainerStyle={{ gap: GAP }}
                    >
                        {list.map((a, i) => (
                            <ObdPage key={a.id} appointment={a} width={pageWidth} onVisit={(v) => handIn(a.id, i, v)} />
                        ))}
                    </ScrollView>
                </View>
                {list.length > 1 ? (
                    <View className="flex-row items-center justify-center" style={{ gap: 6, marginTop: 4, paddingBottom: 30 }}>
                        <Text className="font-outfit-semibold" style={{ ...TYPE.caption, color: OS.muted, marginRight: 4 }}>{t('dashboard.rating.counter', { current: page + 1, total: list.length })}</Text>
                        {list.slice(0, 12).map((a, i) => (
                            <View key={a.id} style={{ width: i === page ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: done.has(a.id) ? OS.green : i === page ? OS.blue : '#D5DCEB' }} />
                        ))}
                    </View>
                ) : <View style={{ height: 30 }} />}
            </View>
        </SlideModal>
    );
}
