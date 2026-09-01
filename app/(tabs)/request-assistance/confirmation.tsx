import { useRequestDraft } from '@/context/RequestDraftContext';
import { useUser } from '@/context/UserContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { pricingDAO } from '@/lib/dao/PricingDAO';
import type { Attachment, PendingAttachment } from '@/lib/media/attachments';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, AlignLeft, Car, CheckCircle2, ChevronLeft, MapPin } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

/**
 * The pricing service validates `vehicle_issue_ids` with `@IsUUID`, so an id that
 * isn't a UUID is rejected with a 400 and the selected symptoms are never
 * persisted. That happens whenever issue-selection fell back to FALLBACK_ISSUES
 * (ids like 'battery'), so filter those out and warn instead of failing silently.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseIssueIds = (issues: unknown): string[] =>
    typeof issues === 'string' ? issues.split(',').filter(Boolean) : [];

export default function ConfirmationScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { user } = useUser();
    const { vehicleDetails } = useRequestDraft();
    const params = useLocalSearchParams();
    // latitude, longitude, addressLabel, finalAddress, type, vehicleId, vehicleName, description, issues, details, condition, attachments, date
    const {
        type,
        vehicleId,
        vehicleName,
        description,
        issues,
        details,
        condition,
        attachments,
        latitude,
        longitude,
        addressLabel,
        finalAddress,
        date
    } = params;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [price, setPrice] = useState<number | null>(null);
    const [priceLoading, setPriceLoading] = useState(true);

    // Resolve the ZIP once (from the passed locationZip or parsed from the address);
    // the pricing service uses it to derive the tax jurisdiction (state + county).
    const paramsZip = (params.locationZip as string) || '';
    const addrForZip = (finalAddress || addressLabel || '') as string;
    const zipFromAddr = typeof addrForZip === 'string' ? addrForZip.match(/\b\d{5}\b/) : null;
    const zipCode = paramsZip || (zipFromAddr ? zipFromAddr[0] : '');

    // Scheduled requests must be priced for the hour the mechanic actually shows
    // up, not for the moment the quote is fetched: the backend resolves the
    // night/weekend/holiday surcharge in the timezone of the service location at
    // this instant. `date` comes from the date-time step as a full ISO string; a
    // date-only value carries no time of day, so it is not worth sending.
    const serviceAt =
        typeof date === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(date)
            ? date
            : '';

    // Fetch the price estimate from the pricing service once the request details are
    // known. The first selected issue id is the primary VehicleIssue UUID. Failures
    // fall back to "TBD" and never block submit.
    useEffect(() => {
        let mounted = true;
        (async () => {
            const lat = Number(latitude);
            const lng = Number(longitude);
            const firstIssueId = parseIssueIds(issues).find((id) => UUID_RE.test(id)) ?? '';
            if (!firstIssueId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
                if (mounted) setPriceLoading(false);
                return;
            }

            try {
                const result = await pricingDAO.calculatePrice({
                    vehicle_issue_id: firstIssueId,
                    latitude: lat,
                    longitude: lng,
                    ...(zipCode ? { zipcode: zipCode } : {}),
                    ...(serviceAt ? { service_at: serviceAt } : {}),
                });
                if (mounted) setPrice(result?.pricing_breakdown?.final_price ?? null);
            } catch (err) {
                console.warn('Price calculation failed; showing TBD', err);
            } finally {
                if (mounted) setPriceLoading(false);
            }
        })();
        return () => { mounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // vehicleName is passed through the wizard from select-vehicle screen
    const vehicleStr = (vehicleName as string) || t('requestAssistance.confirmation.vehicleId', { vehicleId });

    const getTitle = () => {
        switch (type) {
            case 'immediate': return t('requestAssistance.header.immediate');
            case 'scheduled': return t('requestAssistance.header.scheduled');
            case 'videocall': return t('requestAssistance.header.videoCall');
            case 'witness': return t('requestAssistance.header.accident');
            default: return t('requestAssistance.header.default');
        }
    };

    const getTypeLabel = () => {
        switch (type) {
            case 'immediate': return t('requestAssistance.header.immediate');
            case 'scheduled': return t('requestAssistance.header.scheduled');
            case 'videocall': return t('requestAssistance.confirmation.videoCallShort');
            case 'witness': return t('requestAssistance.header.accident');
            default: return t('requestAssistance.header.default');
        }
    };

    const handleConfirm = async () => {
        // A request cannot exist without coordinates — the mechanic's map needs
        // the destination pin. Guard against missing/NaN coords before creating.
        const lat = Number(latitude);
        const lng = Number(longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            Alert.alert(t('requestAssistance.confirmation.locationRequiredTitle'), t('requestAssistance.confirmation.locationRequiredMessage'));
            return;
        }

        setIsSubmitting(true);
        try {
            // Upload the documentation media to S3, then create the assistance
            // request with permanent URLs. Photos and videos go to different
            // media-service routes; the note travels with each file.
            const pending: PendingAttachment[] = attachments ? JSON.parse(attachments as string) : [];
            const uploaded: Attachment[] = [];

            for (let i = 0; i < pending.length; i++) {
                setUploadProgress(t('requestAssistance.confirmation.uploadingPhoto', { current: i + 1, total: pending.length }));
                const url = pending[i].type === 'video'
                    ? await assistanceDAO.uploadVideo(pending[i].uri)
                    : await assistanceDAO.uploadPhoto(pending[i].uri);
                uploaded.push({
                    url,
                    type: pending[i].type,
                    ...(pending[i].note ? { note: pending[i].note } : {}),
                });
            }

            setUploadProgress('');

            const addr = finalAddress || addressLabel || '';

            // `budget` and `distance` are intentionally not sent: the pricing service
            // fills `budget`/`price` right after creation, and `distance` is computed
            // per-mechanic at read time (it has no meaningful value at creation).
            const response = await assistanceDAO.create({
                userId: user?.id || 'current-user-id',
                title: typeof description === 'string' ? description : 'Assistance Request',
                notes: typeof details === 'string' ? details : '',
                type: type as any,
                assistanceType: type as string,
                vehicleId: vehicleId as string,
                car: vehicleStr,
                address: addr as string,
                locationLat: lat,
                locationLng: lng,
                status: 'pending',
                photos: uploaded,
                zip: zipCode,
                // Answered on the vehicle information step; informational for the
                // mechanic, the pricing engine does not read it.
                ...(typeof condition === 'string' && condition ? { vehicleCondition: condition } : {}),
                ...(typeof date === 'string' && date ? { date } : {}),
                // Captured on select-vehicle. Spread conditionally so empty values are
                // omitted rather than sent as nulls, matching how `date` is handled.
                ...(vehicleDetails.mileage !== undefined ? { mileage: vehicleDetails.mileage } : {}),
                driverIsOwner: vehicleDetails.driverIsOwner,
                ...(vehicleDetails.driverFirstName ? { driverFirstName: vehicleDetails.driverFirstName } : {}),
                ...(vehicleDetails.driverLastName ? { driverLastName: vehicleDetails.driverLastName } : {}),
                ...(vehicleDetails.driverPhone ? { driverPhone: vehicleDetails.driverPhone } : {})
            });

            // Price + persist the created request server-side (breakdown + issue
            // pivot + assistance_requests.budget/price). The request already exists,
            // so a failure here must not block the flow or revert it — but it must
            // not be silent either: the selected symptoms would be lost.
            const selectedIssueIds = parseIssueIds(issues);
            const issueIds = selectedIssueIds.filter((id) => UUID_RE.test(id));

            if (selectedIssueIds.length > 0 && issueIds.length === 0) {
                console.warn(
                    `[assistance] issues not persisted for request ${response.id}: ` +
                    `the vehicle-issue catalog was unavailable, so the wizard used ` +
                    `fallback ids (${selectedIssueIds.join(',')}) that the pricing ` +
                    `service rejects.`
                );
                Alert.alert(
                    t('requestAssistance.confirmation.pricingUnavailableTitle'),
                    t('requestAssistance.confirmation.pricingUnavailableMessage')
                );
            } else if (issueIds.length > 0) {
                try {
                    const result = await pricingDAO.persistRequestPrice(response.id, {
                        vehicle_issue_ids: issueIds,
                        latitude: lat,
                        longitude: lng,
                        ...(zipCode ? { zipcode: zipCode } : {}),
                        ...(serviceAt ? { service_at: serviceAt } : {}),
                    });
                    // The endpoint persists each part best-effort and reports which
                    // ones landed; a partial write still returns 200.
                    const persisted = (result as any)?.persisted;
                    if (persisted && Object.values(persisted).some((ok) => ok === false)) {
                        console.warn(
                            `[assistance] partial pricing persistence for request ` +
                            `${response.id}:`, persisted
                        );
                        Alert.alert(
                            t('requestAssistance.confirmation.pricingUnavailableTitle'),
                            t('requestAssistance.confirmation.pricingUnavailableMessage')
                        );
                    }
                } catch (err) {
                    console.warn(
                        `[assistance] persisting request price failed for request ` +
                        `${response.id} (issues: ${issueIds.join(',')})`, err
                    );
                    Alert.alert(
                        t('requestAssistance.confirmation.pricingUnavailableTitle'),
                        t('requestAssistance.confirmation.pricingUnavailableMessage')
                    );
                }
            }

            router.replace({
                pathname: '/request-assistance/searching',
                params: { requestId: response.id, type }
            });
        } catch (error) {
            console.error(error);
            setUploadProgress('');
            Alert.alert(t('requestAssistance.confirmation.errorTitle'), t('requestAssistance.confirmation.errorMessage'));
        } finally {
            setIsSubmitting(false);
        }
    };

    /** Icon + label/value row of the white summary card. */
    const SummaryRow = ({ icon, label, value, last }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) => (
        <View
            className="flex-row items-start py-4"
            style={{ gap: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#E5E9F5' }}
        >
            <View
                className="items-center justify-center"
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(30,86,227,0.08)' }}
            >
                {icon}
            </View>
            <View className="flex-1">
                <Text className="font-outfit-bold text-[11px] tracking-wide mb-0.5" style={{ color: '#A8B2C7' }}>
                    {label.toUpperCase()}
                </Text>
                <Text className="text-gray-900 font-outfit-semibold text-base">{value}</Text>
            </View>
        </View>
    );

    return (
        <View className="flex-1" style={{ backgroundColor: '#F4F6FC' }}>
            {/* Custom Header */}
            <View className="px-6 pt-20 pb-2 flex-row items-center justify-between" style={{ backgroundColor: '#F4F5FA', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 3, borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
                        <ChevronLeft size={20} color="#0047AB" />
                    </View>
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>
                    {getTitle()}
                </Text>
                <View className="w-6" />
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, gap: 20 }}
            >
                <View>
                    <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                            {t('requestAssistance.confirmation.requestSummary')}
                        </Text>
                    </View>

                    <Text className="text-gray-900 font-outfit-medium text-3xl mb-2">{t('requestAssistance.confirmation.title')}</Text>

                    <Text className="text-gray-500 font-outfit-regular text-base">
                        {t('requestAssistance.confirmation.subtitle')}
                    </Text>
                </View>

                {/* Assistance type */}
                <LinearGradient
                    colors={['#2B66F8', '#081E72']}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                        borderRadius: 12,
                        paddingHorizontal: 20,
                        paddingVertical: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    <CheckCircle2 size={20} color="#FFFFFF" />
                    <View className="flex-1">
                        <Text className="font-outfit-bold text-[11px] tracking-wide" style={{ color: 'rgba(255,255,255,0.7)' }}>
                            {t('requestAssistance.confirmation.assistanceTypeLabel')}
                        </Text>
                        <Text className="text-white font-outfit-semibold text-sm mt-0.5">{getTypeLabel()}</Text>
                    </View>
                </LinearGradient>

                {/* Price */}
                <View
                    style={{
                        backgroundColor: '#EAF1FF',
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: '#D5DCED',
                        paddingHorizontal: 20,
                        paddingVertical: 18,
                    }}
                >
                    <View className="px-2.5 py-1 rounded-full mb-3" style={{ backgroundColor: '#1E56E3', alignSelf: 'flex-start' }}>
                        <Text className="text-white font-outfit-bold text-[11px] tracking-widest">
                            {t('requestAssistance.confirmation.priceLabel')}
                        </Text>
                    </View>
                    {priceLoading ? (
                        <ActivityIndicator size="small" color="#1E56E3" style={{ alignSelf: 'flex-start' }} />
                    ) : (
                        <Text className="font-outfit-bold text-[26px]" style={{ color: '#1E56E3' }}>
                            {price != null ? `$${price.toFixed(2)}` : 'TBD'}
                        </Text>
                    )}
                    <Text className="text-gray-500 font-outfit-regular text-xs mt-1.5">
                        {t('requestAssistance.confirmation.priceDispatchNote')}
                    </Text>
                </View>

                {/* Summary */}
                <View
                    className="bg-white rounded-2xl px-5"
                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 }}
                >
                    <SummaryRow
                        icon={<Car size={18} color="#1E56E3" />}
                        label={t('requestAssistance.confirmation.car')}
                        value={vehicleStr}
                    />
                    <SummaryRow
                        icon={<AlertCircle size={18} color="#1E56E3" />}
                        label={t('requestAssistance.confirmation.carIssue')}
                        value={(description as string) || t('requestAssistance.confirmation.noDescription')}
                    />
                    <SummaryRow
                        icon={<MapPin size={18} color="#1E56E3" />}
                        label={t('requestAssistance.confirmation.location')}
                        value={((finalAddress || addressLabel) as string) || ''}
                    />
                    <SummaryRow
                        last
                        icon={<AlignLeft size={18} color="#1E56E3" />}
                        label={t('requestAssistance.confirmation.notes')}
                        value={(details as string) || t('requestAssistance.confirmation.none')}
                    />
                </View>

                {/* Included with the service */}
                <View style={{ backgroundColor: '#EFFAF3', borderRadius: 12, borderWidth: 1, borderColor: '#BFE8D0', paddingHorizontal: 16, paddingVertical: 14 }}>
                    <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
                        <CheckCircle2 size={18} color="#1E9E5A" />
                        <Text className="font-outfit-bold text-[13px]" style={{ color: '#0F6B3E' }}>
                            {t('requestAssistance.confirmation.includedTitle')}
                        </Text>
                    </View>
                    {[
                        t('requestAssistance.confirmation.includedChecklist'),
                        t('requestAssistance.confirmation.includedScanner'),
                    ].map((item) => (
                        <View key={item} className="flex-row items-center mb-2" style={{ gap: 8 }}>
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#1E9E5A' }} />
                            <Text className="font-outfit-regular text-[13px]" style={{ color: '#3B7A57' }}>{item}</Text>
                        </View>
                    ))}
                </View>

                {/* Fees Info */}
                <View style={{ backgroundColor: 'rgba(30,86,227,0.08)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(30,86,227,0.13)', paddingHorizontal: 16, paddingVertical: 12 }}>
                    <Text className="font-outfit-medium text-xs" style={{ color: '#1E56E3', lineHeight: 19 }}>
                        {t('requestAssistance.confirmation.feesInfo')}
                    </Text>
                </View>
            </ScrollView>

            {/* Fixed footer */}
            <View
                style={{
                    backgroundColor: '#F4F6FC',
                    borderTopWidth: 1,
                    borderTopColor: '#D5DCED',
                    paddingHorizontal: 20,
                    paddingTop: 16,
                    paddingBottom: 28,
                }}
            >
                {isSubmitting ? (
                    <View className="items-center">
                        <ActivityIndicator size="large" color="#0047AB" />
                        {uploadProgress ? (
                            <Text className="text-gray-500 font-outfit-regular text-sm mt-2">{uploadProgress}</Text>
                        ) : null}
                    </View>
                ) : (
                    <TouchableOpacity onPress={handleConfirm} activeOpacity={0.8}>
                        <LinearGradient
                            colors={['#2B66F8', '#081E72']}
                            start={{ x: 0, y: 1 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                borderRadius: 10,
                                paddingVertical: 16,
                                paddingHorizontal: 16,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Text className="text-white font-outfit-bold text-center">{t('requestAssistance.confirmation.confirmAndRequest')}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}
