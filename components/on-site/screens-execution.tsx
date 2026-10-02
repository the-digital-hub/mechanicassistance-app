import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { MAP_PROVIDER } from '@/lib/maps/provider';
import { MediaSlot } from './MediaSlot';
import {
    ActionBar, Body, Card, CardTitle, Checkbox, Eyebrow, GhostButton, Intro, MaintenanceChecklist, NoteInput, OS,
    PrimaryButton, Tip, useMaintenanceItems,
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
                                <Text className="font-outfit-bold text-[12.5px]" style={{ color: OS.blue }}>{t(`${k}.uploadObd`)}</Text>
                            </TouchableOpacity>
                        ) : (
                            <Card>
                                <CardTitle title={t('appointments.onSite.obd.file')} optional />
                                <MediaSlot kind="file" height={150} placeholder={t('appointments.onSite.obd.placeholder')} onChange={handleObd} />
                            </Card>
                        )}
                    </>
                ) : null}

                <Card>
                    <View className="px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: OS.borderSoft }}>
                        <Text className="font-outfit-bold text-[13px]" style={{ color: OS.text }}>{t(`${k}.listTitle`)}</Text>
                        <Text className="font-outfit-medium text-[11px] mt-0.5" style={{ color: OS.mutedLight }}>
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
                            className="flex-1 font-outfit-regular text-[12.5px] px-3 py-2.5"
                            style={{ borderRadius: 12, borderWidth: 1.5, borderColor: OS.border, backgroundColor: OS.page, color: OS.text }}
                        />
                        <TouchableOpacity onPress={addSearched} className="justify-center px-3.5 rounded-xl" style={{ backgroundColor: OS.blueSoft }}>
                            <Text className="font-outfit-bold text-[12.5px]" style={{ color: OS.blue }}>{t(`${k}.add`)}</Text>
                        </TouchableOpacity>
                    </View>
                    <View className="flex-row justify-between px-4 py-3" style={{ borderTopWidth: 1, borderTopColor: OS.borderSoft }}>
                        <Text className="font-outfit-bold text-[12.5px]" style={{ color: OS.muted }}>{t(`${k}.total`)}</Text>
                        <Text className="font-outfit-bold text-sm" style={{ color: OS.blueDark }}>${partsTotal}</Text>
                    </View>
                </Card>

                <Card>
                    <TouchableOpacity onPress={() => setShopOpen((v) => !v)} className="flex-row items-start gap-3 px-4 py-3.5" style={{ borderBottomWidth: 1, borderBottomColor: OS.borderSoft }}>
                        <View style={{ marginTop: 1 }}><Checkbox checked={shopOpen} size={20} /></View>
                        <View className="flex-1">
                            <Text className="font-outfit-bold text-[13px]" style={{ color: OS.text }}>{t(`${k}.shopOpen`)}</Text>
                            <Text className="font-outfit-regular text-[11.5px] mt-0.5" style={{ color: OS.muted }}>{t(`${k}.shopOpenSub`)}</Text>
                            <View className="flex-row items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full" style={{ backgroundColor: OS.greenSoft, alignSelf: 'flex-start' }}>
                                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: OS.green }} />
                                <Text className="font-outfit-bold text-[11px]" style={{ color: OS.greenDark }}>{t(`${k}.shopBadge`)}</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                    <View className="p-4">
                        <Text className="font-outfit-bold text-xs mb-1" style={{ color: OS.text }}>{t(`${k}.approvalTitle`)}</Text>
                        <Text className="font-outfit-regular text-[11.5px] mb-3" style={{ color: OS.muted }}>{t(`${k}.approvalSub`)}</Text>
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
                                    <Text className="font-outfit-bold text-[13.5px]" style={{ color: OS.greenDark }}>{t(`${k}.approved`)}</Text>
                                    <Text className="font-outfit-medium text-[11.5px] mt-0.5" style={{ color: OS.greenDark }}>{t(`${k}.approvedSub`)}</Text>
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

export function ScreenEvaluateOptions({ context, onSelect }: { context: 'checkin' | 'execution'; onSelect: (r: RedirectReason) => void }) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.options';
    const [reason, setReason] = React.useState<string | null>(null);
    const [note, setNote] = React.useState('');
    const checklist = useMaintenanceItems();
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
                <View className="px-5 pt-3.5"><Eyebrow>{t(`${k}.whyEyebrow`)}</Eyebrow></View>

                <View className="px-4">
                    {!reason ? (
                        REASONS.map((id) => (
                            <TouchableOpacity
                                key={id}
                                onPress={() => setReason(id)}
                                className="flex-row items-center gap-3 px-3.5 py-3 mt-2 bg-white"
                                style={{ borderRadius: 14, borderWidth: 1, borderColor: OS.borderSoft }}
                            >
                                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: OS.border }} />
                                <Text className="flex-1 font-outfit-bold text-[12.5px]" style={{ color: OS.text }}>{label(id)}</Text>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <>
                            <TouchableOpacity
                                onPress={() => setReason(null)}
                                className="flex-row items-center gap-3 px-3.5 py-3 mt-2"
                                style={{ borderRadius: 14, borderWidth: 2, borderColor: OS.blue, backgroundColor: OS.blueSofter }}
                            >
                                <View className="items-center justify-center" style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: OS.blue }}>
                                    <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                                </View>
                                <Text className="flex-1 font-outfit-bold text-[12.5px]" style={{ color: OS.blueDark }}>{label(reason)}</Text>
                                <Text className="font-outfit-bold text-[11.5px]" style={{ color: OS.blue }}>{t('appointments.onSite.common.change')}</Text>
                            </TouchableOpacity>
                            <NoteInput value={note} onChangeText={setNote} white placeholder={reason === 'other' ? t(`${k}.otherPh`) : t(`${k}.notePh`)} />
                        </>
                    )}
                </View>

                {reason ? (
                    <View className="mt-4" style={{ borderTopWidth: 1, borderTopColor: OS.borderSoft }}>
                        <View className="px-5 pt-4">
                            <Eyebrow>{t(`${k}.checklistEyebrow`)}</Eyebrow>
                            <Text className="font-outfit-regular text-[13.5px] leading-5" style={{ color: OS.muted }}>{t(`${k}.checklistIntro`)}</Text>
                        </View>
                        <MaintenanceChecklist state={checklist} />
                        <Tip>{t(`${k}.tip`)}</Tip>
                    </View>
                ) : null}
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

// ─────────── Resolve the issue ───────────
export function ScreenResolveIncident({ issue, partsOrder, onResolved, onNotResolved }: {
    issue: string; partsOrder: PartsOrder | null; onResolved: () => void; onNotResolved: () => void;
}) {
    const { t } = useTranslation();
    const k = 'appointments.onSite.resolve';
    const [seconds, setSeconds] = React.useState(0);
    const [notes, setNotes] = React.useState('');
    const nextPhoto = React.useRef(0);
    const [photos, setPhotos] = React.useState<number[]>([]);
    const checklist = useMaintenanceItems();

    React.useEffect(() => {
        const id = setInterval(() => setSeconds((s) => s + 1), 1000);
        return () => clearInterval(id);
    }, []);
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');

    return (
        <>
            <Body>
                <Intro eyebrow={t(`${k}.eyebrow`)} title={t(`${k}.title`)} subtitle={t(`${k}.subtitle`)} />
                <View className="mx-4 mt-3.5 flex-row items-center justify-between px-4 py-3 rounded-2xl" style={{ backgroundColor: OS.blueSoft }}>
                    <View className="flex-row items-center gap-2">
                        <Ionicons name="time-outline" size={15} color={OS.blue} />
                        <Text className="font-outfit-bold text-[11.5px]" style={{ color: OS.blueDark }}>{t(`${k}.timer`)}</Text>
                    </View>
                    <Text className="font-outfit-bold text-[15px]" style={{ color: OS.blueDark, fontVariant: ['tabular-nums'] }}>{mm}:{ss}</Text>
                </View>

                {partsOrder ? (
                    <>
                        <View className="px-5 pt-4"><Eyebrow>{t(`${k}.pickupEyebrow`)}</Eyebrow></View>
                        <View className="px-5 flex-row items-center flex-wrap gap-2.5">
                            <Text className="font-outfit-bold text-2xl" style={{ color: OS.text }}>{t(`${k}.pickupTitle`)}</Text>
                            <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: OS.greenSoft }}>
                                <Text className="font-outfit-bold text-[11.5px]" style={{ color: OS.greenDark }}>{t(`${k}.paid`)}</Text>
                            </View>
                        </View>
                        <Card>
                            <View className="px-4 py-3" style={{ borderBottomWidth: 1, borderBottomColor: OS.borderSoft }}>
                                <Text className="font-outfit-bold text-[13px]" style={{ color: OS.text }}>{t(`${k}.approvedTitle`)}</Text>
                                <Text className="font-outfit-medium text-[11px] mt-0.5" style={{ color: OS.mutedLight }}>{t(`${k}.approvedSub`)}</Text>
                            </View>
                            {partsOrder.parts.map((p, i) => (
                                <View
                                    key={p.id}
                                    className="flex-row justify-between gap-3 px-4 py-2.5"
                                    style={i < partsOrder.parts.length - 1 ? { borderBottomWidth: 1, borderBottomColor: OS.borderSoft } : undefined}
                                >
                                    <Text className="flex-1 font-outfit-medium text-[12.5px]" style={{ color: OS.text }}>{p.label}</Text>
                                    <Text className="font-outfit-bold text-[12.5px]" style={{ color: OS.blueDark }}>{p.price != null ? `$${p.price}` : '—'}</Text>
                                </View>
                            ))}
                            <View className="mx-4 mt-3.5 px-4 py-3.5 rounded-2xl items-center" style={{ backgroundColor: OS.blueSoft }}>
                                <Text className="font-outfit-bold text-[10.5px] text-center" style={{ color: OS.blueDark }}>{t(`${k}.ticket`)}</Text>
                                <Text className="font-outfit-bold text-[22px] mt-1.5" style={{ color: OS.blueDark, letterSpacing: 1 }}>{partsOrder.receiptCode}</Text>
                            </View>
                            <View className="px-4 pt-3.5">
                                <Text className="font-outfit-bold text-[13px]" style={{ color: OS.text }}>{partsOrder.store.name}</Text>
                                <Text className="font-outfit-regular text-[11.5px] mt-0.5" style={{ color: OS.muted }}>{partsOrder.store.address}</Text>
                            </View>
                            <View className="flex-row items-center gap-1.5 px-4 pt-2.5">
                                <Ionicons name="time-outline" size={14} color={OS.blueDark} />
                                <Text className="font-outfit-bold text-xs" style={{ color: OS.blueDark }}>{t(`${k}.eta`, { minutes: partsOrder.store.etaMinutes })}</Text>
                                <Text className="font-outfit-medium text-[11.5px]" style={{ color: OS.mutedLight }}>{t(`${k}.distance`, { miles: partsOrder.store.distanceMiles })}</Text>
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

                <Card>
                    <View className="flex-row items-center gap-2.5 px-4 py-3">
                        <Ionicons name="construct-outline" size={16} color={OS.mutedLight} />
                        <Text className="flex-1">
                            <Text className="font-outfit-bold text-[10.5px]" style={{ color: OS.mutedLight }}>{t(`${k}.reportedIssue`)} </Text>
                            <Text className="font-outfit-bold text-[12.5px]" style={{ color: OS.text }}>{issue}</Text>
                        </Text>
                    </View>
                </Card>

                <Card>
                    <CardTitle
                        title={t(`${k}.proof`)}
                        optional
                        right={
                            <TouchableOpacity onPress={() => setPhotos((p) => [...p, nextPhoto.current++])}>
                                <Text className="font-outfit-bold text-xs" style={{ color: OS.blue }}>{t(`${k}.addPhoto`)}</Text>
                            </TouchableOpacity>
                        }
                    />
                    {photos.map((id) => (
                        <View key={id}>
                            <MediaSlot height={150} placeholder={t(`${k}.proofPh`)} note onDeleteSlot={() => setPhotos((p) => p.filter((x) => x !== id))} />
                        </View>
                    ))}
                    <View className="px-4 pb-4 pt-1">
                        <NoteInput value={notes} onChangeText={setNotes} placeholder={t(`${k}.workPh`)} rows={3} white />
                    </View>
                </Card>

                <MaintenanceChecklist state={checklist} />
            </Body>
            <ActionBar stacked>
                <Text className="font-outfit-bold text-xs text-center" style={{ color: OS.mutedLight }}>{t(`${k}.question`)}</Text>
                <View className="flex-row gap-3">
                    <GhostButton label={t(`${k}.no`)} onPress={onNotResolved} flex />
                    <PrimaryButton label={t(`${k}.yes`)} onPress={onResolved} tone="green" />
                </View>
            </ActionBar>
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
