import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { CreditCard } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { AvailabilityStep, itemName, windowText, LocationStep, ReviewStep, SentStep, ServicesStep, VehicleStep } from '@/components/scheduled/Steps';
import { Footer, Note, SC, WizardHeader } from '@/components/scheduled/ui';
import { Timeline } from '@/components/ui/RequestSteps';
import { useAppointments } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { addressesForRole } from '@/lib/address';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { pricingDAO } from '@/lib/dao/PricingDAO';
import { vehicleDAO } from '@/lib/dao/VehicleDAO';
import type { Address, AssistanceRequest, ScheduledServiceCategory, Vehicle } from '@/lib/dao/interfaces';
import { getLanguageId } from '@/lib/i18n/catalogTranslations';
import type { Attachment, PendingAttachment } from '@/lib/media/attachments';
import { ApiError } from '@/lib/api/types';
import { apiErrorCode, isPaymentMethodRequired, RETURN_TO_BACK } from '@/lib/payments/cardRequired';
import { usePaymentChoice } from '@/lib/payments/usePaymentChoice';
import {
    buildScheduledPayload,
    clearDraft,
    emptyDraft,
    firstIncompleteStep,
    hasProgress,
    loadDraft,
    MAX_EVIDENCE,
    MAX_PHOTO_BYTES,
    MAX_VIDEO_BYTES,
    parseMileage,
    saveDraft,
    SCHEDULED_STEPS,
    stepIsValid,
    type ScheduledDraft,
    type ScheduledLocation,
} from '@/lib/scheduled/draft';
import { appAlert } from '@/lib/ui/appAlert';
import { vehicleLine } from '@/components/ui/VehicleTitle';

const STEP_KEYS = ['vehicle', 'location', 'services', 'availability', 'review'] as const;

const addressLine = (a: Address) =>
    [a.street, a.apartment, a.city, [a.state, a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');

/**
 * Scheduled assistance, vehicle owner: one screen, five steps (vehicle, location, services,
 * availability, review) and a "request sent" result. The services come from the scheduled-services
 * catalog and travel as `services: [{ code }]`; the offers that follow live on other screens.
 */
export default function ScheduledRequestScreen() {
    const router = useRouter();
    const { entry } = useLocalSearchParams<{ entry?: string }>();
    const { t, i18n } = useTranslation();
    const { user } = useUser();
    const { refresh: refreshAppointments } = useAppointments();
    // Not charged now; the default card (if any) is attached so the offer can be paid later.
    const { selectedId: paymentMethodId } = usePaymentChoice(null);

    const scope = user?.id ? `user:${user.id}` : undefined;

    const [draft, setDraft] = useState<ScheduledDraft>(emptyDraft);
    const [draftReady, setDraftReady] = useState(false);
    const [restored, setRestored] = useState(false);
    const [evidence, setEvidence] = useState<PendingAttachment[]>([]);

    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [vehiclesLoading, setVehiclesLoading] = useState(true);

    const [categories, setCategories] = useState<ScheduledServiceCategory[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(true);
    const [catalogFailed, setCatalogFailed] = useState(false);
    const [languageId, setLanguageId] = useState<number | null>(null);

    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const [uploadLabel, setUploadLabel] = useState('');
    const [cardRequired, setCardRequired] = useState(false);
    const [sent, setSent] = useState<AssistanceRequest | null>(null);

    const scrollRef = useRef<ScrollView>(null);
    // Re-read on every render: the lead-time check must follow the clock, and it is cheap.
    const now = new Date();

    const patch = useCallback((p: Partial<ScheduledDraft>) => setDraft((d) => ({ ...d, ...p })), []);

    // The tab stack keeps this screen mounted after the owner leaves it, so a new attempt (a new
    // `entry`) would land on the previous "Request sent". An unfinished draft is kept on purpose.
    const lastEntry = useRef(entry);
    useEffect(() => {
        if (entry === lastEntry.current) return;
        lastEntry.current = entry;
        if (sent) {
            setSent(null);
            setDraft(emptyDraft());
            setEvidence([]);
            setRestored(false);
        }
    }, [entry, sent]);

    // ── Restore the saved draft once the account is known ──
    useEffect(() => {
        if (!scope) return;
        let alive = true;
        loadDraft(scope).then((saved) => {
            if (!alive) return;
            if (saved && hasProgress(saved)) {
                setDraft(saved);
                setRestored(true);
            }
            setDraftReady(true);
        });
        return () => {
            alive = false;
        };
    }, [scope, entry]);

    // ── Save every change (until the request is sent) ──
    useEffect(() => {
        if (!scope || !draftReady || sent) return;
        const timer = setTimeout(() => void saveDraft(scope, draft), 400);
        return () => clearTimeout(timer);
    }, [draft, scope, draftReady, sent]);

    // ── Vehicles: on focus, so one added through "Add a vehicle" shows when the owner comes back ──
    useFocusEffect(
        useCallback(() => {
            if (!user?.id) return;
            let alive = true;
            vehicleDAO
                .getByUser(user.id)
                .then((list) => alive && setVehicles(list))
                .catch((error) => console.error('Failed to load vehicles', error))
                .finally(() => alive && setVehiclesLoading(false));
            return () => {
                alive = false;
            };
        }, [user?.id]),
    );

    // ── Services catalog ──
    const loadCatalog = useCallback(() => {
        setCatalogLoading(true);
        setCatalogFailed(false);
        pricingDAO
            .getServiceCategories()
            .then((data) => setCategories(Array.isArray(data) ? data : []))
            .catch((error) => {
                console.warn('Could not load the scheduled services catalog', error);
                setCatalogFailed(true);
            })
            .finally(() => setCatalogLoading(false));
    }, []);

    useEffect(() => {
        loadCatalog();
    }, [loadCatalog]);

    useEffect(() => {
        let alive = true;
        getLanguageId(i18n.language).then((id) => alive && setLanguageId(id));
        return () => {
            alive = false;
        };
    }, [i18n.language]);

    const addresses = addressesForRole(user?.addresses, user?.role);

    // Selected services, with their English base names (what mechanics read) and the app-language names.
    const allServices = useMemo(() => categories.flatMap((c) => c.services), [categories]);
    const selectedServices = useMemo(
        () => draft.services.map((code) => allServices.find((s) => s.code === code)).filter((s): s is NonNullable<typeof s> => !!s),
        [draft.services, allServices],
    );

    // ── Step navigation ──
    const goTo = useCallback((step: number) => {
        patch({ step });
        scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [patch]);

    const handleBack = () => {
        if (sent) return;
        if (draft.step > 1) goTo(draft.step - 1);
        else router.back();
    };

    const startOver = () => {
        if (scope) void clearDraft(scope);
        setDraft(emptyDraft());
        setEvidence([]);
        setRestored(false);
    };

    // ── Step 1 ──
    const pickVehicle = (v: Vehicle) =>
        // Tapping the chosen vehicle again un-chooses it.
        draft.vehicleId && draft.vehicleId === v.id
            ? patch({ vehicleId: null, vehicleName: '', mileage: '' })
            : patch({
            vehicleId: v.id ?? null,
            vehicleName: vehicleLine(v),
            // Pre-fill with the last known reading so the owner only edits it when it changed.
            mileage: v.mileage != null ? String(v.mileage) : '',
        });

    // ── Step 2 ──
    const pickSavedAddress = async (a: Address) => {
        setLocationError(null);
        let lat = a.locationLat;
        let lng = a.locationLng;
        if (lat === undefined || lng === undefined) {
            // Addresses saved before Places autocomplete have no coordinates: place them on the map.
            setLocating(true);
            try {
                const results = await Location.geocodeAsync([a.street, a.city, a.state, a.zip].filter(Boolean).join(', '));
                if (results[0]) {
                    lat = results[0].latitude;
                    lng = results[0].longitude;
                }
            } catch (error) {
                console.warn('Geocoding a saved address failed', error);
            } finally {
                setLocating(false);
            }
        }
        if (lat === undefined || lng === undefined) {
            setLocationError(t('scheduled.location.noCoords'));
            return;
        }
        const location: ScheduledLocation = {
            source: 'saved',
            addressId: a.id,
            label: '',
            line: addressLine(a),
            lat,
            lng,
            zip: a.zip ?? '',
        };
        patch({ location });
    };

    const useCurrentLocation = async () => {
        setLocationError(null);
        setLocating(true);
        try {
            const permission = await Location.requestForegroundPermissionsAsync();
            if (permission.status !== 'granted') {
                setLocationError(t('scheduled.location.permissionDenied'));
                return;
            }
            const position = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = position.coords;
            let line = t('scheduled.location.currentLocation');
            let zip = '';
            try {
                const [a] = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (a) {
                    const street = `${a.streetNumber || ''} ${a.street || ''}`.trim();
                    line = [street, a.city, a.region].filter(Boolean).join(', ') || line;
                    zip = a.postalCode || '';
                }
            } catch {
                // The coordinates are what matters; the label falls back to the generic one.
            }
            patch({ location: { source: 'current', label: '', line, lat: latitude, lng: longitude, zip } });
        } catch (error) {
            console.warn('Could not get the current location', error);
            setLocationError(t('scheduled.location.locationFailed'));
        } finally {
            setLocating(false);
        }
    };

    // ── Step 4: evidence ──
    const addEvidence = async () => {
        const room = MAX_EVIDENCE - evidence.length;
        if (room <= 0) return;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            allowsMultipleSelection: true,
            selectionLimit: room,
            quality: 0.6,
        });
        if (result.canceled) return;
        let skipped = false;
        const added: PendingAttachment[] = [];
        for (const asset of result.assets.slice(0, room)) {
            const isVideo = asset.type === 'video';
            const limit = isVideo ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
            if (asset.fileSize !== undefined && asset.fileSize > limit) {
                skipped = true;
                continue;
            }
            added.push({ uri: asset.uri, type: isVideo ? 'video' : 'photo' });
        }
        if (added.length > 0) setEvidence((prev) => [...prev, ...added]);
        if (skipped) appAlert(t('scheduled.availability.tooBig'));
    };

    // ── Publish ──
    const publish = async () => {
        if (submitting || !user?.id) return;
        const missing = firstIncompleteStep(draft);
        if (missing) {
            goTo(missing);
            return;
        }
        setSubmitting(true);
        try {
            const uploaded: Attachment[] = [];
            for (let i = 0; i < evidence.length; i++) {
                setUploadLabel(t('scheduled.review.uploading', { current: i + 1, total: evidence.length }));
                const file = evidence[i];
                const url = file.type === 'video' ? await assistanceDAO.uploadVideo(file.uri) : await assistanceDAO.uploadPhoto(file.uri);
                uploaded.push({ url, type: file.type });
            }
            setUploadLabel('');

            const created = await assistanceDAO.create(
                buildScheduledPayload({
                    draft,
                    userId: user.id,
                    serviceNames: selectedServices.map((s) => s.name),
                    photos: uploaded,
                    paymentMethodId,
                    serviceNamesByCode: Object.fromEntries(selectedServices.map((x) => [x.code, x.name])),
                }),
            );

            // Keep the vehicle's last known reading current. A failed PATCH must not undo a sent request.
            const mileage = parseMileage(draft.mileage);
            const vehicle = vehicles.find((v) => v.id === draft.vehicleId);
            if (vehicle?.id && mileage !== undefined && mileage !== vehicle.mileage) {
                vehicleDAO.update(vehicle.id, { mileage }).catch((error) => console.warn('Failed to update vehicle mileage', error));
            }

            if (scope) await clearDraft(scope);
            void refreshAppointments();
            setSent(created);
        } catch (error) {
            setUploadLabel('');
            if (isPaymentMethodRequired(error)) {
                setCardRequired(true);
                return;
            }
            const code = apiErrorCode(error);
            if (code === 'service_not_available') {
                // Something in the catalog was switched off since the owner picked it: reload and review.
                loadCatalog();
                goTo(3);
                appAlert(t('scheduled.errors.serviceUnavailableTitle'), t('scheduled.errors.serviceUnavailableMessage'));
            } else if (code === 'scheduled_date_in_past' || code === 'scheduled_date_too_soon') {
                goTo(4);
                appAlert(t('scheduled.errors.dateInvalidTitle'), t('scheduled.errors.dateInvalidMessage'));
            } else if (error instanceof ApiError && error.statusCode === 401) {
                // The session died while sending: the app is already back at the login screen.
                appAlert(t('scheduled.errors.sessionExpiredTitle'), t('scheduled.errors.sessionExpiredMessage'));
            } else {
                console.error('Failed to publish the scheduled request', error);
                appAlert(t('scheduled.errors.publishFailedTitle'), t('scheduled.errors.publishFailedMessage'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (sent) {
        return (
            <View className="flex-1" style={{ backgroundColor: SC.page }}>
                <WizardHeader title={t('scheduled.title')} />
                <SentStep
                    refCode={sent.refCode}
                    vehicle={draft.mileage ? `${draft.vehicleName} · ${draft.mileage} mi` : draft.vehicleName}
                    when={windowText(draft, now, t('scheduled.review.today'))}
                    onView={() => router.replace({ pathname: '/request-assistance/scheduled-offers', params: { requestId: sent.id } })}
                />
            </View>
        );
    }

    const step = draft.step;
    const valid = stepIsValid(step, draft, now);
    const isReview = step === SCHEDULED_STEPS;

    return (
        <View className="flex-1" style={{ backgroundColor: SC.page }}>
            <ConfirmationModal
                visible={cardRequired}
                title={t('requestAssistance.cardRequired.title')}
                message={t('requestAssistance.cardRequired.message')}
                icon={CreditCard}
                iconColor="#0047AB"
                confirmText={t('requestAssistance.cardRequired.confirm')}
                cancelText={t('requestAssistance.cardRequired.cancel')}
                onConfirm={() => {
                    setCardRequired(false);
                    router.push({ pathname: '/payment-cards', params: { returnTo: RETURN_TO_BACK } });
                }}
                onClose={() => setCardRequired(false)}
            />
            <WizardHeader title={t('scheduled.title')} onBack={handleBack} />
            <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    ref={scrollRef}
                    className="flex-1"
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 28, gap: 20 }}
                >
                        <Timeline steps={STEP_KEYS.map((key) => ({ key, label: t(`scheduled.steps.${key}`) }))} current={step - 1} gap={20} flush />
                    {restored ? (
                        <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
                            <View style={{ flex: 1 }}>
                                <Note tone="blue">{t('scheduled.draftRestored')}</Note>
                            </View>
                            <TouchableOpacity onPress={startOver} accessibilityRole="button" hitSlop={8}>
                                <Text className="font-outfit-bold" style={{ fontSize: 13, color: SC.blue }}>{t('scheduled.startOver')}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    {step === 1 ? (
                        <VehicleStep draft={draft} patch={patch} vehicles={vehicles} loading={vehiclesLoading} onPick={pickVehicle} onAddVehicle={() => router.push('/(tabs)/vehicles')} />
                    ) : null}
                    {step === 2 ? (
                        <LocationStep
                            draft={draft}
                            patch={patch}
                            addresses={addresses}
                            onPickSaved={pickSavedAddress}
                            onUseCurrent={useCurrentLocation}
                            onAddAddress={() => router.push('/(tabs)/addresses')}
                            busy={locating}
                            error={locationError}
                        />
                    ) : null}
                    {step === 3 ? (
                        <ServicesStep draft={draft} patch={patch} categories={categories} loading={catalogLoading} failed={catalogFailed} onRetry={loadCatalog} languageId={languageId} />
                    ) : null}
                    {step === 4 ? (
                        <AvailabilityStep
                            draft={draft}
                            patch={patch}
                            evidence={evidence}
                            onAddEvidence={addEvidence}
                            onRemoveEvidence={(i) => setEvidence((prev) => prev.filter((_, idx) => idx !== i))}
                            now={now}
                        />
                    ) : null}
                    {step === 5 ? (
                        <ReviewStep
                            draft={draft}
                            services={selectedServices.map((s) => ({ code: s.code, name: itemName(s, languageId) }))}
                            evidenceCount={evidence.length}
                            goTo={goTo}
                            now={now}
                        />
                    ) : null}
                </ScrollView>
            </KeyboardAvoidingView>

            <Footer
                label={isReview ? (submitting ? uploadLabel || t('scheduled.review.sending') : t('scheduled.review.send')) : t('scheduled.next')}
                disabled={!valid}
                loading={submitting}
                tone={isReview ? 'confirm' : 'primary'}
                onPress={isReview ? publish : () => goTo(step + 1)}
            />
        </View>
    );
}
