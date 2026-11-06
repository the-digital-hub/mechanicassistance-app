import { SmsConsent } from '@/components/SmsConsent';
import { useUser } from '@/context/UserContext';
import { formatCountdown, useCountdown } from '@/hooks/useCountdown';
import { describeAuthError } from '@/lib/auth/describe';
import { toAuthError } from '@/lib/auth/errors';
import { resendOtp, toE164 } from '@/lib/auth/otp';
import { confirmPhoneChange, requestPhoneChange } from '@/lib/auth/phoneChange';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const CODE_LENGTH = 6;

/** `+15550101234` or `5550101234` → `(555) 010-1234`. */
function formatUsPhone(value: string): string {
    const digits = value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    if (!digits) return '';
    const area = digits.slice(0, 3);
    const prefix = digits.slice(3, 6);
    const line = digits.slice(6, 10);
    if (digits.length > 6) return `(${area}) ${prefix}-${line}`;
    if (digits.length > 3) return `(${area}) ${prefix}`;
    return `(${area}`;
}

/**
 * Adds a sign-in phone to the account, or replaces the one it has.
 *
 * The way in for accounts created with Google or Apple, which have no phone and
 * so could never sign in with a code. Two steps on one screen: the number, then
 * the code sent to it. Confirming swaps the session for the one the backend
 * returns (it signs out every other device) and puts the number into the user.
 */
export default function PhoneChangeScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { user, updateUser } = useUser();
    const hasPhone = !!user?.phone;

    const [step, setStep] = useState<'phone' | 'code'>('phone');
    const [digits, setDigits] = useState('');
    const [code, setCode] = useState('');
    const [isBusy, setIsBusy] = useState(false);
    const [isResending, setIsResending] = useState(false);

    // The raw E.164 is what the challenge was created for; verify and resend
    // must send exactly that. Deadlines are absolute so backgrounding is safe.
    const [phoneE164, setPhoneE164] = useState('');
    const [requestId, setRequestId] = useState<string | null>(null);
    const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
    const [resendAtMs, setResendAtMs] = useState<number | null>(null);
    const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
    const expiresIn = useCountdown(expiresAtMs);
    const resendIn = useCountdown(resendAtMs);

    const phoneInputRef = useRef<TextInput>(null);
    const codeInputRef = useRef<TextInput>(null);
    const inFlightRef = useRef(false);

    const [modal, setModal] = useState<{
        visible: boolean;
        title: string;
        message: string;
        isSuccess?: boolean;
        onClose?: () => void;
    }>({ visible: false, title: '', message: '' });

    const showModal = (title: string, message: string, opts?: { isSuccess?: boolean; onClose?: () => void }) =>
        setModal({ visible: true, title, message, ...opts });
    const closeModal = () => {
        const onClose = modal.onClose;
        setModal((prev) => ({ ...prev, visible: false, onClose: undefined }));
        onClose?.();
    };

    useEffect(() => {
        const ref = step === 'phone' ? phoneInputRef : codeInputRef;
        const timer = setTimeout(() => ref.current?.focus(), 150);
        return () => clearTimeout(timer);
    }, [step]);

    const startChallenge = (challenge: { requestId: string; expiresIn: number; resendAfter: number }) => {
        setRequestId(challenge.requestId);
        setExpiresAtMs(Date.now() + challenge.expiresIn * 1000);
        setResendAtMs(Date.now() + challenge.resendAfter * 1000);
        setAttemptsLeft(null);
        setCode('');
    };

    const handleSendCode = async () => {
        Keyboard.dismiss();
        if (digits.length !== 10 || inFlightRef.current) return;
        inFlightRef.current = true;
        setIsBusy(true);
        try {
            const fullPhone = toE164(digits);
            const challenge = await requestPhoneChange(fullPhone);
            setPhoneE164(fullPhone);
            startChallenge(challenge);
            setStep('code');
        } catch (error: unknown) {
            showModal(t('phoneChange.errorTitle'), describeAuthError(error, t));
        } finally {
            inFlightRef.current = false;
            setIsBusy(false);
        }
    };

    const handleConfirm = async (value: string = code) => {
        if (value.length < CODE_LENGTH || !requestId || !phoneE164 || inFlightRef.current) return;
        inFlightRef.current = true;
        setIsBusy(true);
        try {
            await confirmPhoneChange(requestId, phoneE164, value);
            // Local only: the backend already saved it, and users-service would
            // refuse a phone in a profile PATCH anyway.
            await updateUser({ phone: phoneE164 }, false);
            showModal(
                t('phoneChange.successTitle'),
                t('phoneChange.successMessage', { phone: `+1 ${formatUsPhone(phoneE164)}` }),
                { isSuccess: true, onClose: () => router.back() },
            );
        } catch (error: unknown) {
            const authError = toAuthError(error);
            setCode('');
            if (authError.code === 'already_registered') {
                // 409: the number went to another account. A new code would not help.
                showModal(t('phoneChange.numberTakenTitle'), t('phoneChange.numberTakenMessage'), {
                    onClose: () => setStep('phone'),
                });
                return;
            }
            setAttemptsLeft(authError.attemptsRemaining ?? null);
            showModal(t('phoneChange.invalidCodeTitle'), describeAuthError(error, t));
        } finally {
            inFlightRef.current = false;
            setIsBusy(false);
        }
    };

    const handleResend = async () => {
        if (!requestId || !phoneE164 || resendIn > 0) return;
        setIsResending(true);
        try {
            startChallenge(await resendOtp(requestId, phoneE164));
            showModal(t('phoneChange.codeSentTitle'), t('phoneChange.codeSentMessage'), { isSuccess: true });
        } catch (error: unknown) {
            showModal(t('phoneChange.errorTitle'), describeAuthError(error, t));
        } finally {
            setIsResending(false);
        }
    };

    const primaryButton = (label: string, onPress: () => void, enabled: boolean) => (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} disabled={!enabled || isBusy} className="mb-6">
            <LinearGradient
                colors={enabled ? ['#2B66F8', '#081E72'] : ['#B0C4FF', '#B0C4FF']}
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
                {isBusy ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <>
                        <Text className="text-white font-outfit-bold text-center mr-2">{label}</Text>
                        <ChevronRight size={20} color="white" />
                    </>
                )}
            </LinearGradient>
        </TouchableOpacity>
    );

    return (
        <KeyboardAvoidingView
            className="flex-1"
            style={{ backgroundColor: '#F6F8FC' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <ScrollView className="flex-1 px-6 pt-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Section Badge */}
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">{t('phoneChange.badge')}</Text>
                </View>

                {step === 'phone' ? (
                    <>
                        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
                            {hasPhone ? t('phoneChange.changeTitle') : t('phoneChange.addTitle')}
                        </Text>
                        <Text className="text-gray-500 font-outfit-regular text-base mb-2">{t('phoneChange.subtitle')}</Text>
                        {hasPhone && (
                            <Text className="text-gray-400 font-outfit-regular text-sm mb-6">
                                {t('phoneChange.current', { phone: `+1 ${formatUsPhone(user?.phone ?? '')}` })}
                            </Text>
                        )}

                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => phoneInputRef.current?.focus()}
                            className="flex-row items-center mt-6 mb-8 border-b-2 border-slate-200 pb-2"
                        >
                            <Text className="text-3xl font-outfit-bold text-[#0F172A] mr-4">+1</Text>
                            <TextInput
                                ref={phoneInputRef}
                                value={formatUsPhone(digits)}
                                onChangeText={(text) => setDigits(text.replace(/\D/g, '').slice(0, 10))}
                                keyboardType="phone-pad"
                                textContentType="telephoneNumber"
                                placeholder="(000) 000-0000"
                                placeholderTextColor="#E2E8F0"
                                maxLength={14}
                                className="text-3xl font-outfit-regular flex-1 text-gray-700"
                                style={{ paddingVertical: 0 }}
                                returnKeyType="done"
                                onSubmitEditing={handleSendCode}
                                testID="phone-change-number"
                            />
                        </TouchableOpacity>

                        <SmsConsent variant="light" className="mb-4" />

                        {primaryButton(t('phoneChange.sendCode'), handleSendCode, digits.length === 10)}
                    </>
                ) : (
                    <>
                        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('phoneChange.codeTitle')}</Text>
                        <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                            {t('phoneChange.codeSubtitle', { phone: `+1 ${formatUsPhone(phoneE164)}` })}
                        </Text>

                        {/* Code boxes over a hidden input, so OS autofill still works. */}
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => codeInputRef.current?.focus()}
                            className="flex-row justify-between mb-10 px-4 relative"
                        >
                            {Array.from({ length: CODE_LENGTH }, (_, index) => (
                                <View
                                    key={index}
                                    className={`w-10 border-b-2 items-center pb-2 ${code.length === index ? 'border-[#0047AB]' : 'border-slate-300'}`}
                                >
                                    <Text className="text-3xl font-outfit-bold text-[#0F172A]">{code[index] || ''}</Text>
                                </View>
                            ))}
                            <TextInput
                                ref={codeInputRef}
                                value={code}
                                onChangeText={(text) => {
                                    const next = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
                                    setCode(next);
                                    if (next.length === CODE_LENGTH) {
                                        Keyboard.dismiss();
                                        handleConfirm(next);
                                    }
                                }}
                                keyboardType="number-pad"
                                textContentType="oneTimeCode"
                                autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                                maxLength={CODE_LENGTH}
                                importantForAutofill="yes"
                                style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0 }}
                                caretHidden
                                testID="phone-change-code"
                            />
                        </TouchableOpacity>

                        {primaryButton(t('phoneChange.confirm'), () => handleConfirm(), code.length === CODE_LENGTH)}

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
                                <Text className="text-center font-outfit-medium text-red-600">{t('setup.otp.codeExpired')}</Text>
                            )}
                        </View>

                        <TouchableOpacity className="mb-4" onPress={handleResend} disabled={isResending || resendIn > 0}>
                            <Text className={`text-center font-outfit-medium ${resendIn > 0 ? 'text-slate-400' : 'text-[#0047AB]'}`}>
                                {isResending
                                    ? t('setup.otp.sending')
                                    : resendIn > 0
                                      ? t('setup.otp.resendIn', { seconds: resendIn })
                                      : t('setup.otp.resendCode')}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity className="mb-6" onPress={() => { setCode(''); setStep('phone'); }}>
                            <Text className="text-center font-outfit-semibold text-[#0047AB]">{t('phoneChange.changeNumber')}</Text>
                        </TouchableOpacity>

                        {/*
                          Always shown: requesting a code for a number that already
                          belongs to another account answers identically and sends
                          nothing, and showing this only then would reveal it.
                        */}
                        <Text className="text-center font-outfit-regular text-sm text-slate-500 border-t border-slate-200 pt-5">
                            {t('phoneChange.noCodeHint')}
                        </Text>
                    </>
                )}
            </ScrollView>

            <Modal visible={modal.visible} transparent animationType="fade" onRequestClose={closeModal}>
                <View className="flex-1 bg-black/40 justify-center items-center px-6">
                    <View className="bg-white rounded-3xl w-full p-8 items-center shadow-xl">
                        <View className={`w-16 h-16 rounded-full justify-center items-center mb-6 ${modal.isSuccess ? 'bg-green-50' : 'bg-red-50'}`}>
                            <Ionicons
                                name={modal.isSuccess ? 'checkmark-circle' : 'alert-circle'}
                                size={32}
                                color={modal.isSuccess ? '#10B981' : '#EF4444'}
                            />
                        </View>
                        <Text className="text-xl font-outfit-bold text-[#0F172A] mb-2 text-center">{modal.title}</Text>
                        <Text className="text-base font-outfit-regular text-slate-500 text-center mb-8">{modal.message}</Text>
                        <TouchableOpacity className="bg-blue-700 w-full py-4 rounded-xl shadow-sm" onPress={closeModal}>
                            <Text className="text-white text-center font-outfit-bold text-lg">{t('phoneChange.gotIt')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}
