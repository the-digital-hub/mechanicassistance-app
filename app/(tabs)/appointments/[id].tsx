import { CancellationModal } from '@/components/appointments/CancellationModal';
import { MechanicAssistanceInfoTab } from '@/components/appointments/MechanicAssistanceInfoTab';
import { MechanicArrivalCard, PulseDot } from '@/components/appointments/MechanicArrivalCard';
import { MechanicClientInfoTab } from '@/components/appointments/MechanicClientInfoTab';
import { CheckInCodeCard } from '@/components/appointments/CheckInCodeCard';
import { OwnerReviewCard } from '@/components/appointments/OwnerReviewCard';
import {
    AcceptedHeader,
    CheckInBanner,
    OwnerBudgetPanel,
    OwnerEtaCard,
    OwnerMechanicCard,
    OwnerTab,
    OwnerTabs,
    OwnerTechnicianPanel,
} from '@/components/appointments/owner/OwnerSections';
import { AO, RequestSummaryRows } from '@/components/offer/OfferSections';
import { useAppointments } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { useAppointmentEta } from '@/hooks/useAppointmentEta';
import { useMechanicLocationBroadcast } from '@/hooks/useMechanicLocationBroadcast';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import type { AssistanceOfferSummary } from '@/lib/dao/interfaces';
import { userDAO } from '@/lib/dao/UserDAO';
import { Ionicons } from '@expo/vector-icons';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { goBackOr } from '@/lib/navigation/goBackOr';
import React from 'react';
import { AttachmentStrip } from '@/components/appointments/AttachmentStrip';
import { parseAttachments } from '@/lib/media/attachments';
import { useTranslation } from 'react-i18next';
import { Dimensions, ScrollView, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

type TabType = 'info' | 'client';

// Mechanic "Request accepted" palette.
const MECH = {
    blue: '#1E56E3',
    blueSoft: '#EAF1FF',
    text: '#0B1530',
    mutedLight: '#8C96AE',
    border: '#E4EAF5',
    page: '#F6F8FC',
    red: '#E53E3E',
    green: '#10B981',
    greenSoft: '#E6F7EF',
};

function assistanceTypeKey(appointment: { assistanceType?: string; type?: string }): string {
    const kind = appointment.assistanceType ?? appointment.type;
    if (appointment.assistanceType === 'witness') return 'appointments.detail.types.accident';
    if (kind === 'immediate') return 'appointments.detail.types.immediate';
    if (kind === 'videocall' || appointment.type === 'video') return 'appointments.detail.types.videocall';
    return 'appointments.detail.types.scheduled';
}

export default function AppointmentDetailScreen() {
    // Switch back to Global params as Local causes context error in full tree
    const { id } = useGlobalSearchParams();
    // const { id } = useLocalSearchParams();
    const router = useRouter();
    const { t } = useTranslation();
    const { getAppointmentById, updateAppointment } = useAppointments();

    const appointment = getAppointmentById(Array.isArray(id) ? id[0] : id || '');

    const { user } = useUser();
    const isUserRole = user?.role === 'user';
    useMechanicLocationBroadcast({
        appointmentId: appointment?.id ?? '',
        status: appointment?.status ?? 'pending',
        role: user?.role,
    });

    // Lifted here so the socket listener stays alive regardless of active tab.
    const { minutesAway, etaTime, loading: etaLoading, mechanicCoords, polyline } = useAppointmentEta(
        isUserRole ? appointment?.id : undefined,
        isUserRole ? appointment?.status : undefined,
    );
    const [offer, setOffer] = React.useState<AssistanceOfferSummary | null>(null);

    const [activeTab, setActiveTab] = React.useState<TabType>('info');
    const [ownerTab, setOwnerTab] = React.useState<OwnerTab>('status');
    const [checkInSeen, setCheckInSeen] = React.useState(false);
    const openOwnerTab = (tab: OwnerTab) => {
        if (tab === 'checkin') setCheckInSeen(true);
        setOwnerTab(tab);
    };
    const [showCancelModal, setShowCancelModal] = React.useState(false);
    const [isCanceledFeedback, setIsCanceledFeedback] = React.useState(false);

    // Consistent state for ClientTab (Mechanic View)
    const [rating, setRating] = React.useState(appointment?.clientReview?.rating || 0);
    const [selectedOption, setSelectedOption] = React.useState<string>(appointment?.clientReview?.experienceTags?.[0] || '');
    const [reviewText, setReviewText] = React.useState(appointment?.clientReview?.review || '');
    const [isReviewSubmitted, setIsReviewSubmitted] = React.useState(appointment?.isReviewSubmitted || false);

    // Hydrate mechanic review state once appointment data arrives — AppointmentsContext
    // loads asynchronously, so a cold navigation into this screen can mount before it
    // does, leaving the useState initializers above stuck at their empty defaults.
    const hasHydratedReview = React.useRef(false);
    React.useEffect(() => {
        if (appointment && !hasHydratedReview.current) {
            hasHydratedReview.current = true;
            setRating(appointment.clientReview?.rating || 0);
            setSelectedOption(appointment.clientReview?.experienceTags?.[0] || '');
            setReviewText(appointment.clientReview?.review || '');
            setIsReviewSubmitted(appointment.isReviewSubmitted || false);
        }
    }, [appointment]);

    // Debounced update implementation for preservation
    const timerRef = React.useRef<any>(null);
    const debouncedUpdate = React.useCallback(
        (updates: Partial<any>) => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                if (appointment) {
                    updateAppointment(appointment.id, updates);
                }
            }, 1000);
        },
        [appointment?.id]
    );

    // Cleanup timer on unmount
    React.useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    // Mechanic: navigate to appointments list when client cancels
    React.useEffect(() => {
        if (!isUserRole && appointment?.status === 'canceled') {
            router.replace('/(tabs)/appointments');
        }
    }, [appointment?.status, isUserRole]);

    // Sync client review state to context for persistence
    React.useEffect(() => {
        if (appointment && !isReviewSubmitted && !isUserRole) {
            debouncedUpdate({
                clientReview: {
                    rating,
                    review: reviewText,
                    experienceTags: selectedOption ? [selectedOption] : []
                }
            });
        }
    }, [rating, selectedOption, reviewText]);

    // Owner: who the mechanic is and what the job costs — the same summary the offer screen used.
    // The appointment id is the request id.
    React.useEffect(() => {
        if (!isUserRole || !appointment?.id || !appointment?.mechanicId) return;
        let cancelled = false;
        assistanceDAO
            .getOfferSummary(appointment.id)
            .then((summary) => !cancelled && setOffer(summary))
            .catch((error) => console.error('Error fetching offer summary:', error));
        return () => {
            cancelled = true;
        };
    }, [isUserRole, appointment?.id, appointment?.mechanicId]);

    // Fetch client details if user is mechanic
    const [client, setClient] = React.useState<any>(null);
    React.useEffect(() => {
        const fetchClient = async () => {
            if (!isUserRole && appointment?.userId) {
                try {
                    const clientData = await userDAO.getPublicProfile(appointment.userId);
                    setClient(clientData);
                } catch (error) {
                    console.error('Error fetching client:', error);
                }
            }
        };
        fetchClient();
    }, [isUserRole, appointment?.userId]);

    const tabs: { key: TabType; label: string }[] = React.useMemo(() => [
        { key: 'info', label: t('appointments.detail.tabs.assistanceInfo') },
        { key: 'client', label: t('appointments.detail.tabs.clientInfo') },
    ], [t]);

    if (!appointment) {
        return (
            <View className="flex-1 bg-white justify-center items-center p-6">
                <Text className="font-outfit-bold text-lg text-gray-900">{t('appointments.detail.notFound')}</Text>
                <Text className="text-gray-500 mt-2">ID: {JSON.stringify(id)}</Text>
                <TouchableOpacity onPress={() => goBackOr(router, '/(tabs)/appointments')} className="mt-4">
                    <Text className="text-blue-600 font-outfit-medium">{t('appointments.detail.goBack')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const ownerDestination =
        appointment.locationLat != null && appointment.locationLng != null
            ? { latitude: appointment.locationLat, longitude: appointment.locationLng }
            : null;
    const ownerMechanicName = offer?.mechanic.displayName ?? t('requestAssistance.mechanicFound.technicianFallback');

    const renderOwnerPanel = () => {
        switch (ownerTab) {
            case 'status':
                return (
                    <View style={{ gap: 16 }}>
                        <OwnerReviewCard appointmentId={appointment.id} status={appointment.status} />
                        <OwnerEtaCard
                            status={appointment.status}
                            minutesAway={minutesAway}
                            etaTime={etaTime}
                            loading={etaLoading}
                            mechanicName={ownerMechanicName}
                            destination={ownerDestination}
                            mechanicCoords={mechanicCoords}
                            polyline={polyline}
                        />
                    </View>
                );
            case 'checkin':
                return appointment.status === 'accepted' ? (
                    <CheckInCodeCard appointmentId={appointment.id} status={appointment.status} />
                ) : (
                    <RequestSummaryRows rows={[{ icon: 'checkmark-circle-outline', label: t('appointments.ownerAccepted.tabs.checkin'), value: t('appointments.ownerAccepted.checkInDone'), tone: 'green' }]} />
                );
            case 'info': {
                const issues = appointment.vehicleIssues?.map((i) => i.name).join(', ');
                const posted = [appointment.date, appointment.time].filter(Boolean).join(' · ');
                const rows = [
                    { icon: 'flash-outline' as const, label: t('appointments.ownerAccepted.rows.service'), value: t(assistanceTypeKey(appointment)) },
                    appointment.car ? { icon: 'car-outline' as const, label: t('appointments.ownerAccepted.rows.vehicle'), value: appointment.car } : null,
                    issues ? { icon: 'construct-outline' as const, label: t('appointments.ownerAccepted.rows.issue'), value: issues } : null,
                    appointment.notes ? { icon: 'document-text-outline' as const, label: t('appointments.ownerAccepted.rows.notes'), value: appointment.notes } : null,
                    appointment.address ? { icon: 'location-outline' as const, label: t('appointments.ownerAccepted.rows.location'), value: appointment.address } : null,
                    posted ? { icon: 'calendar-outline' as const, label: t('appointments.ownerAccepted.rows.posted'), value: posted } : null,
                ].filter((r): r is NonNullable<typeof r> => r !== null);
                return (
                    <View style={{ gap: 12 }}>
                        <RequestSummaryRows rows={rows} />
                        {parseAttachments(appointment.photos).length > 0 && <AttachmentStrip photos={appointment.photos} />}
                    </View>
                );
            }
            case 'mechanic':
                return <OwnerTechnicianPanel mechanic={offer?.mechanic ?? null} />;
            case 'budget':
                return <OwnerBudgetPanel total={(offer?.breakdown?.total ?? offer?.price ?? appointment.budget ?? '').replace(/^\$/, '') || null} />;
        }
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'info':
                return <MechanicAssistanceInfoTab appointment={appointment} />;
            case 'client':
                return (
                    <MechanicClientInfoTab
                        client={client}
                        appointmentType={appointment.type}
                        assistanceType={appointment.assistanceType}
                        rating={rating}
                        setRating={setRating}
                        selectedOption={selectedOption}
                        setSelectedOption={setSelectedOption}
                        reviewText={reviewText}
                        setReviewText={setReviewText}
                        isSubmitted={isReviewSubmitted}
                        onSubmit={() => {
                            setIsReviewSubmitted(true);
                            updateAppointment(appointment.id, {
                                isReviewSubmitted: true,
                                clientReview: {
                                    rating,
                                    review: reviewText,
                                    experienceTags: selectedOption ? [selectedOption] : []
                                }
                            });
                        }}
                        onMessage={() => router.push(`/chat/${appointment.id}`)}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <View
            className="flex-1"
            style={{ backgroundColor: MECH.page }}
            testID="appointment-detail-root"
            nativeID="appointment-detail-root"
        >
            {isCanceledFeedback ? (
                <View><Text>Cancellation Feedback Placeholder</Text></View>
            ) : (
                <View className="flex-1">
                    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                        {isUserRole ? (
                            <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 16 }} testID="owner-accepted">
                                <AcceptedHeader id={appointment.id} />

                                <OwnerMechanicCard
                                    mechanic={offer?.mechanic ?? null}
                                    onMessage={() => router.push(`/chat/${appointment.id}`)}
                                    onCall={() => router.push({ pathname: '/video-lobby/[id]' as any, params: { id: appointment.id } })}
                                />

                                {appointment.type === 'videocall' && (
                                    <TouchableOpacity
                                        onPress={() => router.push({ pathname: '/video-lobby/[id]' as any, params: { id: appointment.id } })}
                                        className="bg-emerald-500 rounded-xl py-4 flex-row items-center justify-center gap-3"
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="videocam" size={22} color="white" />
                                        <Text className="text-white font-outfit-bold text-base">{t('appointments.detail.startVideoChat')}</Text>
                                    </TouchableOpacity>
                                )}

                                <OwnerTabs
                                    active={ownerTab}
                                    onChange={openOwnerTab}
                                    checkInDot={appointment.status === 'accepted' && !checkInSeen}
                                />

                                {ownerTab === 'status' && appointment.status === 'accepted' && (
                                    <CheckInBanner onPress={() => openOwnerTab('checkin')} />
                                )}

                                <View testID="tab-content-container">{renderOwnerPanel()}</View>

                                {(appointment.status === 'accepted' || appointment.status === 'pending') && (
                                    <TouchableOpacity onPress={() => setShowCancelModal(true)} style={{ alignItems: 'center', paddingVertical: 6 }} testID="owner-cancel">
                                        <Text className="font-outfit-bold" style={{ fontSize: 14, color: AO.red }}>{t('appointments.ownerAccepted.cancel')}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            <>
                            {/* Badge + title + assistance type */}
                            <View className="px-5 pt-5 pb-1">
                                <View className="flex-row items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full" style={{ backgroundColor: MECH.blueSoft, alignSelf: 'flex-start' }}>
                                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: MECH.blue }} />
                                    <Text className="font-outfit-bold text-[10.5px] tracking-widest" style={{ color: MECH.blue }}>
                                        {t('appointments.detail.onTheWayBadge')}
                                    </Text>
                                </View>
                                <Text className="font-outfit-bold text-[22px]" style={{ color: MECH.text }}>
                                    {t('appointments.detail.onTheWayTitle')}
                                </Text>
                                <View className="flex-row items-center flex-wrap gap-2 mt-2">
                                    <View className="flex-row items-center gap-2">
                                        <View className="items-center justify-center" style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: 'rgba(229,62,62,0.08)' }}>
                                            <Ionicons name="flash-outline" size={14} color={MECH.red} />
                                        </View>
                                        <Text className="font-outfit-bold text-[13.5px]" style={{ color: MECH.text }}>
                                            {t(assistanceTypeKey(appointment))}
                                        </Text>
                                    </View>
                                    <Text style={{ color: MECH.border }}>·</Text>
                                    <Text className="font-outfit-medium text-xs" style={{ color: MECH.mutedLight }}>
                                        {t('appointments.detail.idLabel', { id: appointment.id.slice(0, 8) })}
                                    </Text>
                                </View>
                            </View>

                            {/* Status card */}
                            <View className="mx-4 mt-3.5 px-5 py-4 items-center" style={{ borderRadius: 20, backgroundColor: MECH.greenSoft }} testID="status-badge" nativeID="status-badge">
                                <View className="flex-row items-center gap-2">
                                    <PulseDot color={MECH.green} />
                                    <Text className="font-outfit-bold text-[22px]" style={{ color: '#0F8A55' }} testID="status-value">
                                        {t('appointments.detail.accepted')}
                                    </Text>
                                </View>
                                <Text className="font-outfit-medium text-[13px] mt-1" style={{ color: '#19A368' }} testID="status-description">
                                    {t('appointments.detail.onTrip')}
                                </Text>
                            </View>

                            {/* On-site check-in — the critical next step once the mechanic arrives */}
                            {appointment.status !== 'completed' ? (
                                <View className="mt-3.5">
                                    <MechanicArrivalCard
                                        inProgress={appointment.status === 'in_progress'}
                                        onStartCheckIn={() => router.push({
                                            pathname: '/appointments/check-in/[id]' as any,
                                            params: { id: appointment.id },
                                        })}
                                    />
                                </View>
                            ) : null}

                            {/* Quick-nav tabs */}
                            <View className="mx-4 mt-3.5 flex-row gap-2.5" testID="tab-navigation-container" nativeID="tab-navigation-container">
                                {tabs.map((tab) => {
                                    const isActive = activeTab === tab.key;
                                    return (
                                        <TouchableOpacity
                                            key={tab.key}
                                            testID={`tab-button-${tab.key}`}
                                            className="flex-1 items-center py-3.5"
                                            style={{
                                                borderRadius: 14,
                                                borderWidth: 1.5,
                                                borderColor: isActive ? MECH.blue : MECH.border,
                                                backgroundColor: isActive ? MECH.blueSoft : '#FFFFFF',
                                            }}
                                            onPress={() => setActiveTab(tab.key)}
                                        >
                                            <Text className="font-outfit-bold text-[13px]" style={{ color: isActive ? MECH.blue : MECH.text }}>
                                                {tab.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <View className="px-4 pt-3.5 pb-10" testID="tab-content-container" nativeID="tab-content-container">
                                {renderTabContent()}
                            </View>
                            </>
                        )}
                    </ScrollView>
                </View>
            )}

            {/* Success Overlay */}
            {/* 
            <SuccessModal
                visible={showSuccess}
                onClose={() => {
                    setShowSuccess(false);
                    router.navigate('/(tabs)/appointments');
                }}
            />
            */}

            {/* Cancellation Overlay */}
            <CancellationModal
                visible={showCancelModal}
                onClose={() => setShowCancelModal(false)}
                onConfirm={() => {
                    setShowCancelModal(false);
                    // Navigate to cancellation reason screen with ID
                    router.push({
                        pathname: '/appointments/cancel-reason',
                        params: { id }
                    });
                }}
            />
        </View>
    );
}

// --- Sub-components (Mechanic View) ---

// KEEPING THESE HELPER FUNCTIONS DEFINED BUT UNUSED FOR NOW TO AVOID IMPORT ERRORS IF I UNCOMMENT

function InfoTab({ appointment, onScanComplete }: { appointment: any, onScanComplete: () => void }) {
    return (
        <View className="gap-5" testID="info-tab-content">
            {/* Title & Type */}
            <View>
                <Text className="text-gray-500 font-outfit-medium text-xs mb-1">Issue Type</Text>
                <Text className="text-blue-900 font-outfit-bold text-xl">{appointment.title}</Text>
            </View>

            {/* Photos */}
            {parseAttachments(appointment.photos).length > 0 && (
                <View>
                    <Text className="text-gray-500 font-outfit-medium text-xs mb-2">Photos</Text>
                    <AttachmentStrip photos={appointment.photos} size={128} />
                </View>
            )}

            {/* Car Details */}
            <View className="flex-row items-start gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                <View className="bg-blue-100 p-2 rounded-lg">
                    <Ionicons name="car-sport" size={24} color="#0047AB" />
                </View>
                <View>
                    <Text className="text-gray-500 text-xs font-outfit-medium">Vehicle</Text>
                    <Text className="text-blue-900 font-outfit-bold text-base">{appointment.car}</Text>
                </View>
            </View>

            {/* Description */}
            <View>
                <Text className="text-gray-500 font-outfit-medium text-xs mb-1">Description</Text>
                <Text className="text-gray-700 font-outfit-regular leading-5">
                    {appointment.notes || 'No description provided.'}
                </Text>
            </View>

            {/* Location (Simplified) */}
            <View>
                <Text className="text-gray-500 font-outfit-medium text-xs mb-1">Location</Text>
                <View className="flex-row items-center gap-2">
                    <Ionicons name="location" size={16} color="#0047AB" />
                    <Text className="text-blue-900 font-outfit-medium">{appointment.address}</Text>
                </View>
            </View>

            {/* Scan Button Action */}
            <View className="mt-4">
                <TouchableOpacity
                    onPress={onScanComplete}
                    className="bg-blue-600 w-full py-4 rounded-xl flex-row items-center justify-center gap-2 shadow-sm"
                >
                    <Ionicons name="qr-code-outline" size={24} color="white" />
                    <Text className="text-white font-outfit-bold text-lg">Scan to Start</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

function ClientTab({
    appointment,
    rating,
    setRating,
    selectedOptions,
    setSelectedOptions,
    reviewText,
    setReviewText,
    isSubmitted,
    setIsSubmitted
}: any) {
    return (
        <View><Text>Client Tab Placeholder</Text></View>
    );
}

function StatusTab({
    // props
}: any) {
    return <View><Text>Status Tab Placeholder</Text></View>
}

function BudgetTab({ appointment, onAskPayment }: { appointment: any, onAskPayment: () => void }) {
    return <View><Text>Budget Tab Placeholder</Text></View>
}

// ... other modals ...
