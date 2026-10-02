import { useAppointments } from '@/context/AppointmentsContext';
import { userDAO } from '@/lib/dao/UserDAO';
import { reportedIssue, ScreenCheckIn, ScreenDiagnosticsObd, ScreenDiagnosticsPhotos, ScreenFeasibility, ScreenIncidentDetails, ScreenRetry, ScreenValidating } from '@/components/on-site/screens-checkin';
import { DoneVariant, ScreenCloseService, ScreenDone, ScreenVideoOut } from '@/components/on-site/screens-checkout';
import { PartsOrder, RedirectReason, ScreenBuyParts, ScreenEvaluateOptions, ScreenResolveIncident } from '@/components/on-site/screens-execution';
import { FlowHeader, OS, Phase, PhaseBar } from '@/components/on-site/ui';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

// On-site assistance flow, from check-in to close-out (design: "Vehicle On-Site
// Assistance V2"). UI only for now: nothing here is validated or saved by the
// backend — QR/PIN, OBD codes, parts, owner approval, charges and the rating are
// all simulated.

type Screen =
    | 'checkin' | 'retry' | 'incident' | 'diagnostics-obd' | 'diagnostics-photos' | 'validating' | 'feasibility'
    | 'options-checkin' | 'buy-parts' | 'resolve' | 'options-execution'
    | 'video-out' | 'close' | 'done';

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
    retry: 'checkin', incident: 'checkin', 'diagnostics-obd': 'incident', 'diagnostics-photos': 'diagnostics-obd',
    feasibility: 'diagnostics-photos', 'options-checkin': 'feasibility', 'buy-parts': 'feasibility', resolve: 'feasibility',
    'options-execution': 'resolve', 'video-out': 'resolve', close: 'video-out',
};

export default function OnSiteFlowScreen() {
    const { id } = useGlobalSearchParams();
    const router = useRouter();
    const { t } = useTranslation();
    const { getAppointmentById } = useAppointments();
    const appointment = getAppointmentById(Array.isArray(id) ? id[0] : id || '');

    const [screen, setScreen] = React.useState<Screen>('checkin');
    const [doneVariant, setDoneVariant] = React.useState<DoneVariant>('completed');
    const [obdFilled, setObdFilled] = React.useState(false);
    const [partsOrder, setPartsOrder] = React.useState<PartsOrder | null>(null);
    const [redirectReason, setRedirectReason] = React.useState<RedirectReason | null>(null);
    const [clientName, setClientName] = React.useState('—');

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

    if (!appointment) {
        return (
            <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: OS.page }}>
                <Text className="font-outfit-bold text-lg" style={{ color: OS.text }}>{t('appointments.detail.notFound')}</Text>
            </View>
        );
    }

    const go = (s: Screen) => setScreen(s);
    const redirect = (r: RedirectReason) => {
        setDoneVariant('redirected');
        setRedirectReason(r);
        go('video-out');
    };

    const back = screen === 'checkin' ? () => router.back() : BACK_OF[screen] ? () => go(BACK_OF[screen]!) : undefined;

    let body: React.ReactNode = null;
    switch (screen) {
        case 'checkin': body = <ScreenCheckIn onMatch={() => go('incident')} onMismatch={() => go('retry')} />; break;
        case 'retry': body = <ScreenRetry onRetry={() => go('checkin')} />; break;
        case 'incident': body = <ScreenIncidentDetails appointment={appointment} clientName={clientName} onNext={() => go('diagnostics-obd')} />; break;
        case 'diagnostics-obd': body = <ScreenDiagnosticsObd onNext={() => go('diagnostics-photos')} onFilledChange={setObdFilled} />; break;
        case 'diagnostics-photos': body = <ScreenDiagnosticsPhotos onNext={() => go('validating')} />; break;
        case 'validating': body = <ScreenValidating onDone={() => go('feasibility')} />; break;
        case 'feasibility':
            body = <ScreenFeasibility appointment={appointment} onYes={() => go('resolve')} onNeedParts={() => go('buy-parts')} onNo={() => go('options-checkin')} />;
            break;
        case 'buy-parts': body = <ScreenBuyParts obdFilled={obdFilled} onDone={(order) => { setPartsOrder(order); go('resolve'); }} />; break;
        case 'options-checkin': body = <ScreenEvaluateOptions context="checkin" onSelect={redirect} />; break;
        case 'resolve':
            body = <ScreenResolveIncident issue={reportedIssue(appointment)} partsOrder={partsOrder} onResolved={() => go('video-out')} onNotResolved={() => go('options-execution')} />;
            break;
        case 'options-execution': body = <ScreenEvaluateOptions context="execution" onSelect={redirect} />; break;
        case 'video-out': body = <ScreenVideoOut obdPending={!obdFilled} onNext={() => go('close')} />; break;
        case 'close':
            body = <ScreenCloseService variant={doneVariant} partsCost={partsOrder?.partsTotal ?? 0} redirectReason={redirectReason} onClose={() => go('done')} />;
            break;
        case 'done':
            body = <ScreenDone variant={doneVariant} appointmentId={appointment.id} clientName={clientName} onBackToDashboard={() => router.replace('/(tabs)/appointments')} />;
            break;
    }

    return (
        <KeyboardAvoidingView className="flex-1" style={{ backgroundColor: OS.page }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <FlowHeader title={t(`appointments.onSite.titles.${TITLE_KEY[screen]}`)} onBack={back} />
            {screen !== 'done' ? <PhaseBar phase={PHASE_OF[screen]} /> : null}
            {/* key resets each screen's local state when navigating between steps */}
            <View key={screen} className="flex-1">{body}</View>
        </KeyboardAvoidingView>
    );
}
