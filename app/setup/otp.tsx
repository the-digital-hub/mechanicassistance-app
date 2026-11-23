import { describeAuthError } from '@/lib/auth/describe';
import { toAuthError } from '@/lib/auth/errors';
import { resendOtp, verifyOtp } from '@/lib/auth/otp';
import { formatCountdown, useCountdown } from '@/hooks/useCountdown';
import { clearAddRole, startAddRole } from '@/lib/setup-add-role';
import { clearSetupProgress, getSetupProgress, mergeSetupProgress, saveSetupProgress } from '@/lib/storage';
import { getSetupResumeRoute } from '@/lib/setup-resume';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Keyboard, KeyboardAvoidingView, ScrollView, Modal, Platform, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { SETUP_BG, SetupFooter, SetupHeading } from '@/components/setup/SetupKit';
import { BUTTON_RADIUS } from '@/lib/ui/floatingFooter';
import { TYPE } from '@/lib/ui/type';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';

export default function OTPScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const [code, setCode] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);

    // The challenge, carried over from the phone step. Deadlines are absolute
    // epoch ms so they survive the app going to the background.
    const [phoneE164, setPhoneE164] = useState('');
    const [requestId, setRequestId] = useState<string | null>(null);
    const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
    const [resendAtMs, setResendAtMs] = useState<number | null>(null);
    const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
    const expiresIn = useCountdown(expiresAtMs);
    const resendIn = useCountdown(resendAtMs);
    const otpInputRef = useRef<TextInput>(null);

    const [errorModal, setErrorModal] = useState<{
        visible: boolean;
        title: string;
        message: string;
        actionLabel?: string;
        onAction?: () => void;
        isSuccess?: boolean;
    }>({ visible: false, title: '', message: '' });

    const showError = (title: string, message: string, action?: { label: string; onPress: () => void }, isSuccess?: boolean) => {
        setErrorModal({ visible: true, title, message, actionLabel: action?.label, onAction: action?.onPress, isSuccess });
    };
    const hideError = () => setErrorModal(prev => ({ ...prev, visible: false }));

    useEffect(() => {
        setTimeout(() => otpInputRef.current?.focus(), 100);
    }, []);

    useEffect(() => {
        loadPhoneNumber();
    }, []);

    const loadPhoneNumber = async () => {
        const progress = await getSetupProgress();
        const phone = progress.phone;
        if (!phone?.phoneNumber) return;

        const raw = phone.phoneNumber as string;
        // The raw E.164 is kept as well as the formatted one: verify needs the
        // number the challenge was created for, and the display string is not it.
        setPhoneE164(raw);

        const digits = raw.replace(/\D/g, '').slice(-10);
        setPhoneNumber(`+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`);

        // Resume the timers the phone step started rather than restarting them.
        if (typeof phone.requestId === 'string') setRequestId(phone.requestId);
        if (typeof phone.expiresAtMs === 'number') setExpiresAtMs(phone.expiresAtMs);
        if (typeof phone.resendAtMs === 'number') setResendAtMs(phone.resendAtMs);
    };

    const handleSubmit = async (codeToVerify?: string) => {
        const currentCode = typeof codeToVerify === 'string' ? codeToVerify : code;
        if (currentCode.length < 6) return;

        if (!requestId || !phoneE164) return;

        setIsVerifying(true);
        try {
            // Verifying returns the scoped token and stores it, so the separate
            // fetch this used to do is gone — along with the swallowed failure
            // that let a missing token break the uploads two screens later.
            const result = await verifyOtp(requestId, phoneE164, currentCode);

            if (result.kind === 'session') {
                // The number acquired an account while the wizard was open.
                // Adopt the session instead of continuing to register.
                await clearSetupProgress();
                router.replace('/choose-role');
                return;
            }

            if (result.kind === 'existing_account') {
                // The phone already has an account: the wizard adds a role to
                // it instead of creating one. Its session is stored but not
                // adopted, so the app stays in the wizard.
                await startAddRole(result.roles, result.primaryRole);
            } else {
                // A leftover marker from an abandoned add-role run must not
                // turn this new account's signup into one.
                await clearAddRole();
            }

            // The same number came back to a registration it left half-way: carry on where it stopped instead of at the role step.
            const before = await getSetupProgress();
            const stoppedAt: string | undefined = result.kind === 'existing_account' ? undefined : before?.resumeFrom;
            await saveSetupProgress('otp', { verified: true });
            if (stoppedAt) {
                await mergeSetupProgress({ lastStep: stoppedAt, resumeFrom: undefined });
                router.replace(getSetupResumeRoute({ ...before, lastStep: stoppedAt }) as never);
                return;
            }
            router.push('/setup/role-selection');
        } catch (err: unknown) {
            const authError = toAuthError(err);
            setAttemptsLeft(authError.attemptsRemaining ?? null);
            showError(t('setup.otp.invalidCodeTitle'), describeAuthError(err, t));
            setCode('');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResend = async () => {
        if (!requestId || !phoneE164 || resendIn > 0) return;

        setIsResending(true);
        try {
            const challenge = await resendOtp(requestId, phoneE164);
            setExpiresAtMs(Date.now() + challenge.expiresIn * 1000);
            setResendAtMs(Date.now() + challenge.resendAfter * 1000);
            setAttemptsLeft(null);
            // Cleared so the OS offers the new code instead of the stale one.
            setCode('');
            showError(t('setup.otp.codeSentTitle'), t('setup.otp.codeSentMessage'), undefined, true);
        } catch (err: unknown) {
            showError(t('setup.otp.errorTitle'), describeAuthError(err, t));
        } finally {
            setIsResending(false);
        }
    };

    return (
        <>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <KeyboardAvoidingView className="flex-1" style={{ backgroundColor: SETUP_BG }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingTop: 18, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        <SetupHeading
                            badge={t('setup.otp.badge')}
                            title={t('setup.otp.title')}
                            subtitle={t('setup.otp.subtitle', { phone: phoneNumber || t('setup.otp.yourPhone') })}
                        />

                        {/* 6-Digit Input Display with Native Autofill support */}
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => otpInputRef.current?.focus()}
                            className="flex-row justify-between relative"
                            style={{ marginBottom: 20 }}
                        >
                            {[0, 1, 2, 3, 4, 5].map((index) => (
                                <View
                                    key={index}
                                    className="items-center justify-center"
                                    style={{
                                        width: 48,
                                        height: 60,
                                        borderRadius: 14,
                                        backgroundColor: '#FFFFFF',
                                        borderWidth: code.length === index ? 2 : 1,
                                        borderColor: code.length === index ? '#1E56E3' : '#EEF2FA',
                                    }}
                                >
                                    <Text className="font-outfit-bold" style={{ fontSize: 26, lineHeight: 32, color: '#0B1530' }}>
                                        {code[index] || ''}
                                    </Text>
                                </View>
                            ))}

                            <TextInput
                                ref={otpInputRef}
                                value={code}
                                onChangeText={(text) => {
                                    const digits = text.replace(/\D/g, '').slice(0, 6);
                                    setCode(digits);
                                    if (digits.length === 6) {
                                        Keyboard.dismiss();
                                        handleSubmit(digits);
                                    }
                                }}
                                keyboardType="number-pad"
                                textContentType="oneTimeCode"
                                autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                                maxLength={6}
                                // Explicit because opacity:0 can make Android skip
                                // the view when it builds the autofill structure.
                                importantForAutofill="yes"
                                style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0 }}
                                caretHidden={true}
                                autoFocus
                            />
                        </TouchableOpacity>

                        {/* Status line: what the user needs to know before acting. */}
                        <View style={{ minHeight: 20, marginBottom: 12 }}>
                            {attemptsLeft !== null && attemptsLeft > 0 ? (
                                <Text className="text-center font-outfit-medium" style={{ ...TYPE.helper, color: '#DC2626' }}>
                                    {t('setup.otp.attemptsRemaining', { count: attemptsLeft })}
                                </Text>
                            ) : expiresIn > 0 ? (
                                <Text className="text-center font-outfit-medium" style={{ ...TYPE.helper, color: '#6B7490' }}>
                                    {t('setup.otp.codeExpiresIn', { time: formatCountdown(expiresIn) })}
                                </Text>
                            ) : (
                                <Text className="text-center font-outfit-medium" style={{ ...TYPE.helper, color: '#DC2626' }}>
                                    {t('setup.otp.codeExpired')}
                                </Text>
                            )}
                        </View>
                        <TouchableOpacity
                            style={{ marginBottom: 20, paddingVertical: 6 }}
                            onPress={handleResend}
                            disabled={isResending || resendIn > 0}
                        >
                            <Text
                                className="text-center font-outfit-semibold"
                                style={{ ...TYPE.body, color: resendIn > 0 ? '#9AA3B8' : '#1E56E3' }}
                            >
                                {isResending
                                    ? t('setup.otp.sending')
                                    : resendIn > 0
                                      ? t('setup.otp.resendIn', { seconds: resendIn })
                                      : t('setup.otp.resendCode')}
                            </Text>
                        </TouchableOpacity>

                        {/*
                          Mirror of the hint on the login screen, for the
                          opposite case: requesting a signup code for a number
                          that ALREADY has an account also returns the identical
                          response and sends nothing, so that user would wait
                          here forever too.

                          Always visible, since showing it conditionally would
                          reveal whether the number is registered — the exact
                          thing the identical response exists to hide.
                        */}
                        <View style={{ padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF2FA' }}>
                            <Text className="text-center font-outfit-semibold" style={{ ...TYPE.body, color: '#0B1530', marginBottom: 4 }}>
                                {t('setup.otp.noCodeHint')}
                            </Text>
                            <Text className="text-center font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490', marginBottom: 10 }}>
                                {t('setup.otp.noCodeHintDetail')}
                            </Text>
                            <TouchableOpacity onPress={() => router.replace('/login')} style={{ paddingVertical: 4 }}>
                                <Text className="text-center font-outfit-semibold" style={{ ...TYPE.body, color: '#1E56E3' }}>
                                    {t('setup.otp.logIn')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>

                    <SetupFooter
                        label={t('setup.otp.verify')}
                        onPress={() => { Keyboard.dismiss(); handleSubmit(); }}
                        loading={isVerifying}
                    />
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>

            {/* Error Modal */}
            <Modal supportedOrientations={MODAL_ORIENTATIONS}
                visible={errorModal.visible}
                transparent
                animationType="fade"
                onRequestClose={hideError}
            >
                <View className="flex-1 bg-black/40 justify-center items-center px-6">
                    <View className="bg-white rounded-3xl w-full p-8 items-center shadow-xl">
                        <View className="w-16 h-16 bg-red-50 rounded-full justify-center items-center mb-6">
                            <Ionicons name="alert-circle" size={32} color={errorModal.isSuccess ? '#10B981' : '#EF4444'} />
                        </View>

                        <Text className="font-outfit-bold text-center mb-2" style={{ ...TYPE.section, color: '#0B1530' }}>
                            {errorModal.title}
                        </Text>

                        <Text className="font-outfit-regular text-center mb-8" style={{ ...TYPE.body, color: '#6B7490' }}>
                            {errorModal.message}
                        </Text>

                        {errorModal.onAction && (
                            <TouchableOpacity
                                className="w-full items-center justify-center mb-3"
                                style={{ minHeight: 56, borderRadius: BUTTON_RADIUS, backgroundColor: '#1E56E3' }}
                                onPress={() => {
                                    hideError();
                                    errorModal.onAction?.();
                                }}
                            >
                                <Text className="text-white text-center font-outfit-bold" style={TYPE.button}>
                                    {errorModal.actionLabel}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            className="w-full items-center justify-center"
                            style={{ minHeight: 56, borderRadius: BUTTON_RADIUS, backgroundColor: '#E6EAF2' }}
                            onPress={hideError}
                        >
                            <Text className="text-center font-outfit-bold" style={{ ...TYPE.button, color: '#4A5470' }}>
                                {errorModal.onAction ? t('setup.otp.cancel') : t('setup.otp.gotIt')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
}
