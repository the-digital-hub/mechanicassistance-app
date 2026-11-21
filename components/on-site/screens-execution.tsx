import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { MAP_PROVIDER } from '@/lib/maps/provider';
import { TYPE } from '@/lib/ui/type';
import { ExtraCaptures, MediaSlot, useExistingCaptures } from './MediaSlot';
import {
    ActionBar, Body, Card, CardTitle, Checkbox, Eyebrow, Intro, MaintenanceChecklist, NoteInput, OS,
    OnSiteDialog, PrimaryButton, Tip, useMaintenanceItems,
} from './ui';

// Parts purchase, "can't resolve" options and the repair itself. All data here is
// simulated — parts catalog, stores and owner approval have no backend yet.

export interface Part {
    id: string;
    label: string;
    price: number | null;
    checked: boolean;
}

export interface Store {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    etaMinutes: number;
    distanceMiles: number;
}

export interface PartsOrder {
    partsTotal: number;
    parts: Part[];
    store: Store;
    receiptCode: string;
}

export interface RedirectReason {
    id: string;
    label: string;
    note: string;
}

const STORES: Store[] = [
    { name: "O'Reilly Auto Parts", address: '4820 Riverside Dr, Austin, TX', latitude: 30.2382, longitude: -97.7197, etaMinutes: 9, distanceMiles: 3.1 },
    { name: 'NAPA Auto Parts', address: '1210 Congress Ave, Austin, TX', latitude: 30.2747, longitude: -97.7404, etaMinutes: 14, distanceMiles: 5.4 },
    { name: 'AutoZone', address: '900 E 5th St, Austin, TX', latitude: 30.2650, longitude: -97.7340, etaMinutes: 11, distanceMiles: 4.0 },
];

// ─────────── Buy parts ───────────
export function ScreenBuyParts({ obdFilled, onDone }: { obdFilled: boolean; onDone: (order: PartsOrder) => void }) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.buyParts';
    const suggested = React.useCallback((): Part[] => [
        { id: 'p1', label: t(`${k}.parts.p1`), price: 145, checked: true },
        { id: 'p2', label: t(`${k}.parts.p2`), price: 38, checked: true },
        { id: 'p3', label: t(`${k}.parts.p3`), price: 22, checked: false },
    ], [t]);

    const [localObd, setLocalObd] = React.useState(obdFilled);
    const [showObdUpload, setShowObdUpload] = React.useState(false);
    const [parts, setParts] = React.useState<Part[]>(() => (obdFilled ? suggested() : []));
    const [search, setSearch] = React.useState('');
    const [shopOpen, setShopOpen] = React.useState(false);
    const [approval, setApproval] = React.useState<'idle' | 'sent' | 'approved'>('idle');
    const [store] = React.useState(() => STORES[Math.floor(Math.random() * STORES.length)]);
    const [receiptCode] = React.useState(() => `PT-${Math.floor(100000 + Math.random() * 900000)}`);

    React.useEffect(() => {
        if (approval !== 'sent') return;
        const id = setTimeout(() => setApproval('approved'), 2000);
        return () => clearTimeout(id);
    }, [approval]);

    const handleObd = (v: boolean) => {
        setLocalObd(v);
        if (v) setParts((ps) => (ps.length ? ps : suggested()));
    };
    const toggle = (id: string) => setParts((ps) => ps.map((p) => (p.id === id ? { ...p, checked: !p.checked } : p)));
    const addSearched = () => {
        const label = search.trim();
        if (!label) return;
        setParts((ps) => [...ps, { id: `custom-${Date.now()}`, label, price: null, checked: true }]);
        setSearch('');
    };
    const partsTotal = parts.filter((p) => p.checked).reduce((s, p) => s + (p.price ?? 0), 0);

    return (
        <>
            <Body>
                <Intro eyebrow={t(`${k}.eyebrow`)} title={t(`${k}.title`)} subtitle={t(`${k}.subtitle`)} />

                {!localObd ? (
                    <>
                        <Tip tone="orange">{t(`${k}.noObd`)}</Tip>
                        {!showObdUpload ? (
                            <TouchableOpacity onPress={() => setShowObdUpload(true)} className="mx-4 mt-2.5 items-center py-3 rounded-xl" style={{ backgroundColor: OS.blueSoft }}>
                                <Text className="font-outfit-bold text-[13px]" style={{ color: OS.blue }}>{t(`${k}.uploadObd`)}</Text>
                            </TouchableOpacity>
                        ) : (
                            <Card>
                                <CardTitle title={t('appointments.onSite.obd.file')} optional />
                                <MediaSlot kind="file" compact actionLabel={t('appointments.onSite.obd.upload')} actionIcon="cloud-upload-outline" height={150} placeholder={t('appointments.onSite.obd.placeholder')} onChange={handleObd} />
                            </Card>
                        )}
                    </>
                ) : null}

                <Card>
                    <View className="px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: OS.borderSoft }}>
                        <Text className="font-outfit-bold text-[13px]" style={{ color: OS.text }}>{t(`${k}.listTitle`)}</Text>
                        <Text className="font-outfit-medium text-[13px] mt-0.5" style={{ color: OS.mutedLight }}>
                            {localObd ? t(`${k}.matched`) : t(`${k}.searchHint`)}
                        </Text>
                    </View>
                    {parts.map((p, i) => (
                        <TouchableOpacity
                            key={p.id}
                            onPress={() => toggle(p.id)}
                            className="flex-row items-center gap-3 px-4 py-3"
                            style={i < parts.length - 1 ? { borderBottomWidth: 1, borderBottomColor: OS.borderSoft } : undefined}
                        >
                            <Checkbox checked={p.checked} size={20} />
                            <Text className="flex-1 font-outfit-medium text-[13px]" style={{ color: OS.text }}>{p.label}</Text>
                            <Text className="font-outfit-bold text-[13px]" style={{ color: OS.blueDark }}>{p.price != null ? `$${p.price}` : '—'}</Text>
                        </TouchableOpacity>
                    ))}
                    <View className="flex-row gap-2 px-4 py-3">
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            onSubmitEditing={addSearched}
                            placeholder={t(`${k}.searchPh`)}
                            placeholderTextColor={OS.mutedLight}
                            returnKeyType="done"
                            className="flex-1 font-outfit-regular text-[13px] px-3 py-2.5"
                            style={{ borderRadius: 12, borderWidth: 1.5, borderColor: OS.border, backgroundColor: OS.page, color: OS.text }}
                        />
                        <TouchableOpacity onPress={addSearched} className="justify-center px-3.5 rounded-xl" style={{ backgroundColor: OS.blueSoft }}>
                            <Text className="font-outfit-bold text-[13px]" style={{ color: OS.blue }}>{t(`${k}.add`)}</Text>
                        </TouchableOpacity>
                    </View>
                    <View className="flex-row justify-between px-4 py-3" style={{ borderTopWidth: 1, borderTopColor: OS.borderSoft }}>
                        <Text className="font-outfit-bold text-[13px]" style={{ color: OS.muted }}>{t(`${k}.total`)}</Text>
                        <Text className="font-outfit-bold text-sm" style={{ color: OS.blueDark }}>${partsTotal}</Text>
                    </View>
                </Card>

                <Card>
                    <TouchableOpacity onPress={() => setShopOpen((v) => !v)} className="flex-row items-start gap-3 px-4 py-3.5" style={{ borderBottomWidth: 1, borderBottomColor: OS.borderSoft }}>
                        <View style={{ marginTop: 1 }}><Checkbox checked={shopOpen} size={20} /></View>
                        <View className="flex-1">
                            <Text className="font-outfit-bold text-[13px]" style={{ color: OS.text }}>{t(`${k}.shopOpen`)}</Text>
                            <Text className="font-outfit-regular text-[13px] mt-0.5" style={{ color: OS.muted }}>{t(`${k}.shopOpenSub`)}</Text>
                            <View className="flex-row items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full" style={{ backgroundColor: OS.greenSoft, alignSelf: 'flex-start' }}>
                                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: OS.green }} />
                                <Text className="font-outfit-bold text-[13px]" style={{ color: OS.greenDark }}>{t(`${k}.shopBadge`)}</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                    <View className="p-4">
                        <Text className="font-outfit-bold text-[13px] mb-1" style={{ color: OS.text }}>{t(`${k}.approvalTitle`)}</Text>
                        <Text className="font-outfit-regular text-[13px] mb-3" style={{ color: OS.muted }}>{t(`${k}.approvalSub`)}</Text>
                        {approval === 'idle' ? (
                            <TouchableOpacity
                                onPress={() => setApproval('sent')}
                                disabled={!shopOpen}
                                className="items-center py-3.5"
                                style={{ borderRadius: 13, backgroundColor: shopOpen ? OS.blue : OS.blueIce }}
                            >
                                <Text className="text-white font-outfit-bold text-sm">{t(`${k}.sendApproval`)}</Text>
                            </TouchableOpacity>
                        ) : approval === 'sent' ? (
                            <View className="flex-row items-center gap-2.5 py-3 px-1">
                                <ActivityIndicator size="small" color={OS.blue} />
                                <Text className="font-outfit-bold text-[13px]" style={{ color: OS.blue }}>{t(`${k}.waiting`)}</Text>
                            </View>
                        ) : (
                            <View className="flex-row items-center gap-2.5 px-3.5 py-3" style={{ borderRadius: 13, backgroundColor: OS.greenSoft }}>
                                <Ionicons name="checkmark-circle" size={20} color={OS.green} />
                                <View className="flex-1">
                                    <Text className="font-outfit-bold text-[14px]" style={{ color: OS.greenDark }}>{t(`${k}.approved`)}</Text>
                                    <Text className="font-outfit-medium text-[13px] mt-0.5" style={{ color: OS.greenDark }}>{t(`${k}.approvedSub`)}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                </Card>
            </Body>
            <ActionBar>
                <PrimaryButton
                    label={t(`${k}.confirm`)}
                    onPress={() => onDone({ partsTotal, parts: parts.filter((p) => p.checked), store, receiptCode })}
                    disabled={!(shopOpen && approval === 'approved')}
                />
            </ActionBar>
        </>
    );
}

// ─────────── Evaluate options (can't resolve) ───────────
const REASONS = ['notReported', 'obdFlag', 'noParts', 'needsShop', 'other'];

export function ScreenEvaluateOptions({ context, onSelect, checklist: initialChecklist, onChecklistChange }: {
    context: 'checkin' | 'execution';
    onSelect: (r: RedirectReason) => void;
    checklist?: Record<string, boolean>;
    onChecklistChange?: (c: Record<string, boolean>) => void;
}) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.options';
    const [reason, setReason] = React.useState<string | null>(null);
    const [note, setNote] = React.useState('');
    const checklist = useMaintenanceItems(initialChecklist, onChecklistChange);
    const label = (id: string) => t(`${k}.reasons.${id}`);

    return (
        <>
            <Body>
                <Intro
                    eyebrow={context === 'checkin' ? t(`${k}.eyebrowCheckin`) : t(`${k}.eyebrowExecution`)}
                    tone="red"
                    title={t(`${k}.title`)}
                    subtitle={t(`${k}.subtitle`)}
                />

                <Card>
                    {/* 1 · why */}
                    <View className="px-4 pt-4 pb-1">
                        <Text className="font-outfit-bold" style={{ ...TYPE.question, color: OS.text }}>{t(`${k}.whyTitle`)}</Text>
                    </View>
                    {REASONS.map((id) => {
                        const selected = reason === id;
                        return (
                            <TouchableOpacity
                                key={id}
                                onPress={() => setReason(id)}
                                activeOpacity={0.7}
                                accessibilityRole="radio"
                                accessibilityState={{ selected }}
                                className="flex-row items-center px-4 py-3.5"
                                style={{ gap: 12, backgroundColor: selected ? OS.blueSofter : 'transparent', borderTopWidth: 1, borderTopColor: OS.borderSoft }}
                            >
                                <View className="items-center justify-center" style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: selected ? OS.blue : OS.border, backgroundColor: selected ? OS.blue : '#FFFFFF' }}>
                                    {selected ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
                                </View>
                                <Text className={`flex-1 ${selected ? 'font-outfit-bold' : 'font-outfit-medium'}`} style={{ ...TYPE.body, color: selected ? OS.blueDark : OS.text }}>{label(id)}</Text>
                            </TouchableOpacity>
                        );
                    })}

                    {reason ? (
                        <>
                            <View className="px-4 pt-1 pb-4" style={{ borderTopWidth: 1, borderTopColor: OS.borderSoft }}>
                                <NoteInput value={note} onChangeText={setNote} white rows={3} placeholder={reason === 'other' ? t(`${k}.otherPh`) : t(`${k}.notePh`)} />
                            </View>

                            {/* 2 · maintenance checklist */}
                            <View style={{ borderTopWidth: 1, borderTopColor: OS.borderSoft }}>
                                <MaintenanceChecklist state={checklist} bare />
                            </View>
                        </>
                    ) : null}
                </Card>

                {reason ? <Tip>{t(`${k}.tip`)}</Tip> : null}
            </Body>
            <ActionBar>
                <PrimaryButton
                    label={t(`${k}.confirm`)}
                    onPress={() => reason && onSelect({ id: reason, label: label(reason), note })}
                    disabled={!reason}
                />
            </ActionBar>
        </>
    );
}

/** The one icon style of this screen: a rounded tile with a 20px outline icon. */
function IconTile({ name, light }: { name: React.ComponentProps<typeof Ionicons>['name']; light?: boolean }) {
    return (
        <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: light ? 'rgba(255,255,255,0.18)' : OS.blueSoft }}>
            <Ionicons name={name} size={20} color={light ? '#FFFFFF' : OS.blue} />
        </View>
    );
}

// ─────────── Resolve the issue ───────────
export function ScreenResolveIncident({
    issue, partsOrder, workStartedAt, workNotes, onWorkNotesChange,
    onResolved, onNotResolved,
}: {
    issue: string;
    partsOrder: PartsOrder | null;
    /** When the repair started, per the server (ISO); the timer counts from it. */
    workStartedAt: string | null;
    workNotes: string;
    onWorkNotesChange: (notes: string) => void;
    onResolved: () => void;
    onNotResolved: () => void;
}) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.resolve';
    const [outcome, setOutcome] = React.useState<'resolved' | 'not' | null>(null);
    const startedAt = React.useMemo(() => (workStartedAt ? new Date(workStartedAt).getTime() : Date.now()), [workStartedAt]);
    const [seconds, setSeconds] = React.useState(() => Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    const [notes, setNotes] = React.useState(workNotes);
    const walkaroundOut = useExistingCaptures('walkaround_out');
    React.useEffect(() => {
        const id = setInterval(() => setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000))), 1000);
        return () => clearInterval(id);
    }, [startedAt]);

    // Save the notes once the mechanic stops typing.
    const saveNotes = React.useRef(onWorkNotesChange);
    saveNotes.current = onWorkNotesChange;
    React.useEffect(() => {
        if (notes === workNotes) return;
        const id = setTimeout(() => saveNotes.current(notes), 800);
        return () => clearTimeout(id);
    }, [notes, workNotes]);
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');

    return (
        <>
            <Body>
                <Intro eyebrow={t(`${k}.eyebrow`)} title={t(`${k}.title`)} subtitle={t(`${k}.subtitle`)} />
                <LinearGradient
                    colors={['#2F6BFF', '#1E56E3', '#0B2A8E']}
                    locations={[0, 0.5, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0.9, y: 1 }}
                    style={{ marginHorizontal: 16, marginTop: 14, borderRadius: 20, padding: 16 }}
                    testID="job-in-progress"
                >
                    <View className="flex-row items-start justify-between">
                        <View className="flex-row items-center" style={{ gap: 10 }}>
                            <IconTile name="time-outline" light />
                            <View>
                                <Text className="font-outfit-semibold" style={{ ...TYPE.helper, color: 'rgba(255,255,255,0.85)' }}>{t(`${k}.timerLabel`)}</Text>
                                <Text className="font-outfit-bold" style={{ fontSize: 44, lineHeight: 50, letterSpacing: -1, color: '#FFFFFF', marginTop: 2, fontVariant: ['tabular-nums'] }}>{mm}:{ss}</Text>
                            </View>
                        </View>
                        <View className="flex-row items-center" style={{ gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.18)' }}>
                            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' }} />
                            <Text className="font-outfit-bold" style={{ ...TYPE.caption, color: '#FFFFFF' }}>{t(`${k}.inProgress`)}</Text>
                        </View>
                    </View>
                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.22)', marginVertical: 14 }} />
                    <View className="flex-row items-center" style={{ gap: 10 }}>
                        <IconTile name="alert-circle-outline" light />
                        <View className="flex-1">
                            <Text className="font-outfit-semibold" style={{ ...TYPE.caption, color: 'rgba(255,255,255,0.8)' }}>{t(`${k}.issueLabel`)}</Text>
                            <Text className="font-outfit-bold" style={{ ...TYPE.body, color: '#FFFFFF' }}>{issue}</Text>
                        </View>
                    </View>
                </LinearGradient>

                {partsOrder ? (
                    <>
                        <View className="px-5 pt-4"><Eyebrow>{t(`${k}.pickupEyebrow`)}</Eyebrow></View>
                        <View className="px-5 flex-row items-center flex-wrap gap-2.5">
                            <Text className="font-outfit-bold text-2xl" style={{ color: OS.text }}>{t(`${k}.pickupTitle`)}</Text>
                            <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: OS.greenSoft }}>
                                <Text className="font-outfit-bold" style={{ ...TYPE.caption, color: OS.greenDark }}>{t(`${k}.paid`)}</Text>
                            </View>
                        </View>
                        <Card>
                            <View className="px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: OS.borderSoft }}>
                                <Text className="font-outfit-bold" style={{ ...TYPE.body, color: OS.text }}>{t(`${k}.approvedTitle`)}</Text>
                                <Text className="font-outfit-medium mt-0.5" style={{ ...TYPE.helper, color: OS.muted }}>{t(`${k}.approvedSub`)}</Text>
                            </View>
                            {partsOrder.parts.map((p, i) => (
                                <View
                                    key={p.id}
                                    className="flex-row justify-between gap-3 px-4 py-2.5"
                                    style={i < partsOrder.parts.length - 1 ? { borderBottomWidth: 1, borderBottomColor: OS.borderSoft } : undefined}
                                >
                                    <Text className="flex-1 font-outfit-medium" style={{ ...TYPE.body, color: OS.text }}>{p.label}</Text>
                                    <Text className="font-outfit-bold" style={{ ...TYPE.body, color: OS.blueDark }}>{p.price != null ? `$${p.price}` : '—'}</Text>
                                </View>
                            ))}
                            <View className="mx-4 mt-3.5 px-4 py-3.5 rounded-2xl items-center" style={{ backgroundColor: OS.blueSoft }}>
                                <Text className="font-outfit-bold text-center" style={{ ...TYPE.caption, letterSpacing: 0.6, color: OS.blueDark }}>{t(`${k}.ticket`)}</Text>
                                <Text className="font-outfit-bold text-[22px] mt-1.5" style={{ color: OS.blueDark, letterSpacing: 1 }}>{partsOrder.receiptCode}</Text>
                            </View>
                            <View className="px-4 pt-3.5">
                                <Text className="font-outfit-bold" style={{ ...TYPE.body, color: OS.text }}>{partsOrder.store.name}</Text>
                                <Text className="font-outfit-regular mt-0.5" style={{ ...TYPE.helper, color: OS.muted }}>{partsOrder.store.address}</Text>
                            </View>
                            <View className="flex-row items-center gap-1.5 px-4 pt-2.5">
                                <Ionicons name="time-outline" size={18} color={OS.blueDark} />
                                <Text className="font-outfit-bold" style={{ ...TYPE.helper, color: OS.blueDark }}>{t(`${k}.eta`, { minutes: partsOrder.store.etaMinutes })}</Text>
                                <Text className="font-outfit-medium" style={{ ...TYPE.helper, color: OS.muted }}>{t(`${k}.distance`, { miles: partsOrder.store.distanceMiles })}</Text>
                            </View>
                            <View className="p-4">
                                <View className="overflow-hidden" style={{ height: 180, borderRadius: 14 }}>
                                    <MapView
                                        provider={MAP_PROVIDER}
                                        style={{ width: '100%', height: '100%' }}
                                        initialRegion={{ latitude: partsOrder.store.latitude, longitude: partsOrder.store.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
                                    >
                                        <Marker coordinate={{ latitude: partsOrder.store.latitude, longitude: partsOrder.store.longitude }} title={partsOrder.store.name} />
                                    </MapView>
                                </View>
                            </View>
                        </Card>
                        <View className="px-5 pt-4"><Eyebrow>{t(`${k}.fixEyebrow`)}</Eyebrow></View>
                    </>
                ) : null}

                {/* Final photos: the same capture as the check-in's extra photos (video or photos). */}
                <View className="px-5 mt-6">
                    <Text className="font-outfit-bold" style={{ fontSize: 17, lineHeight: 23, color: OS.text }}>
                        {t(`${k}.proof`)}
                        <Text className="font-outfit-medium" style={{ fontSize: 13, color: OS.mutedLight }}>  {t('appointments.onSite.common.optional')}</Text>
                    </Text>
                    <Text className="font-outfit-regular mt-1" style={{ fontSize: 14, lineHeight: 20, color: OS.muted }}>{t(`${k}.proofSub`)}</Text>
                </View>
                <ExtraCaptures videoKind="walkaround_out" photoKind="proof" existingVideo={walkaroundOut[0]} videoPlaceholder={t('appointments.onSite.photos.videoPh')} photoPlaceholder={t(`${k}.proofPh`)} />

                <Card>
                    <CardTitle title={t(`${k}.workTitle`)} optional />
                    <View className="px-4 pb-4 pt-1">
                        <NoteInput value={notes} onChangeText={setNotes} placeholder={t(`${k}.workPh`)} rows={4} white />
                    </View>
                </Card>

                {/* How it ended is a choice made in the page; the bar below only moves on with it. */}
                <View className="px-5 mt-6">
                    <Text className="font-outfit-bold" style={{ ...TYPE.question, color: OS.text }}>{t(`${k}.outcomeTitle`)}</Text>
                </View>
                <View className="mx-4 mt-3" style={{ gap: 10 }}>
                    {([
                        { id: 'resolved' as const, icon: 'checkmark-circle-outline' as const, title: t(`${k}.resolvedTitle`), sub: t(`${k}.resolvedSub`), ink: OS.greenDark, soft: OS.greenSoft },
                        { id: 'not' as const, icon: 'close-circle-outline' as const, title: t(`${k}.notResolvedTitle`), sub: t(`${k}.notResolvedSub`), ink: OS.red, soft: OS.redSoft },
                    ]).map((o) => {
                        const on = outcome === o.id;
                        return (
                            <TouchableOpacity
                                key={o.id}
                                onPress={() => setOutcome(o.id)}
                                activeOpacity={0.8}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: on }}
                                className="flex-row items-center"
                                style={{ gap: 12, padding: 14, borderRadius: 18, backgroundColor: on ? o.soft : '#FFFFFF', borderWidth: 1.5, borderColor: on ? o.ink : OS.border }}
                                testID={`resolve-${o.id}`}
                            >
                                <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: on ? '#FFFFFF' : o.soft }}>
                                    <Ionicons name={o.icon} size={24} color={o.ink} />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-outfit-bold" style={{ fontSize: 16, lineHeight: 22, color: OS.text }}>{o.title}</Text>
                                    <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: OS.muted, marginTop: 1 }}>{o.sub}</Text>
                                </View>
                                <View className="items-center justify-center" style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? o.ink : OS.border, backgroundColor: on ? o.ink : '#FFFFFF' }}>
                                    {on ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </Body>
            <ActionBar>
                <PrimaryButton
                    label={t('appointments.onSite.common.continue')}
                    onPress={() => (outcome === 'resolved' ? onResolved() : outcome === 'not' ? onNotResolved() : undefined)}
                    disabled={!outcome}
                    testID="resolve-continue"
                />
            </ActionBar>
        </>
    );
}

// ─────────── Final check (after the repair is resolved) ───────────
export function ScreenFinalCheck({ checklist: initialChecklist, onChecklistChange, onDone }: {
    checklist?: Record<string, boolean>;
    onChecklistChange?: (c: Record<string, boolean>) => void;
    onDone: () => void;
}) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.finalCheck';
    const w = 'appointments.onSite.resolve';
    const checklist = useMaintenanceItems(initialChecklist, onChecklistChange);
    // Set once the mechanic tries to finish with the checklist unfinished: the checklist then stays flagged.
    const [warned, setWarned] = React.useState(false);
    const [warnOpen, setWarnOpen] = React.useState(false);

    /** Finishing without the checklist hurts the rating and the assistance's compliance: say so first. */
    const finish = () => {
        if (checklist.allChecked) {
            onDone();
            return;
        }
        setWarned(true);
        setWarnOpen(true);
    };

    return (
        <>
            <Body>
                <Intro eyebrow={t(`${k}.eyebrow`)} tone="green" title={t(`${k}.title`)} subtitle={t(`${k}.subtitle`)} />
                <MaintenanceChecklist state={checklist} highlight={warned && !checklist.allChecked} />
            </Body>
            <ActionBar>
                <PrimaryButton label={t(`${k}.finish`)} onPress={finish} tone="green" testID="final-check-finish" />
            </ActionBar>
            <OnSiteDialog
                visible={warnOpen}
                tone="orange"
                icon="clipboard-outline"
                title={t(`${w}.checklistWarnTitle`)}
                body={t(`${w}.checklistWarnBody`)}
                primaryLabel={t(`${w}.checklistWarnFix`)}
                onPrimary={() => setWarnOpen(false)}
                secondaryLabel={t(`${w}.checklistWarnSkip`)}
                onSecondary={() => {
                    setWarnOpen(false);
                    onDone();
                }}
                testID="checklist-warning"
            />
        </>
    );
}

// ─────────── Maintenance (standalone; not linked in the flow, as in the design) ───────────
export function ScreenMaintenance({ onNext }: { onNext: () => void }) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.maintenance';
    const checklist = useMaintenanceItems();
    return (
        <>
            <Body>
                <Intro eyebrow={t(`${k}.eyebrow`)} tone="green" title={t(`${k}.title`)} subtitle={t(`${k}.intro`)} />
                <MaintenanceChecklist state={checklist} withHeader={false} compact={false} />
            </Body>
            <ActionBar>
                <PrimaryButton label={t(`${k}.finish`)} onPress={onNext} disabled={!checklist.allChecked} tone="green" />
            </ActionBar>
        </>
    );
}
