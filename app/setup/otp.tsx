import { NumericKeypad } from '@/components/ui/Keypad';
import { describeAuthError } from '@/lib/auth/describe';
import { toAuthError } from '@/lib/auth/errors';
import { resendOtp, verifyOtp } from '@/lib/auth/otp';
import { formatCountdown, useCountdown } from '@/hooks/useCountdown';
import { clearSetupProgress, getSetupProgress, saveSetupProgress } from '@/lib/storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { ActivityIndicator, Keyboard, Modal, Platform, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function OTPScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const [code, setCode] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [showKeypad, setShowKeypad] = useState(true);

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

    const handleKeyPress = (key: string) => {
        if (code.length < 6) {
            setCode(prev => prev + key);
        }
    };

    const handleDelete = () => {
        setCode(prev => prev.slice(0, -1));
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
                router.replace('/(tabs)/dashboard');
                return;
            }

            await saveSetupProgress('otp', { verified: true });
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
            <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setShowKeypad(false); }} accessible={false}>
                <View className="flex-1 justify-between" style={{ backgroundColor: '#F6F8FC' }}>
                    <View className="px-6 pt-6 flex-1">
                        {/* Section Badge */}
                        <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                            <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                            <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                                {t('setup.otp.badge')}
                            </Text>
                        </View>

                        {/* Title */}
                        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
                            {t('setup.otp.title')}
                        </Text>

                        {/* Subtitle */}
                        <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                            {t('setup.otp.subtitle', { phone: phoneNumber || t('setup.otp.yourPhone') })}
                        </Text>

                        {/* 6-Digit Input Display with Native Autofill support */}
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => { setShowKeypad(true); otpInputRef.current?.focus(); }}
                            className="flex-row justify-between mb-12 px-4 relative"
                        >
                            {[0, 1, 2, 3, 4, 5].map((index) => (
                                <View
                                    key={index}
                                    className={`w-10 border-b-2 items-center pb-2 ${code.length === index ? 'border-[#0047AB]' : 'border-slate-300'}`}
                                >
                                    <Text className="text-3xl font-outfit-bold text-[#0F172A]">
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
                            />
                        </TouchableOpacity>

                        <View className="mb-4">
                            <TouchableOpacity
                                onPress={() => { Keyboard.dismiss(); handleSubmit(); }}
                                activeOpacity={0.8}
                                disabled={isVerifying}
                                className="mb-6"
                            >
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
                                    {isVerifying ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <Text className="text-white font-outfit-bold text-center mr-2">{t('setup.otp.verify')}</Text>
                                            <ChevronRight size={20} color="white" />
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                            {/* Status line: what the user needs to know before acting. */}
                            <View className="mb-4 min-h-[20px]">
                                {attemptsLeft !== null && attemptsLeft > 0 ? (
                                    <Text className="text-center font-outfit-medium text-red-600">
                                        {t('setup.otp.attemptsRemaining', { count: attemptsLeft })}
                                    </Text>
                                ) : expiresIn > 0 ? (
                                    <Text className="text-center font-outfit-medium text-slate-500">
                                        {t('setup.otp.codeExpiresIn', { time: formatCountdown(expiresIn) })}
                                    </Text>
                                ) : (
                                    <Text className="text-center font-outfit-medium text-red-600">
                                        {t('setup.otp.codeExpired')}
                                    </Text>
                                )}
                            </View>
                            <TouchableOpacity
                                className="mb-6"
                                onPress={handleResend}
                                disabled={isResending || resendIn > 0}
                            >
                                <Text
                                    className={`text-center font-outfit-medium ${
                                        resendIn > 0 ? 'text-slate-400' : 'text-[#0047AB]'
                                    }`}
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
                            <View className="border-t border-slate-200 pt-5 mb-6">
                                <Text className="text-center font-outfit-semibold text-[#0F172A] mb-1">
                                    {t('setup.otp.noCodeHint')}
                                </Text>
                                <Text className="text-center font-outfit-regular text-sm text-slate-500 mb-3">
                                    {t('setup.otp.noCodeHintDetail')}
                                </Text>
                                <TouchableOpacity onPress={() => router.replace('/login')}>
                                    <Text className="text-center font-outfit-semibold text-[#0047AB]">
                                        {t('setup.otp.logIn')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {showKeypad && (
                        <NumericKeypad
                            onKeyPress={handleKeyPress}
                            onDelete={handleDelete}
                        />
                    )}
                </View>
            </TouchableWithoutFeedback>

            {/* Error Modal */}
            <Modal
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

                        <Text className="text-xl font-outfit-bold text-[#0F172A] mb-2 text-center">
                            {errorModal.title}
                        </Text>

                        <Text className="text-base font-outfit-regular text-slate-500 text-center mb-8">
                            {errorModal.message}
                        </Text>

                        {errorModal.onAction && (
                            <TouchableOpacity
                                className="bg-blue-700 w-full py-4 rounded-xl shadow-sm active:opacity-90 mb-3"
                                onPress={() => {
                                    hideError();
                                    errorModal.onAction?.();
                                }}
                            >
                                <Text className="text-white text-center font-outfit-bold text-lg">
                                    {errorModal.actionLabel}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            className="bg-slate-100 w-full py-4 rounded-xl active:opacity-90"
                            onPress={hideError}
                        >
                            <Text className="text-slate-700 text-center font-outfit-bold text-lg">
                                {errorModal.onAction ? t('setup.otp.cancel') : t('setup.otp.gotIt')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
}
