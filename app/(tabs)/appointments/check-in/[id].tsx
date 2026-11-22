import { useAppointments } from '@/context/AppointmentsContext';
import { useSocket } from '@/context/SocketContext';
import { assistanceDAO } from '@/lib/dao/AssistanceDAO';
import { onSiteDAO, OnSiteStep, OnSiteVisit, RedirectReasonId } from '@/lib/dao/OnSiteDAO';
import { OnSiteCaptureProvider } from '@/components/on-site/MediaSlot';
import { ScreenDiagnosticsVin } from '@/components/on-site/screens-vin';
import { getVinCapture, saveVinCapture, type VinCapture } from '@/lib/onsite/vin';
import { reportedIssue, ScreenArrived, ScreenCheckIn, ScreenCheckinDone, ScreenCheckoutStart, ScreenDiagnosticsObd, ScreenDiagnosticsPhotos, ScreenFeasibility, ScreenRetry } from '@/components/on-site/screens-checkin';
import { DoneVariant, ScreenCloseService } from '@/components/on-site/screens-checkout';
import { ScreenCloseout } from '@/components/on-site/screens-closeout';
import { PartsOrder, RedirectReason, ScreenBuyParts, ScreenEvaluateOptions, ScreenFinalCheck, ScreenResolveIncident } from '@/components/on-site/screens-execution';
import { FlowHeader, OS, Phase, PhaseContext, Spinner } from '@/components/on-site/ui';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { goBackOr } from '@/lib/navigation/goBackOr';
import { refLabel } from '@/lib/refCode';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { appAlert } from '@/lib/ui/appAlert';

// On-site assistance flow, from check-in to close-out (design: "Vehicle On-Site
// Assistance V2"), backed by appointments-service's on-site endpoints: the
// check-in is verified server-side, captures are uploaded, progress is saved
// so the flow resumes where it was left, and the close-out completes the job.
// OBD codes are read off the uploaded scanner report by the document service
// (an `obd_update` socket event says when). Still simulated: the "buy parts" branch.

// 'arrived', 'checkin-done', 'resolve-outcome', 'checkout-start', 'proof', 'diagnostics-vin' and 'final-check' are app-only for now: the visit does not store them, so they are never saved as `step`.
type Screen = 'checkin' | 'arrived' | 'resolve-outcome' | 'checkout-start' | 'proof' | 'retry' | 'diagnostics-vin' | 'final-check' | 'checkin-done' | OnSiteStep;

const TITLE_KEY: Record<Screen, string> = {
    checkin: 'checkin', arrived: 'checkin', 'checkin-done': 'checkin', retry: 'retry', incident: 'incident', 'diagnostics-vin': 'diagnosticsVin', 'diagnostics-obd': 'diagnosticsObd', 'resolve-outcome': 'resolve', 'checkout-start': 'videoOut', proof: 'videoOut',
    'diagnostics-photos': 'diagnosticsPhotos', validating: 'validating', feasibility: 'feasibility',
    'options-checkin': 'options', 'buy-parts': 'buyParts', resolve: 'resolve', 'final-check': 'maintenance', 'options-execution': 'options',
    'video-out': 'videoOut', close: 'close', done: 'done',
};

const PHASE_OF: Record<Screen, Phase> = {
    checkin: 'checkin', arrived: 'checkin', 'checkin-done': 'checkin', retry: 'checkin', incident: 'checkin', 'diagnostics-vin': 'checkin', 'diagnostics-obd': 'checkin', 'diagnostics-photos': 'checkin',
    validating: 'checkin',
    // "Can you resolve it on site?" (and what follows from the answer: parts, or handing the job on) still belongs to the check-in:
    // the assistance, the work itself, starts after it.
    feasibility: 'checkin', 'options-checkin': 'checkin', 'buy-parts': 'checkin',
    resolve: 'execution', 'final-check': 'execution', 'resolve-outcome': 'execution', 'options-execution': 'execution',
    'checkout-start': 'checkout', proof: 'checkout',
    'video-out': 'checkout', close: 'checkout', done: 'checkout',
};

// Where the header's back button goes. Screens missing here have no in-flow back
// (check-in leaves the flow; the rest are one-way, as in the design).
const BACK_OF: Partial<Record<Screen, Screen>> = {
    retry: 'checkin', 'diagnostics-photos': 'diagnostics-vin', 'diagnostics-obd': 'diagnostics-photos',
    feasibility: 'diagnostics-obd', 'options-checkin': 'feasibility', 'buy-parts': 'feasibility', resolve: 'checkin-done',
    'options-execution': 'resolve', 'final-check': 'resolve', 'resolve-outcome': 'final-check', 'checkout-start': 'resolve-outcome', proof: 'checkout-start',
};

/** Screen to reopen a saved visit on. */
function resumeScreen(visit: OnSiteVisit): Screen {
    if (visit.closedAt) return 'done';
    // "Validating" is a transient check; rerun it from the last capture step (OBD).
    if (visit.step === 'validating') return 'diagnostics-obd';
    // The "issue details" screen is gone: a visit still at that step starts at the VIN.
    if (visit.step === 'incident') return 'diagnostics-vin';
    // The exit-capture step is gone (its photos are taken on the Resolve screen): a visit left there goes on to close.
    if (visit.step === 'video-out') return 'close';
    return visit.step;
}

export default function OnSiteFlowScreen() {
    const { id: rawId } = useGlobalSearchParams();
    const id = Array.isArray(rawId) ? rawId[0] : rawId || '';
    const router = useRouter();
    const { t } = useTranslation();
    const { getAppointmentById, refresh: refreshAppointments } = useAppointments();
    const appointment = getAppointmentById(id);

    const [loading, setLoading] = React.useState(true);
    const [visit, setVisit] = React.useState<OnSiteVisit | null>(null);
    const [screen, setScreen] = React.useState<Screen>('checkin');
    // The VIN of the vehicle the owner asked help for, to check the one the mechanic captures against it.
    const [requestVin, setRequestVin] = React.useState<string | null>(null);
    React.useEffect(() => {
        if (!id) return;
        let cancelled = false;
        assistanceDAO
            .getById(id)
            .then((req) => !cancelled && setRequestVin(req?.vehicle?.vin ?? null))
            .catch(() => undefined); // no VIN to compare with: the step works as before
        return () => {
            cancelled = true;
        };
    }, [id]);
    const [doneVariant, setDoneVariant] = React.useState<DoneVariant>('completed');
    const [partsOrder, setPartsOrder] = React.useState<PartsOrder | null>(null);
    const [redirectReason, setRedirectReason] = React.useState<RedirectReason | null>(null);
    const [vinCapture, setVinCapture] = React.useState<VinCapture | null>(null);

    // What the mechanic scanned or typed for the VIN lives on the device (the visit has no field for it yet).
    React.useEffect(() => {
        if (id) void getVinCapture(id).then(setVinCapture);
    }, [id]);

    // A request not accepted yet has no appointment, and a video call has no
    // visit: asking would only earn a 404/409 from the server.
    const hasVisit =
        !!appointment && (appointment.assistanceType ?? appointment.type) !== 'videocall';

    // Resume a visit already checked in (the app may have been closed mid-way).
    React.useEffect(() => {
        if (!id || !hasVisit) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        onSiteDAO
            .get(id)
            .then((v) => {
                if (cancelled || !v) return;
                setVisit(v);
                setScreen(resumeScreen(v));
                if (v.outcome === 'redirected') setDoneVariant('redirected');
            })
            .catch(() => appAlert(t('appointments.onSite.common.error')))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [id, hasVisit, t]);

    // The scanner report is read in the background; refresh when it is in.
    // Also when the owner confirms or disputes the close-out (`onSiteStage`).
    const { lastMessage } = useSocket();
    React.useEffect(() => {
        const refreshes = lastMessage?.type === 'obd_update' || lastMessage?.type === 'owner_review_submitted'
            || (lastMessage?.type === 'appointment_update' && !!lastMessage?.payload?.onSiteStage);
        const eventId = lastMessage?.payload?.id ?? lastMessage?.payload?.appointmentId;
        if (!refreshes || !hasVisit || eventId !== id) return;
        onSiteDAO.get(id).then((v) => v && setVisit(v)).catch(() => { /* next event retries */ });
    }, [lastMessage, id, hasVisit]);

    const obdFilled = visit?.obdStatus === 'ready' || visit?.obdStatus === 'manual';

    const captureContext = React.useMemo(() => ({ appointmentId: id, media: visit?.media ?? [] }), [id, visit?.media]);

    // Every hook goes above the "not found" return below: a render that returns early after one that did not breaks the hook order
    // (the appointment can drop out of the list for a moment while it refreshes).
    // The validating screen turns into the check-in complete one once the diagnostic is in.
    // Can't resolve: two steps (why, then the maintenance check).
    const [optionsStep, setOptionsStep] = React.useState<'why' | 'checklist'>('why');
    // The answer to "can you resolve it on site?", kept here too: the visit it is saved to comes back a moment later.
    const [feasibilityChoice, setFeasibilityChoice] = React.useState<'yes' | 'parts' | 'no' | null>(null);
    // True while the diagnostic is being sent (a second tap on "next" does nothing).
    const submittingDiagnostic = React.useRef(false);
    // The close-out summary lists what was captured, scanned and checked: ask the server for the visit as it is now (captures upload
    // while the technician moves through the steps, and the copy held here is from before them).
    React.useEffect(() => {
        if (screen !== 'close' || !id) return;
        let cancelled = false;
        onSiteDAO.get(id).then((fresh) => { if (!cancelled && fresh) setVisit(fresh); }).catch(() => undefined);
        return () => { cancelled = true; };
    }, [screen, id]);

    if (!appointment) {
        return (
            <View className="flex-1" style={{ backgroundColor: OS.page }}>
                <FlowHeader title={t('appointments.detail.notFound')} onBack={() => router.back()} />
                <View className="flex-1 items-center justify-center p-6">
                    <Text className="font-outfit-bold text-lg" style={{ color: OS.text }}>{t('appointments.detail.notFound')}</Text>
                </View>
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
        if (s !== 'checkin' && s !== 'arrived' && s !== 'resolve-outcome' && s !== 'checkout-start' && s !== 'proof' && s !== 'retry' && s !== 'done' && s !== 'diagnostics-vin' && s !== 'final-check' && s !== 'checkin-done') save({ step: s });
    };

    const checkIn = async (method: 'pin' | 'qr', code: string) => {
        try {
            const result = await onSiteDAO.checkIn(id, method, code);
            if (result.ok) {
                setVisit(result.visit);
                setScreen('arrived');
                // Checking in moves the appointment to in progress: the dashboard and the lists must say so now, not "en route".
                void refreshAppointments();
            } else if (result.reason === 'mismatch') {
                setScreen('retry');
            } else {
                appAlert(t('appointments.checkIn.locked'));
            }
        } catch {
            appAlert(t('appointments.onSite.common.error'));
        }
    };

    // The diagnostic is validated on the server (it names the photos still missing); there is no screen for it: on success the flow moves
    // on to step 4, on failure it goes back to the photos with what is missing.
    const submitDiagnostic = () => {
        if (submittingDiagnostic.current) return;
        submittingDiagnostic.current = true;
        onSiteDAO
            .submitDiagnostic(id)
            .then(() => go('feasibility'))
            .catch(() => {
                appAlert(t('appointments.onSite.validating.missing'));
                go('diagnostics-photos');
            })
            .finally(() => { submittingDiagnostic.current = false; });
    };

    const chooseFeasibility = (feasibility: 'yes' | 'parts' | 'no', next: Screen) => {
        setScreen(next);
        setFeasibilityChoice(feasibility);
        // The check-in complete is app-only: only the answer is stored, the visit stays on this step until the assistance starts.
        save(next === 'checkin-done' ? { feasibility } : { feasibility, step: next as OnSiteStep });
    };

    const redirect = (r: RedirectReason) => {
        setOptionsStep('why');
        setDoneVariant('redirected');
        setRedirectReason(r);
        go('close');
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
            appAlert(t('appointments.onSite.common.error'));
        }
    };

    const inOptions = screen === 'options-checkin' || screen === 'options-execution';
    const back = inOptions && optionsStep === 'checklist'
        ? () => setOptionsStep('why')
        : screen === 'checkin'
        ? () => goBackOr(router, { pathname: '/appointments/[id]', params: { id } })
        : screen === 'done'
            ? () => router.replace('/(tabs)/appointments')
            : screen === 'close'
                // A resolved repair came through the final check; a redirected one, from the resolve screen.
                ? () => go(doneVariant === 'completed' ? 'proof' : 'resolve')
                : BACK_OF[screen] ? () => go(BACK_OF[screen]!) : undefined;
    const checklist = visit?.maintenanceChecklist ?? {};
    const saveChecklist = (c: Record<string, boolean>) => save({ maintenanceChecklist: c });

    let body: React.ReactNode = null;
    switch (screen) {
        case 'checkin': body = <ScreenCheckIn onSubmit={checkIn} onMismatch={() => setScreen('retry')} />; break;
        case 'arrived': body = <ScreenArrived appointment={appointment} onStart={() => setScreen('diagnostics-vin')} />; break;
        case 'retry': body = <ScreenRetry onRetry={() => setScreen('checkin')} vehicle={appointment.car ?? null} refCode={appointment.refCode ?? null} />; break;
        case 'diagnostics-vin':
            body = (
                <ScreenDiagnosticsVin
                    initial={vinCapture}
                    requestVin={requestVin}
                    onNext={(capture) => {
                        setVinCapture(capture);
                        void saveVinCapture(id, capture);
                        go('diagnostics-photos');
                    }}
                />
            );
            break;
        case 'diagnostics-photos': body = <ScreenDiagnosticsPhotos onNext={() => go('diagnostics-obd')} />; break;
        case 'diagnostics-obd':
            body = <ScreenDiagnosticsObd appointmentId={id} visit={visit} onVisit={setVisit} enteredVin={vinCapture?.vin} onNext={submitDiagnostic} />;
            break;
        case 'checkin-done':
            // The close of the check-in: what it covered, and the way into the assistance.
            body = <ScreenCheckinDone visit={visit} vin={vinCapture?.vin ?? null} feasibility={feasibilityChoice ?? visit?.feasibility ?? null} onStart={() => go('resolve')} />;
            break;
        case 'feasibility':
            body = (
                <ScreenFeasibility
                    appointment={appointment}
                    obdCodes={visit?.obdCodes ?? []}
                    onYes={() => chooseFeasibility('yes', 'checkin-done')}
                    onNeedParts={() => chooseFeasibility('parts', 'buy-parts')}
                    onNo={() => chooseFeasibility('no', 'options-checkin')}
                />
            );
            break;
        case 'buy-parts': body = <ScreenBuyParts obdFilled={obdFilled} onDone={(order) => { setPartsOrder(order); go('checkin-done'); }} />; break;
        case 'options-checkin':
            body = <ScreenEvaluateOptions context="checkin" onSelect={redirect} checklist={checklist} onChecklistChange={saveChecklist} step={optionsStep} onStepChange={setOptionsStep} />;
            break;
        case 'resolve':
            body = (
                <ScreenResolveIncident
                    issue={reportedIssue(appointment)}
                    partsOrder={partsOrder}
                    workStartedAt={visit?.workStartedAt ?? null}
                    workNotes={visit?.workNotes ?? ''}
                    onWorkNotesChange={(workNotes) => save({ workNotes })}
                    part="work"
                    onWorkDone={() => go('final-check')}
                    onProofDone={() => undefined}
                    onResolved={() => undefined}
                    onNotResolved={() => undefined}
                />
            );
            break;
        case 'final-check':
            body = <ScreenFinalCheck checklist={checklist} onChecklistChange={saveChecklist} onDone={() => setScreen('resolve-outcome')} />;
            break;
        case 'checkout-start':
            body = <ScreenCheckoutStart issue={reportedIssue(appointment)} workStartedAt={visit?.workStartedAt ?? null} checklist={checklist} onStart={() => setScreen('proof')} />;
            break;
        case 'resolve-outcome':
        case 'proof':
            // How it went (still the assistance), then the photos of the result (check-out): each its own stop, both from the same component.
            body = (
                <ScreenResolveIncident
                    issue={reportedIssue(appointment)}
                    partsOrder={partsOrder}
                    workStartedAt={visit?.workStartedAt ?? null}
                    workNotes={visit?.workNotes ?? ''}
                    onWorkNotesChange={(workNotes) => save({ workNotes })}
                    part={screen === 'proof' ? 'proof' : 'outcome'}
                    onWorkDone={() => undefined}
                    onProofDone={() => go('close')}
                    onResolved={() => setScreen('checkout-start')}
                    onNotResolved={() => go('options-execution')}
                />
            );
            break;
        case 'options-execution':
            body = <ScreenEvaluateOptions context="execution" onSelect={redirect} checklist={checklist} onChecklistChange={saveChecklist} step={optionsStep} onStepChange={setOptionsStep} />;
            break;
        case 'close':
            body = (
                <ScreenCloseService
                    variant={doneVariant}
                    partsCost={partsOrder?.partsTotal ?? 0}
                    redirectReason={redirectReason}
                    serviceAmount={visit?.serviceAmount ?? null}
                    checkedInAt={visit?.checkedInAt ?? null}
                    visit={visit}
                    vehicle={appointment.car ?? null}
                    vin={vinCapture?.vin ?? null}
                    requestCode={refLabel(appointment.refCode, appointment.id)}
                    onClose={close}
                />
            );
            break;
        case 'done':
            body = visit ? (
                <ScreenCloseout
                    visit={visit}
                    requestCode={refLabel(appointment.refCode, appointment.id)}
                    onVisit={setVisit}
                    onBackToDashboard={() => {
                        // Flow finished: empty the appointments stack so the tab doesn't reopen check-in.
                        if (router.canDismiss()) router.dismissAll();
                        router.navigate('/(tabs)/dashboard');
                    }}
                />
            ) : null;
            break;
    }

    return (
        <KeyboardAvoidingView className="flex-1" style={{ backgroundColor: OS.page }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <FlowHeader
                title={screen === 'done' ? t('appointments.closeout.title') : t(`appointments.onSite.titles.${TITLE_KEY[screen]}`)}
                onBack={loading ? () => goBackOr(router, { pathname: '/appointments/[id]', params: { id } }) : back}
                closeIcon={screen === 'done'}
            />
            {loading ? (
                <View className="flex-1 items-center justify-center"><Spinner /></View>
            ) : (
                <OnSiteCaptureProvider value={captureContext}>
                    {/* The phase bar is drawn by each screen's scroll, not pinned here: only the header and the buttons below stay fixed. */}
                    <PhaseContext.Provider value={screen !== 'done' ? PHASE_OF[screen] : null}>
                        {/* key resets each screen's local state when navigating between steps */}
                        <View key={screen} className="flex-1">{body}</View>
                    </PhaseContext.Provider>
                </OnSiteCaptureProvider>
            )}
        </KeyboardAvoidingView>
    );
}
