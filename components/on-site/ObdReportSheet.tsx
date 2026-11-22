import { Ionicons } from '@expo/vector-icons';
import { AlertTriangle, Calendar, Car, Video, Wrench, Zap } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Easing, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardSheetScroll } from '@/components/ui/KeyboardSheetScroll';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';

import { ObdPanel } from '@/components/on-site/ObdPanel';
import { VehicleIdsRow } from '@/components/scheduled/ui';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { OS } from '@/components/on-site/ui';
import { SlideModal } from '@/components/ui/SlideModal';
import type { Appointment } from '@/context/AppointmentsContext';
import { type OnSiteVisit, onSiteDAO } from '@/lib/dao/OnSiteDAO';
import { refLabel } from '@/lib/refCode';
import { formatLocalDateTime } from '@/lib/video/videoCallTime';
import { SHEET } from '@/lib/ui/sheet';
import { TYPE } from '@/lib/ui/type';
import { splitJobTitle } from '@/lib/ui/jobTitle';

/** The kind of assistance, as the cards name it. */
export function assistanceKind(a: Pick<Appointment, 'assistanceType' | 'type'>): 'accident' | 'videocall' | 'scheduled' | 'immediate' {
    return a.assistanceType === 'witness' ? 'accident' : a.type === 'videocall' ? 'videocall' : a.type === 'scheduled' ? 'scheduled' : 'immediate';
}

const SIDE = 20;
const EDGE = 6;
const GAP = 12;

/** A report counts as handed in once it is no longer missing (uploaded and being read, ready, or typed in). */
const reported = (v: OnSiteVisit | null) => !!v && v.obdStatus !== 'none' && v.obdStatus !== 'failed';

/** The one type of the card's three lines (when, what, which vehicle). */
const IDENT = { fontSize: 15, lineHeight: 21, color: OS.text } as const;

/** A line of the pedido card: its icon in a small rounded square (as everywhere else in the app) and the text next to it. */
function IdRow({ icon: Icon, children }: { icon: typeof Car; children: React.ReactNode }) {
    return (
        <View className="flex-row items-center" style={{ gap: 12 }}>
            <View className="items-center justify-center" style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: '#FFFFFF' }}>
                <Icon size={17} color={OS.blue} />
            </View>
            <View className="flex-1" style={{ minWidth: 0 }}>{children}</View>
        </View>
    );
}

/** One assistance of the pager: which one it is (kind, what was wrong, vehicle, code) and its own OBD panel. */
function ObdPage({ appointment, width, onVisit, onHeight }: { appointment: Appointment; width: number; onVisit: (visit: OnSiteVisit) => void; onHeight: (height: number) => void }) {
    const { t, i18n } = useTranslation();
    const [visit, setVisit] = React.useState<OnSiteVisit | null>(null);
    const [failed, setFailed] = React.useState(false);
    const id = appointment.id;
    // The vehicle's VIN (and plate, when the request carries it): which car this report is for, beyond its name.
    const [ids, setIds] = React.useState<{ vin: string | null; plate: string | null }>({ vin: null, plate: null });
    React.useEffect(() => {
        let cancelled = false;
        assistanceDAO.getById(id)
            .then((r) => { if (!cancelled && r?.vehicle) setIds({ vin: r.vehicle.vin ?? null, plate: r.vehicle.plate ?? null }); })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, [id]);

    React.useEffect(() => {
        let cancelled = false;
        onSiteDAO.get(id)
            .then((v) => { if (!cancelled) { setVisit(v); setFailed(!v); } })
            .catch(() => { if (!cancelled) setFailed(true); });
        return () => { cancelled = true; };
    }, [id]);

    const issue = splitJobTitle(appointment.title).main;
    const kind = assistanceKind(appointment);
    const look = {
        immediate: { label: t('dashboard.kind.immediate'), icon: Zap },
        scheduled: { label: t('dashboard.kind.scheduled'), icon: Calendar },
        videocall: { label: t('dashboard.kind.videocall'), icon: Video },
        accident: { label: t('dashboard.kind.accident'), icon: AlertTriangle },
    }[kind];
    // When the service was (the day it was closed, else the day it was asked for).
    const when = formatLocalDateTime(appointment.completedAt || appointment.date, i18n.language);
    return (
        <View style={{ width, paddingBottom: 10 }} onLayout={(e) => onHeight(e.nativeEvent.layout.height)}>
            {/* Which assistance this report is for, so it is never uploaded to the wrong one. */}
            <View style={{ gap: 10, padding: 14, borderRadius: 16, backgroundColor: OS.blueSofter, borderWidth: 1, borderColor: OS.blueSoft }} testID="obd-report-identity">
                {/* The kind as the first line (icon and text, like the rest), then when it was, what it is, the vehicle with its model, VIN and plate, and the code last. */}
                <IdRow icon={look.icon}>
                    <Text className="font-outfit-semibold" style={IDENT} numberOfLines={1}>{look.label}</Text>
                </IdRow>
                {when ? (
                    <IdRow icon={Calendar}>
                        <Text className="font-outfit-semibold" style={IDENT} numberOfLines={1}>{when}</Text>
                    </IdRow>
                ) : null}
                {issue ? (
                    <IdRow icon={Wrench}>
                        <Text className="font-outfit-semibold" style={IDENT} numberOfLines={2}>{issue}</Text>
                    </IdRow>
                ) : null}
                {appointment.car ? (
                    <IdRow icon={Car}>
                        <Text className="font-outfit-semibold" style={IDENT} numberOfLines={1}>{appointment.car}</Text>
                        <VehicleIdsRow plate={ids.plate} vin={ids.vin} plateLabel={t('requestAssistance.selectVehicle.plate')} />
                    </IdRow>
                ) : null}
                <Text className="font-outfit-regular" style={{ fontSize: 12, lineHeight: 16, color: '#9CA3AF' }} selectable>{refLabel(appointment.refCode, appointment.id)}</Text>
            </View>
            {/* The panel carries its own 16 px side margins (it was made for a full-width screen): the page already has its own, so they are taken back. */}
            <View style={{ marginHorizontal: -16, marginTop: 12 }}>
                {visit ? (
                    <ObdPanel dense appointmentId={id} visit={visit} onVisit={(v) => { setVisit(v); onVisit(v); }} />
                ) : failed ? (
                    <Text className="font-outfit-regular text-center px-8 py-6" style={{ fontSize: 15, color: OS.muted }}>{t('appointments.onSite.common.error')}</Text>
                ) : (
                    <View className="items-center py-8"><ActivityIndicator color={OS.blue} /></View>
                )}
            </View>
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
    const { width: screen, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const keyboard = useKeyboardHeight();
    // What is left above the keyboard (and under the status bar) is the most the sheet can be; what does not fit scrolls inside.
    const room = height - (Platform.OS === 'ios' ? keyboard : 0) - insets.top - 12;
    const pageWidth = measured || screen - SIDE * 2;
    const scroller = React.useRef<ScrollView>(null);
    const [done, setDone] = React.useState<Set<string>>(new Set());
    const [page, setPage] = React.useState(0);
    // Each page is as tall as its own content: the pager takes the height of the one in view, not of the tallest.
    const [heights, setHeights] = React.useState<Record<string, number>>({});
    // The sheet follows its content with a sweep: whenever the page in view gets taller or shorter (the codes list, the manual entry opening, the file
    // that arrived) the pager's height glides to the new size instead of jumping, and the sheet, anchored to the bottom, rises or sinks with it.
    const heightAnim = React.useRef(new Animated.Value(0)).current;
    const sized = React.useRef(false);
    const currentHeight = heights[list[page]?.id ?? ''];
    React.useEffect(() => {
        if (!currentHeight) return;
        if (!sized.current) {
            sized.current = true;
            heightAnim.setValue(currentHeight);
            return;
        }
        Animated.timing(heightAnim, { toValue: currentHeight, duration: 280, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start();
    }, [currentHeight, heightAnim]);

    // The sheet is as tall as what it holds, glued to the bottom: the title, the page in view and the pager under it (no empty space, no cut).
    // Its height is a number from the first frame (a guess until the page is measured) and glides to the real one, so it never jumps.
    const chrome = 16 + 40 + 12 + (list.length > 1 ? 50 : 30);
    const target = Math.min(room, chrome + (currentHeight ?? 440));
    const panelAnim = React.useRef(new Animated.Value(target)).current;
    const panelSized = React.useRef(false);
    React.useEffect(() => {
        if (!panelSized.current || !open) {
            panelSized.current = open;
            panelAnim.setValue(target);
            return;
        }
        Animated.timing(panelAnim, { toValue: target, duration: 280, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start();
    }, [target, open, panelAnim]);

    React.useEffect(() => { if (open) { setDone(new Set()); setPage(0); setHeights({}); sized.current = false; } }, [open]);

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
        // Typing codes in is done one by one: the sheet stays where it is (it is closed by hand). Only a file that was uploaded moves on.
        if (v.obdStatus === 'manual') return;
        const another = [...list.keys()].find((n) => n > index && !next.has(list[n].id)) ?? [...list.keys()].find((n) => !next.has(list[n].id));
        if (another === undefined) setTimeout(onClose, 900);
        else setTimeout(() => goTo(another), 700);
    };

    return (
        <SlideModal visible={open} onClose={onClose} avoidKeyboard>
            <Animated.View style={{ ...SHEET, paddingTop: 16, height: panelAnim }} testID="obd-report-sheet">
                <View className="flex-row items-center justify-between px-5 pb-3">
                    <Text className="font-outfit-bold" style={{ fontSize: 22, letterSpacing: -0.4, color: OS.text }}>{t('appointments.closeout.obdTitle')}</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#EEF1F6' }}>
                        <Ionicons name="close" size={16} color="#4B5563" />
                    </TouchableOpacity>
                </View>
                <KeyboardSheetScroll style={{ flex: 1, flexGrow: 1 }} resetKey={open} bounces={false} contentContainerStyle={{ paddingHorizontal: SIDE, paddingBottom: 12 }}>
                    {/* Measured without the side padding: a page is exactly as wide as the room it has. */}
                    <View onLayout={(e) => setMeasured(Math.floor(e.nativeEvent.layout.width))}>
                        <Animated.ScrollView
                            ref={scroller}
                            horizontal
                            // A few px of room on each side, so the borders and shadows of the cards at the edges are not cut by the scroller.
                            style={{ flexGrow: 0, marginHorizontal: -EDGE, ...(currentHeight ? { height: heightAnim } : null) }}
                            contentContainerStyle={{ gap: GAP, alignItems: 'flex-start', paddingHorizontal: EDGE }}
                            snapToInterval={pageWidth + GAP}
                            snapToAlignment="start"
                            disableIntervalMomentum
                            decelerationRate="fast"
                            showsHorizontalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            onMomentumScrollEnd={onScroll}
                        >
                            {list.map((a, i) => (
                                <ObdPage key={a.id} appointment={a} width={pageWidth} onVisit={(v) => handIn(a.id, i, v)} onHeight={(h) => setHeights((prev) => (Math.abs((prev[a.id] ?? 0) - h) < 1 ? prev : { ...prev, [a.id]: h }))} />
                            ))}
                        </Animated.ScrollView>
                    </View>
                </KeyboardSheetScroll>
                {list.length > 1 ? (
                    <View className="flex-row items-center justify-center" style={{ gap: 6, marginTop: 4, paddingBottom: 30 }}>
                        <Text className="font-outfit-semibold" style={{ ...TYPE.caption, color: OS.muted, marginRight: 4 }}>{t('dashboard.rating.counter', { current: page + 1, total: list.length })}</Text>
                        {list.slice(0, 12).map((a, i) => (
                            <View key={a.id} style={{ width: i === page ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: done.has(a.id) ? OS.green : i === page ? OS.blue : '#D5DCEB' }} />
                        ))}
                    </View>
                ) : <View style={{ height: 30 }} />}
            </Animated.View>
        </SlideModal>
    );
}
