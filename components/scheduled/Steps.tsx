import {
    Calendar,
    Car,
    Check,
    ChevronDown,
    ChevronRight,
    CircleDot,
    ClipboardCheck,
    Clock,
    Cog,
    Crosshair,
    Disc,
    Flame,
    Gauge,
    ImagePlus,
    MapPin,
    Plus,
    Snowflake,
    SlidersHorizontal,
    Thermometer,
    Video,
    Wrench,
    X,
    Zap,
    type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';

import type { Address, ScheduledServiceCategory, ScheduledServiceItem, Vehicle } from '@/lib/dao/interfaces';
import { addressDisplayName } from '@/lib/address';
import { DayCalendar, TimeWheel } from '@/components/scheduled/DateTime';
import type { PendingAttachment } from '@/lib/media/attachments';
import {
    bookableDates,
    dateFromKey,
    earliestMinutes,
    formatMinutes,
    isSameDay,
    MAX_EVIDENCE,
    MAX_SERVICES,
    type ScheduledDraft,
} from '@/lib/scheduled/draft';

import { CARD_STYLE, Checkbox, ChoiceCard, Chip, FieldLabel, Note, SC, StepHead, TextField } from './ui';

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
                        const meta = [v.plate, v.plateState].filter(Boolean).join(' · ');
                        return <ChoiceCard key={v.id} on={draft.vehicleId === v.id} onPress={() => onPick(v)} icon={Car} title={name} sub={meta || undefined} />;
                    })}
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
                    <Text className="font-outfit-regular" style={{ fontSize: 12, color: SC.muted, marginTop: 6 }}>{t('scheduled.vehicle.mileageHint')}</Text>
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
    return (
        <View style={{ gap: 20 }}>
            <StepHead eyebrow={t('scheduled.location.eyebrow')} title={t('scheduled.location.title')} sub={t('scheduled.location.sub')} />

            <View>
                <FieldLabel>{t('scheduled.location.yourAddresses')}</FieldLabel>
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
                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: SC.blue }}>{t('scheduled.location.addAddress')}</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
                {error ? <Text className="font-outfit-regular" style={{ fontSize: 12.5, color: SC.red, marginTop: 8 }}>{error}</Text> : null}
            </View>

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

    const toggleOpen = (id: string) =>
        setOpen((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const toggleService = (code: string) => {
        const has = draft.services.includes(code);
        if (!has && draft.services.length >= MAX_SERVICES) return;
        patch({ services: has ? draft.services.filter((c) => c !== code) : [...draft.services, code] });
    };

    return (
        <View style={{ gap: 20 }}>
            <StepHead eyebrow={t('scheduled.services.eyebrow')} title={t('scheduled.services.title')} sub={t('scheduled.services.sub')} />

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
            ) : (
                <View style={{ gap: 10 }}>
                    {categories.map((cat) => {
                        const Icon = CATEGORY_ICONS[cat.code] ?? Wrench;
                        const count = cat.services.filter((s) => draft.services.includes(s.code)).length;
                        const expanded = open.has(cat.id) || count > 0;
                        return (
                            <View key={cat.id} style={{ ...CARD_STYLE, overflow: 'hidden', borderColor: count > 0 ? SC.blue : SC.borderSoft }}>
                                <TouchableOpacity onPress={() => toggleOpen(cat.id)} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ expanded }} className="flex-row items-center" style={{ padding: 14, gap: 12 }}>
                                    <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: SC.blueSoft }}>
                                        <Icon size={20} color={SC.blue} />
                                    </View>
                                    <Text className="font-outfit-bold flex-1" style={{ fontSize: 15, color: SC.text }}>{itemName(cat, languageId)}</Text>
                                    {count > 0 ? (
                                        <View className="rounded-full items-center justify-center" style={{ minWidth: 22, height: 22, paddingHorizontal: 6, backgroundColor: SC.blue }}>
                                            <Text className="font-outfit-bold" style={{ fontSize: 11.5, color: '#FFFFFF' }}>{count}</Text>
                                        </View>
                                    ) : null}
                                    {expanded ? <ChevronDown size={18} color={SC.mutedLight} /> : <ChevronRight size={18} color={SC.mutedLight} />}
                                </TouchableOpacity>
                                {expanded ? (
                                    <View style={{ borderTopWidth: 1, borderTopColor: SC.borderSoft }}>
                                        {cat.services.map((s, i) => {
                                            const on = draft.services.includes(s.code);
                                            const details = itemDetails(s, languageId);
                                            return (
                                                <TouchableOpacity
                                                    key={s.code}
                                                    onPress={() => toggleService(s.code)}
                                                    activeOpacity={0.7}
                                                    accessibilityRole="checkbox"
                                                    accessibilityState={{ checked: on }}
                                                    className="flex-row items-start"
                                                    style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 12, backgroundColor: on ? SC.blueSofter : '#FFFFFF', borderTopWidth: i === 0 ? 0 : 1, borderTopColor: SC.borderSoft }}
                                                >
                                                    <View style={{ marginTop: 1 }}><Checkbox on={on} /></View>
                                                    <View className="flex-1">
                                                        <Text className="font-outfit-semibold" style={{ fontSize: 14.5, color: SC.text }}>{itemName(s, languageId)}</Text>
                                                        {details ? <Text className="font-outfit-regular" style={{ fontSize: 12, lineHeight: 17, color: SC.muted, marginTop: 2 }} numberOfLines={3}>{details}</Text> : null}
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ) : null}
                            </View>
                        );
                    })}
                </View>
            )}

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
    const sameDay = draft.date ? isSameDay(draft.date, now) : false;
    // First selectable start on the picked day, on the 30-minute grid.
    const firstStart = Math.max(SLOT_MIN, Math.ceil(earliest / 30) * 30);
    const [custom, setCustom] = useState(false);

    const pickDay = (key: string) => {
        // The window picked for another day may fall inside today's lead time (or end before it starts).
        const min = earliestMinutes(key, now);
        const fromOk = draft.fromMin != null && draft.fromMin >= min;
        patch({ date: key, ...(fromOk ? {} : { fromMin: null, toMin: null }) });
    };

    // Preselect the first day that still has time left, so the calendar never shows a day that is not in the draft.
    useEffect(() => {
        if (draft.date) return;
        const first = days.find((k) => Math.ceil(earliestMinutes(k, now) / 30) * 30 + 30 <= SLOT_MAX) ?? days[0];
        pickDay(first);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const presets = [
        { id: 'morning', from: 8 * 60, to: 12 * 60 },
        { id: 'afternoon', from: 12 * 60, to: 16 * 60 },
        { id: 'evening', from: 16 * 60, to: 20 * 60 },
        { id: 'any', from: SLOT_MIN, to: SLOT_MAX },
    ].map((p) => {
        const from = Math.max(p.from, firstStart);
        return { ...p, start: from, ok: p.to - from >= 60 };
    });
    const activePreset = !custom ? presets.find((p) => p.start === draft.fromMin && p.to === draft.toMin)?.id : undefined;

    const dayText = draft.date ? dateFromKey(draft.date).toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' }) : '';
    const summary = draft.date && draft.fromMin != null && draft.toMin != null
        ? `${dayText} · ${formatMinutes(draft.fromMin)} – ${formatMinutes(draft.toMin)}`
        : null;

    const setFrom = (m: number) => patch({ fromMin: m, ...(draft.toMin != null && draft.toMin <= m ? { toMin: Math.min(SLOT_MAX, m + 60) } : {}) });

    return (
        <View style={{ gap: 20 }}>
            <StepHead eyebrow={t('scheduled.availability.eyebrow')} title={t('scheduled.availability.title')} sub={t('scheduled.availability.sub')} />

            <View>
                <FieldLabel>{t('scheduled.availability.dayLabel')}</FieldLabel>
                <DayCalendar
                    value={draft.date}
                    min={dateFromKey(days[0])}
                    max={dateFromKey(days[days.length - 1])}
                    locale={i18n.language}
                    onChange={pickDay}
                />
            </View>

            {draft.date ? (
                <View style={{ gap: 12 }}>
                    <FieldLabel>{t('scheduled.availability.windowLabel')}</FieldLabel>
                    <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                        {presets.map((p) => {
                            const on = activePreset === p.id;
                            return (
                                <TouchableOpacity
                                    key={p.id}
                                    disabled={!p.ok}
                                    activeOpacity={0.8}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: on, disabled: !p.ok }}
                                    onPress={() => { setCustom(false); patch({ fromMin: p.start, toMin: p.to }); }}
                                    style={{
                                        width: '48%',
                                        padding: 14,
                                        borderRadius: 16,
                                        backgroundColor: on ? SC.blue : '#FFFFFF',
                                        borderWidth: 1,
                                        borderColor: on ? SC.blue : SC.border,
                                        opacity: p.ok ? 1 : 0.4,
                                    }}
                                >
                                    <Text className="font-outfit-bold" style={{ fontSize: 15, color: on ? '#FFFFFF' : SC.text }}>{t(`scheduled.availability.presets.${p.id}`)}</Text>
                                    <Text className="font-outfit-regular" style={{ fontSize: 12.5, marginTop: 2, color: on ? '#DCE8FF' : SC.muted }}>
                                        {`${formatMinutes(p.start)} – ${formatMinutes(p.to)}`}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <TouchableOpacity
                        onPress={() => {
                            if (!custom && draft.fromMin == null) patch({ fromMin: firstStart, toMin: Math.min(SLOT_MAX, firstStart + 120) });
                            setCustom(!custom);
                        }}
                        accessibilityRole="button"
                        className="flex-row items-center"
                        style={{ gap: 8, paddingVertical: 4 }}
                    >
                        <Clock size={16} color={SC.blue} />
                        <Text className="font-outfit-bold" style={{ color: SC.blue }}>{t('scheduled.availability.custom')}</Text>
                        <ChevronDown size={16} color={SC.blue} style={{ transform: [{ rotate: custom ? '180deg' : '0deg' }] }} />
                    </TouchableOpacity>
                    {custom && draft.fromMin != null && draft.toMin != null ? (
                        <View className="flex-row" style={{ gap: 12 }}>
                            <TimeWheel label={t('scheduled.availability.from')} minutes={draft.fromMin} min={firstStart} max={SLOT_MAX - 30} onChange={setFrom} />
                            <TimeWheel label={t('scheduled.availability.to')} minutes={draft.toMin} min={Math.min(SLOT_MAX, draft.fromMin + 30)} max={SLOT_MAX} onChange={(m) => patch({ toMin: m })} />
                        </View>
                    ) : null}
                    {summary ? (
                        <Text className="font-outfit-semibold" style={{ fontSize: 13.5, color: SC.text }}>{summary}</Text>
                    ) : null}
                    {sameDay ? (
                        <Note tone="amber" title={t('scheduled.availability.sameDayTitle')}>{t('scheduled.availability.sameDayBody')}</Note>
                    ) : (
                        <Note title={t('scheduled.availability.windowTitle')}>{t('scheduled.availability.windowBody')}</Note>
                    )}
                </View>
            ) : null}

            <View>
                <FieldLabel>{t('scheduled.availability.symptomsLabel')}</FieldLabel>
                <TextField multiline value={draft.symptoms} onChangeText={(v) => patch({ symptoms: v })} placeholder={t('scheduled.availability.symptomsPlaceholder')} maxLength={1000} />
            </View>

            <View>
                <FieldLabel>{t('scheduled.availability.evidenceLabel')}</FieldLabel>
                {evidence.length > 0 ? (
                    <View className="flex-row flex-wrap" style={{ gap: 10, marginBottom: 12 }}>
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
                <TouchableOpacity
                    onPress={onAddEvidence}
                    disabled={evidence.length >= MAX_EVIDENCE}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    className="flex-row items-center justify-center"
                    style={{ gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: SC.border, backgroundColor: '#FFFFFF', opacity: evidence.length >= MAX_EVIDENCE ? 0.5 : 1 }}
                >
                    <ImagePlus size={18} color={SC.blue} />
                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: SC.blue }}>{t('scheduled.availability.addEvidence')}</Text>
                </TouchableOpacity>
                <Text className="font-outfit-regular" style={{ fontSize: 12, color: SC.muted, marginTop: 6 }}>{t('scheduled.availability.evidenceLimits')}</Text>
            </View>
        </View>
    );
}

// ───────────── Step 5 · Review ─────────────

function ReviewRow({ icon: Icon, label, value, onEdit, last }: { icon: LucideIcon; label: string; value: string; onEdit?: () => void; last?: boolean }) {
    const { t } = useTranslation();
    return (
        <View className="flex-row items-start" style={{ gap: 12, paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: SC.borderSoft }}>
            <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: SC.blueSoft }}>
                <Icon size={18} color={SC.blue} />
            </View>
            <View className="flex-1">
                <Text className="font-outfit-bold" style={{ fontSize: 10.5, letterSpacing: 1.2, color: SC.mutedLight }}>{label}</Text>
                <Text className="font-outfit-semibold" style={{ fontSize: 14.5, lineHeight: 20, color: SC.text, marginTop: 2 }}>{value}</Text>
            </View>
            {onEdit ? (
                <TouchableOpacity onPress={onEdit} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t('scheduled.review.edit')} ${label}`}>
                    <Text className="font-outfit-bold" style={{ fontSize: 13, color: SC.blue }}>{t('scheduled.review.edit')}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

export function ReviewStep({
    draft,
    serviceNames,
    evidenceCount,
    goTo,
    now,
}: {
    draft: ScheduledDraft;
    serviceNames: string[];
    evidenceCount: number;
    goTo: (step: number) => void;
    now: Date;
}) {
    const { t, i18n } = useTranslation();
    const dateLabel = draft.date
        ? dateFromKey(draft.date).toLocaleDateString(i18n.language, { weekday: 'short', month: 'short', day: 'numeric' })
        : '—';
    const windowLabel =
        draft.fromMin != null && draft.toMin != null ? `${dateLabel} · ${formatMinutes(draft.fromMin)} – ${formatMinutes(draft.toMin)}` : dateLabel;
    const contact = draft.contactIsOwner
        ? t('scheduled.review.me')
        : [draft.contactFirst, draft.contactLast].filter(Boolean).join(' ') + (draft.contactPhone ? ` · ${draft.contactPhone}` : '');
    void now;

    return (
        <View style={{ gap: 20 }}>
            <StepHead eyebrow={t('scheduled.review.eyebrow')} title={t('scheduled.review.title')} sub={t('scheduled.review.sub')} />
            <View style={{ ...CARD_STYLE, paddingHorizontal: 14 }}>
                <ReviewRow icon={Car} label={t('scheduled.review.vehicle')} value={draft.mileage ? `${draft.vehicleName} · ${draft.mileage} mi` : draft.vehicleName} onEdit={() => goTo(1)} />
                <ReviewRow icon={MapPin} label={t('scheduled.review.location')} value={draft.location?.line ?? '—'} onEdit={() => goTo(2)} />
                <ReviewRow icon={Check} label={t('scheduled.review.contact')} value={contact} onEdit={() => goTo(2)} />
                <ReviewRow icon={Wrench} label={t('scheduled.review.services')} value={[...serviceNames, ...(draft.customRequest.trim() ? [draft.customRequest.trim()] : [])].join(', ')} onEdit={() => goTo(3)} />
                <ReviewRow icon={Calendar} label={t('scheduled.review.availability')} value={windowLabel} onEdit={() => goTo(4)} last={!draft.symptoms.trim() && evidenceCount === 0} />
                {draft.symptoms.trim() ? <ReviewRow icon={Clock} label={t('scheduled.review.symptoms')} value={draft.symptoms.trim()} onEdit={() => goTo(4)} last={evidenceCount === 0} /> : null}
                {evidenceCount > 0 ? <ReviewRow icon={ImagePlus} label={t('scheduled.review.evidence')} value={t('scheduled.review.files', { count: evidenceCount })} onEdit={() => goTo(4)} last /> : null}
            </View>
            <Note tone="green" title={t('scheduled.review.noChargeTitle')}>{t('scheduled.review.noChargeBody')}</Note>
        </View>
    );
}

// ───────────── Sent ─────────────

export function SentStep({ refCode, onView, onHome }: { refCode?: string; onView: () => void; onHome: () => void }) {
    const { t } = useTranslation();
    return (
        <View className="flex-1 items-center justify-center" style={{ padding: 24, gap: 16 }}>
            <View className="items-center justify-center" style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: SC.greenSoft }}>
                <Check size={40} color={SC.greenText} strokeWidth={3} />
            </View>
            <Text className="font-outfit-bold text-center" style={{ fontSize: 26, letterSpacing: -0.6, color: SC.text }}>{t('scheduled.sent.title')}</Text>
            <Text className="font-outfit-regular text-center" style={{ fontSize: 14.5, lineHeight: 21, color: SC.muted }}>{t('scheduled.sent.body')}</Text>
            {refCode ? (
                <View className="rounded-full" style={{ paddingHorizontal: 14, paddingVertical: 6, backgroundColor: SC.blueSoft }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 12.5, color: SC.blue }}>{`${t('scheduled.sent.ref')} · ${refCode}`}</Text>
                </View>
            ) : null}
            <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 12 }}>
                <TouchableOpacity onPress={onView} activeOpacity={0.85} accessibilityRole="button" style={{ backgroundColor: SC.blue, borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 15.5, color: '#FFFFFF' }}>{t('scheduled.sent.view')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onHome} activeOpacity={0.7} accessibilityRole="button" style={{ paddingVertical: 12, alignItems: 'center' }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 15, color: SC.blue }}>{t('scheduled.sent.home')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
