import { CancellationModal } from '@/components/appointments/CancellationModal';
import { MechanicAssistanceInfoTab } from '@/components/appointments/MechanicAssistanceInfoTab';
import { MechanicBudgetTab } from '@/components/appointments/MechanicBudgetTab';
import { MechanicClientInfoTab } from '@/components/appointments/MechanicClientInfoTab';
import { MechanicStatusTab } from '@/components/appointments/MechanicStatusTab';
import { UserBudgetTab } from '@/components/appointments/UserBudgetTab';
import { UserMechanicInfoTab } from '@/components/appointments/UserMechanicInfoTab';
import { UserStatusTab } from '@/components/appointments/UserStatusTab';
import { UserTrackingTab } from '@/components/appointments/UserTrackingTab';
import { useAppointments } from '@/context/AppointmentsContext';
import { useUser } from '@/context/UserContext';
import { useAppointmentEta } from '@/hooks/useAppointmentEta';
import { useMechanicLocationBroadcast } from '@/hooks/useMechanicLocationBroadcast';
import { userDAO } from '@/lib/dao/UserDAO';
import { Ionicons } from '@expo/vector-icons';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
    Dimensions,
    Image,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const { width } = Dimensions.get('window');

type TabType = 'info' | 'client' | 'status' | 'budget';

export default function AppointmentDetailScreen() {
    // Switch back to Global params as Local causes context error in full tree
    const { id } = useGlobalSearchParams();
    // const { id } = useLocalSearchParams();
    const router = useRouter();
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
    const { minutesAway, etaTime, loading: etaLoading } = useAppointmentEta(
        isUserRole ? appointment?.id : undefined,
        isUserRole ? appointment?.status : undefined,
    );
    const [mechanic, setMechanic] = React.useState<any>(null); // State for mechanic details

    const [activeTab, setActiveTab] = React.useState<TabType>('info');
    const [showSuccess, setShowSuccess] = React.useState(false);
    const [showCancelModal, setShowCancelModal] = React.useState(false);
    const [isCanceledFeedback, setIsCanceledFeedback] = React.useState(false);

    // Consistent state for ClientTab (Mechanic View)
    const [rating, setRating] = React.useState(appointment?.clientReview?.rating || 0);
    const [selectedOption, setSelectedOption] = React.useState<string>(appointment?.clientReview?.experienceTags?.[0] || '');
    const [reviewText, setReviewText] = React.useState(appointment?.clientReview?.review || '');
    const [isReviewSubmitted, setIsReviewSubmitted] = React.useState(appointment?.isReviewSubmitted || false);

    // Consistent state for Status Updates (Mechanic View)
    const [statusUpdate, setStatusUpdate] = React.useState(appointment?.currentStatus || '');
    const [isStatusUpdated, setIsStatusUpdated] = React.useState(appointment?.isStatusUpdated || false);
    const [additionalAmount, setAdditionalAmount] = React.useState('');
    const [additionalType, setAdditionalType] = React.useState(appointment?.additionalFunds?.[0]?.type || '');
    const [additionalDetails, setAdditionalDetails] = React.useState(appointment?.additionalFunds?.[0]?.details || '');

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

    // Fetch mechanic details if appointment exists
    React.useEffect(() => {
        const fetchMechanic = async () => {
            if (appointment?.mechanicId) {
                try {
                    const mechData = await userDAO.getById(appointment.mechanicId);
                    setMechanic(mechData);
                } catch (error) {
                    console.error('Error fetching mechanic:', error);
                }
            }
        };
        fetchMechanic();
    }, [appointment?.mechanicId]);

    // Fetch client details if user is mechanic
    const [client, setClient] = React.useState<any>(null);
    React.useEffect(() => {
        const fetchClient = async () => {
            if (!isUserRole && appointment?.userId) {
                try {
                    const clientData = await userDAO.getById(appointment.userId);
                    setClient(clientData);
                } catch (error) {
                    console.error('Error fetching client:', error);
                }
            }
        };
        fetchClient();
    }, [isUserRole, appointment?.userId]);

    // Sync status state to context
    React.useEffect(() => {
        if (appointment && !isUserRole) {
            debouncedUpdate({
                currentStatus: statusUpdate,
                additionalFunds: [{
                    amount: additionalAmount,
                    type: additionalType,
                    details: additionalDetails,
                    status: 'pending'
                }]
            });
        }
    }, [additionalAmount, additionalType, additionalDetails, statusUpdate]);

    const tabs: { key: TabType; label: string }[] = React.useMemo(() => isUserRole
        ? [
            { key: 'info', label: 'Assistance info' },
            { key: 'client', label: 'Mechanic info' },
            { key: 'status', label: 'Assist status' },
            { key: 'budget', label: 'Budget' },
        ]
        : [
            { key: 'info', label: 'Assistance info' },
            { key: 'client', label: 'Client info' },
            { key: 'status', label: 'Assist status' },
            { key: 'budget', label: 'Budget' },
        ], [isUserRole]);

    if (!appointment) {
        return (
            <View className="flex-1 bg-white justify-center items-center p-6">
                <Text className="font-outfit-bold text-lg text-gray-900">Appointment not found</Text>
                <Text className="text-gray-500 mt-2">ID: {JSON.stringify(id)}</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-4">
                    <Text className="text-blue-600 font-outfit-medium">Go back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Restore renderTabContent
    const renderTabContent = () => {
        if (isUserRole) {
            switch (activeTab) {
                case 'info':
                    return (
                        <UserTrackingTab
                            onCancel={() => setShowCancelModal(true)}
                            onMessage={() => router.push(`/chat/${appointment.id}`)}
                            mechanic={mechanic}
                            appointmentType={appointment.type}
                            appointment={appointment}
                            minutesAway={minutesAway}
                            etaTime={etaTime}
                            etaLoading={etaLoading}
                        />
                    );
                case 'client':
                    return <UserMechanicInfoTab mechanic={mechanic} />;
                case 'status':
                    return <UserStatusTab appointment={appointment} />;
                case 'budget':
                    return <UserBudgetTab appointment={appointment} />;
                default:
                    return null;
            }
        }

        switch (activeTab) {
            case 'info':
                return <MechanicAssistanceInfoTab appointment={appointment} onScan={() => setActiveTab('status')} />;
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
            case 'status':
                return (
                    <MechanicStatusTab
                        appointment={appointment}
                        statusUpdate={statusUpdate}
                        setStatusUpdate={setStatusUpdate}
                        onUpdateStatus={() => {
                            if (statusUpdate === 'Assistance completed') {
                                setActiveTab('budget');
                            }
                            setIsStatusUpdated(true);
                            updateAppointment(appointment.id, {
                                isStatusUpdated: true,
                                currentStatus: statusUpdate
                            });
                        }}
                        additionalAmount={additionalAmount}
                        setAdditionalAmount={setAdditionalAmount}
                        additionalType={additionalType}
                        setAdditionalType={setAdditionalType}
                        onRequestFunds={() => { }}
                    />
                );
            case 'budget':
                return (
                    <MechanicBudgetTab
                        appointment={appointment}
                        onAskPayment={() => setShowSuccess(true)}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <View className="flex-1 bg-white" testID="appointment-detail-root" nativeID="appointment-detail-root">
            {isCanceledFeedback ? (
                <View><Text>Cancellation Feedback Placeholder</Text></View>
            ) : (
                <View className="flex-1">
                    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                        {/* Title Section */}
                        <View className="px-6 py-4">
                            <Text className="font-outfit-bold text-blue-900 text-lg">Assistance accepted</Text>
                            <Text className="text-gray-400 text-xs">ID:#{appointment.id.slice(0, 8)}...</Text>
                        </View>

                        {/* Status Bar - GREEN */}
                        <View className="px-6 mb-6" testID="status-bar-container" nativeID="status-bar-container">
                            <View
                                className="border border-green-100 rounded-lg p-4 items-center bg-green-50"
                                testID="status-badge"
                                nativeID="status-badge"
                            >
                                <Text className="text-gray-500 font-outfit-medium text-xs mb-1" testID="status-label">Status</Text>
                                <Text className="text-emerald-600 font-outfit-bold text-lg uppercase mb-1" testID="status-value">ACCEPTED</Text>
                                <Text className="text-emerald-600/80 text-[10px]" testID="status-description">On trip to client's address</Text>
                            </View>
                        </View>

                        {/* Video Call Button - only for videocall type appointments */}
                        {appointment.type === 'videocall' && (
                            <View className="px-6 mb-6">
                                <TouchableOpacity
                                    onPress={() => router.push({
                                        pathname: '/video-lobby/[id]' as any,
                                        params: { id: appointment.id }
                                    })}
                                    className="bg-emerald-500 rounded-xl py-4 flex-row items-center justify-center gap-3 shadow-sm"
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="videocam" size={24} color="white" />
                                    <Text className="text-white font-outfit-bold text-lg">
                                        {isUserRole ? 'Start Video Chat' : 'Join Video Call'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Tab Navigation - ROUNDED BUTTONS */}
                        <View className="px-6 mb-6" testID="tab-navigation-container" nativeID="tab-navigation-container">
                            <View className="flex-row flex-wrap justify-between gap-y-3">
                                {tabs.map((tab) => (
                                    <TouchableOpacity
                                        key={tab.key}
                                        testID={`tab-button-${tab.key}`}
                                        className={`py-3 rounded-lg border w-[48%] items-center ${activeTab === tab.key
                                            ? 'bg-white border-blue-900 border-2'
                                            : 'bg-white border-gray-200'
                                            }`}
                                        onPress={() => setActiveTab(tab.key)}
                                    >
                                        <Text className={`font-outfit-bold text-xs ${activeTab === tab.key ? 'text-blue-900' : 'text-gray-900'
                                            }`}>
                                            {tab.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Content Container - REMOVE BLUE HEADER */}
                        <View className="px-6 pb-10" testID="tab-content-container" nativeID="tab-content-container">
                            {renderTabContent()}
                        </View>
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
            {appointment.photos && appointment.photos.length > 0 && (
                <View>
                    <Text className="text-gray-500 font-outfit-medium text-xs mb-2">Photos</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
                        {appointment.photos.map((photo: string, index: number) => (
                            <Image
                                key={index}
                                source={{ uri: photo }}
                                className="w-32 h-32 rounded-lg bg-gray-100"
                                resizeMode="cover"
                            />
                        ))}
                    </ScrollView>
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
