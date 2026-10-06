import { useAppointments } from '@/context/AppointmentsContext';
import { useSocket } from '@/context/SocketContext';
import { userDAO } from '@/lib/dao/UserDAO';
import { onSiteDAO, OnSiteStep, OnSiteVisit, RedirectReasonId } from '@/lib/dao/OnSiteDAO';
import { OnSiteCaptureProvider } from '@/components/on-site/MediaSlot';
import { reportedIssue, ScreenCheckIn, ScreenDiagnosticsObd, ScreenDiagnosticsPhotos, ScreenFeasibility, ScreenIncidentDetails, ScreenRetry, ScreenValidating } from '@/components/on-site/screens-checkin';
import { DoneVariant, ScreenCloseService, ScreenDone, ScreenVideoOut } from '@/components/on-site/screens-checkout';
import { PartsOrder, RedirectReason, ScreenBuyParts, ScreenEvaluateOptions, ScreenResolveIncident } from '@/components/on-site/screens-execution';
import { FlowHeader, OS, Phase, PhaseBar, Spinner } from '@/components/on-site/ui';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';

// On-site assistance flow, from check-in to close-out (design: "Vehicle On-Site
// Assistance V2"), backed by appointments-service's on-site endpoints: the
// check-in is verified server-side, captures are uploaded, progress is saved
// so the flow resumes where it was left, and the close-out completes the job.
// OBD codes are read off the uploaded scanner report by the document service
// (an `obd_update` socket event says when). Still simulated: the "buy parts" branch.

type Screen = 'checkin' | 'retry' | OnSiteStep;

const TITLE_KEY: Record<Screen, string> = {
    checkin: 'checkin', retry: 'retry', incident: 'incident', 'diagnostics-obd': 'diagnosticsObd',
    'diagnostics-photos': 'diagnosticsPhotos', validating: 'validating', feasibility: 'feasibility',
    'options-checkin': 'options', 'buy-parts': 'buyParts', resolve: 'resolve', 'options-execution': 'options',
    'video-out': 'videoOut', close: 'close', done: 'done',
};

const PHASE_OF: Record<Screen, Phase> = {
    checkin: 'checkin', retry: 'checkin', incident: 'checkin', 'diagnostics-obd': 'checkin', 'diagnostics-photos': 'checkin',
    validating: 'checkin', feasibility: 'checkin', 'options-checkin': 'checkin', 'buy-parts': 'checkin',
    resolve: 'execution', 'options-execution': 'execution',
    'video-out': 'checkout', close: 'checkout', done: 'checkout',
};

// Where the header's back button goes. Screens missing here have no in-flow back
// (check-in leaves the flow; the rest are one-way, as in the design).
const BACK_OF: Partial<Record<Screen, Screen>> = {
    retry: 'checkin', 'diagnostics-obd': 'incident', 'diagnostics-photos': 'diagnostics-obd',
    feasibility: 'diagnostics-photos', 'options-checkin': 'feasibility', 'buy-parts': 'feasibility', resolve: 'feasibility',
    'options-execution': 'resolve', 'video-out': 'resolve', close: 'video-out',
};

/** Screen to reopen a saved visit on. */
function resumeScreen(visit: OnSiteVisit): Screen {
    if (visit.closedAt) return 'done';
    // "Validating" is a transient check; rerun it from the photos.
    if (visit.step === 'validating') return 'diagnostics-photos';
    return visit.step;
}

function hasRating(clientReview: unknown): boolean {
    if (!clientReview) return false;
    try {
        const parsed = typeof clientReview === 'string' ? JSON.parse(clientReview) : clientReview;
        return !!(parsed as { rating?: number })?.rating;
    } catch {
        return false;
    }
}

export default function OnSiteFlowScreen() {
    const { id: rawId } = useGlobalSearchParams();
    const id = Array.isArray(rawId) ? rawId[0] : rawId || '';
    const router = useRouter();
    const { t } = useTranslation();
    const { getAppointmentById } = useAppointments();
    const appointment = getAppointmentById(id);

    const [loading, setLoading] = React.useState(true);
    const [visit, setVisit] = React.useState<OnSiteVisit | null>(null);
    const [screen, setScreen] = React.useState<Screen>('checkin');
    const [doneVariant, setDoneVariant] = React.useState<DoneVariant>('completed');
    const [partsOrder, setPartsOrder] = React.useState<PartsOrder | null>(null);
    const [redirectReason, setRedirectReason] = React.useState<RedirectReason | null>(null);
    const [clientName, setClientName] = React.useState('—');

    // Resume a visit already checked in (the app may have been closed mid-way).
    React.useEffect(() => {
        if (!id) return;
        let cancelled = false;
        onSiteDAO
            .get(id)
            .then((v) => {
                if (cancelled || !v) return;
                setVisit(v);
                setScreen(resumeScreen(v));
                if (v.outcome === 'redirected') setDoneVariant('redirected');
            })
            .catch(() => Alert.alert(t('appointments.onSite.common.error')))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [id, t]);

    React.useEffect(() => {
        if (!appointment?.userId) return;
        let cancelled = false;
        userDAO.getPublicProfile(appointment.userId)
            .then((p) => {
                const name = [p?.name, p?.surname].filter(Boolean).join(' ');
                if (!cancelled && name) setClientName(name);
            })
            .catch(() => { /* keep the placeholder */ });
        return () => { cancelled = true; };
    }, [appointment?.userId]);

    // The scanner report is read in the background; refresh when it is in.
    const { lastMessage } = useSocket();
    React.useEffect(() => {
        if (lastMessage?.type !== 'obd_update' || lastMessage?.payload?.id !== id) return;
        onSiteDAO.get(id).then((v) => v && setVisit(v)).catch(() => { /* next event retries */ });
    }, [lastMessage, id]);

    const obdFilled = visit?.obdStatus === 'ready' || visit?.obdStatus === 'manual';

    const captureContext = React.useMemo(() => ({ appointmentId: id, media: visit?.media ?? [] }), [id, visit?.media]);

    if (!appointment) {
        return (
            <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: OS.page }}>
                <Text className="font-outfit-bold text-lg" style={{ color: OS.text }}>{t('appointments.detail.notFound')}</Text>
            </View>
        );
    }

    /** Saves a change to the visit; failures surface but never block the flow. */
    const save = (changes: Parameters<typeof onSiteDAO.update>[1]) => {
        if (!visit) return;
        onSiteDAO
            .update(id, changes)
            .then(setVisit)
            .catch(() => { /* best-effort autosave; the next change retries */ });
    };

    const go = (s: Screen) => {
        setScreen(s);
        if (s !== 'checkin' && s !== 'retry' && s !== 'done') save({ step: s });
    };

    const checkIn = async (method: 'pin' | 'qr', code: string) => {
        try {
            const result = await onSiteDAO.checkIn(id, method, code);
            if (result.ok) {
                setVisit(result.visit);
                setScreen('incident');
            } else if (result.reason === 'mismatch') {
                setScreen('retry');
            } else {
                Alert.alert(t('appointments.checkIn.locked'));
            }
        } catch {
            Alert.alert(t('appointments.onSite.common.error'));
        }
    };

    const chooseFeasibility = (feasibility: 'yes' | 'parts' | 'no', next: Screen) => {
        setScreen(next);
        save({ feasibility, step: next as OnSiteStep });
    };

    const redirect = (r: RedirectReason) => {
        setDoneVariant('redirected');
        setRedirectReason(r);
        go('video-out');
    };

    const close = async () => {
        try {
            const closed = await onSiteDAO.close(
                id,
                doneVariant === 'redirected' ? 'redirected' : 'resolved',
                redirectReason?.id as RedirectReasonId | undefined,
                redirectReason?.note || undefined,
            );
            setVisit(closed);
            setScreen('done');
        } catch {
            Alert.alert(t('appointments.onSite.common.error'));
        }
    };

    const back = screen === 'checkin' ? () => router.back() : BACK_OF[screen] ? () => go(BACK_OF[screen]!) : undefined;
    const checklist = visit?.maintenanceChecklist ?? {};
    const saveChecklist = (c: Record<string, boolean>) => save({ maintenanceChecklist: c });

    let body: React.ReactNode = null;
    switch (screen) {
        case 'checkin': body = <ScreenCheckIn onSubmit={checkIn} onMismatch={() => setScreen('retry')} />; break;
        case 'retry': body = <ScreenRetry onRetry={() => setScreen('checkin')} />; break;
        case 'incident': body = <ScreenIncidentDetails appointment={appointment} clientName={clientName} onNext={() => go('diagnostics-obd')} />; break;
        case 'diagnostics-obd':
            body = <ScreenDiagnosticsObd appointmentId={id} visit={visit} onVisit={setVisit} onNext={() => go('diagnostics-photos')} />;
            break;
        case 'diagnostics-photos': body = <ScreenDiagnosticsPhotos onNext={() => go('validating')} />; break;
        case 'validating':
            body = (
                <ScreenValidating
                    run={async () => { await onSiteDAO.submitDiagnostic(id); }}
                    onDone={() => go('feasibility')}
                    onFail={(message) => {
                        Alert.alert(message);
                        go('diagnostics-photos');
                    }}
                />
            );
            break;
        case 'feasibility':
            body = (
                <ScreenFeasibility
                    appointment={appointment}
                    obdCodes={visit?.obdCodes ?? []}
                    onYes={() => chooseFeasibility('yes', 'resolve')}
                    onNeedParts={() => chooseFeasibility('parts', 'buy-parts')}
                    onNo={() => chooseFeasibility('no', 'options-checkin')}
                />
            );
            break;
        case 'buy-parts': body = <ScreenBuyParts obdFilled={obdFilled} onDone={(order) => { setPartsOrder(order); go('resolve'); }} />; break;
        case 'options-checkin':
            body = <ScreenEvaluateOptions context="checkin" onSelect={redirect} checklist={checklist} onChecklistChange={saveChecklist} />;
            break;
        case 'resolve':
            body = (
                <ScreenResolveIncident
                    issue={reportedIssue(appointment)}
                    partsOrder={partsOrder}
                    workStartedAt={visit?.workStartedAt ?? null}
                    workNotes={visit?.workNotes ?? ''}
                    onWorkNotesChange={(workNotes) => save({ workNotes })}
                    checklist={checklist}
                    onChecklistChange={saveChecklist}
                    onResolved={() => go('video-out')}
                    onNotResolved={() => go('options-execution')}
                />
            );
            break;
        case 'options-execution':
            body = <ScreenEvaluateOptions context="execution" onSelect={redirect} checklist={checklist} onChecklistChange={saveChecklist} />;
            break;
        case 'video-out':
            body = (
                <ScreenVideoOut
                    appointmentId={id}
                    visit={visit}
                    onVisit={setVisit}
                    onNext={(skipped) => {
                        save({ exitSkipped: skipped });
                        go('close');
                    }}
                />
            );
            break;
        case 'close':
            body = (
                <ScreenCloseService
                    variant={doneVariant}
                    partsCost={partsOrder?.partsTotal ?? 0}
                    redirectReason={redirectReason}
                    serviceAmount={visit?.serviceAmount ?? null}
                    checkedInAt={visit?.checkedInAt ?? null}
                    onClose={close}
                />
            );
            break;
        case 'done':
            body = (
                <ScreenDone
                    variant={doneVariant}
                    appointmentId={appointment.id}
                    visit={visit}
                    onVisit={setVisit}
                    clientName={clientName}
                    alreadyRated={hasRating(appointment.clientReview)}
                    onSubmitReview={async (rating, comment) => {
                        await onSiteDAO.reviewClient(id, rating, comment || undefined);
                    }}
                    onBackToDashboard={() => router.replace('/(tabs)/appointments')}
                />
            );
            break;
    }

    return (
        <KeyboardAvoidingView className="flex-1" style={{ backgroundColor: OS.page }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <FlowHeader title={t(`appointments.onSite.titles.${TITLE_KEY[screen]}`)} onBack={loading ? () => router.back() : back} />
            {loading ? (
                <View className="flex-1 items-center justify-center"><Spinner /></View>
            ) : (
                <OnSiteCaptureProvider value={captureContext}>
                    {screen !== 'done' ? <PhaseBar phase={PHASE_OF[screen]} /> : null}
                    {/* key resets each screen's local state when navigating between steps */}
                    <View key={screen} className="flex-1">{body}</View>
                </OnSiteCaptureProvider>
            )}
        </KeyboardAvoidingView>
    );
}
