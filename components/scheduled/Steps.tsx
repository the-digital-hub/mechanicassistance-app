import { TYPE } from '@/lib/ui/type';
import {
    Calendar,
    Camera,
    Car,
    Check,
    Clock,
    Radio,
    ChevronDown,
    ChevronRight,
    CircleDot,
    ClipboardCheck,
    Cog,
    Crosshair,
    Disc,
    FileText,
    Flame,
    Gauge,
    Home,
    MapPin,
    Plus,
    Snowflake,
    ShieldCheck,
    SlidersHorizontal,
    Store,
    Thermometer,
    Upload,
    User,
    Video,
    Wrench,
    X,
    Zap,
    type LucideIcon,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import type { Address, ScheduledServiceCategory, ScheduledServiceItem, Vehicle } from '@/lib/dao/interfaces';
import { addressDisplayName } from '@/lib/address';
import { CalendarPanel, DateField, SelectField, type SelectOption } from '@/components/scheduled/DateTime';
import { RadiusSlider } from '@/components/scheduled/RadiusSlider';
import type { PendingAttachment } from '@/lib/media/attachments';
import {
    bookableDates,
    dateFromKey,
    daysLabel,
    earliestMinutes,
    formatMinutes,
    isSameDay,
    MAX_EVIDENCE,
    MAX_SERVICES,
    timeSlots,
    type ScheduledDraft,
    type ServiceMode,
} from '@/lib/scheduled/draft';

import { categoryIcon } from '@/lib/ui/categoryIcon';
import { PickCard, PickChildren, PickGroup, PickItem, PickList, PickedChips, SearchField } from './picker';
import { CARD_STYLE, Checkbox, ChoiceCard, Chip, FieldLabel, Note, SC, StepHead, TextField, VehicleIdsRow } from './ui';

const SLOT_MIN = 6 * 60;
const SLOT_MAX = 21 * 60;

type Patch = (p: Partial<ScheduledDraft>) => void;

const CATEGORY_ICONS: Record<string, LucideIcon> = {
    preventive_maintenance: Wrench,
    tires_wheels: CircleDot,
    suspension_steering: SlidersHorizontal,
    brakes: Disc,
    electrical_system: Zap,
    hvac_ac: Snowflake,
    engine_ignition: Flame,
    cooling_system: Thermometer,
    engine_accessories_belts: Cog,
    transmission_drivetrain: Gauge,
    general_inspection: ClipboardCheck,
};

/** The row of a catalog item in the app's language, falling back to the English name. */
export function itemName(item: { name: string; translations?: { languageId: number; name: string }[] }, languageId: number | null): string {
    if (languageId === null || !item.translations?.length) return item.name;
    return item.translations.find((tr) => tr.languageId === languageId)?.name ?? item.name;
}

function itemDetails(item: ScheduledServiceItem, languageId: number | null): string | null {
    const translated = languageId !== null ? item.translations?.find((tr) => tr.languageId === languageId)?.details : null;
    return translated || item.details || null;
}

// ───────────── Step 1 · Vehicle ─────────────

export function VehicleStep({
    draft,
    patch,
    vehicles,
    loading,
    onPick,
    onAddVehicle,
}: {
    draft: ScheduledDraft;
    patch: Patch;
    vehicles: Vehicle[];
    loading: boolean;
    onPick: (v: Vehicle) => void;
    onAddVehicle: () => void;
}) {
    const { t } = useTranslation();
    return (
        <View style={{ gap: 20 }}>
            <StepHead eyebrow={t('scheduled.vehicle.eyebrow')} title={t('scheduled.vehicle.title')} sub={t('scheduled.vehicle.sub')} />
            {loading ? (
                <ActivityIndicator color={SC.blue} style={{ marginTop: 24 }} />
            ) : vehicles.length === 0 ? (
                <View style={{ ...CARD_STYLE, padding: 20, alignItems: 'center', gap: 10 }}>
                    <Car size={28} color={SC.blue} />
                    <Text className="font-outfit-bold" style={{ fontSize: 15, color: SC.text }}>{t('scheduled.vehicle.noVehicles')}</Text>
                    <Text className="font-outfit-regular text-center" style={{ fontSize: 13, color: SC.muted }}>{t('scheduled.vehicle.noVehiclesSub')}</Text>
                    <TouchableOpacity onPress={onAddVehicle} accessibilityRole="button" className="flex-row items-center" style={{ gap: 6, marginTop: 4 }}>
                        <Plus size={16} color={SC.blue} />
                        <Text className="font-outfit-bold" style={{ fontSize: 14, color: SC.blue }}>{t('scheduled.vehicle.addVehicle')}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={{ gap: 10 }}>
                    {vehicles.map((v) => {
                        const name = [v.year, v.make, v.model].filter(Boolean).join(' ');
                        return <ChoiceCard key={v.id} on={draft.vehicleId === v.id} onPress={() => onPick(v)} title={name} detail={<VehicleIdsRow plate={v.plate} vin={v.vin} plateLabel={t('scheduled.vehicle.plate')} />} />;
                    })}
                    <TouchableOpacity onPress={onAddVehicle} accessibilityRole="button" className="flex-row items-center justify-center" style={{ gap: 8, paddingVertical: 13, borderRadius: 16, borderWidth: 1.5, borderColor: SC.border }}>
                        <Plus size={16} color={SC.blue} />
                        <Text className="font-outfit-bold" style={{ fontSize: 14, color: SC.blue }}>{t('scheduled.vehicle.addAnother')}</Text>
                    </TouchableOpacity>
                </View>
            )}
            {draft.vehicleId ? (
                <View>
                    <FieldLabel>{t('scheduled.vehicle.mileageLabel')}</FieldLabel>
                    <TextField
                        value={draft.mileage}
                        onChangeText={(v) => patch({ mileage: v.replace(/[^0-9,]/g, '') })}
                        keyboardType="number-pad"
                        placeholder={t('scheduled.vehicle.mileagePlaceholder')}
                        maxLength={9}
                    />
                    <Text className="font-outfit-regular" style={{ fontSize: 13, color: SC.muted, marginTop: 6 }}>{t('scheduled.vehicle.mileageHint')}</Text>
                </View>
            ) : null}
        </View>
    );
}

// ───────────── Step 2 · Location ─────────────

export function LocationStep({
    draft,
    patch,
    addresses,
    onPickSaved,
    onUseCurrent,
    onAddAddress,
    busy,
    error,
}: {
    draft: ScheduledDraft;
    patch: Patch;
    addresses: Address[];
    onPickSaved: (a: Address) => void;
    onUseCurrent: () => void;
    onAddAddress: () => void;
    busy: boolean;
    error: string | null;
}) {
    const { t } = useTranslation();
    const loc = draft.location;
    const mode = draft.mode;
    const modes: { id: ServiceMode; icon: LucideIcon; title: string; sub: string }[] = [
        { id: 'onsite', icon: Home, title: t('scheduled.location.modeOnsite'), sub: t('scheduled.location.modeOnsiteSub') },
        { id: 'workshop', icon: Store, title: t('scheduled.location.modeShop'), sub: t('scheduled.location.modeShopSub') },
    ];
    const chosen = modes.find((m) => m.id === mode);
    return (
        <View style={{ gap: 20 }}>
            <StepHead eyebrow={t('scheduled.location.eyebrow')} title={t('scheduled.location.title')} sub={t('scheduled.location.subChoose')} />

            {!chosen ? (
                <View style={{ gap: 10 }} accessibilityRole="radiogroup">
                    {modes.map((m) => (
                        <ChoiceCard key={m.id} on={false} onPress={() => patch({ mode: m.id })} icon={m.icon} title={m.title} sub={m.sub} />
                    ))}
                </View>
            ) : (
                <View style={{ gap: 8 }}>
                    <View className="flex-row items-center justify-between">
                        <FieldLabel>{t('scheduled.location.yourChoice')}</FieldLabel>
                        <TouchableOpacity onPress={() => patch({ mode: null })} accessibilityRole="button" hitSlop={8}>
                            <Text className="font-outfit-bold" style={{ ...TYPE.helper, color: SC.blue }}>{t('scheduled.location.change')}</Text>
                        </TouchableOpacity>
                    </View>
                    <ChoiceCard on onPress={() => undefined} icon={chosen.icon} title={chosen.title} sub={chosen.sub} />
                </View>
            )}

            {chosen ? (
                <View>
                    <FieldLabel>{mode === 'workshop' ? t('scheduled.location.searchNear') : t('scheduled.location.yourAddresses')}</FieldLabel>
                    <View style={{ gap: 10 }}>
                        {addresses.map((a) => {
                            const line = [a.street, a.apartment, a.city, [a.state, a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
                            return (
                                <ChoiceCard
                                    key={a.id}
                                    on={loc?.source === 'saved' && loc.addressId === a.id}
                                    onPress={() => onPickSaved(a)}
                                    icon={MapPin}
                                    badge={addressDisplayName(a, t)}
                                    title={line}
                                />
                            );
                        })}
                        <ChoiceCard
                            on={loc?.source === 'current'}
                            onPress={onUseCurrent}
                            icon={Crosshair}
                            title={t('scheduled.location.currentLocation')}
                            sub={busy ? t('scheduled.location.locating') : loc?.source === 'current' ? loc.line : t('scheduled.location.currentLocationSub')}
                        />
                        {addresses.length === 0 ? (
                            <TouchableOpacity onPress={onAddAddress} accessibilityRole="button" className="flex-row items-center" style={{ gap: 6, paddingVertical: 4 }}>
                                <Plus size={16} color={SC.blue} />
                                <Text className="font-outfit-bold" style={{ ...TYPE.body, color: SC.blue }}>{t('scheduled.location.addAddress')}</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                    {error ? <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: SC.red, marginTop: 8 }}>{error}</Text> : null}
                </View>
            ) : null}

            {mode === 'workshop' ? (
                <View style={{ gap: 14 }}>
                    <View>
                        <FieldLabel>{t('scheduled.location.radius')}</FieldLabel>
                        <RadiusSlider value={draft.radiusMiles} onChange={(radiusMiles) => patch({ radiusMiles })} label={t('scheduled.location.radiusLook')} unit={t('scheduled.location.miles', { count: draft.radiusMiles })} />
                    </View>
                    <Note>{t('scheduled.location.shopNote', { count: draft.radiusMiles })}</Note>
                </View>
            ) : null}

            {mode === 'onsite' ? (
                <View>
                    <FieldLabel>{t('scheduled.location.contactTitle')}</FieldLabel>
                    <View className="flex-row" style={{ gap: 8, marginBottom: draft.contactIsOwner ? 0 : 12 }}>
                        <Chip on={draft.contactIsOwner} onPress={() => patch({ contactIsOwner: true })}>{t('scheduled.location.contactMe')}</Chip>
                        <Chip on={!draft.contactIsOwner} onPress={() => patch({ contactIsOwner: false })}>{t('scheduled.location.contactSomeone')}</Chip>
                    </View>
                    {!draft.contactIsOwner ? (
                        <View style={{ gap: 12 }}>
                            <View className="flex-row" style={{ gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <FieldLabel>{t('scheduled.location.firstName')}</FieldLabel>
                                    <TextField value={draft.contactFirst} onChangeText={(v) => patch({ contactFirst: v })} autoCapitalize="words" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <FieldLabel>{t('scheduled.location.lastName')}</FieldLabel>
                                    <TextField value={draft.contactLast} onChangeText={(v) => patch({ contactLast: v })} autoCapitalize="words" />
                                </View>
                            </View>
                            <View>
                                <FieldLabel>{t('scheduled.location.phone')}</FieldLabel>
                                <TextField value={draft.contactPhone} onChangeText={(v) => patch({ contactPhone: v })} keyboardType="phone-pad" placeholder={t('scheduled.location.phonePlaceholder')} />
                            </View>
                        </View>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

// ───────────── Step 3 · Services ─────────────

export function ServicesStep({
    draft,
    patch,
    categories,
    loading,
    failed,
    onRetry,
    languageId,
}: {
    draft: ScheduledDraft;
    patch: Patch;
    categories: ScheduledServiceCategory[];
    loading: boolean;
    failed: boolean;
    onRetry: () => void;
    languageId: number | null;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState<Set<string>>(new Set());

    // `open` is what shows (the services); `outlineId` is the card itself (outline and arrow). A card stays open
    // while services are picked in it: it closes only when it is tapped again or another card is opened.
    const [outlineId, setOutlineId] = useState<string | null>(null);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    const cancelTimers = () => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
    };
    const later = (fn: () => void, ms: number) => {
        timers.current.push(setTimeout(fn, ms));
    };
    useEffect(() => cancelTimers, []);

    // Opening a category closes the one that was open, and only once it has finished closing the new one
    // opens: one card at a time, each in its turn.
    const toggleOpen = (id: string) => {
        cancelTimers();
        if (open.has(id)) {
            setOpen(new Set<string>());
            setOutlineId(null);
        } else if (open.size > 0) {
            setOpen(new Set<string>());
            setOutlineId(null);
            later(() => {
                setOpen(new Set<string>([id]));
                setOutlineId(id);
            }, 180);
        } else {
            setOpen(new Set<string>([id]));
            setOutlineId(id);
        }
    };

    const toggleService = (code: string) => {
        const has = draft.services.includes(code);
        if (!has && draft.services.length >= MAX_SERVICES) return;
        patch({ services: has ? draft.services.filter((c) => c !== code) : [...draft.services, code] });
    };

    const [query, setQuery] = useState('');
    const q = query.trim().toLowerCase();
    // A match in the group's name keeps all of its services; otherwise only the services that match.
    const visible = categories
        .map((cat) => {
            if (!q) return { cat, services: cat.services };
            if (itemName(cat, languageId).toLowerCase().includes(q)) return { cat, services: cat.services };
            const services = cat.services.filter((sv) => `${itemName(sv, languageId)} ${itemDetails(sv, languageId) ?? ''}`.toLowerCase().includes(q));
            return { cat, services };
        })
        .filter((g) => g.services.length > 0);

    // What is picked, as badges (tap one to take it off).
    const picked = categories.flatMap((cat) => cat.services).filter((sv) => draft.services.includes(sv.code));

    return (
        <View style={{ gap: 16 }}>
            <StepHead eyebrow={t('scheduled.services.eyebrow')} title={t('scheduled.services.title')} sub={t('scheduled.services.sub')} />

            <SearchField value={query} onChangeText={setQuery} placeholder={t('scheduled.services.searchPlaceholder')} testID="services-search" />

            <PickedChips chips={picked.map((sv) => ({ key: sv.code, label: itemName(sv, languageId), onRemove: () => toggleService(sv.code) }))} />

            {loading ? (
                <ActivityIndicator color={SC.blue} style={{ marginTop: 24 }} />
            ) : failed ? (
                <View style={{ ...CARD_STYLE, padding: 20, alignItems: 'center', gap: 10 }}>
                    <Text className="font-outfit-semibold text-center" style={{ fontSize: 14, color: SC.text }}>{t('scheduled.services.loadFailed')}</Text>
                    <TouchableOpacity onPress={onRetry} accessibilityRole="button">
                        <Text className="font-outfit-bold" style={{ fontSize: 14, color: SC.blue }}>{t('scheduled.services.retry')}</Text>
                    </TouchableOpacity>
                </View>
            ) : categories.length === 0 ? (
                <Text className="font-outfit-regular" style={{ fontSize: 14, color: SC.muted }}>{t('scheduled.services.empty')}</Text>
            ) : visible.length === 0 ? (
                <View style={{ ...CARD_STYLE, padding: 20, alignItems: 'center' }}>
                    <Text className="font-outfit-regular" style={{ ...TYPE.body, color: SC.muted }}>{t('scheduled.services.noResults')}</Text>
                </View>
            ) : (
                <PickList>
                    {visible.map(({ cat, services }) => {
                        const Icon = CATEGORY_ICONS[cat.code] ?? categoryIcon({ code: cat.code, name: cat.name });
                        const count = cat.services.filter((sv) => draft.services.includes(sv.code)).length;
                        const expanded = q ? true : open.has(cat.id);
                        return (
                            <PickCard key={cat.id} picked={count > 0} open={q ? true : outlineId === cat.id}>
                                <PickGroup icon={Icon} title={itemName(cat, languageId)} count={count} open={q ? true : outlineId === cat.id} onPress={() => toggleOpen(cat.id)} first />
                                {expanded ? (
                                    <PickChildren>
                                        {services.map((sv, si) => (
                                            <PickItem
                                                key={sv.code}
                                                label={itemName(sv, languageId)}
                                                details={itemDetails(sv, languageId)}
                                                on={draft.services.includes(sv.code)}
                                                tone="tint"
                                                first={si === 0}
                                                onPress={() => toggleService(sv.code)}
                                            />
                                        ))}
                                    </PickChildren>
                                ) : null}
                            </PickCard>
                        );
                    })}
                </PickList>
            )}

            {picked.length > 0 ? (
                <View style={{ gap: 12 }}>
                    <FieldLabel>{t('scheduled.services.detailsTitle')}</FieldLabel>
                    {picked.map((sv) => (
                        <View key={sv.code} style={{ gap: 6 }}>
                            <Text className="font-outfit-semibold" style={{ ...TYPE.helper, color: SC.text }}>{itemName(sv, languageId)}</Text>
                            <TextField
                                multiline
                                value={draft.serviceDetails[sv.code] ?? ''}
                                onChangeText={(v) => patch({ serviceDetails: { ...draft.serviceDetails, [sv.code]: v } })}
                                placeholder={t('scheduled.services.detailsPlaceholder')}
                                accessibilityLabel={t('scheduled.services.detailsLabel', { name: itemName(sv, languageId) })}
                                maxLength={300}
                            />
                        </View>
                    ))}
                </View>
            ) : null}

            <View>
                <FieldLabel>{t('scheduled.services.customLabel')}</FieldLabel>
                <TextField multiline value={draft.customRequest} onChangeText={(v) => patch({ customRequest: v })} placeholder={t('scheduled.services.customPlaceholder')} maxLength={500} />
            </View>
        </View>
    );
}

// ───────────── Step 4 · Availability ─────────────

export function AvailabilityStep({
    draft,
    patch,
    evidence,
    onAddEvidence,
    onRemoveEvidence,
    now,
}: {
    draft: ScheduledDraft;
    patch: Patch;
    evidence: PendingAttachment[];
    onAddEvidence: () => void;
    onRemoveEvidence: (index: number) => void;
    now: Date;
}) {
    const { t, i18n } = useTranslation();
    const days = bookableDates(now);
    const earliest = draft.date ? earliestMinutes(draft.date, now) : 0;
    const sameDay = draft.dateMode === 'exact' && draft.date ? isSameDay(draft.date, now) : false;
    // Which end of a range has its calendar open: shown full width under both fields.
    const [openEnd, setOpenEnd] = useState<'from' | 'to' | null>(null);
    const minDate = dateFromKey(days[0]);
    const maxDate = dateFromKey(days[days.length - 1]);

    const pickDay = (key: string) => {
        // The window picked for another day may fall inside today's lead time (or end before it starts).
        const min = earliestMinutes(key, now);
        const fromOk = draft.fromMin != null && draft.fromMin >= min;
        patch({
            date: key,
            // A range never ends before it starts.
            ...(draft.dateMode === 'range' && (!draft.dateTo || draft.dateTo < key) ? { dateTo: key } : {}),
            ...(fromOk ? {} : { fromMin: null, toMin: null }),
        });
    };

    const setDateMode = (dateMode: 'exact' | 'range') => {
        setOpenEnd(null);
        patch({ dateMode, dateTo: dateMode === 'range' ? draft.dateTo || draft.date : '' });
    };

    // Start from the first day that still has time left and a window on it, as the design opens pre-filled.
    useEffect(() => {
        if (draft.date && draft.fromMin != null && draft.toMin != null) return;
        const day = draft.date || days.find((k) => Math.ceil(earliestMinutes(k, now) / 30) * 30 + 30 <= SLOT_MAX) || days[0];
        const start = Math.max(SLOT_MIN, Math.ceil(earliestMinutes(day, now) / 30) * 30, 12 * 60 + 30 <= SLOT_MAX ? 12 * 60 + 30 : SLOT_MIN);
        const from = Math.min(start, SLOT_MAX - 60);
        patch({ date: day, fromMin: from, toMin: Math.min(SLOT_MAX, from + 240) });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fromOptions: SelectOption[] = timeSlots().slice(0, -1).map((m) => ({ value: m, label: formatMinutes(m), disabled: m < earliest }));
    const toOptions: SelectOption[] = timeSlots().map((m) => ({ value: m, label: formatMinutes(m), disabled: draft.fromMin == null || m <= draft.fromMin }));

    const setFrom = (m: number) => patch({ fromMin: m, ...(draft.toMin != null && draft.toMin <= m ? { toMin: Math.min(SLOT_MAX, m + 60) } : {}) });

    const card = { ...CARD_STYLE, padding: 14, gap: 12 } as const;
    const Required = ({ children }: { children: string }) => (
        <Text className="font-outfit-bold" style={{ ...TYPE.body, color: SC.text, marginBottom: 6 }}>{children} *</Text>
    );

    return (
        <View style={{ gap: 16 }}>
            <StepHead eyebrow={t('scheduled.availability.eyebrow')} title={t('scheduled.availability.title')} sub={t('scheduled.availability.sub')} />

            <View style={{ ...card, gap: 14 }}>
                <View className="flex-row items-center" style={{ gap: 10 }}>
                    <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: SC.blueSoft }}><Calendar size={18} color={SC.blue} /></View>
                    <Text className="font-outfit-bold" style={{ ...TYPE.group, letterSpacing: -0.2, color: SC.text }}>{t('scheduled.availability.cardTitle')}</Text>
                </View>

                <View className="flex-row" style={{ gap: 8 }}>
                    {(['exact', 'range'] as const).map((mode) => {
                        const on = draft.dateMode === mode;
                        return (
                            <TouchableOpacity
                                key={mode}
                                onPress={() => setDateMode(mode)}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityState={{ selected: on }}
                                style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: on ? SC.blue : '#FFFFFF', borderWidth: on ? 0 : 1, borderColor: SC.border }}
                            >
                                <Text className="font-outfit-bold" style={{ ...TYPE.option, color: on ? '#FFFFFF' : SC.text }}>{t(mode === 'exact' ? 'scheduled.availability.exactDate' : 'scheduled.availability.dateRange')}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {draft.dateMode === 'exact' ? (
                    <View>
                        <View className="flex-row items-center justify-between" style={{ marginBottom: 6 }}>
                            <Text className="font-outfit-bold" style={{ ...TYPE.body, color: SC.text }}>{t('scheduled.availability.serviceDate')} *</Text>
                            {sameDay ? (
                                <View className="rounded-full" style={{ paddingHorizontal: 9, paddingVertical: 3, backgroundColor: SC.blueSoft }}>
                                    <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 0.8, color: SC.blue }}>{t('scheduled.availability.sameDayBadge')}</Text>
                                </View>
                            ) : null}
                        </View>
                        <DateField value={draft.date} min={minDate} max={maxDate} locale={i18n.language} onChange={pickDay} accessibilityLabel={t('scheduled.availability.serviceDate')} />
                    </View>
                ) : (
                    <View style={{ gap: 10 }}>
                        <View className="flex-row" style={{ justifyContent: 'space-between' }}>
                            <View style={{ width: '48.5%' }}>
                                <Required>{t('scheduled.availability.rangeFromLabel')}</Required>
                                <DateField hidePicker open={openEnd === 'from'} onToggle={() => setOpenEnd(openEnd === 'from' ? null : 'from')} value={draft.date} min={minDate} max={maxDate} locale={i18n.language} onChange={pickDay} accessibilityLabel={t('scheduled.availability.rangeFromLabel')} />
                            </View>
                            <View style={{ width: '48.5%' }}>
                                <Required>{t('scheduled.availability.rangeToLabel')}</Required>
                                <DateField hidePicker open={openEnd === 'to'} onToggle={() => setOpenEnd(openEnd === 'to' ? null : 'to')} value={draft.dateTo} min={dateFromKey(draft.date || days[0])} max={maxDate} locale={i18n.language} onChange={(dateTo) => patch({ dateTo })} accessibilityLabel={t('scheduled.availability.rangeToLabel')} />
                            </View>
                        </View>
                        {openEnd ? (
                            <CalendarPanel
                                value={openEnd === 'from' ? draft.date : draft.dateTo}
                                min={openEnd === 'from' ? minDate : dateFromKey(draft.date || days[0])}
                                max={maxDate}
                                locale={i18n.language}
                                onChange={(key) => (openEnd === 'from' ? pickDay(key) : patch({ dateTo: key }))}
                                onClose={() => setOpenEnd(null)}
                            />
                        ) : null}
                    </View>
                )}

                <View style={{ height: 1, backgroundColor: SC.borderSoft }} />

                <View>
                    <Text className="font-outfit-bold" style={{ ...TYPE.caption, letterSpacing: 1.2, color: SC.muted, marginBottom: 10 }}>{t('scheduled.availability.windowLabel')} *</Text>
                    <View className="flex-row" style={{ gap: 10 }}>
                        <View style={{ flex: 1 }}>
                            <Required>{t('scheduled.availability.from')}</Required>
                            <SelectField value={draft.fromMin} options={fromOptions} placeholder={t('scheduled.availability.selectTime')} onSelect={setFrom} accessibilityLabel={t('scheduled.availability.from')} timeGrid />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Required>{t('scheduled.availability.to')}</Required>
                            <SelectField value={draft.toMin} options={toOptions} placeholder={t('scheduled.availability.selectTime')} onSelect={(m) => patch({ toMin: m })} accessibilityLabel={t('scheduled.availability.to')} timeGrid />
                        </View>
                    </View>
                </View>

                <View className="flex-row" style={{ gap: 10, padding: 12, borderRadius: 12, backgroundColor: SC.blueSofter, borderWidth: 1, borderColor: SC.blueSoft }}>
                    <ShieldCheck size={18} color={SC.blue} style={{ marginTop: 1 }} />
                    <Text className="font-outfit-regular flex-1" style={{ ...TYPE.helper, color: SC.text }}>
                        <Text className="font-outfit-bold">{sameDay ? t('scheduled.availability.sameDayTitle') : t('scheduled.availability.windowTitle')} </Text>
                        {sameDay ? t('scheduled.availability.sameDayBody') : t('scheduled.availability.windowBody')}
                    </Text>
                </View>
            </View>

            <View style={{ ...card, gap: 10 }}>
                <View>
                    <Text className="font-outfit-bold" style={{ ...TYPE.group, letterSpacing: -0.2, color: SC.text }}>
                        {t('scheduled.availability.detailsTitle')} <Text className="font-outfit-semibold" style={{ color: SC.muted }}>{t('scheduled.availability.optional')}</Text>
                    </Text>
                    <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: SC.muted, marginTop: 4 }}>{t('scheduled.availability.detailsSub')}</Text>
                </View>
                <TextField multiline value={draft.symptoms} onChangeText={(v) => patch({ symptoms: v })} placeholder={t('scheduled.availability.symptomsPlaceholder')} maxLength={1000} style={{ borderColor: SC.border, borderRadius: 14 }} />
            </View>

            <View style={card}>
                <View className="flex-row items-center" style={{ gap: 10 }}>
                    <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: SC.blueSoft }}><Camera size={18} color={SC.blue} /></View>
                    <Text className="font-outfit-bold flex-1" style={{ ...TYPE.group, letterSpacing: -0.2, color: SC.text }}>
                        {t('scheduled.availability.evidenceTitle')} <Text className="font-outfit-semibold" style={{ color: SC.muted }}>{t('scheduled.availability.optional')}</Text>
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={onAddEvidence}
                    disabled={evidence.length >= MAX_EVIDENCE}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    className="flex-row items-center justify-center"
                    style={{ gap: 10, paddingVertical: 16, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: SC.border, backgroundColor: SC.blueSofter, opacity: evidence.length >= MAX_EVIDENCE ? 0.5 : 1 }}
                >
                    <Upload size={20} color={SC.blue} />
                    <View>
                        <Text className="font-outfit-semibold text-center" style={{ ...TYPE.cardTitle, lineHeight: 20, color: SC.text }}>{t('scheduled.availability.uploadTitle')}</Text>
                        <Text className="font-outfit-regular text-center" style={{ ...TYPE.caption, color: SC.muted }}>{t('scheduled.availability.uploadHint')}</Text>
                    </View>
                </TouchableOpacity>
                {evidence.length > 0 ? (
                    <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                        {evidence.map((file, i) => (
                            <View key={`${file.uri}-${i}`} style={{ width: 76, height: 76, borderRadius: 12, overflow: 'hidden', backgroundColor: SC.blueSoft }}>
                                {file.type === 'photo' ? (
                                    <Image source={{ uri: file.uri }} style={{ width: '100%', height: '100%' }} />
                                ) : (
                                    <View className="flex-1 items-center justify-center"><Video size={24} color={SC.blue} /></View>
                                )}
                                <TouchableOpacity
                                    onPress={() => onRemoveEvidence(i)}
                                    accessibilityRole="button"
                                    accessibilityLabel={t('scheduled.availability.remove')}
                                    hitSlop={8}
                                    className="items-center justify-center"
                                    style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(11,21,48,0.7)' }}
                                >
                                    <X size={12} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                ) : null}
            </View>
        </View>
    );
}

// ───────────── Step 5 · Review ─────────────

function ReviewRow({ icon: Icon, label, value, onEdit, last }: { icon: LucideIcon; label: string; value: string; onEdit?: () => void; last?: boolean }) {
    const { t } = useTranslation();
    return (
        <View className="flex-row items-start" style={{ gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: SC.borderSoft }}>
            <View className="items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: SC.blueSoft }}>
                <Icon size={17} color={SC.blue} />
            </View>
            <View className="flex-1">
                <Text className="font-outfit-bold" style={{ fontSize: 12, letterSpacing: 1, color: SC.muted }}>{label}</Text>
                <Text className="font-outfit-bold" style={{ fontSize: 14, lineHeight: 19, color: SC.text, marginTop: 2 }}>{value}</Text>
            </View>
            {onEdit ? (
                <TouchableOpacity onPress={onEdit} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t('scheduled.review.edit')} ${label}`}>
                    <Text className="font-outfit-bold" style={{ fontSize: 13, color: SC.blue }}>{t('scheduled.review.edit')}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

/** "Fri, Nov 20 (today) · 12:30 PM – 4:30 PM", the way the review and the sent screens show the window. */
export function windowText(draft: ScheduledDraft, now: Date, todayLabel: string): string {
    const days = draft.date ? daysLabel(draft) : '—';
    const today = draft.dateMode === 'exact' && draft.date && isSameDay(draft.date, now) ? ` (${todayLabel})` : '';
    const hours = draft.fromMin != null && draft.toMin != null ? ` · ${formatMinutes(draft.fromMin)} – ${formatMinutes(draft.toMin)}` : '';
    return `${days}${today}${hours}`;
}

export function ReviewStep({
    draft,
    services,
    evidenceCount,
    goTo,
    now,
}: {
    draft: ScheduledDraft;
    /** The selected services, with the name to show. */
    services: { code: string; name: string }[];
    evidenceCount: number;
    goTo: (step: number) => void;
    now: Date;
}) {
    const { t } = useTranslation();
    const contact = draft.contactIsOwner
        ? t('scheduled.review.me')
        : [draft.contactFirst, draft.contactLast].filter(Boolean).join(' ') + (draft.contactPhone ? ` · ${draft.contactPhone}` : '');
    const shop = draft.mode === 'workshop';
    const place = draft.location?.label || draft.location?.line || '';
    const locationLabel = shop
        ? t('scheduled.review.shopWithin', { count: draft.radiusMiles, place })
        : t('scheduled.review.atYourLocation', { place: draft.location?.line ?? '—' });
    const serviceLines = [
        ...services.map((sv) => {
            const detail = (draft.serviceDetails[sv.code] ?? '').trim();
            return detail ? `${sv.name} — ${detail}` : sv.name;
        }),
        ...(draft.customRequest.trim() ? [draft.customRequest.trim()] : []),
    ].join('\n');

    return (
        <View style={{ gap: 16 }}>
            <StepHead eyebrow={t('scheduled.review.eyebrow')} title={t('scheduled.review.title')} sub={t('scheduled.review.sub')} />
            <View style={{ ...CARD_STYLE, overflow: 'hidden' }}>
                <ReviewRow icon={Car} label={t('scheduled.review.vehicle')} value={draft.mileage ? `${draft.vehicleName} · ${draft.mileage} mi` : draft.vehicleName} onEdit={() => goTo(1)} />
                <ReviewRow icon={MapPin} label={t('scheduled.review.location')} value={locationLabel} onEdit={() => goTo(2)} />
                {shop ? null : <ReviewRow icon={User} label={t('scheduled.review.contact')} value={contact} onEdit={() => goTo(2)} />}
                <ReviewRow icon={Wrench} label={t('scheduled.review.services')} value={serviceLines || '—'} onEdit={() => goTo(3)} />
                <ReviewRow icon={Calendar} label={t('scheduled.review.availability')} value={windowText(draft, now, t('scheduled.review.today'))} onEdit={() => goTo(4)} />
                <ReviewRow icon={FileText} label={t('scheduled.review.symptoms')} value={draft.symptoms.trim() || t('scheduled.review.noneProvided')} onEdit={() => goTo(4)} />
                <ReviewRow icon={Camera} label={t('scheduled.review.evidence')} value={evidenceCount > 0 ? t('scheduled.review.files', { count: evidenceCount }) : t('scheduled.review.noneAttached')} onEdit={() => goTo(4)} last />
            </View>
            <View className="flex-row" style={{ gap: 10, padding: 12, borderRadius: 12, backgroundColor: SC.blueSofter, borderWidth: 1, borderColor: SC.blueSoft }}>
                <ShieldCheck size={18} color={SC.blue} style={{ marginTop: 1 }} />
                <Text className="font-outfit-regular flex-1" style={{ fontSize: 13, lineHeight: 18, color: SC.text }}>
                    <Text className="font-outfit-bold">{t('scheduled.review.noChargeTitle')} </Text>
                    {t('scheduled.review.noChargeBody')}
                </Text>
            </View>
        </View>
    );
}

// ───────────── Sent ─────────────

export function SentStep({
    refCode,
    vehicle,
    when,
    onView,
}: {
    refCode?: string;
    vehicle: string;
    when: string;
    onView: () => void;
}) {
    const { t } = useTranslation();
    const rows: [LucideIcon, string, string][] = [
        [Wrench, t('scheduled.sent.service'), t('scheduled.sent.serviceValue')],
        [Radio, t('scheduled.sent.status'), t('scheduled.sent.statusValue')],
        [Car, t('scheduled.sent.vehicle'), vehicle],
        [Calendar, t('scheduled.sent.when'), when],
        [Clock, t('scheduled.sent.offersUntil'), t('scheduled.sent.offersUntilValue')],
    ];
    return (
        <View className="flex-1">
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 32, paddingBottom: 20, alignItems: 'center', gap: 18 }}>
                <LinearGradient colors={[SC.blue, SC.blueDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', shadowColor: SC.blue, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 6 }}>
                    <Check size={34} color="#FFFFFF" strokeWidth={3} />
                </LinearGradient>
                <View>
                    <Text className="font-outfit-bold text-center" style={{ fontSize: 26, letterSpacing: -0.7, lineHeight: 29, color: SC.text }}>{t('scheduled.sent.title')}</Text>
                    <Text className="font-outfit-regular text-center" style={{ ...TYPE.helper, color: SC.muted, marginTop: 8 }}>{t('scheduled.sent.body')}</Text>
                </View>
                <View style={{ ...CARD_STYLE, alignSelf: 'stretch', overflow: 'hidden' }}>
                    {rows.map(([Icon, k, v], i) => (
                        <View key={k} className="flex-row items-center" style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 12, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: SC.borderSoft }}>
                            <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: SC.blueSoft }}>
                                <Icon size={19} color={SC.blue} />
                            </View>
                            <View className="flex-1">
                                <Text className="font-outfit-medium" style={{ ...TYPE.caption, color: SC.muted }}>{k}</Text>
                                <Text className="font-outfit-bold" style={{ ...TYPE.option, color: SC.text, marginTop: 1 }}>{v}</Text>
                            </View>
                        </View>
                    ))}
                </View>
                {refCode ? <Text style={{ fontSize: 12, letterSpacing: 0.5, color: SC.muted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{`#${refCode}`}</Text> : null}
            </ScrollView>
            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 }}>
                <TouchableOpacity onPress={onView} activeOpacity={0.85} accessibilityRole="button">
                    <LinearGradient colors={[SC.blue, SC.blueDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}>
                        <Text className="font-outfit-bold" style={{ ...TYPE.button, color: '#FFFFFF' }}>{t('scheduled.sent.view')}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );
}
